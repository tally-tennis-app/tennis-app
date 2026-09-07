import { NextResponse } from "next/server";

import { safeRedirectPath, signedInLandingPath } from "@/src/lib/auth/routes";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

/**
 * Exchanges the code from a confirmation or recovery email for a session.
 *
 * Route Handlers can write cookies, so the session is persisted here rather
 * than relying on the proxy.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next =
    safeRedirectPath(searchParams.get("next")) ?? signedInLandingPath;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=link_invalid`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Covers an expired link and one already used. Both are the same to the
    // user: request a fresh email.
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
