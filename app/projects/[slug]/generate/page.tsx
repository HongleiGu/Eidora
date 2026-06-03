import { notFound, redirect } from "next/navigation";
import Nav from "@/components/nav";
import ScenarioGenerator from "@/components/scenario-generator";
import { createSsrClient, getCurrentUser } from "@/lib/supabase/ssr";

export const metadata = { title: "Generate Scenario — Eidora" };

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!(await getCurrentUser())) redirect("/login");

  const db = await createSsrClient();
  const { data: project } = await db
    .from("projects").select("name, worlds(name)").eq("slug", slug).maybeSingle();
  if (!project) notFound();

  const worldName = (project.worlds as unknown as { name: string }[] | null)?.[0]?.name;

  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f5]">
      <Nav back={{ href: `/projects/${slug}?type=scenario`, label: project.name }} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-stone-900">Generate a Scenario</h1>
          <p className="mt-1.5 text-sm text-stone-500">
            The assistant will scaffold a playable scenario{worldName ? ` for ${worldName}` : ""} —
            cast, locations, clues, and a hidden solution. Review, trim, then create.
          </p>
        </div>
        <ScenarioGenerator projectSlug={slug} />
      </main>
    </div>
  );
}
