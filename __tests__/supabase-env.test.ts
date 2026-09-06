import { describe, expect, it } from "vitest";

import { readPublicEnv } from "@/src/lib/env";

describe("readPublicEnv", () => {
  it("returns the documented browser-safe Supabase configuration", () => {
    expect(
      readPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toEqual({
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
    });
  });

  it("reports every missing public variable", () => {
    expect(() => readPublicEnv({})).toThrowError(
      "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  });

  it("rejects a malformed Supabase URL", () => {
    expect(() =>
      readPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
      }),
    ).toThrowError("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL");
  });
});
