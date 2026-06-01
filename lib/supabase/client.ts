import { createBrowserClient } from "@supabase/ssr";

/** Browser-side Supabase client (anon key, cookie-based auth). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
