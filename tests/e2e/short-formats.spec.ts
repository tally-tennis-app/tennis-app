import { expect, test, type Page } from "@playwright/test";

import { createPlayer, groupOf, rpc, signIn } from "./local-stack";

/**
 * A single set and a standalone tiebreak, submitted and confirmed through the
 * interface, and the smaller rating movement each one earns (ADR 0005). Runs on
 * both the desktop and mobile projects, so the points entry is exercised at
 * phone width too.
 */

async function confirm(page: Page) {
  await page.getByRole("button", { name: "Confirm score" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirm score" }).click();
  await expect(dialog).toBeHidden();
}

test("a single set counts half a match", async ({ browser }) => {
  const tag = crypto.randomUUID().slice(0, 5);
  const [ada, bo] = await Promise.all(
    ["Ada", "Bo"].map((name) => createPlayer(`${name}${tag}`)),
  );
  await groupOf(ada, bo);
  const names: [string, string] = [ada.name, bo.name];

  const submitter = await signIn(browser, ada);
  await submitter.goto("/matches/new");
  await submitter.getByRole("radio", { name: bo.name }).check();
  await submitter.getByRole("button", { name: "Continue" }).click();

  await submitter.getByRole("radio", { name: "Single set" }).check();
  await submitter.getByRole("button", { name: "Continue" }).click();

  // One set only: there is no "Set 2" to fill and no decider to reveal.
  await submitter.getByLabel(`Set, ${names[0]} games`).fill("6");
  await submitter.getByLabel(`Set, ${names[1]} games`).fill("0");
  await expect(submitter.getByLabel(`Set 2, ${names[0]} games`)).toHaveCount(0);
  await submitter.getByRole("button", { name: "Continue" }).click();

  await expect(submitter.getByText("Single set")).toBeVisible();
  await submitter
    .getByRole("button", { name: "Send for confirmation" })
    .click();
  await expect(submitter.getByText("Sent for confirmation")).toBeVisible();

  const opponent = await signIn(browser, bo);
  await opponent.goto("/matches");
  await opponent
    .getByRole("link", { name: /Confirm or reject/ })
    .first()
    .click();
  await confirm(opponent);

  // A 6-0 set at equal ratings is the biggest margin: a full match would give
  // 20 points, so a single set gives exactly 10.
  await opponent.goto("/standings");
  const table = opponent.getByRole("table");
  await expect(
    table.getByRole("row", { name: new RegExp(ada.name) }),
  ).toContainText("1510");
  await expect(
    table.getByRole("row", { name: new RegExp(bo.name) }),
  ).toContainText("1490");
});

test("a tiebreak counts half a set", async ({ browser }) => {
  const tag = crypto.randomUUID().slice(0, 5);
  const [ada, bo] = await Promise.all(
    ["Ada", "Bo"].map((name) => createPlayer(`${name}${tag}`)),
  );
  await groupOf(ada, bo);

  const submitter = await signIn(browser, ada);
  await submitter.goto("/matches/new");
  await submitter.getByRole("radio", { name: bo.name }).check();
  await submitter.getByRole("button", { name: "Continue" }).click();

  await submitter.getByRole("radio", { name: "Tiebreak" }).check();
  await submitter.getByRole("button", { name: "Continue" }).click();

  // Points, not games: two digits, and a target to choose.
  await submitter.getByRole("radio", { name: "10 points" }).check();
  await submitter.getByLabel(`${ada.name} tiebreak points`).fill("10");
  await submitter.getByLabel(`${bo.name} tiebreak points`).fill("0");
  await submitter.getByRole("button", { name: "Continue" }).click();

  await expect(submitter.getByText("Tiebreak to 10")).toBeVisible();
  await submitter
    .getByRole("button", { name: "Send for confirmation" })
    .click();
  await expect(submitter.getByText("Sent for confirmation")).toBeVisible();

  const opponent = await signIn(browser, bo);
  await opponent.goto("/matches");
  await opponent
    .getByRole("link", { name: /Confirm or reject/ })
    .first()
    .click();
  await confirm(opponent);

  // A quarter of a match: 5 points rather than 20.
  await opponent.goto("/standings");
  const table = opponent.getByRole("table");
  await expect(
    table.getByRole("row", { name: new RegExp(ada.name) }),
  ).toContainText("1505");
});

test("an unfinished tiebreak is refused before it reaches the database", async ({
  browser,
}) => {
  const tag = crypto.randomUUID().slice(0, 5);
  const [ada, bo] = await Promise.all(
    ["Ada", "Bo"].map((name) => createPlayer(`${name}${tag}`)),
  );
  await groupOf(ada, bo);

  const page = await signIn(browser, ada);
  await page.goto("/matches/new");
  await page.getByRole("radio", { name: bo.name }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "Tiebreak" }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: "10 points" }).check();
  await page.getByLabel(`${ada.name} tiebreak points`).fill("10");
  await page.getByLabel(`${bo.name} tiebreak points`).fill("9");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "not a finished tiebreak" }),
  ).toBeVisible();
  // The typed points survive the failure.
  await expect(page.getByLabel(`${ada.name} tiebreak points`)).toHaveValue(
    "10",
  );
});

// A tie's format comes from its tournament rather than the format step, so the
// form has to start in the tiebreak's one-row shape on its own.
test("a tiebreak tournament tie takes a points score", async ({ browser }) => {
  const tag = crypto.randomUUID().slice(0, 5);
  const [ada, bo] = await Promise.all(
    ["Ada", "Bo"].map((name) => createPlayer(`${name}${tag}`)),
  );
  const groupId = await groupOf(ada, bo);
  const tournamentId = await rpc(ada, "create_tournament", {
    target_group: groupId,
    tournament_name: `Breakers ${tag}`,
    cap: 4,
    tournament_format: "tiebreak",
  });
  for (const player of [ada, bo]) {
    await rpc(player, "register_for_tournament", { target: tournamentId });
  }
  await rpc(ada, "start_tournament", { target: tournamentId });

  const page = await signIn(browser, ada);
  await page.goto(`/tournaments/${tournamentId}`);
  await page.getByRole("link", { name: "Log the result" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: "7 points" }).check();
  await page.getByLabel(`${ada.name} tiebreak points`).fill("7");
  await page.getByLabel(`${bo.name} tiebreak points`).fill("3");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Tiebreak to 7")).toBeVisible();
  await page.getByRole("button", { name: "Send for confirmation" }).click();
  await expect(page.getByText("Sent for confirmation")).toBeVisible();
});
