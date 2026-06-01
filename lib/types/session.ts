import type { EntityType } from './entity';

export interface Session {
  id: string;
  projectId: string;
  scenarioSlug: string;
  name: string;
  player?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionStateOverride {
  id: string;
  sessionId: string;
  entityType: EntityType;
  entitySlug: string;
  overrides: Record<string, unknown>;
}

export interface SessionFlag {
  sessionId: string;
  key: string;
  value: string;
}

export type LogRole = 'player' | 'agent' | 'narrator' | 'system';

export interface SessionLogEntry {
  id: string;
  sessionId: string;
  role: LogRole;
  content: string;
  createdAt: string;
}
