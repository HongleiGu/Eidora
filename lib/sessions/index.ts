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
