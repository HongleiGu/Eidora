import { NextResponse } from "next/server";
import { createProject, createWorld } from "@/lib/world";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";

export async function GET() {
  const db = await createSsrClient();
  const { data, error } = await db
    .from("projects")
    .select("id, slug, name, created_at, updated_at, worlds(name, era, genre, description)")
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      name: string;
      worldName: string;
      era?: string;
      genre?: string[];
      description?: string;
    };

    if (!body.name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!body.worldName?.trim()) return NextResponse.json({ error: "worldName is required" }, { status: 400 });

    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const project = await createProject(body.name.trim(), user.id);
    await createWorld(project.id, {
      name: body.worldName.trim(),
      era: body.era,
      genre: body.genre ?? [],
      description: body.description,
      timelines: [],
      content: "",
      visibility: "public",
    });

    return NextResponse.json({ slug: project.slug }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
