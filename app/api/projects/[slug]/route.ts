import { NextResponse } from "next/server";
import { createSsrClient } from "@/lib/supabase/ssr";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const db = await createSsrClient();

  const { data, error } = await db
    .from("projects")
    .select("id, slug, name, created_at, updated_at, worlds(name, era, genre, description, content, timelines)")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(data);
}
