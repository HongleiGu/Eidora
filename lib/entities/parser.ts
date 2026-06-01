import type {
  Entity, EntityType, Visibility,
  Character, Location, Artifact, Lore, Document, Scenario,
} from '../types';

export interface EntityRow {
  id: string;
  project_id: string;
  entity_type: string;
  slug: string;
  name: string;
  visibility: string;
  content: string | null;
  secrets: string | null;
  front_matter: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function base(row: EntityRow) {
  return {
    id: row.id,
    slug: row.slug,
    projectId: row.project_id,
    name: row.name,
    visibility: row.visibility as Visibility,
    content: row.content ?? '',
    secrets: row.secrets ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function fromRow(row: EntityRow): Entity {
  const b = base(row);
  const fm = row.front_matter ?? {};

  switch (row.entity_type as EntityType) {
    case 'character':
      return {
        ...b,
        entityType: 'character',
        role: fm.role as Character['role'],
        status: fm.status as Character['status'],
        location: fm.location as string | undefined,
        faction: fm.faction as string[] | undefined,
        traits: fm.traits as Character['traits'],
        gameMeta: fm.gameMeta as Character['gameMeta'],
      };

    case 'location':
      return {
        ...b,
        entityType: 'location',
        parent: fm.parent as string | undefined,
        locationType: fm.locationType as Location['locationType'],
        tags: fm.tags as string[] | undefined,
        image: fm.image as string | undefined,
        gameMeta: fm.gameMeta as Location['gameMeta'],
      };

    case 'artifact':
      return {
        ...b,
        entityType: 'artifact',
        artifactType: fm.artifactType as Artifact['artifactType'],
        location: fm.location as string | undefined,
        owner: fm.owner as string | undefined,
        gameMeta: fm.gameMeta as Artifact['gameMeta'],
      };

    case 'lore':
      return {
        ...b,
        entityType: 'lore',
        loreType: (fm.loreType ?? 'custom') as Lore['loreType'],
        tags: fm.tags as string[] | undefined,
        frontMatter: fm,
      };

    case 'document':
      return {
        ...b,
        entityType: 'document',
        documentType: (fm.documentType ?? 'custom') as Document['documentType'],
        title: (fm.title as string | undefined) ?? b.name,
        image: fm.image as string | undefined,
        scenario: fm.scenario as string | undefined,
        frontMatter: fm,
      };

    case 'scenario':
      return {
        ...b,
        entityType: 'scenario',
        gameType: (fm.gameType ?? 'story') as Scenario['gameType'],
        world: (fm.world as string) ?? '',
        cast: (fm.cast as Scenario['cast']) ?? {},
        game: fm.game as Scenario['game'],
      };

    default:
      throw new Error(`Unknown entity type: ${row.entity_type}`);
  }
}

/** Extract only type-specific fields (everything except base fields) for front_matter storage. */
export function toFrontMatter(entity: Entity): Record<string, unknown> {
  const {
    id: _id, slug: _s, projectId: _p, name: _n, visibility: _v,
    content: _c, secrets: _sec, createdAt: _ca, updatedAt: _ua,
    entityType: _et, ...typeSpecific
  } = entity as Entity & Record<string, unknown>;
  return typeSpecific;
}
