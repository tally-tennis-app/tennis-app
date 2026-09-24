import type { MatchFormat } from "@/src/lib/matches/score";

import type { MatchView } from "@/src/lib/matches/types";

export type TournamentStatus =
  "registration" | "in_progress" | "completed" | "cancelled";

export type Person = { id: string; name: string };

export type TournamentSummary = {
  id: string;
  name: string;
  group: { id: string; name: string };
  status: TournamentStatus;
  entrantCap: number;
  entrantCount: number;
  seeding: "rating" | "random";
  /** The format every tie in this draw is played in. */
  format: MatchFormat;
  roundDays: number;
  drawSize: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  champion: Person | null;
  viewerEntered: boolean;
  viewerIsOrganizer: boolean;
};

export type DecidedBy = "match" | "bye" | "walkover" | "withdrawal" | "no_show";

export type Tie = {
  id: string;
  round: number;
  position: number;
  playerA: Person | null;
  playerB: Person | null;
  winnerId: string | null;
  decidedBy: DecidedBy | null;
  deadline: string | null;
  match: MatchView | null;
};

export type Entrant = {
  player: Person;
  seed: number | null;
  registeredAt: string;
  withdrawnAt: string | null;
  out: boolean;
};

export type TournamentEvent = {
  id: number;
  kind: string;
  detail: string | null;
  at: string;
};

export type TournamentDetail = TournamentSummary & {
  entrants: Entrant[];
  ties: Tie[];
  rounds: number;
  events: TournamentEvent[];
};

/** Rounds counted back from the final: Final, Semifinals, Quarterfinals, Round of 16. */
export function roundName(round: number, rounds: number) {
  const fromFinal = rounds - round;
  if (fromFinal === 0) return "Final";
  if (fromFinal === 1) return "Semifinals";
  if (fromFinal === 2) return "Quarterfinals";
  return `Round of ${2 ** (fromFinal + 1)}`;
}

/** One tie's round, for sentences: "Semifinal", "Quarterfinal", "Round of 16". */
export function tieRoundName(round: number, rounds: number) {
  return roundName(round, rounds).replace(/finals$/, "final");
}

export function roundsFor(drawSize: number | null) {
  return drawSize ? Math.log2(drawSize) : 0;
}

export const decidedByLabels: Record<DecidedBy, string> = {
  match: "Played",
  bye: "Bye",
  walkover: "Walkover",
  withdrawal: "Withdrawal",
  no_show: "Not played",
};

/**
 * The viewer's open tie, if they are still in: what they should do next.
 * "play" when both players are known and no result is live, "respond" or
 * "waiting" while a result is pending, and "await" while the opponent is
 * still being decided.
 */
export function viewerNextTie(detail: TournamentDetail, viewerId: string) {
  if (detail.status !== "in_progress") return null;
  const tie = detail.ties.find(
    (t) =>
      !t.decidedBy &&
      (t.playerA?.id === viewerId || t.playerB?.id === viewerId),
  );
  if (!tie) return null;

  const opponent = tie.playerA?.id === viewerId ? tie.playerB : tie.playerA;
  let state: "play" | "respond" | "waiting" | "fix" | "await";
  if (!opponent) state = "await";
  else if (!tie.match || tie.match.status === "expired") state = "play";
  else if (tie.match.status === "rejected")
    state = tie.match.submitter.id === viewerId ? "fix" : "waiting";
  else state = tie.match.opponent.id === viewerId ? "respond" : "waiting";

  return { tie, opponent, state };
}
