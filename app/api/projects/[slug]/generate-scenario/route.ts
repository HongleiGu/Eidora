import { NextResponse } from "next/server";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";
import { complete } from "@/lib/ai";
import type { Provider } from "@/lib/ai";

const GAME_GUIDANCE: Record<string, string> = {
  detective: "A solvable mystery: a crime, 3-6 suspects with motives/alibis, physical clues (artifacts) that point to the culprit, and a definitive solution. The solution must be deducible from the clues.",
  turtle_soup: "A lateral-thinking puzzle (situation puzzle): present a strange, incomplete situation as the premise, and a hidden full truth as the solution. Few characters/locations; the puzzle is the star.",
  coc: "Call-of-Cthulhu style cosmic horror: investigators, an unsettling location, mythos elements as lore, artifacts/tomes as clues, and a dreadful truth. Include sanity-threatening reveals.",
  story: "A narrative scenario (no win/lose): rich characters, evocative locations, and an emotional or dramatic arc rather than a puzzle.",
  sandbox: "An open situation with factions, locations, and hooks the players can explore freely; no single solution.",
};

const SYSTEM = `You scaffold a complete, cohesive, PLAYABLE scenario for a story/game authoring tool, set in the given world.

Return ONLY valid JSON (no markdown, no commentary):
{
  "scenario": {
    "name": "...",
    "description": "1-2 sentence public hook (no spoilers)",
    "premise": "the setup the players start with",
    "solution": "the hidden truth / how it resolves (GM-only)",
    "winCondition": "what counts as success (omit for story/sandbox)",
    "mechanics": ["investigation","deduction",...]
  },
  "characters": [ { "name": "...", "content": "1-2 sentence description", "frontMatter": { "role": "npc|player_character|background", "status": "alive|dead|unknown|missing", "traits": { "personality": ["..."], "appearance": "..." } } } ],
  "locations":  [ { "name": "...", "content": "...", "frontMatter": { "locationType": "building|room|city|...", "tags": ["..."] } } ],
  "artifacts":  [ { "name": "...", "content": "...", "frontMatter": { "artifactType": "clue|weapon|document|treasure|prop", "owner": "<character name>", "location": "<location name>" } } ]
}

Rules:
- Stay consistent with the world (era, genre, tone).
- Make it genuinely playable: clues should support the solution; characters should have reasons to be involved.
- Reference owners/locations by the NAMES you used above (the tool resolves them to slugs).
- Reasonable scope: 3-6 characters, 2-4 locations, 2-4 artifacts (fewer for turtle_soup).
- All lowercase enum values exactly as listed.`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    premise?: string; gameType?: string; provider?: Provider; model?: string;
  };
  const gameType = body.gameType ?? "detective";

  const db = await createSsrClient();
  const { data: project } = await db
    .from("projects")
    .select("id, name, worlds(name, era, genre, description, content)")
    .eq("slug", slug)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const w = (project.worlds as unknown as
    { name: string; era: string | null; genre: string[] | null; description: string | null; content: string | null }[] | null)?.[0] ?? null;

  const worldBlock = w
    ? `World: ${w.name}${w.era ? ` (${w.era})` : ""}\nGenre: ${(w.genre ?? []).join(", ")}\n${w.description ?? ""}\n${w.content ?? ""}`.trim()
    : "No world defined yet.";

  const userPrompt = [
    `# World\n${worldBlock}`,
    `# Game type: ${gameType}\n${GAME_GUIDANCE[gameType] ?? ""}`,
    body.premise?.trim()
      ? `# Author's premise / request\n${body.premise.trim()}`
      : `# Author's premise / request\nInvent an original scenario that fits this world and game type.`,
  ].join("\n\n");

  try {
    const result = await complete({
      provider: body.provider,
      model: body.model,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.8,
      maxTokens: 4096,
    });

    const cleaned = result.text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
    if (s === -1 || e === -1) return NextResponse.json({ error: "Could not parse scenario", raw: result.text }, { status: 422 });

    let bundle: unknown;
    try { bundle = JSON.parse(cleaned.slice(s, e + 1)); }
    catch { return NextResponse.json({ error: "Invalid JSON from model", raw: result.text }, { status: 422 }); }

    return NextResponse.json({ bundle, gameType, usage: result.usage });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
