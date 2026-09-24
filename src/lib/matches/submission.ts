import { asUuid, field } from "@/src/lib/forms";
import {
  matchFormats,
  toMatchSets,
  validateScore,
  type MatchFormat,
  type MatchSetInput,
  type Outcome,
  type SetScore,
  type TiebreakTarget,
} from "@/src/lib/matches/score";

/** The score form posts its sets as JSON; anything malformed becomes []. */
function parseSets(raw: string): SetScore[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.map((set) => ({
      a: Number(set?.a),
      b: Number(set?.b),
      tiebreak:
        set?.tiebreak === null ||
        set?.tiebreak === undefined ||
        set?.tiebreak === ""
          ? null
          : Number(set.tiebreak),
      target:
        set?.target === 7 || set?.target === 10
          ? (Number(set.target) as TiebreakTarget)
          : null,
    }));
  } catch {
    return [];
  }
}

export type Submission = {
  match_outcome: Outcome;
  match_winner: string;
  sets: MatchSetInput[];
  match_played_on: string;
  match_retired_by: string | undefined;
};

/**
 * Reads a score form for a match between the submitter (side A) and an
 * opponent. The winner of a completed match is derived here from the sets,
 * never taken from the form; a retirement's retiring player is whoever did
 * not win. The database validates everything again.
 */
export function readSubmission(
  formData: FormData,
  submitter: string,
  opponent: string,
):
  | { ok: true; value: Submission; format: MatchFormat }
  | { ok: false; error: string } {
  const outcome = field(formData, "outcome") as Outcome;
  if (!["completed", "retired", "walkover"].includes(outcome)) {
    return { ok: false, error: "Choose how the match ended." };
  }

  // A tournament tie's format is fixed by its tournament, which the database
  // enforces regardless of what the form posts.
  const format = field(formData, "format") as MatchFormat;
  if (!matchFormats.includes(format)) {
    return { ok: false, error: "Choose a match, single set, or tiebreak." };
  }

  const playedOn = field(formData, "playedOn");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(playedOn)) {
    return { ok: false, error: "Enter the date you played." };
  }

  const sets = outcome === "walkover" ? [] : parseSets(field(formData, "sets"));
  const check = validateScore(outcome, sets, format);
  if (check.error !== null) return { ok: false, error: check.error };

  const named = asUuid(field(formData, "winner"));
  const winner =
    check.winner === "a" ? submitter : check.winner === "b" ? opponent : named;
  if (!winner || (winner !== submitter && winner !== opponent)) {
    return { ok: false, error: "Choose who won the match." };
  }

  return {
    ok: true,
    format,
    value: {
      match_outcome: outcome,
      match_winner: winner,
      sets: toMatchSets(sets, format),
      match_played_on: playedOn,
      match_retired_by:
        outcome === "retired"
          ? winner === submitter
            ? opponent
            : submitter
          : undefined,
    },
  };
}

/** Everything the form sent, echoed back so a failure keeps the input. */
export function echoValues(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()]
      .filter(
        ([name, value]) => !name.startsWith("$") && typeof value === "string",
      )
      .map(([name, value]) => [name, value as string]),
  );
}
