"use client";

import { createBrowserClient } from "@supabase/ssr";

import { readPublicEnv, type EnvironmentSource } from "@/src/lib/env";

export function createSupabaseBrowserClient(source?: EnvironmentSource) {
  const { supabaseUrl, supabasePublishableKey } = readPublicEnv(source);

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
