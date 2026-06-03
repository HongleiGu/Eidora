import { NextResponse } from "next/server";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";
import { getSession } from "@/lib/sessions";
import { runTurnStream } from "@/lib/play";
import type { Provider } from "@/lib/ai";

/**
 * POST /api/projects/[slug]/play/[sessionId]/turn
 * Body: { message, provider?, model? }
 * Streams the GM turn as SSE: {type:"delta",text} chunks, then {type:"done",result}.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; sessionId: string }> },
) {
  const { slug, sessionId } = await params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    message?: string; provider?: Provider; model?: string;
  };
  if (!body.message?.trim()) return NextResponse.json({ error: "message is required" }, { status: 400 });

  // Resolve project (RLS) and verify the session belongs to it.
  const db = await createSsrClient();
  const { data: project } = await db.from("projects").select("id").eq("slug", slug).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const session = await getSession(sessionId);
  if (!session || session.projectId !== project.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runTurnStream(sessionId, body.message!.trim(), { provider: body.provider, model: body.model })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: (err as Error).message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
