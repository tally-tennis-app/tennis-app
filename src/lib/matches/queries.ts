import { cache } from "react";
import { requireUser } from "@/src/lib/auth/dal";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
const selection =
  "*, match_sets(*), groups(name), player_a_profile:profiles!matches_player_a_fkey(display_name), player_b_profile:profiles!matches_player_b_fkey(display_name)" as const;
export const getMatch = cache(async (id: string) => {
  await requireUser(`/matches/${id}`);
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("matches")
    .select(selection)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  return data;
});
export type MatchDetail = NonNullable<Awaited<ReturnType<typeof getMatch>>>;
export async function listMatches({
  groupId,
  page = 0,
  pending = false,
}: { groupId?: string; page?: number; pending?: boolean } = {}) {
  const user = await requireUser("/matches");
  const db = await createSupabaseServerClient();
  let q = db.from("matches").select(selection, { count: "exact" });
  if (groupId) q = q.eq("group_id", groupId);
  else q = q.or(`player_a.eq.${user.id},player_b.eq.${user.id}`);
  if (pending)
    q = q
      .eq("status", "pending")
      .neq("submitted_by", user.id)
      .gte("created_at", new Date(Date.now() - 14 * 86400000).toISOString());
  const { data, error, count } = await q
    .order("played_on", { ascending: false })
    .order("id", { ascending: false })
    .range(page * 25, page * 25 + 24);
  if (error) throw error;
  return { matches: data ?? [], total: count ?? 0 };
}
export async function ratings(groupId?: string) {
  await requireUser("/standings");
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc(
    "get_ratings",
    groupId ? { p_group_id: groupId } : {},
  );
  if (error) throw error;
  return data ?? [];
}
export async function ratingHistory(playerId: string, groupId?: string) {
  await requireUser();
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc("get_rating_history", {
    p_player_id: playerId,
    ...(groupId ? { p_group_id: groupId } : {}),
  });
  if (error) throw error;
  return data ?? [];
}
export async function groupStandings(groupId: string) {
  await requireUser();
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from("group_standings")
    .select("*")
    .eq("group_id", groupId);
  if (error) throw error;
  return data ?? [];
}
export function pageNumber(value: string | string[] | undefined) {
  return typeof value === "string" && /^\d+$/.test(value)
    ? Math.min(Number(value), 100000)
    : 0;
}
