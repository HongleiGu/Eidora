/**
 * Dev helper: instantly confirm a user's email (bypasses the rate-limited mailer).
 * For local development only.
 *
 * Usage: pnpm tsx --env-file=.env scripts/confirm-user.ts <email>
 */
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: pnpm tsx --env-file=.env scripts/confirm-user.ts <email>");
  process.exit(1);
}

const url = `https://${process.env.SUPABASE_URL}`;
const svc = process.env.SUPABASE_SERVICE_ROLE;
if (!svc) { console.error("SUPABASE_SERVICE_ROLE not set"); process.exit(1); }

const admin = createClient(url, svc, { auth: { persistSession: false } });

(async () => {
  // Find the user by email (paginate the first page; fine for dev volumes).
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) { console.error(error.message); process.exit(1); }

  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) { console.error(`No user found for ${email}`); process.exit(1); }

  if (user.email_confirmed_at) {
    console.log(`${email} is already confirmed.`);
    return;
  }

  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
  if (updErr) { console.error(updErr.message); process.exit(1); }
  console.log(`Confirmed ${email} (id ${user.id}). You can now log in.`);
})();
