import { NextResponse } from "next/server";
import { createSsrClient } from "@/lib/supabase/ssr";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; relationId: string }> },
) {
  const { relationId } = await params;
  const db = await createSsrClient();

  const { error } = await db.from("relations").delete().eq("id", relationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
