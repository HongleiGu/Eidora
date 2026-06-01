import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/ssr";
import LoginForm from "./login-form";

export const metadata = { title: "Sign in — Eidora" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf8f5] px-6">
      <LoginForm initialError={error} />
    </div>
  );
}
