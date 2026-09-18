import { cache } from "react";

import { requireUser } from "@/src/lib/auth/dal";
import { asUuid } from "@/src/lib/forms";
import { recentResults } from "@/src/lib/matches/queries";
import {
  rankStandings,
  type FormResult,
  type Standing,
} from "@/src/lib/ratings/types";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

// Ratings come from get_ratings() (20260914015033_derived_ratings.sql), which
// already limits players to the caller and people in the caller's groups.
// Records come from the group_standings view: walkovers count as a win and a
// loss there, though the rating fold skips them.

/**
 * Rated players ranked; unrated ones listed apart, so a table never implies
 * that someone who has not played sits level with a player on 1500.
 */
export const getStandings = cache(
  async (
    groupId?: string,
  ): Promise<{ rated: Standing[]; unrated: Standing[] }> => {
    await requireUser("/standings");
    const group = asUuid(groupId);
    const supabase = await createSupabaseServerClient();

    let records = supabase
      .from("group_standings")
      .select("group_id, user_id, wins, losses");
    if (group) records = records.eq("group_id", group);

    const [ratings, recordRows, results] = await Promise.all([
      supabase.rpc("get_ratings", group ? { p_group_id: group } : {}),
      records,
      recentResults(group),
    ]);
    if (ratings.error) throw ratings.error;
    if (recordRows.error) throw recordRows.error;

    // Overall records add up each player's rows across the viewer's groups.
    const record = new Map<string, { wins: number; losses: number }>();
    for (const row of recordRows.data ?? []) {
      if (!row.user_id) continue;
      const current = record.get(row.user_id) ?? { wins: 0, losses: 0 };
      current.wins += row.wins ?? 0;
      current.losses += row.losses ?? 0;
      record.set(row.user_id, current);
    }

    const form = new Map<string, FormResult[]>();
    for (const result of results) {
      for (const player of [result.player_a, result.player_b]) {
        const strip = form.get(player) ?? [];
        if (strip.length < 5) strip.push(result.winner === player ? "W" : "L");
        form.set(player, strip);
      }
    }

    const rows = (ratings.data ?? []).map((row) => ({
      playerId: row.player_id,
      name: row.display_name,
      rating: row.rating,
      played: row.matches_played,
      wins: record.get(row.player_id)?.wins ?? 0,
      losses: record.get(row.player_id)?.losses ?? 0,
      form: form.get(row.player_id) ?? [],
      lastDelta: null,
      active: row.active,
    }));

    return {
      rated: rankStandings(rows.filter((row) => row.played > 0)),
      unrated: rows
        .filter((row) => row.played === 0 && row.active)
        .map((row) => ({ ...row, rank: 0, tied: false }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
);

export type RatingEvent = {
  matchId: string;
  confirmedAt: string;
  before: number;
  after: number;
};

/**
 * A player's overall rating history, oldest first. get_rating_history() only
 * returns matches in groups the viewer belongs to.
 */
export const getRatingHistory = cache(
  async (playerId: string): Promise<RatingEvent[]> => {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_rating_history", {
      p_player_id: playerId,
    });
    if (error) {
      if (error.code === "42501") return [];
      throw error;
    }

    return (data ?? [])
      .map((row) => ({
        matchId: row.match_id,
        confirmedAt: row.confirmed_at,
        before: row.rating_before,
        after: row.rating_after,
      }))
      .sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt));
  },
);
