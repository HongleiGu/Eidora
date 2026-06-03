import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/nav";
import ForkButton from "@/components/fork-button";
import SuggestButton from "@/components/suggest-button";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";
import type { EntityType } from "@/lib/types";

interface EntityRow {
  id: string;
  slug: string;
  name: string;
  entity_type: string;
  visibility: string;
  front_matter: Record<string, unknown>;
}

const TABS: { type: EntityType; label: string; icon: string }[] = [
  { type: "character", label: "Characters", icon: "◈" },
  { type: "location",  label: "Locations",  icon: "◉" },
  { type: "artifact",  label: "Artifacts",  icon: "◇" },
  { type: "lore",      label: "Lore",       icon: "◎" },
  { type: "document",  label: "Documents",  icon: "◻" },
  { type: "scenario",  label: "Scenarios",  icon: "▶" },
];

const ENTITY_COLORS: Record<string, string> = {
  character: "text-amber-700",
  location:  "text-emerald-700",
  artifact:  "text-violet-700",
  lore:      "text-orange-700",
  document:  "text-sky-700",
  scenario:  "text-rose-700",
};

const DOT_COLORS: Record<string, string> = {
  character: "bg-amber-400",
  location:  "bg-emerald-400",
  artifact:  "bg-violet-400",
  lore:      "bg-orange-400",
  document:  "bg-sky-400",
  scenario:  "bg-rose-400",
};

const GENRE_COLORS: Record<string, string> = {
  detective:    "bg-amber-50 text-amber-700 border-amber-200",
  mystery:      "bg-amber-50 text-amber-700 border-amber-200",
  horror:       "bg-red-50 text-red-700 border-red-200",
  fantasy:      "bg-violet-50 text-violet-700 border-violet-200",
  "sci-fi":     "bg-sky-50 text-sky-700 border-sky-200",
  historical:   "bg-stone-100 text-stone-600 border-stone-300",
  contemporary: "bg-green-50 text-green-700 border-green-200",
  thriller:     "bg-orange-50 text-orange-700 border-orange-200",
  coc:          "bg-red-50 text-red-700 border-red-200",
};

function entityMeta(entity: EntityRow): string[] {
  const fm = entity.front_matter;
  const type = entity.entity_type as EntityType;
  switch (type) {
    case "character": return [fm.role, fm.status, fm.location].filter(Boolean).map(String);
    case "location":  return [fm.locationType, fm.parent].filter(Boolean).map(String);
    case "artifact":  return [fm.artifactType, fm.owner].filter(Boolean).map(String);
    case "lore":      return [fm.loreType, ...(Array.isArray(fm.tags) ? fm.tags.slice(0, 2) : [])].filter(Boolean).map(String);
    case "document":  return [fm.documentType].filter(Boolean).map(String);
    case "scenario":  return [fm.gameType, fm.world].filter(Boolean).map(String);
    default:          return [];
  }
}

function EntityRowItem({ entity, projectSlug }: { entity: EntityRow; projectSlug: string }) {
  const meta = entityMeta(entity);
  const type = entity.entity_type as EntityType;
  const image = typeof entity.front_matter?.image === "string" ? entity.front_matter.image : "";
  const visLabel = entity.visibility === "gm_only" ? "gm"
    : entity.visibility === "author_only" ? "private" : null;

  return (
    <Link
      href={`/projects/${projectSlug}/${type}/${entity.slug}`}
      className="group flex items-center gap-4 border-b border-stone-100 px-6 py-3 transition-colors hover:bg-stone-50 last:border-b-0"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-8 w-8 shrink-0 rounded-sm border border-stone-200 object-cover" />
      ) : (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-stone-100 bg-stone-50">
          <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[type] ?? "bg-stone-400"}`} />
        </span>
      )}
      <span className="flex-1 text-sm font-medium text-stone-800 group-hover:text-stone-900">
        {entity.name}
      </span>
      <div className="flex items-center gap-3">
        {meta.map((m, i) => (
          <span key={i} className="text-xs capitalize text-stone-400">
            {m.replace(/_/g, " ")}
          </span>
        ))}
        {visLabel && (
          <span className="rounded-sm border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-xs text-stone-500">
            {visLabel}
          </span>
        )}
      </div>
    </Link>
  );
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { slug } = await params;
  const { type } = await searchParams;
  const activeType = (TABS.some((t) => t.type === type) ? type : "character") as EntityType;

  if (!(await getCurrentUser())) redirect("/login");
  const db = await createSsrClient();

  const { data: projectData } = await db
    .from("projects")
    .select("id, slug, name, kind, worlds(name, era, genre, description)")
    .eq("slug", slug)
    .maybeSingle();

  if (!projectData) notFound();

  const project = projectData as unknown as {
    id: string; slug: string; name: string; kind: string;
    worlds: { name: string; era: string | null; genre: string[] | null; description: string | null }[] | null;
  };
  const w = project.worlds?.[0] ?? null;
  const isTemplate = project.kind === "template";

  const { data: entities } = await db
    .from("entities")
    .select("id, slug, name, entity_type, visibility, front_matter")
    .eq("project_id", project.id)
    .eq("entity_type", activeType)
    .order("name");

  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f5]">
      <Nav back={{ href: "/", label: "Projects" }} />

      {/* Project header */}
      <div className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2">
                <span className={`rounded-sm border px-2 py-0.5 text-xs font-medium ${isTemplate ? "border-stone-300 bg-stone-100 text-stone-600" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                  {isTemplate ? "Template" : "Campaign"}
                </span>
              </div>
              <h1 className="font-display text-3xl font-semibold text-stone-900">{project.name}</h1>
              {w && (
                <p className="mt-1 text-sm text-stone-500">
                  {w.name}{w.era ? ` · ${w.era}` : ""}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isTemplate && <ForkButton projectSlug={slug} defaultName={`${project.name} (Campaign)`} />}
              <Link
                href={`/projects/${slug}/workspace`}
                className="rounded-sm border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                ⌗ Workspace
              </Link>
              <Link
                href={`/projects/${slug}/play`}
                className="rounded-sm border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                ▶ Play
              </Link>
              <Link
                href={`/projects/${slug}/studio`}
                className="rounded-sm bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700"
              >
                ✶ Open Studio
              </Link>
            </div>
          </div>
          {w?.genre && w.genre.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {w.genre.map((g: string) => (
                <span key={g} className={`rounded-sm border px-2 py-0.5 text-xs font-medium capitalize ${GENRE_COLORS[g.toLowerCase()] ?? "bg-stone-50 text-stone-600 border-stone-200"}`}>
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-5xl px-6">
          <nav className="-mb-px flex">
            {TABS.map((tab) => {
              const active = tab.type === activeType;
              return (
                <Link
                  key={tab.type}
                  href={`/projects/${slug}?type=${tab.type}`}
                  className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${active ? `border-stone-800 ${ENTITY_COLORS[tab.type]}` : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700"}`}
                >
                  <span className="text-xs">{tab.icon}</span>
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Entity list */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-stone-600">
            {TABS.find((t) => t.type === activeType)?.label}{" "}
            <span className="text-stone-400">({entities?.length ?? 0})</span>
          </h2>
          <div className="flex items-center gap-2">
            {activeType === "scenario" && (
              <Link
                href={`/projects/${slug}/generate`}
                className="rounded-sm border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                ✶ Generate
              </Link>
            )}
            <SuggestButton projectSlug={slug} defaultType={activeType} />
            <Link
              href={`/projects/${slug}/${activeType}/new`}
              className="rounded-sm bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-50 transition-colors hover:bg-stone-700"
            >
              + Add
            </Link>
          </div>
        </div>

        {!entities || entities.length === 0 ? (
          <div className="rounded-sm border border-dashed border-stone-200 bg-white py-16 text-center">
            <p className="text-sm text-stone-400">
              No {TABS.find((t) => t.type === activeType)?.label.toLowerCase()} yet.
            </p>
            <Link
              href={`/projects/${slug}/${activeType}/new`}
              className="mt-4 inline-block text-sm font-medium text-stone-700 underline underline-offset-4 hover:text-stone-900"
            >
              Add the first one →
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-sm border border-stone-200 bg-white shadow-sm">
            {(entities as EntityRow[]).map((entity) => (
              <EntityRowItem key={entity.id} entity={entity} projectSlug={slug} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
