import { NextResponse } from "next/server";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";
import { getSession, revealEntity, unrevealEntity } from "@/lib/sessions";
import type { EntityType } from "@/lib/types";

/**
 * Manual GM reveal/unreveal (EID-107). Role-gated to owner/admin/gm — a human
 * stepping in. Body: { type, slug, reveal: boolean }.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; sessionId: string }> },
) {
  const { slug, sessionId } = await params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { type?: string; slug?: string; reveal?: boolean };
  if (!body.type || !body.slug) return NextResponse.json({ error: "type and slug required" }, { status: 400 });

  const db = await createSsrClient();
  const { data: project } = await db.from("projects").select("id, owner_id").eq("slug", slug).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Role gate: owner, admin, or gm.
  const { data: mem } = await db
    .from("project_members").select("role").eq("project_id", project.id).eq("user_id", user.id).maybeSingle();
  const canGm = project.owner_id === user.id || mem?.role === "admin" || mem?.role === "gm";
  if (!canGm) return NextResponse.json({ error: "GM role required" }, { status: 403 });

  const session = await getSession(sessionId);
  if (!session || session.projectId !== project.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    if (body.reveal === false) await unrevealEntity(sessionId, body.type as EntityType, body.slug);
    else await revealEntity(sessionId, body.type as EntityType, body.slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
