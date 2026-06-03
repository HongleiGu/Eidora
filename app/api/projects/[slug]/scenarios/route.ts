import { NextResponse } from "next/server";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";
import { createScenarioBundle, type ScenarioBundle } from "@/lib/scenarios";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { bundle, gameType } = (await request.json().catch(() => ({}))) as { bundle?: ScenarioBundle; gameType?: string };
  if (!bundle?.scenario?.name?.trim()) {
    return NextResponse.json({ error: "bundle.scenario.name is required" }, { status: 400 });
  }

  const db = await createSsrClient();
  const { data: project } = await db
    .from("projects").select("id, worlds(slug)").eq("slug", slug).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const worldSlug = (project.worlds as unknown as { slug: string }[] | null)?.[0]?.slug ?? "";

  try {
    const { scenarioSlug, counts } = await createScenarioBundle(project.id, worldSlug, bundle, gameType ?? "detective");
    return NextResponse.json({ slug: scenarioSlug, created: counts }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
