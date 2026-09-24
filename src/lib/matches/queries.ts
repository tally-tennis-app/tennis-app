import { cache } from "react";

import { requireUser } from "@/src/lib/auth/dal";
import { asUuid } from "@/src/lib/forms";
import type { SetScore, TiebreakTarget } from "@/src/lib/matches/score";
import {
  deriveStatus,
  EXPIRY_DAYS,
  type MatchView,
} from "@/src/lib/matches/types";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { roundsFor, tieRoundName } from "@/src/lib/tournaments/types";

// Schema: supabase/migrations/20260913010000_matches.sql. The submitter is
// always player_a when submit_match() creates a row, but the view below
// orients by submitted_by so it never depends on that.
const matchColumns = `
  id, group_id, played_on, outcome, format, status, player_a, player_b, winner,
  retired_by, submitted_by, created_at, confirmed_at, voided_at, void_reason,
  rejection_reason, rejected_at,
  groups(name),
  a:profiles!matches_player_a_fkey(display_name),
  b:profiles!matches_player_b_fkey(display_name),
  match_sets(set_number, games_a, games_b, tiebreak_a, tiebreak_b, tiebreak_target),
  tie:tournament_ties!matches_tournament_tie_id_fkey(round, tournament_id, tournaments(name, draw_size))
`;

type MatchRow = {
  id: string;
  group_id: string;
  played_on: string;
  outcome: string;
  format: string;
  status: string;
  player_a: string;
  player_b: string;
  winner: string;
  retired_by: string | null;
  submitted_by: string;
  created_at: string;
  confirmed_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  rejection_reason: string | null;
  rejected_at: string | null;
  groups: { name: string } | null;
  a: { display_name: string } | null;
  b: { display_name: string } | null;
  match_sets: {
    set_number: number;
    games_a: number;
    games_b: number;
    tiebreak_a: number | null;
    tiebreak_b: number | null;
    tiebreak_target: number | null;
  }[];
  tie: {
    round: number;
    tournament_id: string;
    tournaments: { name: string; draw_size: number | null } | null;
  } | null;
};

// A profile is readable only while the viewer shares a group with its owner.
const FORMER_PLAYER = "Former player";

/**
 * One player's overall rating change per match, from get_rating_history().
 * Cached per request and player; a player the viewer may not see yields none.
 */
const ratingDeltasFor = cache(
  async (playerId: string): Promise<Map<string, number>> => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_rating_history", {
      p_player_id: playerId,
    });
    if (error) {
      if (error.code === "42501") return new Map();
      throw error;
    }
    return new Map((data ?? []).map((row) => [row.match_id, row.delta]));
  },
);

async function withDeltas(rows: MatchRow[], playerIds: string[]) {
  const maps = await Promise.all(
    [...new Set(playerIds)].map(
      async (id) => [id, await ratingDeltasFor(id)] as const,
    ),
  );
  const byPlayer = new Map(maps);
  return rows.map((row) => toView(row, byPlayer));
}

function toView(
  row: MatchRow,
  deltas: Map<string, Map<string, number>>,
): MatchView {
  const submitterIsA = row.submitted_by !== row.player_b;
  const format = row.format as MatchView["format"];
  const sets: SetScore[] = [...row.match_sets]
    .sort((x, y) => x.set_number - y.set_number)
    .map((set) => {
      // A standalone tiebreak records points, not games.
      if (format === "tiebreak") {
        const [minePoints, theirPoints] = submitterIsA
          ? [set.tiebreak_a ?? 0, set.tiebreak_b ?? 0]
          : [set.tiebreak_b ?? 0, set.tiebreak_a ?? 0];
        return {
          a: minePoints,
          b: theirPoints,
          tiebreak: null,
          target: (set.tiebreak_target ?? 10) as TiebreakTarget,
        };
      }
      const [mine, theirs] = submitterIsA
        ? [set.games_a, set.games_b]
        : [set.games_b, set.games_a];
      // Shown the conventional way, 7-6(5): the tiebreak loser's points.
      const tiebreak =
        set.tiebreak_a === null || set.tiebreak_b === null
          ? null
          : Math.min(set.tiebreak_a, set.tiebreak_b);
      return { a: mine, b: theirs, tiebreak };
    });

  const player = (id: string, profile: { display_name: string } | null) => ({
    id,
    name: profile?.display_name ?? FORMER_PLAYER,
  });
  const playerA = player(row.player_a, row.a);
  const playerB = player(row.player_b, row.b);

  const ratingDeltas: Record<string, number> = {};
  for (const id of [row.player_a, row.player_b]) {
    const delta = deltas.get(id)?.get(row.id);
    if (delta !== undefined) ratingDeltas[id] = delta;
  }

  return {
    id: row.id,
    group: { id: row.group_id, name: row.groups?.name ?? "Former group" },
    playedOn: row.played_on,
    outcome: row.outcome as MatchView["outcome"],
    format,
    status: deriveStatus(row),
    submitter: submitterIsA ? playerA : playerB,
    opponent: submitterIsA ? playerB : playerA,
    winnerId: row.winner,
    sets,
    submittedAt: row.created_at,
    confirmedAt: row.confirmed_at,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    ratingDeltas,
    tournament: row.tie?.tournaments
      ? {
          id: row.tie.tournament_id,
          name: row.tie.tournaments.name,
          round: tieRoundName(
            row.tie.round,
            roundsFor(row.tie.tournaments.draw_size),
          ),
        }
      : null,
  };
}

export const HISTORY_STATUSES = [
  "confirmed",
  "pending",
  "rejected",
  "expired",
  "voided",
] as const;
export type HistoryStatus = (typeof HISTORY_STATUSES)[number];

export type MatchFilters = {
  status?: HistoryStatus;
  groupId?: string;
  playerId?: string;
};

function expiryCutoff() {
  return new Date(Date.now() - EXPIRY_DAYS * 86_400_000).toISOString();
}

/**
 * Visible matches, newest played first. RLS decides what is visible; the
 * filters only narrow it, and they run in the database so private rows never
 * reach the client to be filtered there. Rating changes are the viewer's.
 */
export async function listMatches(
  filters: MatchFilters = {},
  { limit = 20, offset = 0 } = {},
): Promise<{ matches: MatchView[]; hasMore: boolean }> {
  const user = await requireUser("/matches");
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("matches")
    .select(matchColumns)
    .order("played_on", { ascending: false })
    .order("created_at", { ascending: false })
    // One extra row answers "is there another page" without a count query.
    .range(offset, offset + limit);

  const cutoff = expiryCutoff();
  switch (filters.status) {
    case "confirmed":
      query = query.eq("status", "confirmed").is("voided_at", null);
      break;
    case "voided":
      query = query.not("voided_at", "is", null);
      break;
    case "rejected":
      query = query.eq("status", "rejected");
      break;
    case "pending":
      query = query.eq("status", "pending").gte("created_at", cutoff);
      break;
    case "expired":
      query = query.eq("status", "pending").lt("created_at", cutoff);
      break;
  }
  const groupId = asUuid(filters.groupId);
  const playerId = asUuid(filters.playerId);
  if (groupId) query = query.eq("group_id", groupId);
  // Checked as a uuid first: it is interpolated into a PostgREST filter.
  if (playerId)
    query = query.or(`player_a.eq.${playerId},player_b.eq.${playerId}`);

  const { data, error } = await query.overrideTypes<
    MatchRow[],
    { merge: false }
  >();
  if (error) throw error;

  const rows = (data ?? []).slice(0, limit);
  return {
    matches: await withDeltas(rows, [user.id]),
    hasMore: (data ?? []).length > limit,
  };
}

/**
 * Submissions waiting on the viewer, and the viewer's own submissions waiting
 * on an opponent. A rejection is final in this schema, so it needs no answer
 * and appears in the history instead.
 */
export const listOpenMatches = cache(async (viewerId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("matches")
    .select(matchColumns)
    .eq("status", "pending")
    .or(`player_a.eq.${viewerId},player_b.eq.${viewerId}`)
    .gte("created_at", expiryCutoff())
    .order("created_at", { ascending: true })
    .overrideTypes<MatchRow[], { merge: false }>();
  if (error) throw error;

  const matches = await withDeltas(data ?? [], [viewerId]);
  return {
    needsYou: matches.filter((m) => m.opponent.id === viewerId),
    awaitingOpponent: matches.filter((m) => m.submitter.id === viewerId),
  };
});

/** One match with both players' rating changes. */
export const getMatch = cache(async (matchId: string) => {
  await requireUser(`/matches/${matchId}`);
  // A malformed id is simply "not found", like a match the viewer cannot see.
  if (!asUuid(matchId)) return null;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("matches")
    .select(matchColumns)
    .eq("id", matchId)
    .overrideTypes<MatchRow[], { merge: false }>();
  if (error) throw error;

  const row = data?.[0];
  if (!row) return null;
  const [view] = await withDeltas([row], [row.player_a, row.player_b]);
  return view;
});

/** Specific matches by id, for tournament draws and rating history. */
export async function getMatchesByIds(
  ids: string[],
  viewerId?: string,
): Promise<MatchView[]> {
  if (ids.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("matches")
    .select(matchColumns)
    .in("id", ids)
    .overrideTypes<MatchRow[], { merge: false }>();
  if (error) throw error;
  return withDeltas(data ?? [], viewerId ? [viewerId] : []);
}

/**
 * Recent rated results, newest first, for form strips. Walkovers and voided
 * matches are excluded, matching what the rating fold counts.
 */
export async function recentResults(groupId?: string) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("matches")
    .select("player_a, player_b, winner, confirmed_at")
    .eq("status", "confirmed")
    .is("voided_at", null)
    .neq("outcome", "walkover")
    .order("confirmed_at", { ascending: false })
    .limit(500);
  const group = asUuid(groupId);
  if (group) query = query.eq("group_id", group);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
