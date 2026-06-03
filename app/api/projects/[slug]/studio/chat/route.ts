import { createSsrClient } from "@/lib/supabase/ssr";
import { stream, streamToResponse } from "@/lib/ai";
import { extractReferences, formatReferenceContext } from "@/lib/references";
import type { Message, Provider, ContentPart } from "@/lib/ai";

interface ChatBody {
  messages: Message[];
  /** The current editor draft — used for @reference resolution + context. */
  editorText?: string;
  provider?: Provider;
  model?: string;
  /** Image data URLs to attach to the latest user message (vision models). */
  images?: string[];
}

const SYSTEM_PREAMBLE = `You are a collaborative story-writing assistant inside Eidora, a workspace for crafting interactive fiction and text-based games (detective mysteries, turtle-soup puzzles, Call-of-Cthulhu-style scenarios).

You help the author develop their world: brainstorming characters, locations, artifacts, plot beats, clues, and scenario structure. You write vivid, economical prose and give concrete, usable suggestions.

When the author references an existing entity with @slug, use the provided details about it — stay consistent with established canon. When suggesting a NEW character, location, or artifact, format it clearly so it can be saved as an entity (a bolded name, then a short description, then key attributes).

Be concise unless asked to expand. Match the tone of the world's genre.`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let body: ChatBody;
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const db = await createSsrClient();

  // Resolve project + world + entity inventory
  const { data: project } = await db
    .from("projects")
    .select("id, name, worlds(name, era, genre, description, content)")
    .eq("slug", slug)
    .maybeSingle();

  if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

  const w = (project.worlds as unknown as
    { name: string; era: string | null; genre: string[] | null; description: string | null; content: string | null }[] | null)?.[0] ?? null;

  // Compact inventory of everything that exists (names only, for awareness)
  const { data: inventory } = await db
    .from("entities")
    .select("entity_type, slug, name")
    .eq("project_id", project.id)
    .order("entity_type");

  // Resolve @references from the editor draft + the latest user message
  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  const lastUserText = typeof lastUser?.content === "string" ? lastUser.content : "";
  const refSource = `${body.editorText ?? ""}\n${lastUserText}`;
  const resolved = await extractReferences(project.id, refSource);
  const refContext = formatReferenceContext(resolved);

  // ── Build system prompt ──────────────────────────────────────────────────
  const parts: string[] = [SYSTEM_PREAMBLE];

  if (w) {
    const worldLines = [`# World: ${w.name}`];
    if (w.era) worldLines.push(`Era: ${w.era}`);
    if (w.genre?.length) worldLines.push(`Genre: ${w.genre.join(", ")}`);
    if (w.description) worldLines.push(`\n${w.description}`);
    if (w.content) worldLines.push(`\n${w.content}`);
    parts.push(worldLines.join("\n"));
  }

  if (inventory && inventory.length > 0) {
    const grouped = inventory.reduce<Record<string, string[]>>((acc, e) => {
      (acc[e.entity_type] ??= []).push(`@${e.slug} (${e.name})`);
      return acc;
    }, {});
    const lines = Object.entries(grouped).map(
      ([type, items]) => `${type}: ${items.join(", ")}`,
    );
    parts.push(`# Existing entities in this project\n${lines.join("\n")}`);
  }

  if (refContext) parts.push(refContext);

  if (body.editorText?.trim()) {
    parts.push(`# Current draft\nThe author is currently working on this text:\n\n${body.editorText.trim()}`);
  }

  const system = parts.join("\n\n---\n\n");

  // Strip any client-sent system messages; we control the system prompt.
  const messages = body.messages.filter((m) => m.role !== "system");

  // Attach images (if any) to the last user message as multimodal content.
  if (body.images?.length) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role !== "user") continue;
      const text = typeof messages[i].content === "string" ? (messages[i].content as string) : "";
      const parts: ContentPart[] = [
        ...(text ? [{ type: "text" as const, text }] : []),
        ...body.images.map((url) => ({ type: "image" as const, url })),
      ];
      messages[i] = { role: "user", content: parts };
      break;
    }
  }

  try {
    const gen = stream({
      provider: body.provider,
      model: body.model,
      system,
      messages,
      temperature: 0.9,
    });
    return streamToResponse(gen);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
