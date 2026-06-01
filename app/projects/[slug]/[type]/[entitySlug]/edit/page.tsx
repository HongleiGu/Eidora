import { notFound } from "next/navigation";
import Nav from "@/components/nav";
import EntityForm from "@/components/entity-form";
import { createSsrClient } from "@/lib/supabase/ssr";
import type { EntityType, Visibility } from "@/lib/types";

const VALID_TYPES = new Set(["character","location","artifact","lore","document","scenario"]);

export default async function EditEntityPage({
  params,
}: {
  params: Promise<{ slug: string; type: string; entitySlug: string }>;
}) {
  const { slug, type, entitySlug } = await params;
  if (!VALID_TYPES.has(type)) notFound();

  const db = await createSsrClient();

  const { data: projectData } = await db
    .from("projects").select("id").eq("slug", slug).maybeSingle();
  if (!projectData) notFound();

  const { data: entity } = await db
    .from("entities")
    .select("name, visibility, content, secrets, front_matter")
    .eq("project_id", projectData.id)
    .eq("entity_type", type)
    .eq("slug", entitySlug)
    .maybeSingle();
  if (!entity) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f5]">
      <Nav back={{ href: `/projects/${slug}/${type}/${entitySlug}`, label: entity.name }} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-stone-900">
            Edit {entity.name}
          </h1>
          <p className="mt-1.5 text-sm text-stone-500 capitalize">{type}</p>
        </div>
        <EntityForm
          projectSlug={slug}
          entityType={type as EntityType}
          mode="edit"
          entitySlug={entitySlug}
          initial={{
            name: entity.name,
            visibility: entity.visibility as Visibility,
            content: entity.content ?? "",
            secrets: entity.secrets ?? "",
            frontMatter: (entity.front_matter ?? {}) as Record<string, unknown>,
          }}
        />
      </main>
    </div>
  );
}
