import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { signout } from "@/app/auth/actions";

export default async function Nav({ back }: { back?: { href: string; label: string } }) {
  const user = await getCurrentUser();
  const label = user?.email?.split("@")[0] ?? null;

  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-[#faf8f5]/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          {back && (
            <Link
              href={back.href}
              className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
            >
              ← {back.label}
            </Link>
          )}
          <Link
            href="/"
            className="font-display text-xl font-semibold tracking-widest text-stone-900 uppercase"
          >
            Eidora
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <Link
              href="/projects/new"
              className="rounded-sm bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700"
            >
              + New Project
            </Link>
          )}
          {label ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-stone-500" title={user?.email ?? ""}>{label}</span>
              <form action={signout}>
                <button
                  type="submit"
                  className="text-sm text-stone-400 transition-colors hover:text-stone-700"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-sm bg-stone-800 px-4 py-2 text-sm font-medium text-stone-50 transition-colors hover:bg-stone-700"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
