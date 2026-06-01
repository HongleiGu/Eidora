import { createClient } from '@supabase/supabase-js';

function getUrl() {
  const raw = process.env.SUPABASE_URL ?? '';
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

/**
 * Service-role client — bypasses RLS. Use ONLY for trusted server-side admin
 * operations (scripts, system tasks), never for user-facing requests.
 * User-facing code must use createSsrClient (lib/supabase/ssr) so RLS applies.
 */
export function createAdminClient() {
  const url = getUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE must be set');
  return createClient(url, key, { auth: { persistSession: false } });
}
