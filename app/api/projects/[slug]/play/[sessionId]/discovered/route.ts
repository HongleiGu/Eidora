import { NextResponse } from "next/server";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";
import { getSession } from "@/lib/sessions";
import { getDiscovered } from "@/lib/play";

/** GET player-visible discovered entities for a session. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; sessionId: string }> },
) {
  const { slug, sessionId } = await params;

  if (!(await getCurrentUser())) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = await createSsrClient();
  const { data: project } = await db.from("projects").select("id").eq("slug", slug).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const session = await getSession(sessionId);
  if (!session || session.projectId !== project.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(await getDiscovered(sessionId));
}
