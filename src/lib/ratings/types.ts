export type FormResult = "W" | "L";

export type Standing = {
  playerId: string;
  name: string;
  rating: number;
  /** Competition rank: tied players share it, and the next rank skips. */
  rank: number;
  tied: boolean;
  played: number;
  wins: number;
  losses: number;
  /** Most recent first, up to five rated results. */
  form: FormResult[];
  /** Change from the player's most recent rated match. */
  lastDelta: number | null;
  /** False for a former group member, who keeps their place in history. */
  active: boolean;
};

export const STARTING_RATING = 1500;

/**
 * Ranks by displayed (rounded) rating, so two players who look tied are tied.
 * Ties are then listed by name to keep the order stable between loads.
 */
export function rankStandings<T extends { rating: number; name: string }>(
  rows: T[],
): (T & { rank: number; tied: boolean })[] {
  const sorted = [...rows].sort(
    (a, b) =>
      Math.round(b.rating) - Math.round(a.rating) ||
      a.name.localeCompare(b.name),
  );

  return sorted.map((row) => {
    const shown = Math.round(row.rating);
    const first = sorted.findIndex(
      (other) => Math.round(other.rating) === shown,
    );
    const count = sorted.filter(
      (other) => Math.round(other.rating) === shown,
    ).length;
    return { ...row, rank: first + 1, tied: count > 1 };
  });
}

export function ordinal(n: number) {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ??
        "th");
  return `${n}${suffix}`;
}
