/**
 * Tennis scoring rules from docs/product-questions.md, as pure functions.
 *
 * The score form uses these for instant feedback. They are a convenience, not
 * the authority: submit_match() in the database enforces the same rules and
 * has the final word.
 */

export type Outcome = "completed" | "retired" | "walkover";

/**
 * A best-of-three match, one set, or one standalone tiebreak. A set is worth
 * half a match and a tiebreak half a set; see
 * docs/decisions/0005-short-formats-and-rating-weights.md.
 */
export type MatchFormat = "match" | "set" | "tiebreak";

export const matchFormats: MatchFormat[] = ["match", "set", "tiebreak"];

/** Points needed to win a standalone tiebreak. */
export type TiebreakTarget = 7 | 10;

/**
 * Games for side A (the submitter) and side B (the opponent). On a standalone
 * tiebreak, a and b are points rather than games and target is set.
 */
export type SetScore = {
  a: number;
  b: number;
  /** Tiebreak points of the set's loser, only on a 7-6 set: 7-6(5). */
  tiebreak?: number | null;
  /** 7 or 10 on a standalone tiebreak, absent on an ordinary set. */
  target?: TiebreakTarget | null;
};

export type Side = "a" | "b";

/** 6-0 through 6-4, 7-5, and 7-6. No advantage sets. */
export function isCompleteSet({ a, b }: SetScore): boolean {
  const [high, low] = a > b ? [a, b] : [b, a];
  return (high === 6 && low <= 4) || (high === 7 && (low === 5 || low === 6));
}

/**
 * First to the target, win by two: 10-8 and 12-10 stand, 10-9 and 11-10 do not.
 */
export function isCompleteTiebreak({ a, b, target }: SetScore): boolean {
  if (target == null) return false;
  const [high, low] = a > b ? [a, b] : [b, a];
  if (high < target) return false;
  return high === target ? low <= target - 2 : high - low === 2;
}

export function tiebreakWinner(set: SetScore): Side | null {
  if (!isCompleteTiebreak(set)) return null;
  return set.a > set.b ? "a" : "b";
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
export function validateScore(
  outcome: Outcome,
  sets: SetScore[],
  format: MatchFormat = "match",
): Validation {
  if (outcome === "walkover") {
    return sets.length === 0
      ? { error: null, winner: null }
      : { error: "A walkover has no score." };
  }

  if (format === "tiebreak") return validateTiebreak(outcome, sets);

  if (sets.length > 3) return { error: "A match has at most three sets." };
  if (format === "set" && sets.length > 1) {
    return { error: "A single set match has one set." };
  }
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
  // A single set is decided by its one set; a match needs two.
  const needed = format === "set" ? 1 : 2;

  for (const [index, set] of sets.entries()) {
    const isLast = index === sets.length - 1;
    const label = `Set ${index + 1}`;

    if (wins.a === needed || wins.b === needed) {
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
    if (wins.a === needed) return { error: null, winner: "a" };
    if (wins.b === needed) return { error: null, winner: "b" };
    return {
      error:
        format === "set"
          ? "A completed single set needs a finished set."
          : "A completed match needs one player to win two sets.",
    };
  }

  if (wins.a === needed || wins.b === needed) {
    return {
      error:
        format === "set"
          ? "The set was finished, so the match was completed."
          : "One player already won two sets, so the match was completed.",
    };
  }

  return { error: null, winner: null };
}

/** One standalone tiebreak, entered as both players' points. */
function validateTiebreak(outcome: Outcome, sets: SetScore[]): Validation {
  if (sets.length !== 1) {
    return { error: "A tiebreak match has one tiebreak." };
  }
  const [set] = sets;
  if (set.target !== 7 && set.target !== 10) {
    return { error: "Choose a tiebreak to 7 or 10 points." };
  }
  for (const points of [set.a, set.b]) {
    if (!Number.isInteger(points) || points < 0 || points > 99) {
      return { error: "Points must be whole numbers from 0 to 99." };
    }
  }

  const finished = isCompleteTiebreak(set);
  if (outcome === "completed") {
    const winner = tiebreakWinner(set);
    if (!winner) {
      return {
        error: `${set.a}-${set.b} is not a finished tiebreak. First to ${set.target}, win by two.`,
      };
    }
    return { error: null, winner };
  }

  // A retirement keeps the points as they stood, which cannot already decide it.
  if (finished) {
    return { error: "The tiebreak was finished, so the match was completed." };
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
  /** Set only on a standalone tiebreak (20260923120000_match_formats.sql). */
  tiebreak_target?: number | null;
};

/**
 * Converts the form's sets to the database shape. For an ordinary set the form
 * asks only for the tiebreak loser's points, the way scores are written
 * (7-6(5)); the winner's are implied: seven, or two clear once the loser
 * reached six. A standalone tiebreak records no games and carries both players'
 * points with its target.
 */
export function toMatchSets(
  sets: SetScore[],
  format: MatchFormat = "match",
): MatchSetInput[] {
  if (format === "tiebreak") {
    return sets.map((set, index) => ({
      set_number: index + 1,
      games_a: 0,
      games_b: 0,
      tiebreak_a: set.a,
      tiebreak_b: set.b,
      complete: isCompleteTiebreak(set),
      tiebreak_target: set.target ?? null,
    }));
  }
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

/** "Best of 3", "Single set", "Tiebreak to 10" for labels and badges. */
export function formatLabel(
  format: MatchFormat,
  target?: number | null,
): string {
  if (format === "set") return "Single set";
  if (format === "tiebreak") return `Tiebreak to ${target ?? 10}`;
  return "Best of 3";
}
