import { describe, expect, it } from "vitest";

import {
  formatScore,
  toMatchSets,
  isCompleteSet,
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
