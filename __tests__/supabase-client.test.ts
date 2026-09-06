import { describe, expect, it } from "vitest";

import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";

describe("createSupabaseBrowserClient", () => {
  it("creates a client for the configured project", () => {
    const client = createSupabaseBrowserClient({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
    });

    expect(client).toEqual(
      expect.objectContaining({
        auth: expect.any(Object),
        from: expect.any(Function),
      }),
    );
  });
});
