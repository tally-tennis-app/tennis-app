import { expect, test, type Page } from "@playwright/test";

import { createPlayer, groupOf, rpc, signIn } from "./local-stack";

async function logResult(
  page: Page,
  sets: [string, string][],
  names: [string, string],
) {
  await page.getByRole("button", { name: "Continue" }).click();
  for (const [index, [mine, theirs]] of sets.entries()) {
    await page.getByLabel(`Set ${index + 1}, ${names[0]} games`).fill(mine);
    await page.getByLabel(`Set ${index + 1}, ${names[1]} games`).fill(theirs);
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Send for confirmation" }).click();
  await expect(page.getByText("Sent for confirmation")).toBeVisible();
}

test("a small tournament runs from creation to champion", async ({
  browser,
}) => {
  const tag = crypto.randomUUID().slice(0, 5);
  const [ada, bo, cal] = await Promise.all(
    ["Ada", "Bo", "Cal"].map((name) => createPlayer(`${name}${tag}`)),
  );
  await groupOf(ada, bo, cal);

  // The organizer creates the tournament and enters it.
  const organizer = await signIn(browser, ada);
  await organizer.goto("/tournaments/new");
  await organizer.getByLabel("Name").fill(`Cup ${tag}`);
  await organizer.getByRole("radio", { name: "4 players" }).check();
  await organizer.getByRole("button", { name: "Open for entries" }).click();
  await expect(organizer.getByText("Tournament created")).toBeVisible();
  const tournamentUrl = organizer.url().split("?")[0];
  const tournamentId = tournamentUrl.split("/").pop()!;
  await organizer.getByRole("button", { name: "Enter tournament" }).click();
  await expect(organizer.getByText("You are entered")).toBeVisible();

  // Two members enter; the second through the page.
  await rpc(bo, "register_for_tournament", { target: tournamentId });
  const cal_ = await signIn(browser, cal);
  await cal_.goto(tournamentUrl);
  await cal_.getByRole("button", { name: "Enter tournament" }).click();
  await expect(cal_.getByText("You are entered")).toBeVisible();

  // The organizer makes the draw: three players, so the top seed gets a bye.
  await organizer.goto(`${tournamentUrl}/manage`);
  await organizer
    .getByRole("button", { name: "Close entries and make the draw" })
    .click();
  await expect(organizer.getByRole("dialog")).toContainText(
    "1 bye for the top seeds",
  );
  await organizer
    .getByRole("dialog")
    .getByRole("button", { name: "Make the draw" })
    .click();
  // The dialog closes only once the server has accepted the draw.
  await expect(organizer.getByRole("dialog")).toBeHidden();
  await organizer.goto(tournamentUrl);
  await expect(
    organizer.getByText("You are through to the final"),
  ).toBeVisible();

  const draw = organizer.getByRole("region", { name: "Semifinals" });
  await organizer.getByRole("link", { name: "Draw" }).click();
  await expect(draw.getByText(`Ada${tag} advanced: bye`)).toBeAttached();

  // Semifinal: Bo logs a win over Cal, and Cal confirms it.
  const bo_ = await signIn(browser, bo);
  await bo_.goto(tournamentUrl);
  await bo_.getByRole("link", { name: "Log the result" }).click();
  await logResult(
    bo_,
    [
      ["6", "3"],
      ["6", "4"],
    ],
    [`Bo${tag}`, `Cal${tag}`],
  );
  await cal_.goto(tournamentUrl);
  await cal_.getByRole("link", { name: "Confirm or reject" }).click();
  await cal_.getByRole("button", { name: "Confirm score" }).click();
  await cal_
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm score" })
    .click();
  await expect(
    cal_.getByText("Confirmed", { exact: true }).first(),
  ).toBeVisible();

  // Final: the organizer, as a player, logs a loss to Bo; Bo confirms.
  await organizer.goto(tournamentUrl);
  await expect(
    organizer.getByText(`Your final against Bo${tag}`),
  ).toBeVisible();
  await organizer.getByRole("link", { name: "Log the result" }).click();
  await logResult(
    organizer,
    [
      ["4", "6"],
      ["5", "7"],
    ],
    [`Ada${tag}`, `Bo${tag}`],
  );
  await bo_.goto("/dashboard");
  await bo_
    .getByRole("link", { name: /Confirm or reject/ })
    .first()
    .click();
  await bo_.getByRole("button", { name: "Confirm score" }).click();
  await bo_
    .getByRole("dialog")
    .getByRole("button", { name: "Confirm score" })
    .click();
  // Wait for the action to finish, as matches.spec.ts does: asserting straight
  // after the click races the server action and the revalidation behind it.
  // Confirming a tie also advances the draw, so this one waits longer than the
  // five second default while the suite's other journeys share the server.
  await expect(bo_.getByRole("dialog")).toBeHidden({ timeout: 15_000 });
  await expect(bo_.getByText("Confirmed", { exact: true }).first()).toBeVisible(
    { timeout: 15_000 },
  );

  // Bo is champion, for everyone.
  for (const page of [organizer, cal_]) {
    await page.goto(tournamentUrl);
    await expect(page.getByText("Champion", { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole("paragraph")
        .filter({ hasText: `Bo${tag}` })
        .first(),
    ).toBeVisible();
  }
});
