export type SetInput = {
  set_number: number;
  games_a: number;
  games_b: number;
  complete: boolean;
  tiebreak_a: number | null;
  tiebreak_b: number | null;
};
export function localDateInputValue(
  date = new Date(),
  timezoneOffsetMinutes = date.getTimezoneOffset(),
) {
  return new Date(date.getTime() - timezoneOffsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
}
export function field(form: FormData, key: string) {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}
export function parseMatchInput(form: FormData):
  | {
      ok: true;
      value: {
        opponent: string;
        outcome: string;
        winner: string;
        playedOn: string;
        retiredBy: string | null;
        sets: SetInput[];
      };
    }
  | { ok: false; error: string } {
  const outcome = field(form, "outcome"),
    winner = field(form, "winner"),
    playedOn = field(form, "playedOn"),
    opponent = field(form, "opponent");
  const retiredBy = outcome === "retired" ? field(form, "retiredBy") : null;
  if (
    !["completed", "retired", "walkover"].includes(outcome) ||
    !winner ||
    !opponent
  )
    return {
      ok: false,
      error: "Choose both players, the outcome, and the winner.",
    };
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(playedOn) ||
    !Number.isFinite(Date.parse(playedOn)) ||
    new Date(playedOn).toISOString().slice(0, 10) !== playedOn
  )
    return { ok: false, error: "Enter a valid date played." };
  if (outcome === "retired" && !retiredBy)
    return { ok: false, error: "Choose the player who retired." };
  const sets: SetInput[] = [];
  if (outcome !== "walkover")
    for (let i = 1; i <= 3; i++) {
      const a = field(form, `gamesA${i}`),
        b = field(form, `gamesB${i}`),
        ta = field(form, `tiebreakA${i}`),
        tb = field(form, `tiebreakB${i}`);
      if (!a && !b && !ta && !tb) continue;
      if (
        i !== sets.length + 1 ||
        !/^\d+$/.test(a) ||
        !/^\d+$/.test(b) ||
        Number(a) > 7 ||
        Number(b) > 7
      )
        return {
          ok: false,
          error: "Enter whole game scores for each set in order (0–7).",
        };
      if (
        Boolean(ta) !== Boolean(tb) ||
        (ta &&
          (!/^\d+$/.test(ta) ||
            !/^\d+$/.test(tb) ||
            Number(ta) > 2147483647 ||
            Number(tb) > 2147483647))
      )
        return {
          ok: false,
          error: "Enter both tiebreak point scores as whole numbers.",
        };
      sets.push({
        set_number: i,
        games_a: Number(a),
        games_b: Number(b),
        complete:
          outcome === "completed" || field(form, `complete${i}`) === "true",
        tiebreak_a: ta ? Number(ta) : null,
        tiebreak_b: tb ? Number(tb) : null,
      });
    }
  if (outcome !== "walkover" && !sets.length)
    return { ok: false, error: "Enter at least one set." };
  return {
    ok: true,
    value: { opponent, outcome, winner, playedOn, retiredBy, sets },
  };
}
export function matchStatus(
  match: { status: string; created_at: string; voided_at: string | null },
  now = Date.now(),
) {
  return match.voided_at
    ? "void"
    : match.status === "pending" &&
        Date.parse(match.created_at) < now - 14 * 24 * 60 * 60 * 1000
      ? "expired"
      : match.status;
}
export function matchError(error: { code?: string; message?: string }) {
  if (error.code === "42501")
    return "You cannot make that change. Check your group membership and match role.";
  if (error.code === "22023")
    return "Check the score, winner, date, and match status. Sets must follow best-of-three rules; expired or completed matches cannot be changed.";
  return "We could not save the match. Please try again.";
}
