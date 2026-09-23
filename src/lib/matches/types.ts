import type {
  MatchFormat,
  Outcome,
  SetScore,
  Side,
} from "@/src/lib/matches/score";

/** What a player sees. Expired and voided are derived, not stored. */
export type MatchStatus =
  "pending" | "confirmed" | "rejected" | "expired" | "voided";

export type MatchPlayer = { id: string; name: string };

export type MatchView = {
  id: string;
  group: { id: string; name: string };
  /** YYYY-MM-DD. Display and sorting only; ratings order by confirmedAt. */
  playedOn: string;
  outcome: Outcome;
  /** Weights the rating: a set is half a match, a tiebreak half a set. */
  format: MatchFormat;
  status: MatchStatus;
  /** Side A. */
  submitter: MatchPlayer;
  /** Side B. */
  opponent: MatchPlayer;
  winnerId: string;
  sets: SetScore[];
  submittedAt: string;
  confirmedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  /** Rating change by player id, present once the match is rated. */
  ratingDeltas: Record<string, number>;
  /** Set when the match settles a tournament tie. */
  tournament?: { id: string; name: string; round: string } | null;
};

export const EXPIRY_DAYS = 14;

/**
 * Pending items expire 14 days after they were created; edits do not extend
 * that. No job flips a stored flag: the status is computed whenever it is read
 * (docs/product-questions.md).
 */
export function deriveStatus(
  row: {
    status: string;
    created_at: string;
    voided_at: string | null;
  },
  now = Date.now(),
): MatchStatus {
  if (row.voided_at) return "voided";
  if (row.status === "confirmed") return "confirmed";
  if (row.status === "rejected") return "rejected";
  const age = now - new Date(row.created_at).getTime();
  return age > EXPIRY_DAYS * 86_400_000 ? "expired" : "pending";
}

export function sideOf(match: MatchView, playerId: string): Side | null {
  if (match.submitter.id === playerId) return "a";
  if (match.opponent.id === playerId) return "b";
  return null;
}

export type ViewerAction = "confirm" | "waiting" | null;

/**
 * What, if anything, this match needs from the viewer. A rejection is final
 * (the submitter logs a fresh result), so it asks nothing of anyone.
 */
export function viewerAction(match: MatchView, viewerId: string): ViewerAction {
  if (match.status === "pending") {
    if (match.opponent.id === viewerId) return "confirm";
    if (match.submitter.id === viewerId) return "waiting";
  }
  return null;
}
