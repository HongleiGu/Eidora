/**
 * Nudge AI-produced front-matter toward our enum/shape conventions.
 * front_matter is jsonb (lenient), but normalising keeps values matching the
 * form selects, filters, and visibility logic. Shared by entity extraction
 * and scenario generation.
 */

const ROLE_ALIASES: Record<string, string> = {
  protagonist: "player_character", pc: "player_character", "player character": "player_character",
  player_character: "player_character",
  npc: "npc", victim: "npc", suspect: "npc", witness: "npc", villain: "npc", antagonist: "npc", ally: "npc",
  background: "background", extra: "background", "walk-on": "background",
};

const STATUS_ALIASES: Record<string, string> = {
  alive: "alive", active: "alive", living: "alive",
  dead: "dead", deceased: "dead", "presumed dead": "dead", killed: "dead", murdered: "dead",
  missing: "missing", disappeared: "missing",
  unknown: "unknown",
};

function canon(v: unknown): string | undefined {
  return typeof v === "string" ? v.toLowerCase().trim() : undefined;
}

export function normalizeFrontMatter(type: string, fm: Record<string, unknown>): Record<string, unknown> {
  const out = { ...fm };

  if (type === "character") {
    const role = canon(out.role);
    if (role) out.role = ROLE_ALIASES[role] ?? role.replace(/[\s-]+/g, "_");
    const status = canon(out.status);
    if (status) out.status = STATUS_ALIASES[status] ?? status;
    const traits = out.traits as Record<string, unknown> | undefined;
    if (traits && Array.isArray(traits.appearance)) {
      out.traits = { ...traits, appearance: (traits.appearance as unknown[]).join(", ") };
    }
  }
  if (type === "location") { const t = canon(out.locationType); if (t) out.locationType = t; }
  if (type === "artifact") { const t = canon(out.artifactType); if (t) out.artifactType = t; }
  if (type === "lore")     { const t = canon(out.loreType); if (t) out.loreType = t; }
  if (type === "document") { const t = canon(out.documentType); if (t) out.documentType = t; }

  // Drop empty-string fields so they don't masquerade as set values.
  for (const k of Object.keys(out)) if (out[k] === "") delete out[k];
  return out;
}
