export type EntityType = 'character' | 'location' | 'artifact' | 'lore' | 'document' | 'scenario';
export type Visibility = 'public' | 'gm_only' | 'author_only';
export type CharacterRole = 'player_character' | 'npc' | 'background';
export type CharacterStatus = 'alive' | 'dead' | 'unknown' | 'missing';
export type LocationType = 'continent' | 'country' | 'city' | 'district' | 'building' | 'room' | 'other';
export type ArtifactType = 'weapon' | 'clue' | 'document' | 'treasure' | 'prop';
export type LoreType = 'faction' | 'event' | 'creature' | 'species' | 'law' | 'legend' | 'rumor' | 'custom';
export type DocumentType = 'timeline' | 'manuscript' | 'map' | 'letter' | 'codex' | 'newspaper' | 'blueprint' | 'custom';
export type GameType = 'detective' | 'turtle_soup' | 'coc' | 'story' | 'sandbox';

interface BaseEntity {
  id: string;
  slug: string;
  projectId: string;
  name: string;
  visibility: Visibility;
  content: string;
  secrets: string;
  createdAt: string;
  updatedAt: string;
}

export interface Character extends BaseEntity {
  entityType: 'character';
  role?: CharacterRole;
  status?: CharacterStatus;
  location?: string;
  faction?: string[];
  traits?: { personality?: string[]; appearance?: string };
  gameMeta?: {
    archetype?: string;
    stats?: Record<string, number>;
    secrets?: string;
    knowledge?: string[];
  };
}

export interface Location extends BaseEntity {
  entityType: 'location';
  parent?: string;
  locationType?: LocationType;
  tags?: string[];
  image?: string;
  gameMeta?: { isAccessible?: boolean; unlockCondition?: string };
}

export interface Artifact extends BaseEntity {
  entityType: 'artifact';
  artifactType?: ArtifactType;
  location?: string;
  owner?: string;
  gameMeta?: { discoverable?: boolean; discoveredBy?: string[]; reveals?: string };
}

export interface Lore extends BaseEntity {
  entityType: 'lore';
  loreType: LoreType;
  tags?: string[];
  frontMatter: Record<string, unknown>;
}

export interface Document extends BaseEntity {
  entityType: 'document';
  documentType: DocumentType;
  title: string;
  image?: string;
  scenario?: string;
  frontMatter: Record<string, unknown>;
}

export interface ScenarioCast {
  characters?: string[];
  locations?: string[];
  artifacts?: string[];
  lore?: string[];
  documents?: string[];
}

export interface Scenario extends BaseEntity {
  entityType: 'scenario';
  gameType: GameType;
  world: string;
  cast: ScenarioCast;
  game?: {
    premise: string;
    playerCount?: number;
    mechanics?: string[];
    solution?: string;
    winCondition?: string;
  };
}

export type Entity = Character | Location | Artifact | Lore | Document | Scenario;
