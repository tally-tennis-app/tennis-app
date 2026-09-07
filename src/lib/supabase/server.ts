import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { readPublicEnv } from "@/src/lib/env";
import type { Database } from "@/src/lib/supabase/database.types";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabasePublishableKey } = readPublicEnv();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. `proxy.ts` refreshes the
          // session and applies the rotated cookies before the route renders,
          // so swallowing this here loses nothing.
        }
      },
    },
  });
}
