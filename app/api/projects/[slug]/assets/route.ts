import { NextResponse } from "next/server";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";
import { getStorage, assetKey } from "@/lib/storage";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED = [/^image\//, /^audio\//, /^application\/pdf$/];

/** POST multipart/form-data with a "file" field → uploads an asset, returns { key, url }. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // RLS: a readable project means the user is owner/member (or it's public).
  const db = await createSsrClient();
  const { data: project } = await db.from("projects").select("id").eq("slug", slug).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File exceeds 25MB" }, { status: 413 });
  if (!ALLOWED.some((re) => re.test(file.type))) {
    return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 415 });
  }

  try {
    const storage = getStorage();
    const key = assetKey(project.id, file.name || "file");
    const body = await file.arrayBuffer();
    await storage.put({ key, body, contentType: file.type });
    return NextResponse.json({ key, url: storage.publicUrl(key) }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** DELETE ?key=<objectKey> → removes an asset. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key param required" }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = await createSsrClient();
  const { data: project } = await db.from("projects").select("id").eq("slug", slug).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // Guard: key must belong to this project's namespace.
  if (!key.startsWith(`projects/${project.id}/`)) {
    return NextResponse.json({ error: "Key does not belong to this project" }, { status: 403 });
  }

  try {
    await getStorage().remove(key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
