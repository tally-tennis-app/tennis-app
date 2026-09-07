/**
 * Pure routing rules for authentication redirects.
 *
 * Kept free of Supabase and Next request objects so the branching can be tested
 * directly. `proxy.ts` supplies the session state and performs the redirect.
 */

/** Signed-out pages that an authenticated user should be bounced away from. */
export const authPages = ["/login", "/signup", "/reset-password"] as const;

/** Pages reachable without a session. */
const publicPages = new Set<string>([
  "/",
  ...authPages,
  "/auth/callback",
  "/auth/confirm",
]);

/** Where an authenticated user lands when they have no specific destination. */
export const signedInLandingPath = "/dashboard";

export function isPublicPath(pathname: string): boolean {
  return publicPages.has(pathname);
}

/**
 * A `next` parameter arrives from the URL, so it is attacker-controlled. Only a
 * path on this origin is allowed: it must start with a single slash. `//host`
 * and `/\host` are protocol-relative URLs that browsers resolve off-site, so
 * they are rejected rather than sanitised.
 */
export function safeRedirectPath(
  candidate: string | null | undefined,
): string | null {
  if (!candidate || !candidate.startsWith("/")) {
    return null;
  }

  if (candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return null;
  }

  return candidate;
}

export function loginPathFor(pathname: string): string {
  return `/login?next=${encodeURIComponent(pathname)}`;
}

/**
 * Returns the path to redirect to, or null to let the request through.
 *
 * This is an optimistic check only. Next's proxy does not cover Server
 * Functions reliably, so every route that reads user data verifies the session
 * again through the data access layer, and RLS is the real boundary.
 */
export function resolveAuthRedirect({
  pathname,
  isAuthenticated,
}: {
  pathname: string;
  isAuthenticated: boolean;
}): string | null {
  if (!isAuthenticated && !isPublicPath(pathname)) {
    return loginPathFor(pathname);
  }

  if (isAuthenticated && (authPages as readonly string[]).includes(pathname)) {
    return signedInLandingPath;
  }

  return null;
}
