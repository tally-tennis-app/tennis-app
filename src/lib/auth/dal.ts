import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { loginPathFor } from "@/src/lib/auth/routes";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

/**
 * Data access layer for the current session.
 *
 * `proxy.ts` performs an optimistic redirect, but Next does not guarantee proxy
 * coverage for Server Functions, and a matcher change can silently remove it.
 * Anything that reads or writes user data calls `requireUser()` here instead of
 * trusting the proxy.
 *
 * `cache` deduplicates the auth round trip within a single request, so a layout
 * and its page can both ask without paying twice.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();

  // getUser() validates the token with the auth server. Never trust
  // getSession() for an authorization decision: it only decodes the cookie,
  // which the client controls.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

/** Returns the signed-in user, or redirects to login. */
export async function requireUser(returnTo?: string): Promise<User> {
  const user = await getUser();

  if (!user) {
    redirect(returnTo ? loginPathFor(returnTo) : "/login");
  }

  return user;
}
