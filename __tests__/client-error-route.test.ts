import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/errors/route";

afterEach(() => {
  vi.restoreAllMocks();
});

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://preview.example.test/api/errors", {
    method: "POST",
    body,
    headers,
  });
}

describe("client error report route", () => {
  it("rejects cross-site reports", async () => {
    const response = await POST(
      request("{}", {
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
      }),
    );

    expect(response.status).toBe(403);
  });

  it("rejects non-JSON and oversized reports", async () => {
    expect(
      (await POST(request("plain text", { "sec-fetch-site": "same-origin" })))
        .status,
    ).toBe(415);
    expect(
      (
        await POST(
          request(JSON.stringify({ message: "x".repeat(5000) }), {
            "content-type": "application/json",
            "sec-fetch-site": "same-origin",
          }),
        )
      ).status,
    ).toBe(413);
  });

  it("rejects malformed report objects", async () => {
    const response = await POST(
      request("[]", {
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("emits a sanitized structured event and returns no content", async () => {
    const logger = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await POST(
      request(
        JSON.stringify({
          name: "TypeError",
          message: "Account person@example.test failed with Bearer secret",
          digest: "digest-99",
          pathname: "/groups/42?invite=PRIVATE",
          ignored: "PRIVATE",
        }),
        {
          "content-type": "application/json; charset=utf-8",
          "sec-fetch-site": "same-origin",
        },
      ),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(logger).toHaveBeenCalledOnce();

    const line = logger.mock.calls[0]?.[0];
    expect(typeof line).toBe("string");
    expect(JSON.parse(String(line))).toMatchObject({
      event: "application_error",
      source: "client-boundary",
      errorName: "TypeError",
      message: "Account [redacted-email] failed with Bearer [redacted]",
      digest: "digest-99",
      pathname: "/groups/42",
    });
    expect(String(line)).not.toContain("PRIVATE");
  });
});
