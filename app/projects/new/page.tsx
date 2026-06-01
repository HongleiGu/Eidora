import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import NewProjectForm from "@/components/new-project-form";
import { getCurrentUser } from "@/lib/supabase/ssr";

export const metadata = { title: "New Project — Eidora" };

export default async function NewProjectPage() {
  if (!(await getCurrentUser())) redirect("/login");
  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f5]">
      <Nav back={{ href: "/", label: "Projects" }} />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold text-stone-900">
            New Project
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            A project holds your world, characters, locations, and scenarios.
          </p>
        </div>
        <NewProjectForm />
      </main>
    </div>
  );
}
