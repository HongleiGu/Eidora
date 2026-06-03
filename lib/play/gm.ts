/**
 * GM context assembler (EID-102). Pure functions — no DB — so they're easy to
 * test. The orchestrator (index.ts) loads data and feeds it here.
 */
import { parseActions, type Action } from "./directives";

export interface GmScenario {
  name: string;
  premise: string;
  solution: string;     // GM-only truth (from the scenario's secrets)
  gameType: string;
  bible?: string;       // canonical ground truth (EID-114) — fixed fact
}

export interface GmEntity {
  entityType: string;
  slug: string;
  name: string;
  content: string;
  secrets: string;
  frontMatter: Record<string, unknown>;
  revealed: boolean;    // already revealed to players this session?
}

export interface GmState {
  flags: Record<string, string>;
  overrides: { entity: string; set: Record<string, unknown> }[];
}

const RUN_GUIDANCE: Record<string, string> = {
  detective: "Let the player investigate freely — describe scenes, answer questions, role-play NPCs. Drop clues when they look in the right place; never hand them the answer. Accept an accusation and resolve it against the solution.",
  turtle_soup: "This is a lateral-thinking puzzle. The player asks yes/no questions about the strange situation. Answer ONLY 'Yes', 'No', or 'Irrelevant' (with a tiny flourish). When they correctly reconstruct the full truth, confirm and end.",
  coc: "Cosmic horror. Build dread slowly. Gate the worst truths behind investigation. Sanity-shaking reveals should cost something. Stay ominous and restrained.",
  story: "Collaborative narrative — no win/lose. Follow the player's lead, deepen characters, raise stakes, keep prose vivid.",
  sandbox: "Open world. React to whatever the player does; offer hooks but don't railroad.",
};

export function buildGmSystemPrompt(scenario: GmScenario, cast: GmEntity[], state: GmState): string {
  const parts: string[] = [];

  parts.push(
    `You are the Game Master running a "${scenario.gameType}" interactive game for a single player. ` +
    `Stay in character as the narrator/GM. You know the FULL truth, but reveal it only progressively through play — never dump the solution.`,
  );

  parts.push(`# Scenario: ${scenario.name}\n${scenario.premise}`);

  if (scenario.bible) {
    parts.push(`# CANON — ground truth (GM-ONLY, FIXED)\nThis is the established truth of the story. Treat every detail as fact and NEVER contradict it. Do not invent facts that conflict with this; if something isn't covered, keep it minor and consistent.\n\n${scenario.bible}`);
  } else if (scenario.solution) {
    parts.push(`# The truth (GM-ONLY — never state directly; disclose gradually as the player earns it)\n${scenario.solution}`);
  }

  if (cast.length) {
    const lines = cast.map((e) => {
      const bits = [`### ${e.name}  —  ${e.entityType}:${e.slug}${e.revealed ? " [revealed]" : e.frontMatter.reveal === "secret" ? " [SECRET — hidden from player until you reveal it]" : ""}`];
      if (e.content) bits.push(e.content);
      // Surface voice cues so each character sounds distinct.
      if (e.entityType === "character") {
        const traits = (e.frontMatter.traits ?? {}) as Record<string, unknown>;
        const personality = Array.isArray(traits.personality) ? (traits.personality as string[]).join(", ") : "";
        if (personality) bits.push(`personality: ${personality}`);
        if (typeof traits.appearance === "string" && traits.appearance) bits.push(`appearance: ${traits.appearance}`);
      }
      if (e.secrets) bits.push(`(GM-only) ${e.secrets}`);
      return bits.join("\n");
    });
    parts.push(`# Cast & world (you know all of this; the player only knows what's been revealed)\n${lines.join("\n\n")}`);
  }

  const flagList = Object.entries(state.flags).filter(([k]) => !k.startsWith("__")).map(([k, v]) => `${k}=${v}`);
  const stateLines: string[] = [];
  if (flagList.length) stateLines.push(`Flags: ${flagList.join(", ")}`);
  if (state.overrides.length) stateLines.push(`Changed: ${state.overrides.map((o) => `${o.entity} → ${JSON.stringify(o.set)}`).join("; ")}`);
  if (stateLines.length) parts.push(`# Current state\n${stateLines.join("\n")}`);

  parts.push(`# How to run a ${scenario.gameType} game\n${RUN_GUIDANCE[scenario.gameType] ?? RUN_GUIDANCE.story}`);

  parts.push(
    `# Keep it moving\n` +
    `Advance the story every turn. Do NOT re-describe rooms, clues, or details the player has already been told — reference them in a few words at most, then move forward. Respond to what the player just did; don't recap the situation.`,
  );

  parts.push(
    `# Voicing characters\n` +
    `Give every NPC a DISTINCT voice grounded in their personality, background, and station — vocabulary, rhythm, attitude, verbal tics. A nervous apprentice, a haughty aristocrat, and a weary constable should never sound alike. When a character speaks, attribute it clearly ("The butler sniffs: ...") and let their mood shift with the situation (defensive, evasive, frightened). Never flatten everyone into the same neutral tone.`,
  );

  parts.push(
    `# Response format\n` +
    `First write your narration for the player as prose (Markdown allowed — it renders). ` +
    `Then, on its own line, write exactly ${ACTIONS_SENTINEL} followed by a JSON array of state-change actions (use [] if nothing changes).\n` +
    `Action types:\n` +
    `- {"type":"reveal","target":"type:slug"} — reveal a secret entity to the player when they've earned it\n` +
    `- {"type":"flag","key":"...","value":"..."} — record game state (e.g. a discovery, a decision)\n` +
    `- {"type":"override","entity":"type:slug","set":{"status":"dead"}} — change an entity's state\n` +
    `- {"type":"end","outcome":"solved"|"failed"|"ended"} — conclude the session\n` +
    `Always reference an entity as type:slug exactly (e.g. artifact:spare-key) — never with an @ or the name.\n` +
    `Example:\nThe bolt is scored with fresh scratches — someone forced this door from the outside.\n${ACTIONS_SENTINEL}\n[{"type":"reveal","target":"artifact:spare-key"}]\n` +
    `Keep narration concise and evocative.`,
  );

  return parts.join("\n\n---\n\n");
}

export const ACTIONS_SENTINEL = "===ACTIONS===";

export interface GmResponse { narration: string; actions: Action[] }

/** Parse a JSON actions array out of the text after the sentinel. */
export function parseActionsText(raw: string): Action[] {
  if (!raw) return [];
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "");
  const start = cleaned.indexOf("["), end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    return parseActions(JSON.parse(cleaned.slice(start, end + 1)));
  } catch {
    return [];
  }
}

/** Split a full GM reply into narration + actions, handling the sentinel
 *  format (and an old JSON-object fallback). */
export function parseGmResponse(text: string): GmResponse {
  const idx = text.indexOf(ACTIONS_SENTINEL);
  if (idx !== -1) {
    return {
      narration: text.slice(0, idx).trim(),
      actions: parseActionsText(text.slice(idx + ACTIONS_SENTINEL.length)),
    };
  }
  // Fallback: old { narration, actions } JSON shape, else all prose.
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  if (cleaned.startsWith("{")) {
    try {
      const obj = JSON.parse(cleaned) as { narration?: unknown; actions?: unknown };
      return {
        narration: typeof obj.narration === "string" ? obj.narration : text.trim(),
        actions: parseActions(obj.actions),
      };
    } catch { /* fall through */ }
  }
  return { narration: text.trim(), actions: [] };
}
