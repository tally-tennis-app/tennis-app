import { test } from "@playwright/test";

import { audit } from "./audit";
import { createPlayer, groupOf, rpc, sets, signIn, today } from "./local-stack";

// The accessibility and reflow audit from audit.ts, over every
// signed-in route, with enough data that lists, tables, and a three-round
// tournament draw are populated.
test("signed-in pages are accessible and reflow", async ({ browser }) => {
  test.setTimeout(180_000);
  const tag = crypto.randomUUID().slice(0, 5);
  const [ada, bo, cal, dee, eve] = await Promise.all(
    ["Ada", "Bo", "Cal", "Dee", "Eve"].map((name) =>
      createPlayer(`${name}${tag}`),
    ),
  );
  const groupId = await groupOf(ada, bo, cal, dee, eve);

  const confirmed = await rpc(ada, "submit_match", {
    target_group: groupId,
    opponent: bo.id,
    match_outcome: "completed",
    match_winner: ada.id,
    sets: sets([6, 4], [3, 6], [7, 5]),
    match_played_on: today(),
  });
  await rpc(bo, "confirm_match", { target_match: confirmed.id });
  const pending = await rpc(bo, "submit_match", {
    target_group: groupId,
    opponent: ada.id,
    match_outcome: "completed",
    match_winner: bo.id,
    sets: sets([6, 2], [6, 2]),
    match_played_on: today(),
  });

  // Five entrants make a draw of eight: three rounds, far wider than a phone.
  const tournamentId = await rpc(ada, "create_tournament", {
    target_group: groupId,
    tournament_name: `Cup ${tag}`,
    cap: 8,
  });
  for (const player of [ada, bo, cal, dee, eve]) {
    await rpc(player, "register_for_tournament", { target: tournamentId });
  }
  await rpc(ada, "start_tournament", { target: tournamentId });

  const page = await signIn(browser, ada);
  for (const path of [
    "/dashboard",
    "/matches",
    "/matches/new",
    `/matches/${confirmed.id}`,
    `/matches/${pending.id}`,
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
