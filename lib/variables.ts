/**
 * Template variable substitution.
 *
 * Syntax: {dot.path} inside any text.
 *
 * Built-in scopes:
 *   {world.era} {world.name} {world.genre}        — from the project's world
 *   {project.name}                                 — from the project
 *   {char.<slug>.<field>}                          — any front-matter field of a character
 *                                                    e.g. {char.inspector-morse.status}
 *
 * Custom variables (passed in) take precedence over built-ins. Use these for
 * COC-style game state — global ({sanity_loss}) or scoped ({char.morse.hp}).
 *
 * Unresolved tokens are left unchanged by default (so authors can see typos),
 * or replaced with a marker when keepUnresolved is false.
 */

import { createSsrClient } from './supabase/ssr';

// Path chars: lowercase alphanumerics, underscore, hyphen, separated by dots.
const VARIABLE_RE = /\{([a-z0-9_]+(?:[.-][a-z0-9_]+)*)\}/gi;

export interface ParsedVariable {
  raw: string;   // "{char.morse.hp}"
  path: string;  // "char.morse.hp"
}

/** Nested scope object: { world: {...}, project: {...}, char: { slug: {...} }, ...custom }. */
export type VariableScope = Record<string, unknown>;

// ── Parsing ───────────────────────────────────────────────────────────────────

export function parseVariables(text: string): ParsedVariable[] {
  const seen = new Set<string>();
  const out: ParsedVariable[] = [];
  for (const match of text.matchAll(VARIABLE_RE)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    out.push({ raw: match[0], path: match[1] });
  }
  return out;
}

/** Character slugs referenced via {char.<slug>.*} — used to limit the DB fetch. */
export function referencedCharSlugs(text: string): string[] {
  const slugs = new Set<string>();
  for (const { path } of parseVariables(text)) {
    const parts = path.split('.');
    if (parts[0] === 'char' && parts[1]) slugs.add(parts[1]);
  }
  return [...slugs];
}

// ── Scope building ────────────────────────────────────────────────────────────

export interface BuildScopeOptions {
  /** Character slugs to include under scope.char.<slug>. */
  charSlugs?: string[];
  /** Custom variables merged on top (highest precedence). */
  custom?: VariableScope;
}

export async function buildVariableScope(
  projectId: string,
  opts: BuildScopeOptions = {},
): Promise<VariableScope> {
  const db = await createSsrClient();

  const [projectRes, worldRes] = await Promise.all([
    db.from('projects').select('name, slug').eq('id', projectId).maybeSingle(),
    db.from('worlds').select('name, era, genre, description').eq('project_id', projectId).maybeSingle(),
  ]);

  const scope: VariableScope = {
    project: projectRes.data ?? {},
    world: worldRes.data
      ? {
          ...worldRes.data,
          genre: Array.isArray(worldRes.data.genre) ? worldRes.data.genre.join(', ') : worldRes.data.genre,
        }
      : {},
    char: {} as Record<string, unknown>,
  };

  if (opts.charSlugs && opts.charSlugs.length > 0) {
    const { data } = await db
      .from('entities')
      .select('slug, name, front_matter')
      .eq('project_id', projectId)
      .eq('entity_type', 'character')
      .in('slug', opts.charSlugs);

    const charScope = scope.char as Record<string, unknown>;
    for (const row of data ?? []) {
      charScope[row.slug] = {
        name: row.name,
        ...(row.front_matter as Record<string, unknown> ?? {}),
      };
    }
  }

  // Custom variables override built-ins. For char.*, merge per-slug so a custom
  // field (e.g. hp) doesn't clobber DB-loaded fields (e.g. status).
  if (opts.custom) {
    for (const [key, val] of Object.entries(opts.custom)) {
      if (key === 'char' && typeof val === 'object' && val !== null) {
        const charScope = scope.char as Record<string, unknown>;
        for (const [slug, fields] of Object.entries(val as Record<string, unknown>)) {
          charScope[slug] = { ...(charScope[slug] as object ?? {}), ...(fields as object) };
        }
      } else {
        scope[key] = val;
      }
    }
  }

  return scope;
}

// ── Substitution ──────────────────────────────────────────────────────────────

function lookup(scope: VariableScope, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, scope);
}

export interface SubstituteOptions {
  /** If true (default), unresolved {tokens} are left verbatim. If false, replaced with marker. */
  keepUnresolved?: boolean;
  /** Marker for unresolved tokens when keepUnresolved is false. Default: "⟨path⟩". */
  marker?: (path: string) => string;
}

export function substitute(
  text: string,
  scope: VariableScope,
  opts: SubstituteOptions = {},
): string {
  const keepUnresolved = opts.keepUnresolved ?? true;
  const marker = opts.marker ?? ((p: string) => `⟨${p}⟩`);

  return text.replace(VARIABLE_RE, (raw, path: string) => {
    const value = lookup(scope, path);
    if (value === undefined || value === null) {
      return keepUnresolved ? raw : marker(path);
    }
    return String(value);
  });
}

/** Convenience: parse → build scope (with referenced chars) → substitute. */
export async function resolveVariables(
  projectId: string,
  text: string,
  opts: { custom?: VariableScope } & SubstituteOptions = {},
): Promise<string> {
  const { custom, ...subOpts } = opts;
  const scope = await buildVariableScope(projectId, {
    charSlugs: referencedCharSlugs(text),
    custom,
  });
  return substitute(text, scope, subOpts);
}
