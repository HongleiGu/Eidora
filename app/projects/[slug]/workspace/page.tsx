import { notFound, redirect } from "next/navigation";
import Nav from "@/components/nav";
import WorkspaceExplorer, { type TreeEntity } from "@/components/workspace-explorer";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";

export const metadata = { title: "Workspace — Eidora" };

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await getCurrentUser())) redirect("/login");

  const db = await createSsrClient();
  const { data: project } = await db
    .from("projects").select("id, name").eq("slug", slug).maybeSingle();
  if (!project) notFound();

  const { data: rows } = await db
    .from("entities")
    .select("entity_type, slug, name, front_matter")
    .eq("project_id", project.id)
    .order("name");

  const entities: TreeEntity[] = (rows ?? []).map((r) => {
    const fm = (r.front_matter ?? {}) as Record<string, unknown>;
    return {
      type: r.entity_type as string,
      slug: r.slug as string,
      name: r.name as string,
      image: typeof fm.image === "string" ? fm.image : undefined,
    };
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f5]">
      <Nav back={{ href: `/projects/${slug}`, label: project.name }} />
      <WorkspaceExplorer projectSlug={slug} entities={entities} />
    </div>
  );
}
