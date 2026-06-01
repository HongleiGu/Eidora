import type { Visibility } from './entity';

export interface WorldTimeline {
  id: string;
  name: string;
  description?: string;
}

export interface World {
  id: string;
  projectId: string;
  slug: string;
  name: string;
  era?: string;
  genre?: string[];
  description?: string;
  timelines: WorldTimeline[];
  content: string;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}
