import { expect, test } from "@playwright/test";

import { createPlayer, secret, signIn } from "./local-stack";

/**
 * The primary product loop with two real accounts: create a group, join it,
 * submit a score, confirm it as the opponent, and watch the standings move.
 * Runs only against the local stack; see local-stack.ts.
 */
test.skip(!secret, "needs the local Supabase stack");

test("a score goes from submission to confirmed standings", async ({
  browser,
}) => {
  const suffix = crypto.randomUUID().slice(0, 6);
  const [adaPlayer, boPlayer] = await Promise.all([
    createPlayer(`Ada${suffix}`),
    createPlayer(`Bo${suffix}`),
  ]);

  // Ada creates a group from the first-run dashboard.
  const ada = await signIn(browser, adaPlayer);
  await ada.getByRole("button", { name: "Create group" }).click();
  await ada.getByLabel("Group name").fill(`Ladder ${suffix}`);
  await ada
    .getByRole("dialog")
    .getByRole("button", { name: "Create group" })
    .click();
  await expect(
    ada.getByRole("heading", { level: 1, name: `Ladder ${suffix}` }),
  ).toBeVisible();
  const code = (await ada.locator(".type-code").first().textContent())!.trim();

  // Bo joins with the code.
  const bo = await signIn(browser, boPlayer);
  await bo.getByRole("button", { name: "Join group" }).first().click();
  await bo.getByLabel("Invite code").fill(code);
  await bo
    .getByRole("dialog")
    .getByRole("button", { name: "Join group" })
    .click();
  await expect(bo.getByText(`Welcome to Ladder ${suffix}.`)).toBeVisible();

  // Ada logs a three-set win. The group is preselected: she has only one.
  await ada.goto("/matches/new");
  await ada.getByRole("radio", { name: `Bo${suffix}` }).check();
  await ada.getByRole("button", { name: "Continue" }).click();
  await ada.getByRole("button", { name: "Continue" }).click();
  const games = async (set: number, mine: string, theirs: string) => {
    await ada.getByLabel(`Set ${set}, Ada${suffix} games`).fill(mine);
    await ada.getByLabel(`Set ${set}, Bo${suffix} games`).fill(theirs);
  };
  await games(1, "6", "4");
  await games(2, "3", "6");
  // The deciding set appears only once the first two are split.
  await games(3, "7", "6");
  await ada.getByLabel("Tiebreak loser's points (optional)").fill("5");
  await ada.getByRole("button", { name: "Continue" }).click();
  await expect(
    ada.getByRole("group", {
      name: `Ada${suffix} beat Bo${suffix} 6-4 3-6 7-6(5)`,
    }),
  ).toBeVisible();
  await ada.getByRole("button", { name: "Send for confirmation" }).click();
  await expect(ada.getByText("Sent for confirmation")).toBeVisible();

  // Ada cannot confirm her own submission.
  await expect(ada.getByRole("button", { name: "Confirm score" })).toHaveCount(
    0,
  );

  // Bo finds it waiting on the dashboard and confirms it.
  await bo.goto("/dashboard");
  await bo.getByRole("link", { name: /Confirm or reject/ }).click();
  await bo.getByRole("button", { name: "Confirm score" }).click();
  await bo
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm score" })
    .click();
  await expect(
    bo.getByText("Confirmed", { exact: true }).first(),
  ).toBeVisible();

  // The standings move for both players.
  await ada.goto("/standings");
  const table = ada.getByRole("table", { name: "Overall standings" });
  await expect(
    table.getByRole("row", { name: new RegExp(`Ada${suffix}`) }),
  ).toContainText("1-0");
  await expect(
    table.getByRole("row", { name: new RegExp(`Bo${suffix}`) }),
  ).toContainText("0-1");
});
