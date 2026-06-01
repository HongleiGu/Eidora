/**
 * Entity reference system.
 *
 * Syntax (inside any text the user types):
 *   @slug              — resolve across all entity types (first match wins)
 *   @type:slug         — scoped to a type, using a short alias
 *
 * Type aliases: char, loc, art, lore, doc, scenario
 *   @char:inspector-morse
 *   @loc:locked-study
 *   @art:jade-idol
 *
 * Used by the studio editor (for @mention autocomplete + highlighting) and the
 * AI chat (to inject referenced entities into the prompt context).
 */

import { createSsrClient } from './supabase/ssr';
import type { EntityType } from './types';

// Token chars: lowercase alphanumerics + hyphen, with an optional `type:` prefix.
const REFERENCE_RE = /@([a-z]+:)?([a-z0-9][a-z0-9-]*)/g;

const TYPE_ALIASES: Record<string, EntityType> = {
  char: 'character',
  character: 'character',
  loc: 'location',
  location: 'location',
  art: 'artifact',
  artifact: 'artifact',
  lore: 'lore',
  doc: 'document',
  document: 'document',
  scenario: 'scenario',
};

export interface ParsedReference {
  /** The raw matched text, e.g. "@char:inspector-morse". */
  raw: string;
  /** Resolved entity type, or null if the alias was unknown/unscoped. */
  type: EntityType | null;
  slug: string;
}

export interface ResolvedReference extends ParsedReference {
  resolved: boolean;
  entity?: {
    id: string;
    name: string;
    entityType: EntityType;
    slug: string;
    visibility: string;
    frontMatter: Record<string, unknown>;
  };
}

// ── Parsing ───────────────────────────────────────────────────────────────────

/** Extract all @references from a piece of text (deduplicated by raw token). */
export function parseReferences(text: string): ParsedReference[] {
  const seen = new Set<string>();
  const out: ParsedReference[] = [];

  for (const match of text.matchAll(REFERENCE_RE)) {
    const raw = match[0];
    if (seen.has(raw)) continue;
    seen.add(raw);

    const aliasRaw = match[1]?.slice(0, -1); // strip trailing ":"
    const slug = match[2];
    const type = aliasRaw ? (TYPE_ALIASES[aliasRaw] ?? null) : null;

    // If an alias prefix was given but is unknown, skip — it's not a real ref.
    if (aliasRaw && !TYPE_ALIASES[aliasRaw]) continue;

    out.push({ raw, type, slug });
  }

  return out;
}

// ── Resolution ────────────────────────────────────────────────────────────────

/** Resolve parsed references to entities in a project. */
export async function resolveReferences(
  projectId: string,
  refs: ParsedReference[],
): Promise<ResolvedReference[]> {
  if (refs.length === 0) return [];

  const db = await createSsrClient();

  // Collect all candidate slugs, query once.
  const slugs = [...new Set(refs.map((r) => r.slug))];
  const { data } = await db
    .from('entities')
    .select('id, name, entity_type, slug, visibility, front_matter')
    .eq('project_id', projectId)
    .in('slug', slugs);

  const rows = data ?? [];

  return refs.map((ref) => {
    // Scoped: match slug AND type. Unscoped: first match by slug.
    const row = rows.find((r) =>
      r.slug === ref.slug && (ref.type === null || r.entity_type === ref.type),
    );

    if (!row) return { ...ref, resolved: false };

    return {
      ...ref,
      resolved: true,
      entity: {
        id: row.id,
        name: row.name,
        entityType: row.entity_type as EntityType,
        slug: row.slug,
        visibility: row.visibility,
        frontMatter: (row.front_matter ?? {}) as Record<string, unknown>,
      },
    };
  });
}

/** Convenience: parse + resolve in one call. */
export async function extractReferences(
  projectId: string,
  text: string,
): Promise<ResolvedReference[]> {
  return resolveReferences(projectId, parseReferences(text));
}

// ── Context formatting for AI ─────────────────────────────────────────────────

/**
 * Build a compact context block listing every resolved reference, ready to
 * prepend to an AI prompt. Pulls the most relevant front-matter fields per type.
 */
export function formatReferenceContext(resolved: ResolvedReference[]): string {
  // Dedupe by entity id — @char:morse and @morse may point at the same entity.
  const seen = new Set<string>();
  const hits = resolved.filter((r) => {
    if (!r.resolved || !r.entity || seen.has(r.entity.id)) return false;
    seen.add(r.entity.id);
    return true;
  });
  if (hits.length === 0) return '';

  const blocks = hits.map((r) => {
    const e = r.entity!;
    const fm = e.frontMatter;
    const lines = [`### ${e.name} (${e.entityType}, @${e.slug})`];

    switch (e.entityType) {
      case 'character':
        if (fm.role) lines.push(`- role: ${fm.role}`);
        if (fm.status) lines.push(`- status: ${fm.status}`);
        if (fm.location) lines.push(`- location: ${fm.location}`);
        if (Array.isArray(fm.faction) && fm.faction.length) lines.push(`- faction: ${fm.faction.join(', ')}`);
        if ((fm.traits as Record<string, unknown>)?.appearance) lines.push(`- appearance: ${(fm.traits as Record<string, unknown>).appearance}`);
        break;
      case 'location':
        if (fm.locationType) lines.push(`- type: ${fm.locationType}`);
        if (fm.parent) lines.push(`- within: ${fm.parent}`);
        break;
      case 'artifact':
        if (fm.artifactType) lines.push(`- type: ${fm.artifactType}`);
        if (fm.location) lines.push(`- location: ${fm.location}`);
        if (fm.owner) lines.push(`- owner: ${fm.owner}`);
        break;
      case 'lore':
        if (fm.loreType) lines.push(`- type: ${fm.loreType}`);
        break;
      case 'scenario':
        if (fm.gameType) lines.push(`- game type: ${fm.gameType}`);
        if ((fm.game as Record<string, unknown>)?.premise) lines.push(`- premise: ${(fm.game as Record<string, unknown>).premise}`);
        break;
    }

    return lines.join('\n');
  });

  return `# Referenced entities\n\n${blocks.join('\n\n')}`;
}
