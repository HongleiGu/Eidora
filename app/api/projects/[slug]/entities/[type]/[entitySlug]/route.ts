import { NextResponse } from "next/server";
import { createSsrClient } from "@/lib/supabase/ssr";
import { updateEntity, deleteEntity } from "@/lib/entities";
import type { Visibility } from "@/lib/types";

type Params = Promise<{ slug: string; type: string; entitySlug: string }>;

async function resolveProjectId(slug: string): Promise<string | null> {
  const db = await createSsrClient();
  const { data } = await db.from("projects").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

export async function GET(_req: Request, { params }: { params: Params }) {
  const { slug, type, entitySlug } = await params;
  const db = await createSsrClient();

  const projectId = await resolveProjectId(slug);
  if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data, error } = await db
    .from("entities")
    .select()
    .eq("project_id", projectId)
    .eq("entity_type", type)
    .eq("slug", entitySlug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(request: Request, { params }: { params: Params }) {
  const { slug, type, entitySlug } = await params;

  try {
    const body = await request.json() as {
      name?: string;
      visibility?: string;
      content?: string;
      secrets?: string;
      frontMatter?: Record<string, unknown>;
    };

    const projectId = await resolveProjectId(slug);
    if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const entity = await updateEntity(projectId, type as never, entitySlug, {
      name: body.name,
      visibility: body.visibility as Visibility | undefined,
      content: body.content,
      secrets: body.secrets,
      frontMatter: body.frontMatter,
    });

    return NextResponse.json({ slug: entity.slug });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  const { slug, type, entitySlug } = await params;

  try {
    const projectId = await resolveProjectId(slug);
    if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    await deleteEntity(projectId, type as never, entitySlug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
