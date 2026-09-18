/**
 * Tennis scoring rules from docs/product-questions.md, as pure functions.
 *
 * The score form uses these for instant feedback. They are a convenience, not
 * the authority: submit_match() in the database enforces the same rules and
 * has the final word.
 */

export type Outcome = "completed" | "retired" | "walkover";

/** Games for side A (the submitter) and side B (the opponent). */
export type SetScore = {
  a: number;
  b: number;
  /** Tiebreak points of the set's loser, only on a 7-6 set: 7-6(5). */
  tiebreak?: number | null;
};

export type Side = "a" | "b";

/** 6-0 through 6-4, 7-5, and 7-6. No advantage sets. */
export function isCompleteSet({ a, b }: SetScore): boolean {
  const [high, low] = a > b ? [a, b] : [b, a];
  return (high === 6 && low <= 4) || (high === 7 && (low === 5 || low === 6));
}

export function setWinner(set: SetScore): Side | null {
  if (!isCompleteSet(set)) return null;
  return set.a > set.b ? "a" : "b";
}

export function isTiebreakSet({ a, b }: SetScore): boolean {
  return (a === 7 && b === 6) || (a === 6 && b === 7);
}

type Validation = { error: string } | { error: null; winner: Side | null };

/**
 * Checks a full submission. For a completed match the winner is derived from
 * the sets. A retirement or walkover returns null: the player names the winner.
 */
export function validateScore(outcome: Outcome, sets: SetScore[]): Validation {
  if (outcome === "walkover") {
    return sets.length === 0
      ? { error: null, winner: null }
      : { error: "A walkover has no score." };
  }

  if (sets.length > 3) return { error: "A match has at most three sets." };
  if (outcome === "retired" && sets.length === 0) {
    return { error: "Enter the score as it stood when play stopped." };
  }

  for (const [index, set] of sets.entries()) {
    const label = `Set ${index + 1}`;
    for (const games of [set.a, set.b]) {
      if (!Number.isInteger(games) || games < 0 || games > 7) {
        return { error: `${label}: games must be whole numbers from 0 to 7.` };
      }
    }
    if (set.tiebreak != null) {
      if (!isTiebreakSet(set)) {
        return { error: `${label}: tiebreak points only apply to a 7-6 set.` };
      }
      if (
        !Number.isInteger(set.tiebreak) ||
        set.tiebreak < 0 ||
        set.tiebreak > 99
      ) {
        return { error: `${label}: enter the tiebreak loser's points.` };
      }
    }
  }

  const wins = { a: 0, b: 0 };

  for (const [index, set] of sets.entries()) {
    const isLast = index === sets.length - 1;
    const label = `Set ${index + 1}`;

    if (wins.a === 2 || wins.b === 2) {
      return { error: "The match was already decided before this set." };
    }

    const winner = setWinner(set);
    if (winner) {
      wins[winner] += 1;
      continue;
    }

    // Only a retirement may end on an unfinished set, and an unfinished set
    // cannot have reached seven games.
    if (outcome === "completed" || !isLast || set.a > 6 || set.b > 6) {
      return {
        error: `${label}: ${set.a}-${set.b} is not a finished set. Sets end 6-0 to 6-4, 7-5, or 7-6.`,
      };
    }
  }

  if (outcome === "completed") {
    if (wins.a === 2) return { error: null, winner: "a" };
    if (wins.b === 2) return { error: null, winner: "b" };
    return { error: "A completed match needs one player to win two sets." };
  }

  if (wins.a === 2 || wins.b === 2) {
    return {
      error: "One player already won two sets, so the match was completed.",
    };
  }

  return { error: null, winner: null };
}

/** "6-4 3-6 7-6(5)" from the given side's point of view. */
export function formatScore(sets: SetScore[], perspective: Side = "a"): string {
  return sets
    .map((set) => {
      const [mine, theirs] =
        perspective === "a" ? [set.a, set.b] : [set.b, set.a];
      const tiebreak = set.tiebreak != null ? `(${set.tiebreak})` : "";
      return `${mine}-${theirs}${tiebreak}`;
    })
    .join(" ");
}

export function gameTotals(sets: SetScore[]) {
  return sets.reduce(
    (totals, set) => ({ a: totals.a + set.a, b: totals.b + set.b }),
    { a: 0, b: 0 },
  );
}

/** A set as submit_match() stores it (20260913010000_matches.sql). */
export type MatchSetInput = {
  set_number: number;
  games_a: number;
  games_b: number;
  tiebreak_a: number | null;
  tiebreak_b: number | null;
  complete: boolean;
};

/**
 * Converts the form's sets to the database shape. The form asks only for the
 * tiebreak loser's points, the way scores are written (7-6(5)); the winner's
 * are implied: seven, or two clear once the loser reached six.
 */
export function toMatchSets(sets: SetScore[]): MatchSetInput[] {
  return sets.map((set, index) => {
    let tiebreak_a: number | null = null;
    let tiebreak_b: number | null = null;
    if (set.tiebreak != null && isTiebreakSet(set)) {
      const winnerPoints = Math.max(7, set.tiebreak + 2);
      [tiebreak_a, tiebreak_b] =
        set.a > set.b
          ? [winnerPoints, set.tiebreak]
          : [set.tiebreak, winnerPoints];
    }
    return {
      set_number: index + 1,
      games_a: set.a,
      games_b: set.b,
      tiebreak_a,
      tiebreak_b,
      complete: isCompleteSet(set),
    };
  });
}
