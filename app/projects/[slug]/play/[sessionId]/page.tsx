import { notFound, redirect } from "next/navigation";
import Nav from "@/components/nav";
import PlaySession, { type GmEntity } from "@/components/play-session";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";
import { getSession, getLog, getFlags, listRevealed } from "@/lib/sessions";
import { getDiscovered } from "@/lib/play";

export const metadata = { title: "Session — Eidora" };

export default async function PlayScreenPage({
  params,
}: {
  params: Promise<{ slug: string; sessionId: string }>;
}) {
  const { slug, sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await createSsrClient();
  const { data: project } = await db.from("projects").select("id, name, owner_id").eq("slug", slug).maybeSingle();
  if (!project) notFound();

  const session = await getSession(sessionId);
  if (!session || session.projectId !== project.id) notFound();

  const { data: scenario } = await db
    .from("entities")
    .select("name, content, secrets, front_matter")
    .eq("project_id", project.id)
    .eq("entity_type", "scenario")
    .eq("slug", session.scenarioSlug)
    .maybeSingle();

  const sfm = (scenario?.front_matter ?? {}) as Record<string, unknown>;
  const game = (sfm.game ?? {}) as Record<string, unknown>;
  const premise = typeof game.premise === "string" ? game.premise : (scenario?.content ?? "");

  const [log, discovered, flags] = await Promise.all([
    getLog(sessionId),
    getDiscovered(sessionId),
    getFlags(sessionId),
  ]);

  // GM role gate (owner / admin / gm) → enables the step-in panel.
  const { data: mem } = await db
    .from("project_members").select("role").eq("project_id", project.id).eq("user_id", user.id).maybeSingle();
  const canGm = project.owner_id === user.id || mem?.role === "admin" || mem?.role === "gm";

  let gmEntities: GmEntity[] = [];
  let solution = "";
  if (canGm) {
    solution = scenario?.secrets ?? "";
    const [{ data: ents }, revealed] = await Promise.all([
      db.from("entities").select("entity_type, slug, name, front_matter").eq("project_id", project.id).neq("entity_type", "scenario").order("entity_type"),
      listRevealed(sessionId),
    ]);
    gmEntities = (ents ?? []).map((e) => {
      const fm = (e.front_matter ?? {}) as Record<string, unknown>;
      return {
        type: e.entity_type as string,
        slug: e.slug as string,
        name: e.name as string,
        secret: fm.reveal === "secret",
        revealed: revealed.has(`${e.entity_type}:${e.slug}`),
      };
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f5]">
      <Nav back={{ href: `/projects/${slug}/play`, label: "Sessions" }} />
      <PlaySession
        projectSlug={slug}
        sessionId={sessionId}
        scenarioName={scenario?.name ?? session.name}
        premise={premise}
        initialLog={log.filter((e) => e.role === "player" || e.role === "agent").map((e) => ({ role: e.role, content: e.content }))}
        initialDiscovered={discovered}
        initialEnded={flags.__ended === "1"}
        initialOutcome={flags.__outcome}
        canGm={canGm}
        solution={solution}
        gmEntities={gmEntities}
      />
    </div>
  );
}
