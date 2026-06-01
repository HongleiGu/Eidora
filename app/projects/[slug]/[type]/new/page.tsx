import { notFound } from "next/navigation";
import Nav from "@/components/nav";
import NewEntityForm from "@/components/new-entity-form";
import type { EntityType } from "@/lib/types";

const VALID_TYPES = new Set(["character","location","artifact","lore","document","scenario"]);
const TYPE_LABELS: Record<string, string> = {
  character: "Character", location: "Location", artifact: "Artifact",
  lore: "Lore Entry", document: "Document", scenario: "Scenario",
};

export default async function NewEntityPage({
  params,
}: {
  params: Promise<{ slug: string; type: string }>;
}) {
  const { slug, type } = await params;
  if (!VALID_TYPES.has(type)) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f5]">
      <Nav back={{ href: `/projects/${slug}?type=${type}`, label: TYPE_LABELS[type] ?? "Back" }} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-stone-900">
            New {TYPE_LABELS[type]}
          </h1>
          <p className="mt-1.5 text-sm text-stone-500">
            All fields except name are optional — you can always edit later.
          </p>
        </div>
        <NewEntityForm projectSlug={slug} entityType={type as EntityType} />
      </main>
    </div>
  );
}
