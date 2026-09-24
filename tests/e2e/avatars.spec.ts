import { expect, test } from "@playwright/test";

import { createPlayer, groupOf, rpc, sets, signIn, today } from "./local-stack";

/**
 * An uploaded picture has to follow the player around the app, not just sit on
 * their own profile. Standings, the group roster, and the tournament entrant
 * list each render from a different query, so each one needs its own check.
 */

// The smallest valid PNG: one opaque pixel.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("an uploaded picture shows everywhere the player is listed", async ({
  browser,
}) => {
  const tag = crypto.randomUUID().slice(0, 5);
  const [ada, bo] = await Promise.all(
    ["Ada", "Bo"].map((name) => createPlayer(`${name}${tag}`)),
  );
  const groupId = await groupOf(ada, bo);

  // Rate them both so they appear in the standings table rather than the
  // unrated list.
  const match = await rpc(ada, "submit_match", {
    target_group: groupId,
    opponent: bo.id,
    match_outcome: "completed",
    match_winner: ada.id,
    sets: sets([6, 4], [6, 3]),
    match_played_on: today(),
  });
  await rpc(bo, "confirm_match", { target_match: match.id });

  const page = await signIn(browser, ada);

  // Upload a picture.
  await page.goto("/settings");
  await page.getByLabel("Profile picture").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: PIXEL,
  });
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  // The settings form itself shows it back.
  const settingsAvatar = page.locator('img[src*="avatars"]').first();
  await expect(settingsAvatar).toBeVisible();

  // Their own profile.
  await page.goto("/profile");
  await expect(page.locator('img[src*="avatars"]').first()).toBeVisible();

  // Standings: the regression this test exists for.
  await page.goto("/standings");
  const ownRow = page
    .getByRole("table")
    .getByRole("row", { name: new RegExp(ada.name) });
  await expect(ownRow.locator('img[src*="avatars"]')).toHaveCount(1);
  // Bo has no picture, so that row keeps its initials.
  await expect(
    page
      .getByRole("table")
      .getByRole("row", { name: new RegExp(bo.name) })
      .locator("img"),
  ).toHaveCount(0);

  // The group roster.
  await page.goto(`/groups/${groupId}`);
  await expect(page.locator('img[src*="avatars"]').first()).toBeVisible();

  // And a peer sees it too, not just the owner.
  const peer = await signIn(browser, bo);
  await peer.goto("/standings");
  await expect(
    peer
      .getByRole("table")
      .getByRole("row", { name: new RegExp(ada.name) })
      .locator('img[src*="avatars"]'),
  ).toHaveCount(1);
});
