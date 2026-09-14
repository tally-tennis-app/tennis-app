import { describe, expect, it } from "vitest";
import {
  localDateInputValue,
  matchError,
  parseMatchInput,
  matchStatus,
} from "@/src/lib/matches/input";

function input(extra: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    opponent: "22222222-2222-2222-2222-222222222222",
    outcome: "completed",
    winner: "11111111-1111-1111-1111-111111111111",
    playedOn: "2026-09-01",
    gamesA1: "6",
    gamesB1: "4",
    gamesA2: "6",
    gamesB2: "0",
    ...extra,
  }))
    form.set(key, value);
  return form;
}
describe("match input", () => {
  it("uses the user's local calendar date near a UTC day boundary", () => {
    expect(localDateInputValue(new Date("2026-09-15T01:30:00Z"), 4 * 60)).toBe(
      "2026-09-14",
    );
  });
  it("omits unused third set without inventing a score", () => {
    const result = parseMatchInput(input());
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.sets).toEqual([
        {
          set_number: 1,
          games_a: 6,
          games_b: 4,
          complete: true,
          tiebreak_a: null,
          tiebreak_b: null,
        },
        {
          set_number: 2,
          games_a: 6,
          games_b: 0,
          complete: true,
          tiebreak_a: null,
          tiebreak_b: null,
        },
      ]);
  });
  it("rejects half filled and fractional scores", () => {
    expect(parseMatchInput(input({ gamesB2: "" })).ok).toBe(false);
    expect(parseMatchInput(input({ gamesA1: "6.5" })).ok).toBe(false);
  });
  it("does not coerce a non-number into zero", () => {
    expect(parseMatchInput(input({ gamesA1: "junk" })).ok).toBe(false);
  });
  it("walkover always has no set data", () => {
    const r = parseMatchInput(input({ outcome: "walkover" }));
    expect(r.ok && r.value.sets).toEqual([]);
  });
  it("requires a retiring player", () => {
    expect(parseMatchInput(input({ outcome: "retired" })).ok).toBe(false);
  });
  it("rejects impossible calendar dates", () => {
    expect(parseMatchInput(input({ playedOn: "2026-02-31" })).ok).toBe(false);
  });
  it("requires tiebreak points in pairs", () => {
    expect(parseMatchInput(input({ tiebreakA1: "7" })).ok).toBe(false);
  });
  it("maps database authorization and validation errors to safe guidance", () => {
    expect(matchError({ code: "42501", message: "private detail" })).toMatch(
      /cannot make that change/i,
    );
    expect(matchError({ code: "22023", message: "private detail" })).toMatch(
      /check the score/i,
    );
    expect(
      matchError({ code: "XX000", message: "private detail" }),
    ).not.toContain("private detail");
  });
});
it("derives expiry and void without changing stored status", () => {
  const now = Date.parse("2026-09-15T00:00:00Z");
  expect(
    matchStatus(
      {
        status: "pending",
        created_at: "2026-08-31T23:59:59Z",
        voided_at: null,
      },
      now,
    ),
  ).toBe("expired");
  expect(
    matchStatus(
      {
        status: "pending",
        created_at: "2026-09-01T00:00:00Z",
        voided_at: null,
      },
      now,
    ),
  ).toBe("pending");
  expect(
    matchStatus(
      {
        status: "confirmed",
        created_at: "2026-08-01T00:00:00Z",
        voided_at: "2026-09-02",
      },
      now,
    ),
  ).toBe("void");
});
