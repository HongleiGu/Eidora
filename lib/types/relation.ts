export interface Relation {
  id: string;
  projectId: string;
  sourceSlug: string;
  targetSlug: string;
  relationType: string;
  attitude?: number; // -100 to 100
  twoWay: boolean;
  note?: string;
  createdAt: string;
}
