/**
 * gray-matter file parser — converts .md files with YAML front-matter
 * to/from Entity objects. Used by the CLI and import/export flows.
 * The DB (Supabase) is the primary store; files are the portable format.
 */

import matter from 'gray-matter';
import type { Entity, EntityType, Visibility } from './types';
import type { CreateEntityInput } from './entities/schemas';

const SECRETS_HEADING = /^## Secrets\s*$/im;

/**
 * Parse a .md file's string content into a CreateEntityInput ready for the DB.
 * Extracts the ## Secrets section from the body automatically.
 */
export function parseEntityFile(
  raw: string,
  entityType: EntityType,
): CreateEntityInput & { entityType: EntityType } {
  const { data: fm, content: body } = matter(raw);

  // Split body on ## Secrets heading
  const secretsMatch = SECRETS_HEADING.exec(body);
  let content = body.trim();
  let secrets = '';

  if (secretsMatch) {
    const idx = secretsMatch.index;
    content = body.slice(0, idx).trim();
    secrets = body.slice(idx + secretsMatch[0].length).trim();
  }

  const { name, slug, visibility, ...restFm } = fm as Record<string, unknown>;

  return {
    entityType,
    slug: typeof slug === 'string' ? slug : undefined,
    name: typeof name === 'string' ? name : '',
    visibility: (visibility as Visibility | undefined) ?? 'public',
    content,
    secrets,
    frontMatter: restFm,
  };
}

/**
 * Serialise an Entity back to a .md file string.
 * Secrets are appended as a ## Secrets section when non-empty.
 */
export function serializeEntityFile(entity: Entity): string {
  const {
    id: _id, projectId: _p, createdAt: _ca, updatedAt: _ua,
    entityType: _et, content, secrets, ...frontMatterFields
  } = entity as Entity & Record<string, unknown>;

  const body = [
    content ?? '',
    secrets ? `\n## Secrets\n\n${secrets}` : '',
  ].join('').trim();

  return matter.stringify(body, frontMatterFields as Record<string, unknown>);
}

/**
 * Parse a world.md file.
 */
export function parseWorldFile(raw: string): {
  slug?: string;
  name: string;
  era?: string;
  genre?: string[];
  description?: string;
  timelines?: unknown[];
  visibility?: Visibility;
  content: string;
} {
  const { data: fm, content } = matter(raw);
  return {
    slug: fm.slug as string | undefined,
    name: (fm.name as string) ?? '',
    era: fm.era as string | undefined,
    genre: fm.genre as string[] | undefined,
    description: fm.description as string | undefined,
    timelines: fm.timelines as unknown[] | undefined,
    visibility: fm.visibility as Visibility | undefined,
    content: content.trim(),
  };
}
