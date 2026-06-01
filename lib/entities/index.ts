import { createSsrClient } from '../supabase/ssr';
import { fromRow } from './parser';
import { createEntitySchema, updateEntitySchema, entityFiltersSchema } from './schemas';
import type { Entity, EntityType, Visibility } from '../types';
import type { CreateEntityInput, UpdateEntityInput, EntityFilters } from './schemas';

export type { CreateEntityInput, UpdateEntityInput, EntityFilters };
export type ReadContext = 'player' | 'gm' | 'author';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function applyContext(entity: Entity, context: ReadContext): Entity | null {
  if (context === 'author') return entity;
  if (context === 'gm' && entity.visibility === 'author_only') return null;
  if (context === 'player' && entity.visibility !== 'public') return null;

  if (context === 'player') {
    const filtered = { ...entity, secrets: '' };
    if ('gameMeta' in filtered && filtered.gameMeta) {
      const { secrets: _s, ...rest } = filtered.gameMeta as Record<string, unknown>;
      (filtered as Record<string, unknown>).gameMeta = rest;
    }
    return filtered as Entity;
  }

  return entity;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createEntity(
  projectId: string,
  entityType: EntityType,
  raw: CreateEntityInput,
): Promise<Entity> {
  const input = createEntitySchema.parse(raw);
  const db = await createSsrClient();

  const { data, error } = await db
    .from('entities')
    .insert({
      project_id: projectId,
      entity_type: entityType,
      slug: input.slug ?? slugify(input.name),
      name: input.name,
      visibility: input.visibility,
      content: input.content,
      secrets: input.secrets,
      front_matter: input.frontMatter,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return fromRow(data);
}

export async function getEntity(
  projectId: string,
  entityType: EntityType,
  slug: string,
  context: ReadContext = 'author',
): Promise<Entity | null> {
  const db = await createSsrClient();

  const { data, error } = await db
    .from('entities')
    .select()
    .eq('project_id', projectId)
    .eq('entity_type', entityType)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return applyContext(fromRow(data), context);
}

export async function updateEntity(
  projectId: string,
  entityType: EntityType,
  slug: string,
  raw: UpdateEntityInput,
): Promise<Entity> {
  const input = updateEntitySchema.parse(raw);
  const db = await createSsrClient();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.content !== undefined) patch.content = input.content;
  if (input.secrets !== undefined) patch.secrets = input.secrets;
  if (input.frontMatter !== undefined) patch.front_matter = input.frontMatter;

  const { data, error } = await db
    .from('entities')
    .update(patch)
    .eq('project_id', projectId)
    .eq('entity_type', entityType)
    .eq('slug', slug)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return fromRow(data);
}

export async function deleteEntity(
  projectId: string,
  entityType: EntityType,
  slug: string,
): Promise<void> {
  const db = await createSsrClient();

  const { error } = await db
    .from('entities')
    .delete()
    .eq('project_id', projectId)
    .eq('entity_type', entityType)
    .eq('slug', slug);

  if (error) throw new Error(error.message);
}

/**
 * List entities of a type, omitting content/secrets for performance.
 * Full content is available via getEntity().
 */
export async function listEntities(
  projectId: string,
  entityType: EntityType,
  rawFilters?: EntityFilters,
  context: ReadContext = 'author',
): Promise<Entity[]> {
  const filters = rawFilters ? entityFiltersSchema.parse(rawFilters) : {};
  const db = await createSsrClient();

  let query = db
    .from('entities')
    .select('id,project_id,entity_type,slug,name,visibility,front_matter,created_at,updated_at')
    .eq('project_id', projectId)
    .eq('entity_type', entityType)
    .order('name');

  if (filters.search) query = query.ilike('name', `%${filters.search}%`);

  // Pre-filter by visibility at DB level when possible
  if (context === 'player') query = query.eq('visibility', 'public' as Visibility);
  else if (context === 'gm') query = query.neq('visibility', 'author_only' as Visibility);
  else if (filters.visibility) query = query.eq('visibility', filters.visibility);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) =>
    fromRow({ ...row, content: null, secrets: null }),
  ) as Entity[];
}
