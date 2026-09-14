import { describe, expect, it, vi } from "vitest";

import {
  createServerErrorEvent,
  reportErrorEvent,
  sanitizeErrorText,
  safePathname,
} from "@/src/lib/observability/error-report";

describe("error reporting", () => {
  it("redacts credentials and personal email from arbitrary error text", () => {
    const text = sanitizeErrorText(
      "login person@example.test Authorization: Bearer super-secret " +
        "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature " +
        "key sb_secret_not-for-logs",
    );

    expect(text).toBe(
      "login [redacted-email] Authorization: Bearer [redacted] " +
        "token [redacted-token] key [redacted-key]",
    );
  });

  it("bounds text and removes control characters", () => {
    expect(sanitizeErrorText(`first\nsecond\t${"x".repeat(600)}`)).toBe(
      `first second ${"x".repeat(487)}`,
    );
  });

  it("keeps only the pathname from request locations", () => {
    expect(safePathname("/groups/123?email=person@example.test#private")).toBe(
      "/groups/123",
    );
    expect(safePathname("not a URL?token=secret")).toBe("/");
  });

  it("creates a searchable server event without request headers or query data", () => {
    const event = createServerErrorEvent(
      Object.assign(
        new Error("Failed for person@example.test with Bearer abc123"),
        { digest: "digest-42" },
      ),
      {
        path: "/groups/123?invite=PRIVATE",
        method: "POST",
        headers: { cookie: "session=PRIVATE" },
      },
      {
        routerKind: "App Router",
        routePath: "/groups/[id]",
        routeType: "action",
        renderSource: "server-rendering",
        revalidateReason: undefined,
        renderType: "dynamic",
      },
      {
        NODE_ENV: "production",
        NEXT_RUNTIME: "nodejs",
        VERCEL_ENV: "preview",
        VERCEL_GIT_COMMIT_SHA: "abc123",
      },
      "2026-09-14T12:00:00.000Z",
    );

    expect(event).toEqual({
      event: "application_error",
      occurredAt: "2026-09-14T12:00:00.000Z",
      source: "next-server",
      errorName: "Error",
      message: "Failed for [redacted-email] with Bearer [redacted]",
      digest: "digest-42",
      method: "POST",
      pathname: "/groups/123",
      routePath: "/groups/[id]",
      routeType: "action",
      routerKind: "App Router",
      runtime: "nodejs",
      environment: "preview",
      commitSha: "abc123",
    });
    expect(JSON.stringify(event)).not.toContain("PRIVATE");
  });

  it("does not throw when the configured logger fails", () => {
    const logger = vi.fn(() => {
      throw new Error("logger unavailable");
    });

    expect(() =>
      reportErrorEvent(
        {
          event: "application_error",
          occurredAt: "2026-09-14T12:00:00.000Z",
          source: "next-server",
        },
        logger,
      ),
    ).not.toThrow();
  });
});
