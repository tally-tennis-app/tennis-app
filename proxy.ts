import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { resolveAuthRedirect } from "@/src/lib/auth/routes";
import { readPublicEnv } from "@/src/lib/env";

/**
 * Refreshes the Supabase session on every matched request and applies the
 * rotated auth cookies to the response.
 *
 * Next 16 renamed the `middleware` convention to `proxy`; the export is `proxy`
 * and the runtime is Node.js. Most Supabase guides still show `middleware.ts`.
 *
 * Server Components cannot write cookies, so without this file a refreshed
 * token would be computed and then discarded, and sessions would expire even
 * while the user was active.
 *
 * The redirect here is an optimistic check only. Next does not guarantee proxy
 * coverage for Server Functions, so routes verify the session again through
 * `requireUser()`, and Row Level Security remains the real boundary.
 */
export async function proxy(request: NextRequest) {
  const { supabaseUrl, supabasePublishableKey } = readPublicEnv();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates the token with the auth server and refreshes it when
  // expired, which is what triggers setAll above. getSession() only decodes the
  // existing cookie and would refresh nothing.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const redirectTo = resolveAuthRedirect({
    pathname: request.nextUrl.pathname,
    isAuthenticated: user !== null,
  });

  if (redirectTo) {
    const redirectResponse = NextResponse.redirect(
      new URL(redirectTo, request.url),
    );

    // Carry over any cookies the refresh just rotated. Dropping them here would
    // silently sign the user out on the next request.
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation. Auth needs the
    // proxy on as many routes as possible, but running it on assets would cost
    // an auth round trip per file.
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
};
