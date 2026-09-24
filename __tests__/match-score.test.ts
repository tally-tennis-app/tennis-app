import { describe, expect, it } from "vitest";

import {
  formatLabel,
  formatScore,
  toMatchSets,
  isCompleteSet,
  isCompleteTiebreak,
  validateScore,
  type SetScore,
} from "@/src/lib/matches/score";

const s = (a: number, b: number, tiebreak?: number): SetScore => ({
  a,
  b,
  tiebreak,
});

describe("isCompleteSet", () => {
  it.each([
    [6, 0],
    [6, 4],
    [4, 6],
    [7, 5],
    [7, 6],
    [6, 7],
  ])("accepts %i-%i", (a, b) => expect(isCompleteSet(s(a, b))).toBe(true));

  it.each([
    [6, 5],
    [6, 6],
    [7, 4],
    [8, 6],
    [5, 3],
  ])("rejects %i-%i", (a, b) => expect(isCompleteSet(s(a, b))).toBe(false));
});

describe("validateScore", () => {
  it("derives the winner of a straight-sets match", () => {
    expect(validateScore("completed", [s(6, 4), s(7, 6, 5)])).toEqual({
      error: null,
      winner: "a",
    });
  });

  it("derives the winner of a three-set match", () => {
    expect(validateScore("completed", [s(6, 4), s(3, 6), s(2, 6)])).toEqual({
      error: null,
      winner: "b",
    });
  });

  it("rejects a third set after the match was decided", () => {
    expect(
      validateScore("completed", [s(6, 1), s(6, 2), s(6, 3)]).error,
    ).toMatch(/already decided/);
  });

  it("rejects an unfinished set in a completed match", () => {
    expect(validateScore("completed", [s(6, 4), s(5, 3)]).error).toMatch(
      /not a finished set/,
    );
  });

  it("requires a decided completed match", () => {
    expect(validateScore("completed", [s(6, 4), s(4, 6)]).error).toMatch(
      /two sets/,
    );
  });

  it("allows a retirement to end mid-set and leaves the winner to the player", () => {
    expect(validateScore("retired", [s(6, 4), s(2, 1)])).toEqual({
      error: null,
      winner: null,
    });
  });

  it("needs the score as it stood when a player retired", () => {
    expect(validateScore("retired", []).error).toMatch(/stood/);
  });

  it("rejects an unfinished set that already reached seven games", () => {
    expect(validateScore("retired", [s(7, 3)]).error).toMatch(
      /not a finished set/,
    );
  });

  it("rejects a retirement after the match was already won", () => {
    expect(validateScore("retired", [s(6, 4), s(6, 4)]).error).toMatch(
      /completed/,
    );
  });

  it("keeps walkovers scoreless", () => {
    expect(validateScore("walkover", [])).toEqual({
      error: null,
      winner: null,
    });
    expect(validateScore("walkover", [s(6, 0)]).error).toMatch(/no score/);
  });

  it("only allows tiebreak points on a 7-6 set", () => {
    expect(validateScore("completed", [s(6, 4, 3), s(6, 4)]).error).toMatch(
      /tiebreak/,
    );
  });
});

describe("formatScore", () => {
  it("prints the score from either player's point of view", () => {
    const sets = [s(6, 4), s(6, 7, 5), s(7, 5)];
    expect(formatScore(sets)).toBe("6-4 6-7(5) 7-5");
    expect(formatScore(sets, "b")).toBe("4-6 7-6(5) 5-7");
  });
});

describe("toMatchSets", () => {
  it("fills in the tiebreak winner's points and marks finished sets", () => {
    expect(toMatchSets([s(7, 6, 5), s(6, 7, 10), s(2, 1)])).toEqual([
      {
        set_number: 1,
        games_a: 7,
        games_b: 6,
        tiebreak_a: 7,
        tiebreak_b: 5,
        complete: true,
      },
      {
        set_number: 2,
        games_a: 6,
        games_b: 7,
        tiebreak_a: 10,
        tiebreak_b: 12,
        complete: true,
      },
      {
        set_number: 3,
        games_a: 2,
        games_b: 1,
        tiebreak_a: null,
        tiebreak_b: null,
        complete: false,
      },
    ]);
  });
});

// Short formats. These mirror supabase/tests/matches_validation.test.sql: the
// database has the final word, so a rule that disagrees here would surface to
// the player as the generic "Something went wrong" message.
const tb = (a: number, b: number, target: 7 | 10 = 10): SetScore => ({
  a,
  b,
  target,
});

describe("single set format", () => {
  it("accepts one finished set", () => {
    expect(validateScore("completed", [s(6, 4)], "set")).toEqual({
      error: null,
      winner: "a",
    });
  });

  it("accepts a set decided by its own tiebreak", () => {
    expect(validateScore("completed", [s(7, 6, 5)], "set")).toEqual({
      error: null,
      winner: "a",
    });
  });

  it("names the loser's side when they win the set", () => {
    expect(validateScore("completed", [s(4, 6)], "set")).toEqual({
      error: null,
      winner: "b",
    });
  });

  it("rejects a second set", () => {
    expect(validateScore("completed", [s(6, 4), s(6, 4)], "set").error).toMatch(
      /one set/,
    );
  });

  it("rejects an unfinished set when completed", () => {
    expect(validateScore("completed", [s(5, 3)], "set").error).toMatch(
      /not a finished set/,
    );
  });

  it("allows a retirement mid-set", () => {
    expect(validateScore("retired", [s(3, 2)], "set")).toEqual({
      error: null,
      winner: null,
    });
  });

  it("rejects a retirement after the set finished", () => {
    expect(validateScore("retired", [s(6, 4)], "set").error).toMatch(
      /completed/,
    );
  });
});

describe("isCompleteTiebreak", () => {
  it.each([
    [7, 5, 7],
    [7, 0, 7],
    [9, 7, 7],
    [10, 8, 10],
    [10, 0, 10],
    [12, 10, 10],
  ])("accepts %i-%i to %i", (a, b, target) =>
    expect(isCompleteTiebreak(tb(a, b, target as 7 | 10))).toBe(true),
  );

  it.each([
    [7, 6, 7],
    [8, 7, 7],
    [10, 9, 10],
    [11, 10, 10],
    [13, 10, 10],
    [8, 6, 10],
  ])("rejects %i-%i to %i", (a, b, target) =>
    expect(isCompleteTiebreak(tb(a, b, target as 7 | 10))).toBe(false),
  );

  it("rejects a set with no target", () => {
    expect(isCompleteTiebreak(s(6, 4))).toBe(false);
  });
});

describe("tiebreak format", () => {
  it("accepts a finished tiebreak", () => {
    expect(validateScore("completed", [tb(10, 8)], "tiebreak")).toEqual({
      error: null,
      winner: "a",
    });
  });

  it("derives the winner from the points", () => {
    expect(validateScore("completed", [tb(8, 10)], "tiebreak")).toEqual({
      error: null,
      winner: "b",
    });
  });

  it("rejects an unfinished tiebreak when completed", () => {
    expect(validateScore("completed", [tb(10, 9)], "tiebreak").error).toMatch(
      /not a finished tiebreak/,
    );
  });

  it("rejects two tiebreaks", () => {
    expect(
      validateScore("completed", [tb(10, 8), tb(10, 8)], "tiebreak").error,
    ).toMatch(/one tiebreak/);
  });

  it("requires a target of 7 or 10", () => {
    expect(
      validateScore("completed", [{ a: 10, b: 8 }], "tiebreak").error,
    ).toMatch(/7 or 10/);
  });

  it("allows a retirement while undecided", () => {
    expect(validateScore("retired", [tb(5, 3)], "tiebreak")).toEqual({
      error: null,
      winner: null,
    });
  });

  it("rejects a retirement after the tiebreak finished", () => {
    expect(validateScore("retired", [tb(10, 8)], "tiebreak").error).toMatch(
      /completed/,
    );
  });

  it("still allows a walkover", () => {
    expect(validateScore("walkover", [], "tiebreak")).toEqual({
      error: null,
      winner: null,
    });
  });
});

describe("toMatchSets for short formats", () => {
  it("stores a tiebreak as points with no games", () => {
    expect(toMatchSets([tb(10, 8)], "tiebreak")).toEqual([
      {
        set_number: 1,
        games_a: 0,
        games_b: 0,
        tiebreak_a: 10,
        tiebreak_b: 8,
        complete: true,
        tiebreak_target: 10,
      },
    ]);
  });

  it("stores a single set exactly as a match set", () => {
    expect(toMatchSets([s(6, 4)], "set")).toEqual([
      {
        set_number: 1,
        games_a: 6,
        games_b: 4,
        tiebreak_a: null,
        tiebreak_b: null,
        complete: true,
      },
    ]);
  });
});

describe("formatLabel", () => {
  it.each([
    ["match", undefined, "Best of 3"],
    ["set", undefined, "Single set"],
    ["tiebreak", 7, "Tiebreak to 7"],
    ["tiebreak", 10, "Tiebreak to 10"],
  ] as const)("labels %s", (format, target, expected) =>
    expect(formatLabel(format, target)).toBe(expected),
  );
});
