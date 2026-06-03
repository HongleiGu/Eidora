/**
 * Play turn loop (EID-102). Orchestrates a single GM turn:
 * player message → assemble GM context → AI → narration + actions → apply → log.
 * Transport-agnostic: reads/writes the session log; the UI/route renders from it.
 */
import { createSsrClient } from "../supabase/ssr";
import { complete, stream } from "../ai";
import type { Message, Provider } from "../ai";
import {
  getSession, getFlags, listRevealed, listOverrides, getLog, appendLog,
} from "../sessions";
import { buildGmSystemPrompt, parseGmResponse, parseActionsText, ACTIONS_SENTINEL, type GmEntity, type GmScenario, type GmState } from "./gm";
import { applyActions, type Action, type AppliedAction } from "./directives";

export type { Action } from "./directives";

/** Resolve loose refs ("@slug", bare "slug") to canonical "type:slug" via the cast. */
function normalizeActions(actions: Action[], cast: GmEntity[]): Action[] {
  const bySlug = new Map<string, string>();
  for (const e of cast) bySlug.set(e.slug, `${e.entityType}:${e.slug}`);
  const fix = (ref: string): string => {
    const s = ref.trim().replace(/^@/, "");
    return s.includes(":") ? s : (bySlug.get(s) ?? s);
  };
  return actions.map((a) => {
    if (a.type === "reveal" || a.type === "unreveal") return { ...a, target: fix(a.target) };
    if (a.type === "override") return { ...a, entity: fix(a.entity) };
    return a;
  });
}

interface EntityRow {
  entity_type: string; slug: string; name: string;
  content: string | null; secrets: string | null;
  front_matter: Record<string, unknown> | null;
}

const HISTORY_LIMIT = 24;

async function loadContext(sessionId: string) {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Session not found");

  const db = await createSsrClient();
  const { data: rows } = await db
    .from("entities")
    .select("entity_type, slug, name, content, secrets, front_matter")
    .eq("project_id", session.projectId);
  const entities = (rows ?? []) as EntityRow[];

  const scenarioRow = entities.find((e) => e.entity_type === "scenario" && e.slug === session.scenarioSlug);
  if (!scenarioRow) throw new Error("Scenario not found for this session");

  const sfm = (scenarioRow.front_matter ?? {}) as Record<string, unknown>;
  const game = (sfm.game ?? {}) as Record<string, unknown>;
  const scenario: GmScenario = {
    name: scenarioRow.name,
    premise: typeof game.premise === "string" ? game.premise : (scenarioRow.content ?? ""),
    solution: scenarioRow.secrets ?? "",
    gameType: typeof sfm.gameType === "string" ? sfm.gameType : "story",
    bible: typeof sfm.bible === "string" ? sfm.bible : undefined,
  };

  // Cast = entities listed in scenario.cast; fall back to all non-scenario entities.
  const cast = (sfm.cast ?? {}) as Record<string, unknown>;
  const castKeys = new Set<string>();
  for (const [group, slugs] of Object.entries(cast)) {
    const type = group.replace(/s$/, ""); // characters → character
    if (Array.isArray(slugs)) for (const s of slugs) castKeys.add(`${type}:${s}`);
  }

  const revealed = await listRevealed(sessionId);

  const toGmEntity = (e: EntityRow): GmEntity => ({
    entityType: e.entity_type,
    slug: e.slug,
    name: e.name,
    content: e.content ?? "",
    secrets: e.secrets ?? "",
    frontMatter: (e.front_matter ?? {}) as Record<string, unknown>,
    revealed: revealed.has(`${e.entity_type}:${e.slug}`),
  });

  const castEntities = (castKeys.size > 0
    ? entities.filter((e) => castKeys.has(`${e.entity_type}:${e.slug}`))
    : entities.filter((e) => e.entity_type !== "scenario")
  ).map(toGmEntity);

  const [flags, overrides] = await Promise.all([getFlags(sessionId), listOverrides(sessionId)]);
  const state: GmState = {
    flags,
    overrides: overrides.map((o) => ({ entity: `${o.entityType}:${o.slug}`, set: o.overrides })),
  };

  return { session, scenario, castEntities, state };
}

export interface TurnResult {
  narration: string;
  actions: AppliedAction[];
  ended: boolean;
  outcome?: string;
}

/** Append the player's move, assemble context, and build the prompt+messages. */
async function prepareTurn(sessionId: string, playerText: string) {
  await appendLog(sessionId, "player", playerText);
  const { scenario, castEntities, state } = await loadContext(sessionId);
  const system = buildGmSystemPrompt(scenario, castEntities, state);
  const log = await getLog(sessionId);
  const messages: Message[] = log
    .slice(-HISTORY_LIMIT)
    .filter((e) => e.role === "player" || e.role === "agent" || e.role === "narrator")
    .map((e) => ({ role: e.role === "player" ? "user" : "assistant", content: e.content }));
  return { system, messages, castEntities };
}

/** Apply a GM reply (narration + actions) and record it. Shared by both paths. */
async function commitTurn(
  sessionId: string, narration: string, actions: Action[], castEntities: GmEntity[],
): Promise<TurnResult> {
  const applied = await applyActions(sessionId, normalizeActions(actions, castEntities));
  await appendLog(sessionId, "agent", narration);
  const endAction = actions.find((a) => a.type === "end");
  return {
    narration,
    actions: applied,
    ended: !!endAction,
    outcome: endAction?.type === "end" ? endAction.outcome : undefined,
  };
}

export async function runTurn(
  sessionId: string,
  playerText: string,
  opts: { provider?: Provider; model?: string } = {},
): Promise<TurnResult> {
  const { system, messages, castEntities } = await prepareTurn(sessionId, playerText);
  const result = await complete({ provider: opts.provider, model: opts.model, system, messages, temperature: 0.9, maxTokens: 1500 });
  const { narration, actions } = parseGmResponse(result.text);
  return commitTurn(sessionId, narration, actions, castEntities);
}

export type TurnEvent =
  | { type: "delta"; text: string }
  | { type: "done"; result: TurnResult };

/**
 * Streaming turn: emits narration deltas (everything before ===ACTIONS===),
 * then applies the actions parsed from after the marker and emits the result.
 */
export async function* runTurnStream(
  sessionId: string,
  playerText: string,
  opts: { provider?: Provider; model?: string } = {},
): AsyncGenerator<TurnEvent> {
  const { system, messages, castEntities } = await prepareTurn(sessionId, playerText);

  let full = "";
  let emitted = 0;
  const holdback = ACTIONS_SENTINEL.length; // avoid leaking a partial marker

  for await (const chunk of stream({ provider: opts.provider, model: opts.model, system, messages, temperature: 0.9, maxTokens: 1500 })) {
    if (chunk.done) break;
    full += chunk.delta;
    const idx = full.indexOf(ACTIONS_SENTINEL);
    const narr = idx === -1 ? full : full.slice(0, idx);
    const safeLen = idx === -1 ? Math.max(0, narr.length - holdback) : narr.length;
    if (safeLen > emitted) {
      yield { type: "delta", text: narr.slice(emitted, safeLen) };
      emitted = safeLen;
    }
  }

  // Flush any remaining narration, then parse + apply actions.
  const idx = full.indexOf(ACTIONS_SENTINEL);
  const narration = (idx === -1 ? full : full.slice(0, idx)).trim();
  if (narration.length > emitted) yield { type: "delta", text: narration.slice(emitted) };

  const actions = idx === -1 ? [] : parseActionsText(full.slice(idx + ACTIONS_SENTINEL.length));
  const result = await commitTurn(sessionId, narration, actions, castEntities);
  yield { type: "done", result };
}

export { loadContext };

export interface DiscoveredEntity {
  type: string; slug: string; name: string; image?: string; content?: string;
}

/**
 * Player-facing "discovered" list: entities revealed this session that are
 * public. Returns only player-safe fields (no secrets).
 */
export async function getDiscovered(sessionId: string): Promise<DiscoveredEntity[]> {
  const session = await getSession(sessionId);
  if (!session) return [];

  const revealed = await listRevealed(sessionId); // set of "type:slug"
  if (revealed.size === 0) return [];

  const db = await createSsrClient();
  const { data: rows } = await db
    .from("entities")
    .select("entity_type, slug, name, content, visibility, front_matter")
    .eq("project_id", session.projectId)
    .eq("visibility", "public");

  return (rows ?? [])
    .filter((r) => revealed.has(`${r.entity_type}:${r.slug}`))
    .map((r) => {
      const fm = (r.front_matter ?? {}) as Record<string, unknown>;
      return {
        type: r.entity_type as string,
        slug: r.slug as string,
        name: r.name as string,
        image: typeof fm.image === "string" ? fm.image : undefined,
        content: (r.content as string | null) ?? undefined,
      };
    });
}
