import { notFound } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/nav";
import RelationsSection from "@/components/relations-section";
import DeleteEntityBtn from "@/components/delete-entity-btn";
import Markdown from "@/components/markdown";
import { createSsrClient } from "@/lib/supabase/ssr";
import type { EntityType } from "@/lib/types";

// ── Config ────────────────────────────────────────────────────────────────────

const VALID_TYPES = new Set(["character","location","artifact","lore","document","scenario"]);

const TYPE_LABELS: Record<string, string> = {
  character: "Characters", location: "Locations", artifact: "Artifacts",
  lore: "Lore", document: "Documents", scenario: "Scenarios",
};

const TYPE_COLORS: Record<string, { badge: string; dot: string }> = {
  character: { badge: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-400" },
  location:  { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
  artifact:  { badge: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-400" },
  lore:      { badge: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-400" },
  document:  { badge: "bg-sky-50 text-sky-700 border-sky-200",         dot: "bg-sky-400" },
  scenario:  { badge: "bg-rose-50 text-rose-700 border-rose-200",      dot: "bg-rose-400" },
};

// ── Metadata display ──────────────────────────────────────────────────────────

function MetaGrid({ pairs }: { pairs: [string, string][] }) {
  const visible = pairs.filter(([, v]) => v);
  if (!visible.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
      {visible.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase tracking-wider text-stone-400">{label}</dt>
          <dd className="mt-0.5 text-sm capitalize text-stone-700">{value.replace(/_/g, " ")}</dd>
        </div>
      ))}
    </dl>
  );
}

function buildMeta(type: string, fm: Record<string, unknown>): [string, string][] {
  switch (type) {
    case "character": return [
      ["Role", String(fm.role ?? "")],
      ["Status", String(fm.status ?? "")],
      ["Location", String(fm.location ?? "")],
      ["Faction", Array.isArray(fm.faction) ? fm.faction.join(", ") : String(fm.faction ?? "")],
    ];
    case "location": return [
      ["Type", String(fm.locationType ?? "")],
      ["Parent", String(fm.parent ?? "")],
      ["Tags", Array.isArray(fm.tags) ? fm.tags.join(", ") : ""],
    ];
    case "artifact": return [
      ["Type", String(fm.artifactType ?? "")],
      ["Location", String(fm.location ?? "")],
      ["Owner", String(fm.owner ?? "")],
    ];
    case "lore": return [
      ["Type", String(fm.loreType ?? "")],
      ["Tags", Array.isArray(fm.tags) ? fm.tags.join(", ") : ""],
    ];
    case "document": return [
      ["Type", String(fm.documentType ?? "")],
      ["Scenario", String(fm.scenario ?? "")],
    ];
    case "scenario": return [
      ["Game Type", String(fm.gameType ?? "")],
      ["World", String(fm.world ?? "")],
    ];
    default: return [];
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ slug: string; type: string; entitySlug: string }>;
}) {
  const { slug, type, entitySlug } = await params;
  if (!VALID_TYPES.has(type)) notFound();

  const db = await createSsrClient();

  const { data: projectData } = await db
    .from("projects").select("id, name").eq("slug", slug).maybeSingle();
  if (!projectData) notFound();

  const { data: entity } = await db
    .from("entities")
    .select("id, slug, name, entity_type, visibility, content, secrets, front_matter, created_at, updated_at")
    .eq("project_id", projectData.id)
    .eq("entity_type", type)
    .eq("slug", entitySlug)
    .maybeSingle();
  if (!entity) notFound();

  const { data: relationsData } = await db
    .from("relations")
    .select("id, source_slug, target_slug, relation_type, attitude, two_way, note")
    .eq("project_id", projectData.id)
    .or(`source_slug.eq.${entitySlug},target_slug.eq.${entitySlug}`)
    .order("created_at");

  const fm = (entity.front_matter ?? {}) as Record<string, unknown>;
  const meta = buildMeta(type, fm);
  const colors = TYPE_COLORS[type] ?? TYPE_COLORS.character;
  const appearance = type === "character" ? String((fm.traits as Record<string,unknown> | undefined)?.appearance ?? "") : "";
  const premise = type === "scenario" ? String((fm.game as Record<string,unknown> | undefined)?.premise ?? "") : "";
  const image = typeof fm.image === "string" ? fm.image : "";

  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f5]">
      <Nav back={{ href: `/projects/${slug}?type=${type}`, label: TYPE_LABELS[type] ?? "Back" }} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
              <span className={`rounded-sm border px-2 py-0.5 text-xs font-medium capitalize ${colors.badge}`}>
                {type}
              </span>
              {entity.visibility !== "public" && (
                <span className="rounded-sm border border-stone-200 bg-stone-50 px-2 py-0.5 text-xs text-stone-500">
                  {entity.visibility === "gm_only" ? "GM Only" : "Private"}
                </span>
              )}
              {fm.reveal === "secret" && (
                <span className="rounded-sm border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700" title="Hidden from players until revealed during a session">
                  🔒 Secret
                </span>
              )}
            </div>
            <h1 className="font-display text-3xl font-semibold text-stone-900">{entity.name}</h1>
            {appearance && <p className="mt-1 text-sm italic text-stone-500">{appearance}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/projects/${slug}/${type}/${entitySlug}/edit`}
              className="rounded-sm border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-50"
            >
              Edit
            </Link>
            <DeleteEntityBtn projectSlug={slug} entityType={type} entitySlug={entitySlug} />
          </div>
        </div>

        {/* Hero image */}
        {image && (
          <div className="mb-8 overflow-hidden rounded-sm border border-stone-200 bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={entity.name} className="max-h-96 w-full object-cover" />
          </div>
        )}

        {/* Metadata */}
        {meta.some(([, v]) => v) && (
          <section className="mb-8 rounded-sm border border-stone-200 bg-white p-6 paper">
            <MetaGrid pairs={meta} />
          </section>
        )}

        {/* Premise (scenarios) */}
        {premise && (
          <section className="mb-8 rounded-sm border border-stone-200 bg-white p-6 paper">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-stone-400">Premise</h2>
            <p className="text-sm leading-relaxed text-stone-700">{premise}</p>
          </section>
        )}

        {/* Content */}
        {entity.content && (
          <section className="mb-8 rounded-sm border border-stone-200 bg-white p-6 paper">
            <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-stone-400">Notes</h2>
            <Markdown>{entity.content}</Markdown>
          </section>
        )}

        {/* Secrets */}
        {entity.secrets && (
          <section className="rounded-sm border border-dashed border-stone-300 bg-stone-50 p-6">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-stone-500">
              <span className="rounded-sm bg-stone-200 px-1.5 py-0.5 text-stone-600">GM</span>
              Secrets
            </h2>
            <Markdown className="italic text-stone-700">{entity.secrets}</Markdown>
          </section>
        )}

        {/* Empty state */}
        {!entity.content && !entity.secrets && !meta.some(([, v]) => v) && (
          <div className="rounded-sm border border-dashed border-stone-200 bg-white py-16 text-center">
            <p className="text-sm text-stone-400">No details added yet.</p>
            <Link
              href={`/projects/${slug}/${type}/${entitySlug}/edit`}
              className="mt-4 inline-block text-sm font-medium text-stone-700 underline underline-offset-4 hover:text-stone-900"
            >
              Add details →
            </Link>
          </div>
        )}

        {/* Relations */}
        <div className="mt-8">
          <RelationsSection
            projectSlug={slug}
            entitySlug={entitySlug}
            initialRelations={relationsData ?? []}
          />
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-stone-400">
          Created {new Date(entity.created_at).toLocaleDateString()}
          {entity.updated_at !== entity.created_at && ` · Updated ${new Date(entity.updated_at).toLocaleDateString()}`}
        </p>
      </main>
    </div>
  );
}
