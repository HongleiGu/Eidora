/**
 * Create a scenario "bundle" (cast + scenario, cross-refs wired) into a project.
 * Shared by the scenario generator (EID-75) and complete-story generation (EID-113).
 */
import { createEntity, slugify } from "./entities";
import { normalizeFrontMatter } from "./entities/normalize";
import { createSsrClient } from "./supabase/ssr";
import type { EntityType } from "./types";

export interface BundleEntity {
  name: string;
  content?: string;
  frontMatter?: Record<string, unknown>;
}

export interface ScenarioBundle {
  scenario: {
    name: string;
    description?: string;
    premise?: string;
    solution?: string;
    winCondition?: string;
    mechanics?: string[];
  };
  characters?: BundleEntity[];
  locations?: BundleEntity[];
  artifacts?: BundleEntity[];
  lore?: BundleEntity[];
}

export interface BundleResult {
  scenarioSlug: string;
  counts: { characters: number; locations: number; artifacts: number; lore: number };
}

export async function createScenarioBundle(
  projectId: string,
  worldSlug: string,
  bundle: ScenarioBundle,
  gameType: string,
): Promise<BundleResult> {
  const db = await createSsrClient();

  // Pre-load existing slugs so generated ones don't collide.
  const { data: existing } = await db.from("entities").select("slug").eq("project_id", projectId);
  const used = new Set<string>((existing ?? []).map((r) => r.slug));
  const uniqueSlug = (name: string): string => {
    const base = slugify(name) || "item";
    let s = base, i = 2;
    while (used.has(s)) s = `${base}-${i++}`;
    used.add(s);
    return s;
  };

  const nameToSlug = new Map<string, string>();
  const resolve = (v: unknown) =>
    typeof v === "string" ? (nameToSlug.get(v.trim().toLowerCase()) ?? slugify(v)) : v;

  async function createGroup(items: BundleEntity[] | undefined, type: EntityType): Promise<string[]> {
    const slugs: string[] = [];
    for (const it of items ?? []) {
      if (!it?.name?.trim()) continue;
      const entitySlug = uniqueSlug(it.name);
      nameToSlug.set(it.name.trim().toLowerCase(), entitySlug);
      await createEntity(projectId, type, {
        slug: entitySlug,
        name: it.name.trim(),
        visibility: "public",
        content: it.content ?? "",
        secrets: "",
        frontMatter: normalizeFrontMatter(type, it.frontMatter ?? {}),
      });
      slugs.push(entitySlug);
    }
    return slugs;
  }

  // Characters first (so artifacts can reference owners), then locations, lore, artifacts.
  const charSlugs = await createGroup(bundle.characters, "character");
  const locSlugs = await createGroup(bundle.locations, "location");
  const loreSlugs = await createGroup(bundle.lore, "lore");

  const artifacts = (bundle.artifacts ?? []).map((a) => ({
    ...a,
    frontMatter: {
      ...(a.frontMatter ?? {}),
      ...(a.frontMatter?.owner ? { owner: resolve(a.frontMatter.owner) } : {}),
      ...(a.frontMatter?.location ? { location: resolve(a.frontMatter.location) } : {}),
    },
  }));
  const artSlugs = await createGroup(artifacts, "artifact");

  const secretsText = [
    bundle.scenario.solution ? `Solution: ${bundle.scenario.solution}` : "",
    bundle.scenario.winCondition ? `Win condition: ${bundle.scenario.winCondition}` : "",
  ].filter(Boolean).join("\n\n");

  const scenario = await createEntity(projectId, "scenario", {
    slug: uniqueSlug(bundle.scenario.name),
    name: bundle.scenario.name.trim(),
    visibility: "public",
    content: bundle.scenario.description ?? "",
    secrets: secretsText,
    frontMatter: {
      gameType: gameType ?? "detective",
      world: worldSlug,
      cast: { characters: charSlugs, locations: locSlugs, artifacts: artSlugs, lore: loreSlugs },
      game: { premise: bundle.scenario.premise ?? "", mechanics: bundle.scenario.mechanics ?? [] },
    },
  });

  return {
    scenarioSlug: scenario.slug,
    counts: { characters: charSlugs.length, locations: locSlugs.length, artifacts: artSlugs.length, lore: loreSlugs.length },
  };
}
