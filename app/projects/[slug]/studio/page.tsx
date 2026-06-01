import { notFound, redirect } from "next/navigation";
import Studio from "@/components/studio";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";

export const metadata = { title: "Studio — Eidora" };

export default async function StudioPage({
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

  const { data: entities } = await db
    .from("entities")
    .select("entity_type, slug, name")
    .eq("project_id", project.id)
    .order("name");

  const entityList = (entities ?? []).map((e) => ({
    type: e.entity_type as string,
    slug: e.slug as string,
    name: e.name as string,
  }));

  return (
    <Studio
      projectSlug={slug}
      projectName={project.name}
      entities={entityList}
    />
  );
}
