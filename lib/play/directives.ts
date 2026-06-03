/**
 * GM directives (EID-103). The AI GM returns a list of actions alongside its
 * narration; the engine applies them via existing session-engine handlers.
 */
import {
  revealEntity, unrevealEntity, setFlag, setEntityOverride,
} from "../sessions";
import type { EntityType } from "../types";

export type Action =
  | { type: "reveal"; target: string }                              // "type:slug"
  | { type: "unreveal"; target: string }
  | { type: "flag"; key: string; value?: string }
  | { type: "override"; entity: string; set: Record<string, unknown> }
  | { type: "end"; outcome: "solved" | "failed" | "ended" };

const VALID_TYPES = new Set<EntityType>([
  "character", "location", "artifact", "lore", "document", "scenario",
]);

/** Parse "type:slug" (tolerating a leading @) into a typed ref, or null. */
export function parseRef(ref: unknown): { type: EntityType; slug: string } | null {
  if (typeof ref !== "string") return null;
  const cleaned = ref.trim().replace(/^@/, "");
  if (!cleaned.includes(":")) return null;
  const [t, ...rest] = cleaned.split(":");
  const slug = rest.join(":");
  if (!VALID_TYPES.has(t as EntityType) || !slug) return null;
  return { type: t as EntityType, slug };
}

/** Validate/normalise a raw actions array from the model into known Actions. */
export function parseActions(raw: unknown): Action[] {
  if (!Array.isArray(raw)) return [];
  const out: Action[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    switch (o.type) {
      case "reveal":
        if (typeof o.target === "string") out.push({ type: "reveal", target: o.target });
        break;
      case "unreveal":
        if (typeof o.target === "string") out.push({ type: "unreveal", target: o.target });
        break;
      case "flag":
        if (typeof o.key === "string") out.push({ type: "flag", key: o.key, value: typeof o.value === "string" ? o.value : "1" });
        break;
      case "override":
        if (typeof o.entity === "string" && o.set && typeof o.set === "object")
          out.push({ type: "override", entity: o.entity, set: o.set as Record<string, unknown> });
        break;
      case "end":
        if (o.outcome === "solved" || o.outcome === "failed" || o.outcome === "ended")
          out.push({ type: "end", outcome: o.outcome });
        break;
    }
  }
  return out;
}

export interface AppliedAction { action: Action; ok: boolean; note?: string }

/** Apply actions to the session. Bad targets are skipped (recorded as not ok). */
export async function applyActions(sessionId: string, actions: Action[]): Promise<AppliedAction[]> {
  const applied: AppliedAction[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case "reveal": {
          const ref = parseRef(action.target);
          if (!ref) { applied.push({ action, ok: false, note: "bad target" }); break; }
          await revealEntity(sessionId, ref.type, ref.slug);
          applied.push({ action, ok: true });
          break;
        }
        case "unreveal": {
          const ref = parseRef(action.target);
          if (!ref) { applied.push({ action, ok: false, note: "bad target" }); break; }
          await unrevealEntity(sessionId, ref.type, ref.slug);
          applied.push({ action, ok: true });
          break;
        }
        case "flag":
          await setFlag(sessionId, action.key, action.value ?? "1");
          applied.push({ action, ok: true });
          break;
        case "override": {
          const ref = parseRef(action.entity);
          if (!ref) { applied.push({ action, ok: false, note: "bad entity" }); break; }
          await setEntityOverride(sessionId, ref.type, ref.slug, action.set);
          applied.push({ action, ok: true });
          break;
        }
        case "end":
          await setFlag(sessionId, "__ended", "1");
          await setFlag(sessionId, "__outcome", action.outcome);
          applied.push({ action, ok: true });
          break;
      }
    } catch (err) {
      applied.push({ action, ok: false, note: (err as Error).message });
    }
  }

  return applied;
}
