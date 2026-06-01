import { z } from 'zod';

const visibility = z.enum(['public', 'gm_only', 'author_only']);

export const createEntitySchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens').optional(),
  name: z.string().min(1, 'name is required'),
  visibility: visibility.default('public'),
  content: z.string().default(''),
  secrets: z.string().default(''),
  frontMatter: z.record(z.string(), z.unknown()).default({}),
});

export const updateEntitySchema = z.object({
  name: z.string().min(1).optional(),
  visibility: visibility.optional(),
  content: z.string().optional(),
  secrets: z.string().optional(),
  frontMatter: z.record(z.string(), z.unknown()).optional(),
});

export const entityFiltersSchema = z.object({
  visibility: visibility.optional(),
  search: z.string().optional(),
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
export type EntityFilters = z.infer<typeof entityFiltersSchema>;
