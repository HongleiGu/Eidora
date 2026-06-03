import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { complete } from "@/lib/ai";
import { normalizeFrontMatter } from "@/lib/entities/normalize";
import type { Provider } from "@/lib/ai";

const SYSTEM = `You extract structured worldbuilding entities from a passage of text for a story/game authoring tool.

Return ONLY valid JSON (no markdown, no commentary) of the shape:
{ "entities": [ { "entityType": "...", "name": "...", "content": "...", "frontMatter": { ... } } ] }

entityType must be one of: character | location | artifact | lore | document | scenario

Type-specific frontMatter fields (include only those clearly supported by the text; omit unknowns):
- character: role ("player_character"|"npc"|"background"), status ("alive"|"dead"|"unknown"|"missing"), location (slug), faction (string[]), traits ({ personality: string[], appearance: string })
- location:  locationType ("continent"|"country"|"city"|"district"|"building"|"room"|"other"), parent (slug), tags (string[])
- artifact:  artifactType ("weapon"|"clue"|"document"|"treasure"|"prop"), location (slug), owner (slug)
- lore:      loreType ("faction"|"event"|"creature"|"species"|"law"|"legend"|"rumor"|"custom"), tags (string[])
- document:  documentType ("timeline"|"manuscript"|"map"|"letter"|"codex"|"newspaper"|"blueprint"|"custom")
- scenario:  gameType ("detective"|"turtle_soup"|"coc"|"story"|"sandbox"), game ({ premise: string })

"content" is a concise prose description (1-3 sentences). Extract every distinct entity the passage introduces. If none, return { "entities": [] }.`;

function parseJson(text: string): { entities: unknown[] } | null {
  // Strip code fences if present, then find the outermost JSON object.
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as { entities: unknown[] };
  } catch {
    return null;
  }
}

const VALID = new Set(["character", "location", "artifact", "lore", "document", "scenario"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  await params; // slug not needed for extraction itself
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { text?: string; provider?: Provider; model?: string };
  if (!body.text?.trim()) return NextResponse.json({ error: "text is required" }, { status: 400 });

  try {
    const result = await complete({
      provider: body.provider,
      model: body.model,
      system: SYSTEM,
      messages: [{ role: "user", content: body.text }],
      temperature: 0.2,
      maxTokens: 2048,
    });

    const parsed = parseJson(result.text);
    if (!parsed || !Array.isArray(parsed.entities)) {
      return NextResponse.json({ error: "Could not parse entities from AI output", raw: result.text }, { status: 422 });
    }

    // Validate + normalise
    const entities = parsed.entities
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
      .filter((e) => VALID.has(String(e.entityType)) && typeof e.name === "string" && (e.name as string).trim())
      .map((e) => {
        const type = String(e.entityType);
        const fm = (e.frontMatter && typeof e.frontMatter === "object" ? e.frontMatter : {}) as Record<string, unknown>;
        return {
          entityType: type,
          name: String(e.name).trim(),
          content: typeof e.content === "string" ? e.content : "",
          frontMatter: normalizeFrontMatter(type, fm),
        };
      });

    return NextResponse.json({ entities, usage: result.usage });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
