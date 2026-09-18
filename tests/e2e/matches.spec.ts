import { expect, test, type Page } from "@playwright/test";

import { createPlayer, signIn } from "./local-stack";

/**
 * The verified match lifecycle with two real accounts, through the interface:
 * create and join a group, submit, edit, confirm, see the rating move, void it
 * with a reason, reject with a reason, withdraw, edit a profile, sign out.
 * Carries over every check from the pre-redesign lifecycle test.
 */

async function logMatch(
  page: Page,
  opponent: string,
  sets: [string, string][],
  names: [string, string],
) {
  await page.goto("/matches/new");
  await page.getByRole("radio", { name: opponent }).check();
  await page.getByRole("button", { name: "Continue" }).click(); // opponent
  await page.getByRole("button", { name: "Continue" }).click(); // date and outcome
  await fillSets(page, sets, names);
  await page.getByRole("button", { name: "Continue" }).click(); // score
}

async function fillSets(
  page: Page,
  sets: [string, string][],
  names: [string, string],
) {
  for (const [index, [mine, theirs]] of sets.entries()) {
    await page.getByLabel(`Set ${index + 1}, ${names[0]} games`).fill(mine);
    await page.getByLabel(`Set ${index + 1}, ${names[1]} games`).fill(theirs);
  }
}

async function answer(
  page: Page,
  action: "Confirm score" | "Reject score",
  reason?: string,
) {
  await page.getByRole("button", { name: action }).click();
  const dialog = page.getByRole("dialog");
  if (reason)
    await dialog.getByLabel("What was wrong? (optional)").fill(reason);
  await dialog.getByRole("button", { name: action }).click();
  await expect(dialog).toBeHidden();
}

test("two players complete the verified match lifecycle", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const tag = crypto.randomUUID().slice(0, 6);
  const [adaPlayer, boPlayer] = await Promise.all([
    createPlayer(`Ada${tag}`),
    createPlayer(`Bo${tag}`),
  ]);
  const names: [string, string] = [`Ada${tag}`, `Bo${tag}`];

  // A signed-in visitor to the landing page goes to their dashboard.
  const ada = await signIn(browser, adaPlayer);
  await ada.goto("/");
  await expect(ada).toHaveURL(/\/dashboard$/);

  // Ada creates a group from the first-run dashboard; Bo joins with the code.
  await ada.getByRole("button", { name: "Create group" }).click();
  await ada.getByLabel("Group name").fill(`Ladder ${tag}`);
  await ada
    .getByRole("dialog")
    .getByRole("button", { name: "Create group" })
    .click();
  await expect(
    ada.getByRole("heading", { level: 1, name: `Ladder ${tag}` }),
  ).toBeVisible();
  const groupUrl = ada.url().split("?")[0];
  const code = (await ada.locator(".type-code").first().textContent())!.trim();

  const bo = await signIn(browser, boPlayer);
  await bo.getByRole("button", { name: "Join group" }).first().click();
  await bo.getByLabel("Invite code").fill(code);
  await bo
    .getByRole("dialog")
    .getByRole("button", { name: "Join group" })
    .click();
  await expect(bo.getByText(`Welcome to Ladder ${tag}.`)).toBeVisible();

  // An illegal score is caught before it is sent, and the entry is kept.
  await logMatch(
    ada,
    names[1],
    [
      ["6", "5"],
      ["6", "0"],
    ],
    names,
  );
  await expect(
    ada.getByRole("alert").filter({ hasText: "not a finished set" }),
  ).toBeVisible();
  await expect(ada.getByLabel(`Set 1, ${names[0]} games`)).toHaveValue("6");
  await ada.getByLabel(`Set 1, ${names[1]} games`).fill("0");
  await ada.getByRole("button", { name: "Continue" }).click();
  await ada.getByRole("button", { name: "Send for confirmation" }).click();
  await expect(ada.getByText("Sent for confirmation")).toBeVisible();
  const matchUrl = ada.url().split("?")[0];

  // The submitter cannot confirm, but can edit while it is pending.
  await expect(ada.getByRole("button", { name: "Confirm score" })).toHaveCount(
    0,
  );
  await ada.getByRole("link", { name: "Edit score" }).click();
  await ada.getByRole("button", { name: "Continue" }).click();
  await ada.getByLabel(`Set 2, ${names[1]} games`).fill("1");
  await ada.getByRole("button", { name: "Continue" }).click();
  await expect(
    ada.getByRole("group", { name: `${names[0]} beat ${names[1]} 6-0 6-1` }),
  ).toBeVisible();
  await ada.getByRole("button", { name: "Save changes" }).click();
  await expect(ada.getByText("Correction sent")).toBeVisible();

  // Nothing is rated until the opponent confirms.
  await bo.goto(`${groupUrl}?tab=standings`);
  await expect(
    bo.getByText("No confirmed matches in this group yet."),
  ).toBeVisible();

  await bo.goto(matchUrl);
  await answer(bo, "Confirm score");
  await expect(
    bo.getByText("Confirmed", { exact: true }).first(),
  ).toBeVisible();

  // 6-0 6-1 between two new players: +19.4 and -19.4, shown rounded.
  await bo.goto(`${groupUrl}?tab=standings`);
  const table = bo.getByRole("table");
  await expect(
    table.getByRole("row", { name: new RegExp(names[0]) }),
  ).toContainText("1519");
  await expect(
    table.getByRole("row", { name: new RegExp(names[1]) }),
  ).toContainText("1481");

  // Confirmed is final: no edit. The organizer voids it with a reason.
  await ada.goto(matchUrl);
  await expect(ada.getByRole("link", { name: "Edit score" })).toHaveCount(0);
  await ada.getByRole("button", { name: "Void match" }).click();
  await ada
    .getByRole("dialog")
    .getByLabel("Reason")
    .fill("Practice set, logged by mistake.");
  await ada
    .getByRole("dialog")
    .getByRole("button", { name: "Void match" })
    .click();
  await expect(ada.getByText("This match was voided")).toBeVisible();
  await expect(
    ada.getByText("Practice set, logged by mistake.").first(),
  ).toBeVisible();
  await ada.goto(`${groupUrl}?tab=standings`);
  await expect(
    ada.getByText("No confirmed matches in this group yet."),
  ).toBeVisible();

  // Bo rejects the next submission, and Ada sees why.
  await logMatch(
    ada,
    names[1],
    [
      ["6", "0"],
      ["6", "0"],
    ],
    names,
  );
  await ada.getByRole("button", { name: "Send for confirmation" }).click();
  await expect(ada.getByText("Sent for confirmation")).toBeVisible();
  const rejectedUrl = ada.url().split("?")[0];
  await bo.goto(rejectedUrl);
  await answer(bo, "Reject score", "It was 6-2 in the second.");
  await expect(bo.getByText("Rejected", { exact: true }).first()).toBeVisible();
  await ada.goto(rejectedUrl);
  await expect(ada.getByText(`${names[1]} rejected this score`)).toBeVisible();
  await expect(
    ada.getByText("It was 6-2 in the second.").first(),
  ).toBeVisible();

  // Ada withdraws a pending submission; it is gone.
  await logMatch(
    ada,
    names[1],
    [
      ["6", "2"],
      ["6", "2"],
    ],
    names,
  );
  await ada.getByRole("button", { name: "Send for confirmation" }).click();
  await expect(ada.getByText("Sent for confirmation")).toBeVisible();
  const withdrawnUrl = ada.url().split("?")[0];
  await ada.getByRole("button", { name: "Withdraw" }).click();
  await ada
    .getByRole("dialog")
    .getByRole("button", { name: "Withdraw match" })
    .click();
  await expect(ada.getByText("The match was withdrawn.")).toBeVisible();
  await ada.goto(withdrawnUrl);
  await expect(
    ada.getByRole("heading", { name: "Nothing here" }),
  ).toBeVisible();

  // Profile: a new display name is saved and shown.
  await ada.goto("/settings");
  await ada.getByLabel("Display name").fill(`Ada updated ${tag}`);
  await ada.getByRole("button", { name: "Save name" }).click();
  await expect(ada.getByText("Display name saved.")).toBeVisible();
  await ada.goto("/profile");
  await expect(
    ada.getByRole("heading", { level: 1, name: `Ada updated ${tag}` }),
  ).toBeVisible();

  // Signing out ends the session.
  await ada.goto("/settings");
  await ada.getByRole("button", { name: "Sign out" }).click();
  await expect(ada).toHaveURL(/\/login$/);
  await ada.goto("/dashboard");
  await expect(ada).toHaveURL(/\/login\?next=/);
});
