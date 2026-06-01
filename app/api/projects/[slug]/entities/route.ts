import { NextResponse } from "next/server";
import { createSsrClient } from "@/lib/supabase/ssr";
import { createEntity } from "@/lib/entities";
import type { EntityType } from "@/lib/types";

const VALID_TYPES = new Set<string>(["character","location","artifact","lore","document","scenario"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const body = await request.json() as {
      type: string;
      name: string;
      visibility?: string;
      content?: string;
      secrets?: string;
      frontMatter?: Record<string, unknown>;
    };

    if (!VALID_TYPES.has(body.type))
      return NextResponse.json({ error: `Invalid entity type: ${body.type}` }, { status: 400 });
    if (!body.name?.trim())
      return NextResponse.json({ error: "name is required" }, { status: 400 });

    // Resolve project slug → id
    const db = await createSsrClient();
    const { data: project } = await db
      .from("projects").select("id").eq("slug", slug).maybeSingle();
    if (!project)
      return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const entity = await createEntity(project.id, body.type as EntityType, {
      name: body.name.trim(),
      visibility: (body.visibility ?? "public") as "public" | "gm_only" | "author_only",
      content: body.content ?? "",
      secrets: body.secrets ?? "",
      frontMatter: body.frontMatter ?? {},
    });

    return NextResponse.json({ slug: entity.slug, id: entity.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
