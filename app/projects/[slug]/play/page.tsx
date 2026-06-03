import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Nav from "@/components/nav";
import NewSessionForm from "@/components/new-session-form";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";

export const metadata = { title: "Play — Eidora" };

interface SessionRow { id: string; name: string; scenario_slug: string; created_at: string; }

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default async function PlayListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await getCurrentUser())) redirect("/login");

  const db = await createSsrClient();
  const { data: project } = await db.from("projects").select("id, name").eq("slug", slug).maybeSingle();
  if (!project) notFound();

  const [{ data: scenarios }, { data: sessions }] = await Promise.all([
    db.from("entities").select("slug, name, front_matter").eq("project_id", project.id).eq("entity_type", "scenario").order("name"),
    db.from("sessions").select("id, name, scenario_slug, created_at").eq("project_id", project.id).order("created_at", { ascending: false }),
  ]);

  const scenarioOpts = (scenarios ?? []).map((s) => {
    const fm = (s.front_matter ?? {}) as Record<string, unknown>;
    return {
      slug: s.slug as string,
      name: s.name as string,
      gameType: fm.gameType as string | undefined,
      hasBible: typeof fm.bible === "string" && !!fm.bible,
    };
  });
  const sessionRows = (sessions ?? []) as SessionRow[];

  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f5]">
      <Nav back={{ href: `/projects/${slug}`, label: project.name }} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="font-display text-3xl font-semibold text-stone-900">Play</h1>
        <p className="mt-1.5 text-sm text-stone-500">Start a new session, or resume one in progress.</p>

        <div className="mt-6">
          <NewSessionForm projectSlug={slug} scenarios={scenarioOpts} />
        </div>

        <h2 className="mt-10 mb-3 text-sm font-medium text-stone-600">
          Sessions <span className="text-stone-400">({sessionRows.length})</span>
        </h2>
        {sessionRows.length === 0 ? (
          <p className="rounded-sm border border-dashed border-stone-200 bg-white py-12 text-center text-sm text-stone-400">
            No sessions yet.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-sm border border-stone-200 bg-white">
            {sessionRows.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/projects/${slug}/play/${s.id}`}
                  className="flex items-center justify-between border-b border-stone-100 px-5 py-3 transition-colors hover:bg-stone-50 last:border-b-0"
                >
                  <span className="text-sm font-medium text-stone-800">{s.name}</span>
                  <span className="text-xs text-stone-400">{timeAgo(s.created_at)} · resume →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
