import { NextResponse } from "next/server";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";
import { createSession } from "@/lib/sessions";
import { generateBible } from "@/lib/play/bible";

/** POST /api/projects/[slug]/sessions — start a new play session for a scenario.
 *  Generates & persists the scenario's canonical "bible" (ground truth) on first play. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { scenarioSlug?: string; name?: string };
  if (!body.scenarioSlug) return NextResponse.json({ error: "scenarioSlug is required" }, { status: 400 });

  const db = await createSsrClient();
  const { data: project } = await db.from("projects").select("id").eq("slug", slug).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { data: scenario } = await db
    .from("entities")
    .select("name, content, secrets, front_matter")
    .eq("project_id", project.id)
    .eq("entity_type", "scenario")
    .eq("slug", body.scenarioSlug)
    .maybeSingle();
  if (!scenario) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });

  const sfm = (scenario.front_matter ?? {}) as Record<string, unknown>;
  let generatedBible = false;

  // Ensure the scenario has a canonical ground truth (generate once, persist).
  if (typeof sfm.bible !== "string" || !sfm.bible) {
    try {
      const game = (sfm.game ?? {}) as Record<string, unknown>;
      const premise = typeof game.premise === "string" ? game.premise : (scenario.content ?? "");
      const gameType = typeof sfm.gameType === "string" ? sfm.gameType : "story";

      const [{ data: ents }, { data: world }] = await Promise.all([
        db.from("entities").select("entity_type, name, content, secrets").eq("project_id", project.id).neq("entity_type", "scenario"),
        db.from("worlds").select("name, era, genre, description, content").eq("project_id", project.id).maybeSingle(),
      ]);

      const worldText = world
        ? `${world.name}${world.era ? ` (${world.era})` : ""}${world.genre?.length ? ` — ${(world.genre as string[]).join(", ")}` : ""}\n${world.description ?? ""}\n${world.content ?? ""}`.trim()
        : undefined;

      const cast = (ents ?? []).map((e) => ({
        name: e.name as string, type: e.entity_type as string,
        content: (e.content as string | null) ?? "", secrets: (e.secrets as string | null) ?? "",
      }));

      const bible = await generateBible({
        gameType, worldText, scenarioName: scenario.name, premise,
        solution: scenario.secrets ?? "", cast,
      });

      await db.from("entities")
        .update({ front_matter: { ...sfm, bible } })
        .eq("project_id", project.id).eq("entity_type", "scenario").eq("slug", body.scenarioSlug);
      generatedBible = true;
    } catch (err) {
      // Non-fatal: play can still proceed without a bible (GM falls back to solution).
      console.error("bible generation failed:", (err as Error).message);
    }
  }

  const player = user.email?.split("@")[0];
  const name = body.name?.trim() || scenario.name;

  try {
    const session = await createSession(project.id, body.scenarioSlug, name, player);
    return NextResponse.json({ id: session.id, generatedBible }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
