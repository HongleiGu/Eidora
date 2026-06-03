import { NextResponse } from "next/server";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";
import { getImageGen, type ImageProviderName } from "@/lib/imagegen";
import { getStorage, assetKey } from "@/lib/storage";

/**
 * POST /api/projects/[slug]/generate-image
 * Body: { prompt, provider?, model? }
 * Generates an image, stores it via the storage abstraction, returns { url, key }.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    prompt?: string; provider?: ImageProviderName; model?: string;
  };
  if (!body.prompt?.trim()) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  const db = await createSsrClient();
  const { data: project } = await db.from("projects").select("id").eq("slug", slug).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    const img = await getImageGen(body.provider).generate({ prompt: body.prompt.trim(), model: body.model });
    const ext = img.contentType.includes("png") ? "png" : img.contentType.includes("webp") ? "webp" : "jpg";
    const key = assetKey(project.id, `generated.${ext}`);
    const storage = getStorage();
    await storage.put({ key, body: img.data, contentType: img.contentType });
    return NextResponse.json({ url: storage.publicUrl(key), key }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
