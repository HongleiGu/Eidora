import { z } from 'zod';
import { createSsrClient } from '../supabase/ssr';
import type { Relation } from '../types';

// ── Schema ────────────────────────────────────────────────────────────────────

const addRelationSchema = z.object({
  relationType: z.string().min(1),
  attitude: z.number().int().min(-100).max(100).optional(),
  twoWay: z.boolean().default(false),
  note: z.string().optional(),
});

export type AddRelationInput = z.infer<typeof addRelationSchema>;

// ── Parser ────────────────────────────────────────────────────────────────────

function fromRow(row: Record<string, unknown>): Relation {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    sourceSlug: row.source_slug as string,
    targetSlug: row.target_slug as string,
    relationType: row.relation_type as string,
    attitude: row.attitude != null ? (row.attitude as number) : undefined,
    twoWay: row.two_way as boolean,
    note: row.note != null ? (row.note as string) : undefined,
    createdAt: row.created_at as string,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/** All relations where sourceSlug is the origin. */
export async function getRelations(projectId: string, sourceSlug: string): Promise<Relation[]> {
  const db = await createSsrClient();
  const { data, error } = await db
    .from('relations')
    .select()
    .eq('project_id', projectId)
    .eq('source_slug', sourceSlug)
    .order('relation_type');
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

/** All relations pointing at targetSlug from any source. */
export async function getRelationsTo(projectId: string, targetSlug: string): Promise<Relation[]> {
  const db = await createSsrClient();
  const { data, error } = await db
    .from('relations')
    .select()
    .eq('project_id', projectId)
    .eq('target_slug', targetSlug)
    .order('relation_type');
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

/**
 * All relations for a slug in either direction.
 * Deduplicates two_way pairs so they appear once with the original direction.
 */
export async function getAllRelations(projectId: string, slug: string): Promise<Relation[]> {
  const [outgoing, incoming] = await Promise.all([
    getRelations(projectId, slug),
    getRelationsTo(projectId, slug),
  ]);

  const seen = new Set(outgoing.map((r) => r.id));
  const incomingNew = incoming.filter((r) => !seen.has(r.id));

  return [...outgoing, ...incomingNew];
}

/**
 * Upsert a relation. If twoWay is true, also upserts the reverse.
 * Uses relationType as part of the unique key, so the same pair can have
 * multiple relation types (e.g. "suspects" and "works with").
 */
export async function addRelation(
  projectId: string,
  sourceSlug: string,
  targetSlug: string,
  raw: AddRelationInput,
): Promise<Relation> {
  const input = addRelationSchema.parse(raw);
  const db = await createSsrClient();

  const row = {
    project_id: projectId,
    source_slug: sourceSlug,
    target_slug: targetSlug,
    relation_type: input.relationType,
    attitude: input.attitude ?? null,
    two_way: input.twoWay,
    note: input.note ?? null,
  };

  const { data, error } = await db
    .from('relations')
    .upsert(row, { onConflict: 'project_id,source_slug,target_slug,relation_type' })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (input.twoWay) {
    await db.from('relations').upsert(
      { ...row, source_slug: targetSlug, target_slug: sourceSlug },
      { onConflict: 'project_id,source_slug,target_slug,relation_type' },
    );
  }

  return fromRow(data);
}

export async function removeRelation(
  projectId: string,
  sourceSlug: string,
  targetSlug: string,
  relationType: string,
): Promise<void> {
  const db = await createSsrClient();
  const { error } = await db
    .from('relations')
    .delete()
    .eq('project_id', projectId)
    .eq('source_slug', sourceSlug)
    .eq('target_slug', targetSlug)
    .eq('relation_type', relationType);
  if (error) throw new Error(error.message);
}
