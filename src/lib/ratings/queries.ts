import { cache } from "react";

import { requireUser } from "@/src/lib/auth/dal";
import { asUuid } from "@/src/lib/forms";
import {
  rankStandings,
  type FormResult,
  type Standing,
} from "@/src/lib/ratings/types";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

/**
 * Rated players ranked; unrated ones listed apart, so a table never implies
 * that someone who has not played sits level with a player on 1500.
 */
export const getStandings = cache(
  async (
    groupId?: string,
  ): Promise<{ rated: Standing[]; unrated: Standing[] }> => {
    await requireUser("/standings");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("standings", {
      target_group: asUuid(groupId),
    });
    if (error) throw error;

    const rows = (data ?? []).map((row) => ({
      playerId: row.player_id,
      name: row.display_name,
      rating: Number(row.rating),
      played: row.played,
      wins: row.wins,
      losses: row.losses,
      form: row.form.split("") as FormResult[],
      lastDelta: row.last_delta === null ? null : Number(row.last_delta),
      active: row.is_active,
    }));

    return {
      rated: rankStandings(rows.filter((row) => row.played > 0)),
      unrated: rows
        .filter((row) => row.played === 0)
        .map((row) => ({ ...row, rank: 0, tied: false }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
);

export type RatingEvent = {
  matchId: string;
  confirmedAt: string;
  opponentId: string;
  won: boolean;
  before: number;
  after: number;
};

/** A player's rating history, oldest first, limited to matches the viewer can see. */
export const getRatingHistory = cache(
  async (playerId: string): Promise<RatingEvent[]> => {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("rating_history", {
      target_player: playerId,
    });
    if (error) throw error;

    return (data ?? [])
      .map((row) => ({
        matchId: row.match_id,
        confirmedAt: row.confirmed_at,
        opponentId: row.opponent_id,
        won: row.won,
        before: Number(row.rating_before),
        after: Number(row.rating_after),
      }))
      .sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt));
  },
);
