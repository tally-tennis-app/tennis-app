import { cache } from "react";

import { requireUser } from "@/src/lib/auth/dal";
import { asUuid } from "@/src/lib/forms";
import type { SetScore } from "@/src/lib/matches/score";
import {
  deriveStatus,
  EXPIRY_DAYS,
  type MatchView,
} from "@/src/lib/matches/types";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const matchColumns = `
  id, group_id, played_on, outcome, status, submitted_by, opponent_id,
  winner_id, submitted_at, confirmed_at, rejected_at, rejection_reason,
  voided_at, void_reason,
  groups(name),
  submitter:profiles!matches_submitted_by_fkey(display_name),
  opponent:profiles!matches_opponent_id_fkey(display_name),
  match_sets(set_number, submitter_games, opponent_games, tiebreak_points)
`;

type MatchRow = {
  id: string;
  group_id: string;
  played_on: string;
  outcome: string;
  status: string;
  submitted_by: string;
  opponent_id: string;
  winner_id: string;
  submitted_at: string;
  confirmed_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  voided_at: string | null;
  void_reason: string | null;
  groups: { name: string } | null;
  submitter: { display_name: string } | null;
  opponent: { display_name: string } | null;
  match_sets: {
    set_number: number;
    submitter_games: number;
    opponent_games: number;
    tiebreak_points: number | null;
  }[];
};

// A profile is readable only while the viewer shares a group with its owner,
// so a player the viewer no longer shares a group with has no readable name.
const FORMER_PLAYER = "Former player";

/**
 * Global rating change per match and player, keyed "matchId:playerId". The
 * fold runs once per request however many cards a page renders.
 */
export const getRatingDeltas = cache(async (): Promise<Map<string, number>> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rating_history", {});
  if (error) throw error;

  return new Map(
    (data ?? []).map((row) => [
      `${row.match_id}:${row.player_id}`,
      row.rating_after - row.rating_before,
    ]),
  );
});

function toView(row: MatchRow, deltas: Map<string, number>): MatchView {
  const sets: SetScore[] = [...row.match_sets]
    .sort((a, b) => a.set_number - b.set_number)
    .map((set) => ({
      a: set.submitter_games,
      b: set.opponent_games,
      tiebreak: set.tiebreak_points,
    }));

  const ratingDeltas: Record<string, number> = {};
  for (const player of [row.submitted_by, row.opponent_id]) {
    const delta = deltas.get(`${row.id}:${player}`);
    if (delta !== undefined) ratingDeltas[player] = delta;
  }

  return {
    id: row.id,
    group: { id: row.group_id, name: row.groups?.name ?? "Former group" },
    playedOn: row.played_on,
    outcome: row.outcome as MatchView["outcome"],
    status: deriveStatus(row),
    submitter: {
      id: row.submitted_by,
      name: row.submitter?.display_name ?? FORMER_PLAYER,
    },
    opponent: {
      id: row.opponent_id,
      name: row.opponent?.display_name ?? FORMER_PLAYER,
    },
    winnerId: row.winner_id,
    sets,
    submittedAt: row.submitted_at,
    confirmedAt: row.confirmed_at,
    rejectedAt: row.rejected_at,
    rejectionReason: row.rejection_reason,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    ratingDeltas,
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
 * filters here only narrow it, and they run in the database so private rows
 * never reach the client to be filtered there.
 */
export async function listMatches(
  filters: MatchFilters = {},
  { limit = 20, offset = 0 } = {},
): Promise<{ matches: MatchView[]; hasMore: boolean }> {
  await requireUser("/matches");
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("matches")
    .select(matchColumns)
    .order("played_on", { ascending: false })
    .order("submitted_at", { ascending: false })
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
      query = query.eq("status", "pending").gte("submitted_at", cutoff);
      break;
    case "expired":
      query = query.eq("status", "pending").lt("submitted_at", cutoff);
      break;
  }
  const groupId = asUuid(filters.groupId);
  const playerId = asUuid(filters.playerId);
  if (groupId) query = query.eq("group_id", groupId);
  // Checked as a uuid first: it is interpolated into a PostgREST filter.
  if (playerId) {
    query = query.or(`submitted_by.eq.${playerId},opponent_id.eq.${playerId}`);
  }

  const [{ data, error }, deltas] = await Promise.all([
    query.overrideTypes<MatchRow[], { merge: false }>(),
    getRatingDeltas(),
  ]);
  if (error) throw error;

  const rows = data ?? [];
  return {
    matches: rows.slice(0, limit).map((row) => toView(row, deltas)),
    hasMore: rows.length > limit,
  };
}

/**
 * Everything waiting on or for the viewer: submissions to answer, rejected
 * submissions to review, and their own submissions awaiting the opponent.
 */
export const listOpenMatches = cache(async (viewerId: string) => {
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, deltas] = await Promise.all([
    supabase
      .from("matches")
      .select(matchColumns)
      .in("status", ["pending", "rejected"])
      .or(`submitted_by.eq.${viewerId},opponent_id.eq.${viewerId}`)
      .gte("submitted_at", expiryCutoff())
      .order("submitted_at", { ascending: true })
      .overrideTypes<MatchRow[], { merge: false }>(),
    getRatingDeltas(),
  ]);
  if (error) throw error;

  const matches = (data ?? []).map((row) => toView(row, deltas));
  return {
    needsYou: matches.filter(
      (m) =>
        (m.status === "pending" && m.opponent.id === viewerId) ||
        (m.status === "rejected" && m.submitter.id === viewerId),
    ),
    awaitingOpponent: matches.filter(
      (m) => m.status === "pending" && m.submitter.id === viewerId,
    ),
  };
});

export const getMatch = cache(async (matchId: string) => {
  await requireUser(`/matches/${matchId}`);
  const supabase = await createSupabaseServerClient();

  // A malformed id is simply "not found", like a match the viewer cannot see.
  if (!asUuid(matchId)) return null;

  const [{ data, error }, deltas] = await Promise.all([
    supabase
      .from("matches")
      .select(matchColumns)
      .eq("id", matchId)
      .overrideTypes<MatchRow[], { merge: false }>(),
    getRatingDeltas(),
  ]);
  if (error) throw error;

  const row = data?.[0];
  return row ? toView(row, deltas) : null;
});
