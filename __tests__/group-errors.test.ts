import { describe, expect, it } from "vitest";

import {
  genericErrorMessage,
  userFacingMessage,
} from "@/src/lib/groups/errors";

describe("userFacingMessage", () => {
  it.each([
    ["28000", "Not authenticated"],
    ["22023", "That invite code is not valid"],
    ["42501", "Only an organizer can remove a member"],
    ["23514", "Transfer the organizer role before leaving"],
  ])("shows the message the migration raised with code %s", (code, message) => {
    expect(userFacingMessage({ code, message, details: null })).toBe(message);
  });

  it("hides a CHECK violation, which shares 23514 but carries the failing row", () => {
    expect(
      userFacingMessage({
        code: "23514",
        message:
          'new row for relation "groups" violates check constraint "groups_name_length"',
        details: "Failing row contains (4f1c..., ...).",
      }),
    ).toBe(genericErrorMessage);
  });

  it.each([
    ["P0001", "raise without an explicit code"],
    ["23505", "duplicate key value violates unique constraint"],
    ["PGRST202", "Could not find the function public.create_group"],
  ])("hides an unexpected error with code %s", (code, message) => {
    expect(userFacingMessage({ code, message })).toBe(genericErrorMessage);
  });

  it("hides an error with no code, such as a network failure", () => {
    expect(userFacingMessage({ message: "fetch failed" })).toBe(
      genericErrorMessage,
    );
  });
});
