import { NextResponse } from "next/server";
import { createSsrClient } from "@/lib/supabase/ssr";

async function resolveProjectId(slug: string): Promise<string | null> {
  const db = await createSsrClient();
  const { data } = await db.from("projects").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

/** GET /api/projects/[slug]/relations?entity=[entitySlug]
 *  Returns all relations where entity is source OR target. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const entitySlug = new URL(request.url).searchParams.get("entity");
  if (!entitySlug) return NextResponse.json({ error: "entity param required" }, { status: 400 });

  const projectId = await resolveProjectId(slug);
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await createSsrClient();
  const { data, error } = await db
    .from("relations")
    .select("id, source_slug, target_slug, relation_type, attitude, two_way, note, created_at")
    .eq("project_id", projectId)
    .or(`source_slug.eq.${entitySlug},target_slug.eq.${entitySlug}`)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** POST /api/projects/[slug]/relations */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const body = await request.json() as {
      sourceSlug: string;
      targetSlug: string;
      relationType: string;
      attitude?: number;
      twoWay?: boolean;
      note?: string;
    };

    if (!body.sourceSlug || !body.targetSlug || !body.relationType)
      return NextResponse.json({ error: "sourceSlug, targetSlug and relationType are required" }, { status: 400 });

    const projectId = await resolveProjectId(slug);
    if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const db = await createSsrClient();
    const row = {
      project_id: projectId,
      source_slug: body.sourceSlug,
      target_slug: body.targetSlug,
      relation_type: body.relationType,
      attitude: body.attitude ?? null,
      two_way: body.twoWay ?? false,
      note: body.note ?? null,
    };

    const { data, error } = await db
      .from("relations")
      .upsert(row, { onConflict: "project_id,source_slug,target_slug,relation_type" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Mirror for two-way
    if (body.twoWay) {
      await db.from("relations").upsert(
        { ...row, source_slug: body.targetSlug, target_slug: body.sourceSlug },
        { onConflict: "project_id,source_slug,target_slug,relation_type" },
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
