import { NextResponse } from "next/server";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";
import { complete } from "@/lib/ai";
import { normalizeFrontMatter } from "@/lib/entities/normalize";
import type { Provider } from "@/lib/ai";

const VALID = new Set(["character", "location", "artifact", "lore", "document", "scenario"]);

const SCHEMA = `Type-specific frontMatter (include only what fits; omit unknowns):
- character: role (player_character|npc|background), status (alive|dead|unknown|missing), traits ({ personality: string[], appearance: string })
- location:  locationType (continent|country|city|district|building|room|other), tags (string[])
- artifact:  artifactType (weapon|clue|document|treasure|prop)
- lore:      loreType (faction|event|creature|species|law|legend|rumor|custom), tags (string[])
- document:  documentType (timeline|manuscript|map|letter|codex|newspaper|blueprint|custom)`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    type?: string; count?: number; hint?: string; provider?: Provider; model?: string;
  };
  const wantType = body.type && VALID.has(body.type) ? body.type : null; // null = "surprise me"
  const count = Math.min(Math.max(body.count ?? 2, 1), 4);

  const db = await createSsrClient();
  const { data: project } = await db
    .from("projects")
    .select("id, worlds(name, era, genre, description, content)")
    .eq("slug", slug)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const w = (project.worlds as unknown as
    { name: string; era: string | null; genre: string[] | null; description: string | null; content: string | null }[] | null)?.[0] ?? null;

  const { data: inventory } = await db
    .from("entities").select("entity_type, name").eq("project_id", project.id).order("entity_type");

  const worldBlock = w
    ? `World: ${w.name}${w.era ? ` (${w.era})` : ""}\nGenre: ${(w.genre ?? []).join(", ")}\n${w.description ?? ""}\n${w.content ?? ""}`.trim()
    : "No world defined yet.";

  const grouped = (inventory ?? []).reduce<Record<string, string[]>>((acc, e) => {
    (acc[e.entity_type] ??= []).push(e.name);
    return acc;
  }, {});
  const inventoryBlock = Object.keys(grouped).length
    ? Object.entries(grouped).map(([t, names]) => `${t}: ${names.join(", ")}`).join("\n")
    : "(empty — nothing created yet)";

  const system = `You are a worldbuilding muse. Propose ${count} NEW ${wantType ? `${wantType}(s)` : "element(s)"} that fit this world and fill gaps — distinct from what already exists, evocative, and immediately usable. Do NOT duplicate existing entities.

Return ONLY valid JSON: { "entities": [ { "entityType": "...", "name": "...", "content": "1-2 sentence description", "frontMatter": { ... } } ] }
entityType must be one of: character | location | artifact | lore | document | scenario${wantType ? ` (use "${wantType}")` : ""}.
${SCHEMA}`;

  const userPrompt = [
    `# World\n${worldBlock}`,
    `# Existing entities (don't duplicate these)\n${inventoryBlock}`,
    body.hint?.trim() ? `# Author's nudge\n${body.hint.trim()}` : "",
    `# Task\nSuggest ${count} ${wantType ?? "element"}(s) that would enrich this world.`,
  ].filter(Boolean).join("\n\n");

  try {
    const result = await complete({
      provider: body.provider, model: body.model,
      system, messages: [{ role: "user", content: userPrompt }],
      temperature: 1.0, maxTokens: 2048,
    });

    const cleaned = result.text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
    if (s === -1 || e === -1) return NextResponse.json({ error: "Could not parse suggestions", raw: result.text }, { status: 422 });

    const parsed = JSON.parse(cleaned.slice(s, e + 1)) as { entities?: unknown[] };
    const entities = (parsed.entities ?? [])
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .filter((x) => VALID.has(String(x.entityType)) && typeof x.name === "string" && (x.name as string).trim())
      .map((x) => {
        const type = String(x.entityType);
        return {
          entityType: type,
          name: String(x.name).trim(),
          content: typeof x.content === "string" ? x.content : "",
          frontMatter: normalizeFrontMatter(type, (x.frontMatter && typeof x.frontMatter === "object" ? x.frontMatter : {}) as Record<string, unknown>),
        };
      });

    return NextResponse.json({ entities });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
