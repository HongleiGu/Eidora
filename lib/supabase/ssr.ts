import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Request-scoped Supabase client (anon key + the user's session cookies).
 * RLS is enforced as the logged-in user. Use this in server components,
 * route handlers, and server actions — NOT the service-role admin client.
 */
export async function createSsrClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In Server Components, cookie writes throw — safe to ignore because
          // the proxy refreshes the session. Writes succeed in actions/handlers.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* no-op in read-only contexts */
          }
        },
      },
    },
  );
}

/** Get the current authenticated user (or null). */
export async function getCurrentUser() {
  const supabase = await createSsrClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
