import { z } from 'zod';
import { createSsrClient } from '../supabase/ssr';
import type { Project, World, WorldTimeline, Visibility } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function projectFromRow(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    schemaVersion: row.schema_version as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function worldFromRow(row: Record<string, unknown>): World {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    slug: row.slug as string,
    name: row.name as string,
    era: row.era != null ? (row.era as string) : undefined,
    genre: (row.genre as string[]) ?? [],
    description: row.description != null ? (row.description as string) : undefined,
    timelines: (row.timelines as WorldTimeline[]) ?? [],
    content: (row.content as string) ?? '',
    visibility: (row.visibility as Visibility) ?? 'public',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const createWorldSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(1),
  era: z.string().optional(),
  genre: z.array(z.string()).default([]),
  description: z.string().optional(),
  timelines: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
  })).default([]),
  content: z.string().default(''),
  visibility: z.enum(['public', 'gm_only', 'author_only']).default('public'),
});

export type CreateWorldInput = z.infer<typeof createWorldSchema>;
export type UpdateWorldInput = Partial<Omit<CreateWorldInput, 'slug'>>;

// ── Project CRUD ──────────────────────────────────────────────────────────────

export async function createProject(
  name: string,
  ownerId: string,
  slug?: string,
): Promise<Project> {
  const db = await createSsrClient();
  const { data, error } = await db
    .from('projects')
    .insert({ slug: slug ?? slugify(name), name, owner_id: ownerId, kind: 'template' })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Make the creator an admin member.
  const { error: memberErr } = await db
    .from('project_members')
    .insert({ project_id: data.id, user_id: ownerId, role: 'admin' });
  if (memberErr) throw new Error(memberErr.message);

  return projectFromRow(data);
}

export async function getProject(slug: string): Promise<Project | null> {
  const db = await createSsrClient();
  const { data, error } = await db
    .from('projects').select().eq('slug', slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? projectFromRow(data) : null;
}

/**
 * Fork a template into a new group-owned campaign (deep copy via the
 * fork_template RPC). Returns the new campaign's slug.
 */
export async function forkTemplate(templateId: string, newName: string): Promise<string> {
  const db = await createSsrClient();
  const { data, error } = await db.rpc('fork_template', {
    p_template_id: templateId,
    p_new_name: newName,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function listProjects(): Promise<Project[]> {
  const db = await createSsrClient();
  const { data, error } = await db.from('projects').select().order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map(projectFromRow);
}

export async function deleteProject(slug: string): Promise<void> {
  const db = await createSsrClient();
  const { error } = await db.from('projects').delete().eq('slug', slug);
  if (error) throw new Error(error.message);
}

// ── World CRUD ────────────────────────────────────────────────────────────────

export async function createWorld(projectId: string, raw: CreateWorldInput): Promise<World> {
  const input = createWorldSchema.parse(raw);
  const db = await createSsrClient();
  const { data, error } = await db
    .from('worlds')
    .insert({
      project_id: projectId,
      slug: input.slug ?? slugify(input.name),
      name: input.name,
      era: input.era ?? null,
      genre: input.genre,
      description: input.description ?? null,
      timelines: input.timelines,
      content: input.content,
      visibility: input.visibility,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return worldFromRow(data);
}

export async function getWorld(projectId: string): Promise<World | null> {
  const db = await createSsrClient();
  const { data, error } = await db
    .from('worlds').select().eq('project_id', projectId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? worldFromRow(data) : null;
}

export async function updateWorld(projectId: string, input: UpdateWorldInput): Promise<World> {
  const db = await createSsrClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.era !== undefined) patch.era = input.era;
  if (input.genre !== undefined) patch.genre = input.genre;
  if (input.description !== undefined) patch.description = input.description;
  if (input.timelines !== undefined) patch.timelines = input.timelines;
  if (input.content !== undefined) patch.content = input.content;
  if (input.visibility !== undefined) patch.visibility = input.visibility;

  const { data, error } = await db
    .from('worlds').update(patch).eq('project_id', projectId).select().single();
  if (error) throw new Error(error.message);
  return worldFromRow(data);
}
