import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createPlayer, groupOf, rpc, secret, signIn } from "./local-stack";

/**
 * Automated floor, not a substitute for a screen-reader pass: every page has
 * no critical or serious axe violation against WCAG 2.2 AA, and reflows at
 * 320px wide (WCAG 1.4.10) and in phone landscape without sideways scrolling.
 */
async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    // The Next.js development overlay is not part of the product.
    .exclude("nextjs-portal")
    .analyze();
  const blocking = violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map(
      (v) =>
        `${path}: ${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
    );
  expect.soft(blocking, `axe violations on ${path}`).toEqual([]);

  for (const viewport of [
    { width: 320, height: 640 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect
      .soft(overflow, `${path} scrolls sideways at ${viewport.width}px`)
      .toBeLessThanOrEqual(0);
  }
}

test("public pages are accessible and reflow", async ({ page }) => {
  for (const path of [
    "/",
    "/login",
    "/signup",
    "/reset-password",
    "/no-such-page",
  ]) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await audit(page, path);
  }
});

test.describe("signed-in pages", () => {
  test.skip(!secret, "needs the local Supabase stack");

  test("are accessible and reflow", async ({ browser }) => {
    test.setTimeout(120_000);
    const tag = crypto.randomUUID().slice(0, 5);
    // Five entrants make a three-round draw, far wider than a phone, so the
    // reflow check covers the scrolling bracket.
    const [ada, bo, cal, dee, eve] = await Promise.all(
      ["Ada", "Bo", "Cal", "Dee", "Eve"].map((name) =>
        createPlayer(`${name}${tag}`),
      ),
    );
    const groupId = await groupOf(ada, bo, cal, dee, eve);
    const confirmed = await rpc(ada, "submit_match", {
      target_group: groupId,
      opponent: bo.id,
      played: new Date().toISOString().slice(0, 10),
      match_outcome: "completed",
      sets: [
        { a: 6, b: 4 },
        { a: 3, b: 6 },
        { a: 7, b: 6, tiebreak: 5 },
      ],
    });
    await rpc(bo, "confirm_match", { target_match: confirmed });
    const pending = await rpc(bo, "submit_match", {
      target_group: groupId,
      opponent: ada.id,
      played: new Date().toISOString().slice(0, 10),
      match_outcome: "completed",
      sets: [
        { a: 6, b: 2 },
        { a: 6, b: 2 },
      ],
    });
    const tournamentId = await rpc(ada, "create_tournament", {
      target_group: groupId,
      tournament_name: `Cup ${tag}`,
      cap: 8,
    });
    await rpc(ada, "register_for_tournament", { target: tournamentId });
    for (const player of [bo, cal, dee, eve]) {
      await rpc(player, "register_for_tournament", { target: tournamentId });
    }
    await rpc(ada, "start_tournament", { target: tournamentId });

    const page = await signIn(browser, ada);
    for (const path of [
      "/dashboard",
      "/matches",
      "/matches/new",
      `/matches/${confirmed}`,
      `/matches/${pending}`,
      "/standings",
      "/groups",
      `/groups/${groupId}`,
      `/groups/${groupId}?tab=members`,
      `/groups/${groupId}/settings`,
      "/tournaments",
      "/tournaments/new",
      `/tournaments/${tournamentId}`,
      `/tournaments/${tournamentId}?tab=entrants`,
      `/tournaments/${tournamentId}/manage`,
      "/profile",
      `/players/${bo.id}`,
      "/settings",
    ]) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await audit(page, path);
    }
  });
});
