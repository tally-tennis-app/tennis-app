import { cache } from "react";

import { requireUser } from "@/src/lib/auth/dal";
import { asUuid } from "@/src/lib/forms";
import { listMyGroups } from "@/src/lib/groups/queries";
import { getMatchesByIds } from "@/src/lib/matches/queries";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import {
  roundsFor,
  type DecidedBy,
  type TournamentDetail,
  type TournamentStatus,
  type TournamentSummary,
} from "@/src/lib/tournaments/types";

const summaryColumns = `
  id, name, group_id, status, entrant_cap, seeding, round_days, draw_size, format,
  created_at, started_at, completed_at, cancelled_at, cancel_reason, champion_id,
  groups(name),
  champion:profiles!tournaments_champion_id_fkey(display_name),
  tournament_entrants(user_id, withdrawn_at)
`;

type SummaryRow = {
  id: string;
  name: string;
  group_id: string;
  status: string;
  entrant_cap: number;
  seeding: string;
  format: string;
  round_days: number;
  draw_size: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  champion_id: string | null;
  groups: { name: string } | null;
  champion: { display_name: string } | null;
  tournament_entrants: { user_id: string; withdrawn_at: string | null }[];
};

async function toSummary(
  row: SummaryRow,
  viewerId: string,
): Promise<TournamentSummary> {
  const groups = await listMyGroups();
  const role = groups.find((g) => g.id === row.group_id)?.role;
  return {
    id: row.id,
    name: row.name,
    group: { id: row.group_id, name: row.groups?.name ?? "Former group" },
    status: row.status as TournamentStatus,
    entrantCap: row.entrant_cap,
    entrantCount: row.tournament_entrants.length,
    seeding: row.seeding as "rating" | "random",
    format: row.format as TournamentSummary["format"],
    roundDays: row.round_days,
    drawSize: row.draw_size,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    champion: row.champion_id
      ? {
          id: row.champion_id,
          name: row.champion?.display_name ?? "Former player",
        }
      : null,
    viewerEntered: row.tournament_entrants.some(
      (e) => e.user_id === viewerId && !e.withdrawn_at,
    ),
    viewerIsOrganizer: role === "organizer",
  };
}

/** Every tournament the viewer can see: their groups' and their own entries. */
export const listTournaments = cache(async (): Promise<TournamentSummary[]> => {
  const user = await requireUser("/tournaments");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select(summaryColumns)
    .order("created_at", { ascending: false })
    .overrideTypes<SummaryRow[], { merge: false }>();
  if (error) throw error;
  return Promise.all((data ?? []).map((row) => toSummary(row, user.id)));
});

export const getTournament = cache(
  async (tournamentId: string): Promise<TournamentDetail | null> => {
    const user = await requireUser(`/tournaments/${tournamentId}`);
    if (!asUuid(tournamentId)) return null;
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("tournaments")
      .select(summaryColumns)
      .eq("id", tournamentId)
      .overrideTypes<SummaryRow[], { merge: false }>();
    if (error) throw error;
    const row = data?.[0];
    if (!row) return null;

    const [entrants, ties, events] = await Promise.all([
      supabase
        .from("tournament_entrants")
        .select(
          "user_id, seed, registered_at, withdrawn_at, profiles(display_name)",
        )
        .eq("tournament_id", tournamentId),
      supabase
        .from("tournament_ties")
        .select(
          "id, round, position, player_a, player_b, winner_id, decided_by, deadline, match_id",
        )
        .eq("tournament_id", tournamentId)
        .order("round")
        .order("position"),
      supabase
        .from("tournament_events")
        .select("id, kind, detail, created_at")
        .eq("tournament_id", tournamentId)
        .order("created_at", { ascending: false }),
    ]);
    for (const result of [entrants, ties, events])
      if (result.error) throw result.error;

    const names = new Map(
      (entrants.data ?? []).map((e) => [
        e.user_id,
        e.profiles?.display_name ?? "Former player",
      ]),
    );
    const person = (id: string | null) =>
      id ? { id, name: names.get(id) ?? "Former player" } : null;

    const tieRows = ties.data ?? [];
    const matches = new Map(
      (
        await getMatchesByIds(
          tieRows.flatMap((t) => (t.match_id ? [t.match_id] : [])),
        )
      ).map((m) => [m.id, m]),
    );
    const lost = new Set(
      tieRows.flatMap((t) =>
        t.decided_by
          ? [t.player_a, t.player_b].filter(
              (p): p is string => p !== null && p !== t.winner_id,
            )
          : [],
      ),
    );

    const summary = await toSummary(row, user.id);
    return {
      ...summary,
      rounds: roundsFor(summary.drawSize),
      entrants: (entrants.data ?? [])
        .map((e) => ({
          player: person(e.user_id)!,
          seed: e.seed,
          registeredAt: e.registered_at,
          withdrawnAt: e.withdrawn_at,
          out: Boolean(e.withdrawn_at) || lost.has(e.user_id),
        }))
        .sort(
          (a, b) =>
            (a.seed ?? 999) - (b.seed ?? 999) ||
            a.registeredAt.localeCompare(b.registeredAt),
        ),
      ties: tieRows.map((t) => ({
        id: t.id,
        round: t.round,
        position: t.position,
        playerA: person(t.player_a),
        playerB: person(t.player_b),
        winnerId: t.winner_id,
        decidedBy: t.decided_by as DecidedBy | null,
        deadline: t.deadline,
        match: t.match_id ? (matches.get(t.match_id) ?? null) : null,
      })),
      events: (events.data ?? []).map((e) => ({
        id: e.id,
        kind: e.kind,
        detail: e.detail,
        at: e.created_at,
      })),
    };
  },
);
