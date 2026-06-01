"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSsrClient } from "@/lib/supabase/ssr";

export interface AuthResult {
  error?: string;
  /** Set after signup when an email confirmation must be clicked. */
  needsConfirmation?: boolean;
  email?: string;
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

export async function login(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createSsrClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/");
}

export async function signup(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  const supabase = await createSsrClient();
  const origin = await requestOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };

  // When email confirmation is required, no session is returned yet.
  if (!data.session) return { needsConfirmation: true, email };

  redirect("/");
}

export async function signout() {
  const supabase = await createSsrClient();
  await supabase.auth.signOut();
  redirect("/login");
}
