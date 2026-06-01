import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";

interface WorldRow {
  name: string;
  era: string | null;
  genre: string[] | null;
  description: string | null;
}

interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  created_at: string;
  updated_at: string;
  worlds: WorldRow | WorldRow[] | null;
}

const GENRE_COLORS: Record<string, string> = {
  detective: "bg-amber-50 text-amber-700 border-amber-200",
  mystery: "bg-amber-50 text-amber-700 border-amber-200",
  horror: "bg-red-50 text-red-700 border-red-200",
  fantasy: "bg-violet-50 text-violet-700 border-violet-200",
  "sci-fi": "bg-sky-50 text-sky-700 border-sky-200",
  historical: "bg-stone-100 text-stone-600 border-stone-300",
  contemporary: "bg-green-50 text-green-700 border-green-200",
  thriller: "bg-orange-50 text-orange-700 border-orange-200",
  coc: "bg-red-50 text-red-700 border-red-200",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function world(row: ProjectRow): WorldRow | null {
  if (!row.worlds) return null;
  return Array.isArray(row.worlds) ? (row.worlds[0] ?? null) : row.worlds;
}

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await createSsrClient();
  const { data } = await db
    .from("projects")
    .select("id, slug, name, created_at, updated_at, worlds(name, era, genre, description)")
    .order("updated_at", { ascending: false });

  const projects = (data ?? []) as ProjectRow[];

  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f5]">
      <Nav />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <h2 className="mb-8 font-display text-2xl font-medium text-stone-800 italic">
              Your projects
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => {
                const w = world(p);
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.slug}`}
                    className="group flex flex-col gap-3 rounded-sm border border-stone-200 bg-white p-6 shadow-sm transition-all hover:border-stone-300 hover:shadow-md paper"
                  >
                    {/* Genre pills */}
                    {w?.genre && w.genre.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {w.genre.slice(0, 3).map((g) => (
                          <span
                            key={g}
                            className={`rounded-sm border px-2 py-0.5 text-xs font-medium capitalize ${GENRE_COLORS[g.toLowerCase()] ?? "bg-stone-50 text-stone-600 border-stone-200"}`}
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Title */}
                    <div>
                      <h3 className="font-display text-lg font-semibold leading-snug text-stone-900 group-hover:text-stone-700">
                        {p.name}
                      </h3>
                      {w && (
                        <p className="mt-1 text-sm text-stone-500">
                          {w.name}
                          {w.era ? ` · ${w.era}` : ""}
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    {w?.description && (
                      <p className="line-clamp-2 text-sm leading-relaxed text-stone-500">
                        {w.description}
                      </p>
                    )}

                    {/* Footer */}
                    <p className="mt-auto pt-2 text-xs text-stone-400">
                      Updated {timeAgo(p.updated_at)}
                    </p>
                  </Link>
                );
              })}

              {/* New project card */}
              <Link
                href="/projects/new"
                className="flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-stone-300 bg-transparent p-6 text-stone-400 transition-colors hover:border-stone-400 hover:text-stone-600"
              >
                <span className="text-2xl">+</span>
                <span className="text-sm font-medium">New project</span>
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-32">
      <div className="max-w-sm rounded-sm border border-stone-200 bg-white p-12 text-center shadow-sm paper">
        <p className="font-display text-4xl text-stone-300 select-none">◆</p>
        <h2 className="mt-4 font-display text-2xl font-medium italic text-stone-800">
          Your stories await.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-500">
          Create a project to start building worlds, characters, and scenarios for your stories and games.
        </p>
        <Link
          href="/projects/new"
          className="mt-8 inline-block rounded-sm bg-stone-800 px-6 py-2.5 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700"
        >
          + New Project
        </Link>
      </div>
    </div>
  );
}
