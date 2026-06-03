import { NextResponse } from "next/server";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";
import { forkTemplate } from "@/lib/world";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { name?: string };

    // Resolve the source template (RLS ensures the user can read it).
    const db = await createSsrClient();
    const { data: template } = await db
      .from("projects")
      .select("id, name")
      .eq("slug", slug)
      .maybeSingle();
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const newName = body.name?.trim() || `${template.name} (Campaign)`;
    const newSlug = await forkTemplate(template.id, newName);

    return NextResponse.json({ slug: newSlug }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
