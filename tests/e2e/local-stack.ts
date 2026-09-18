import { expect, type Browser, type Page } from "@playwright/test";

/**
 * Helpers for journeys that write data. They run only against the local
 * Supabase stack: docs/product-questions.md forbids seeded tests on the shared
 * project. Set E2E_LOCAL_SUPABASE_SECRET to the `SECRET_KEY` from
 * `npx supabase status`, and E2E_LOCAL_SUPABASE_PUBLISHABLE to its
 * `PUBLISHABLE_KEY` for helpers that act as a player through the API.
 */
export const secret = process.env.E2E_LOCAL_SUPABASE_SECRET;
const publishable = process.env.E2E_LOCAL_SUPABASE_PUBLISHABLE;
const api = "http://127.0.0.1:54321";
const password = "tennis-pass-1";

export type Player = { name: string; email: string; id: string; token: string };

export async function createPlayer(name: string): Promise<Player> {
  const email = `${name.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}@tenny.test`;
  const created = await fetch(`${api}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: secret!,
      Authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: name },
    }),
  });
  expect(created.ok).toBe(true);

  const session = await fetch(`${api}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: publishable ?? secret!,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  }).then((response) => response.json());

  return { name, email, id: session.user.id, token: session.access_token };
}

/** Calls a database function as the player, for setup the test is not about. */
export async function rpc(
  player: Player,
  fn: string,
  args: Record<string, unknown>,
) {
  const response = await fetch(`${api}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: publishable ?? secret!,
      Authorization: `Bearer ${player.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const body = await response.text();
  expect(response.ok, body).toBe(true);
  return body ? JSON.parse(body) : null;
}

export async function signIn(browser: Browser, player: Player): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(player.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return page;
}

/** A group organized by the first player, joined by the rest. */
export async function groupOf(organizer: Player, ...members: Player[]) {
  const groupId: string = await rpc(organizer, "create_group", {
    group_name: `Ladder ${crypto.randomUUID().slice(0, 6)}`,
  });
  const [{ invite_code }] = await fetch(
    `${api}/rest/v1/groups?id=eq.${groupId}&select=invite_code`,
    {
      headers: {
        apikey: publishable ?? secret!,
        Authorization: `Bearer ${organizer.token}`,
      },
    },
  ).then((response) => response.json());
  for (const member of members) {
    await rpc(member, "join_group_by_code", { code: invite_code });
  }
  return groupId;
}
