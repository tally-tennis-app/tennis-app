import { describe, expect, it } from "vitest";

import {
  resolveAuthRedirect,
  safeRedirectPath,
  signedInLandingPath,
} from "@/src/lib/auth/routes";

describe("resolveAuthRedirect", () => {
  it.each(["/", "/login", "/signup", "/reset-password", "/auth/callback"])(
    "lets an anonymous visitor reach the public page %s",
    (pathname) => {
      expect(
        resolveAuthRedirect({ pathname, isAuthenticated: false }),
      ).toBeNull();
    },
  );

  it("sends an anonymous visitor to login, preserving where they were going", () => {
    expect(
      resolveAuthRedirect({ pathname: "/dashboard", isAuthenticated: false }),
    ).toBe("/login?next=%2Fdashboard");
  });

  it("protects unknown paths by default rather than allowing them", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/groups/some-future-page",
        isAuthenticated: false,
      }),
    ).toBe("/login?next=%2Fgroups%2Fsome-future-page");
  });

  it.each(["/login", "/signup", "/reset-password"])(
    "bounces a signed-in user away from %s",
    (pathname) => {
      expect(resolveAuthRedirect({ pathname, isAuthenticated: true })).toBe(
        signedInLandingPath,
      );
    },
  );

  it("leaves a signed-in user on the marketing page", () => {
    expect(resolveAuthRedirect({ pathname: "/", isAuthenticated: true })).toBe(
      null,
    );
  });

  it("lets a signed-in user set a new password after a recovery link", () => {
    expect(
      resolveAuthRedirect({
        pathname: "/update-password",
        isAuthenticated: true,
      }),
    ).toBeNull();
  });
});

describe("safeRedirectPath", () => {
  it.each(["/dashboard", "/groups/abc", "/"])(
    "allows the local path %s",
    (p) => {
      expect(safeRedirectPath(p)).toBe(p);
    },
  );

  it.each([
    "//evil.example.com",
    "/\\evil.example.com",
    "https://evil.example.com",
    "javascript:alert(1)",
    "",
    null,
    undefined,
  ])("refuses to redirect to %s", (candidate) => {
    expect(safeRedirectPath(candidate)).toBeNull();
  });
});
