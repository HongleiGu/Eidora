import { NextResponse } from "next/server";
import { createSsrClient } from "@/lib/supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Email-confirmation / OAuth callback.
 * Handles both flows so it works with Supabase's default email template:
 *   - PKCE:       ?code=...                 → exchangeCodeForSession
 *   - token_hash: ?token_hash=...&type=...  → verifyOtp
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createSsrClient();
  const fail = (msg: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? fail(error.message) : NextResponse.redirect(`${origin}${next}`);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return error ? fail(error.message) : NextResponse.redirect(`${origin}${next}`);
  }

  return fail("Invalid or expired confirmation link.");
}
