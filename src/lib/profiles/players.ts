import { cache } from "react";

import { requireUser } from "@/src/lib/auth/dal";
import { asUuid } from "@/src/lib/forms";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export type PlayerProfile = { id: string; name: string; memberSince: string };

/**
 * Another player's public-within-the-app identity. RLS returns the profile
 * only to the player themselves or someone who shares a group with them, so
 * null means "not found" and "not yours" alike. Email is never selected.
 */
export const getPlayer = cache(
  async (playerId: string): Promise<PlayerProfile | null> => {
    await requireUser(`/players/${playerId}`);
    if (!asUuid(playerId)) return null;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, created_at")
      .eq("id", playerId)
      .maybeSingle();

    if (error) throw error;
    return data
      ? { id: data.id, name: data.display_name, memberSince: data.created_at }
      : null;
  },
);

/** Display names for a set of ids, where the viewer may read them. */
export async function getNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", [...new Set(ids)]);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.id, row.display_name]));
}
