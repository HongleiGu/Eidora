import { createSsrClient } from '../supabase/ssr';
import { getEntity } from '../entities';
import type { Entity, EntityType, Session, SessionLogEntry, LogRole } from '../types';

// ── Parsers ───────────────────────────────────────────────────────────────────

function sessionFromRow(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    scenarioSlug: row.scenario_slug as string,
    name: row.name as string,
    player: row.player != null ? (row.player as string) : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function logFromRow(row: Record<string, unknown>): SessionLogEntry {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    role: row.role as LogRole,
    content: row.content as string,
    createdAt: row.created_at as string,
  };
}

// ── Session CRUD ──────────────────────────────────────────────────────────────

export async function createSession(
  projectId: string,
  scenarioSlug: string,
  name: string,
  player?: string,
): Promise<Session> {
  const db = await createSsrClient();
  const { data, error } = await db
    .from('sessions')
    .insert({ project_id: projectId, scenario_slug: scenarioSlug, name, player: player ?? null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return sessionFromRow(data);
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const db = await createSsrClient();
  const { data, error } = await db
    .from('sessions').select().eq('id', sessionId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? sessionFromRow(data) : null;
}

export async function listSessions(projectId: string): Promise<Session[]> {
  const db = await createSsrClient();
  const { data, error } = await db
    .from('sessions').select().eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(sessionFromRow);
}

// ── State overlay ─────────────────────────────────────────────────────────────

/**
 * Load an entity and shallow-merge session overrides on top.
 * Base entity files are never mutated; overrides are stored in session_state.
 */
export async function getMergedEntity(
  projectId: string,
  sessionId: string,
  entityType: EntityType,
  slug: string,
): Promise<Entity | null> {
  const db = await createSsrClient();

  const [entity, { data: stateRow, error }] = await Promise.all([
    getEntity(projectId, entityType, slug),
    db.from('session_state')
      .select('overrides')
      .eq('session_id', sessionId)
      .eq('entity_type', entityType)
      .eq('entity_slug', slug)
      .maybeSingle(),
  ]);

  if (error) throw new Error(error.message);
  if (!entity) return null;
  if (!stateRow?.overrides) return entity;

  return { ...entity, ...(stateRow.overrides as Partial<Entity>) } as Entity;
}

export async function setEntityOverride(
  sessionId: string,
  entityType: EntityType,
  slug: string,
  overrides: Partial<Entity>,
): Promise<void> {
  const db = await createSsrClient();
  const { error } = await db.from('session_state').upsert(
    { session_id: sessionId, entity_type: entityType, entity_slug: slug, overrides },
    { onConflict: 'session_id,entity_type,entity_slug' },
  );
  if (error) throw new Error(error.message);
}

export interface EntityOverrideRow {
  entityType: EntityType;
  slug: string;
  overrides: Record<string, unknown>;
}

export async function listOverrides(sessionId: string): Promise<EntityOverrideRow[]> {
  const db = await createSsrClient();
  const { data, error } = await db
    .from('session_state')
    .select('entity_type, entity_slug, overrides')
    .eq('session_id', sessionId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    entityType: r.entity_type as EntityType,
    slug: r.entity_slug as string,
    overrides: (r.overrides ?? {}) as Record<string, unknown>,
  }));
}

// ── Flags ─────────────────────────────────────────────────────────────────────

export async function setFlag(sessionId: string, key: string, value: string): Promise<void> {
  const db = await createSsrClient();
  const { error } = await db
    .from('session_flags')
    .upsert({ session_id: sessionId, key, value }, { onConflict: 'session_id,key' });
  if (error) throw new Error(error.message);
}

export async function getFlag(sessionId: string, key: string): Promise<string | null> {
  const db = await createSsrClient();
  const { data, error } = await db
    .from('session_flags').select('value').eq('session_id', sessionId).eq('key', key).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value ?? null;
}

export async function getFlags(sessionId: string): Promise<Record<string, string>> {
  const db = await createSsrClient();
  const { data, error } = await db
    .from('session_flags').select('key,value').eq('session_id', sessionId);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

// ── Log ───────────────────────────────────────────────────────────────────────

export async function appendLog(
  sessionId: string,
  role: LogRole,
  content: string,
): Promise<SessionLogEntry> {
  const db = await createSsrClient();
  const { data, error } = await db
    .from('session_log')
    .insert({ session_id: sessionId, role, content })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return logFromRow(data);
}

export async function getLog(sessionId: string): Promise<SessionLogEntry[]> {
  const db = await createSsrClient();
  const { data, error } = await db
    .from('session_log').select().eq('session_id', sessionId).order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map(logFromRow);
}

// ── Reveal system (EID-93) ──────────────────────────────────────────────────
// A "secret" entity (front_matter.reveal === 'secret') stays hidden from players
// until revealed during a session. Reveal is manual — a human GM or an AI GM
// calls revealEntity. Revealed-state is stored as a session flag so it's
// per-playthrough and never mutates the base entity.

function revealKey(entityType: EntityType, slug: string): string {
  return `reveal:${entityType}:${slug}`;
}

export async function revealEntity(sessionId: string, entityType: EntityType, slug: string): Promise<void> {
  await setFlag(sessionId, revealKey(entityType, slug), '1');
}

export async function unrevealEntity(sessionId: string, entityType: EntityType, slug: string): Promise<void> {
  const db = await createSsrClient();
  const { error } = await db
    .from('session_flags')
    .delete()
    .eq('session_id', sessionId)
    .eq('key', revealKey(entityType, slug));
  if (error) throw new Error(error.message);
}

export async function isRevealed(sessionId: string, entityType: EntityType, slug: string): Promise<boolean> {
  return (await getFlag(sessionId, revealKey(entityType, slug))) != null;
}

/** All reveal flag keys set in a session, as a Set of "type:slug". */
export async function listRevealed(sessionId: string): Promise<Set<string>> {
  const flags = await getFlags(sessionId);
  const out = new Set<string>();
  for (const key of Object.keys(flags)) {
    if (key.startsWith('reveal:')) out.add(key.slice('reveal:'.length));
  }
  return out;
}

/**
 * Whether an entity is visible to a player right now, given the set of revealed
 * "type:slug" keys for the current session. gm_only/author_only never reach
 * players; a public secret is visible only once revealed.
 */
export function visibleToPlayer(
  entity: Pick<Entity, 'entityType' | 'slug' | 'visibility'> & { reveal?: string },
  revealedKeys: Set<string>,
): boolean {
  if (entity.visibility !== 'public') return false;
  if (entity.reveal === 'secret') return revealedKeys.has(`${entity.entityType}:${entity.slug}`);
  return true;
}
