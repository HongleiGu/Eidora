import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { createProject, createWorld } from "@/lib/world";
import { createScenarioBundle, type ScenarioBundle } from "@/lib/scenarios";
import { complete } from "@/lib/ai";
import type { Provider } from "@/lib/ai";

const SYSTEM = `You invent a COMPLETE, cohesive, playable story world from a seed for a story/game authoring tool.

Return ONLY valid JSON:
{
  "title": "short project/story title",
  "world": { "name": "...", "era": "...", "genre": ["..."], "description": "2-3 sentence setting" },
  "scenario": { "name": "...", "gameType": "detective|turtle_soup|coc|story|sandbox", "premise": "the setup players start with", "solution": "the hidden truth (GM-only)", "winCondition": "what success looks like (omit for story/sandbox)", "mechanics": ["..."] },
  "characters": [ { "name": "...", "content": "1-2 sentences", "frontMatter": { "role": "player_character|npc|background", "status": "alive|dead|unknown|missing", "traits": { "personality": ["..."], "appearance": "..." } } } ],
  "locations":  [ { "name": "...", "content": "...", "frontMatter": { "locationType": "building|room|city|...", "tags": ["..."] } } ],
  "artifacts":  [ { "name": "...", "content": "...", "frontMatter": { "artifactType": "clue|weapon|document|treasure|prop", "owner": "<character name>", "location": "<location name>" } } ],
  "lore":       [ { "name": "...", "content": "...", "frontMatter": { "loreType": "faction|event|legend|law|rumor|custom" } } ]
}

Make it genuinely playable and internally consistent: clues support the solution, characters have reasons to be involved, lore deepens the world. Reference owners/locations by the NAMES used above. 4-6 characters, 2-4 locations, 2-4 artifacts, 1-3 lore. All lowercase enum values exactly as listed.`;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    prompt?: string; genre?: string; provider?: Provider; model?: string;
  };

  const seed = body.prompt?.trim()
    ? `# Seed idea\n${body.prompt.trim()}`
    : body.genre?.trim()
      ? `# Genre\n${body.genre.trim()}\nInvent an original story in this genre.`
      : `# No seed given\nInvent an original, surprising story in any genre you like.`;

  try {
    const result = await complete({
      provider: body.provider, model: body.model,
      system: SYSTEM, messages: [{ role: "user", content: seed }],
      temperature: 0.95, maxTokens: 4096,
    });

    const cleaned = result.text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
    if (s === -1 || e === -1) return NextResponse.json({ error: "Could not parse story", raw: result.text }, { status: 422 });

    const spec = JSON.parse(cleaned.slice(s, e + 1)) as {
      title?: string;
      world?: { name?: string; era?: string; genre?: string[]; description?: string };
      scenario?: ScenarioBundle["scenario"] & { gameType?: string };
      characters?: ScenarioBundle["characters"];
      locations?: ScenarioBundle["locations"];
      artifacts?: ScenarioBundle["artifacts"];
      lore?: ScenarioBundle["lore"];
    };

    const title = spec.title?.trim() || spec.world?.name?.trim() || "Untitled Story";
    if (!spec.scenario?.name?.trim()) return NextResponse.json({ error: "Generated story has no scenario" }, { status: 422 });

    // Guard gameType to a known value (fall back to "story" so GM guidance resolves).
    const VALID_GAME = new Set(["detective", "turtle_soup", "coc", "story", "sandbox"]);
    const gameType = VALID_GAME.has(String(spec.scenario.gameType)) ? String(spec.scenario.gameType) : "story";

    // 1. Project (owner + admin membership handled by createProject)
    const project = await createProject(title, user.id);

    // 2. World
    const world = await createWorld(project.id, {
      name: spec.world?.name?.trim() || title,
      era: spec.world?.era,
      genre: spec.world?.genre ?? [],
      description: spec.world?.description,
      timelines: [],
      content: "",
      visibility: "public",
    });

    // 3. Cast + scenario (cross-refs wired)
    await createScenarioBundle(
      project.id,
      world.slug,
      {
        scenario: spec.scenario,
        characters: spec.characters,
        locations: spec.locations,
        artifacts: spec.artifacts,
        lore: spec.lore,
      },
      gameType,
    );

    return NextResponse.json({ slug: project.slug }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
