import { expect, type Browser, type Page } from "@playwright/test";

/**
 * Helpers for journeys that create accounts and data. They run only in the
 * integration projects that scripts/test-local-e2e.py enables, and refuse any
 * database that is not the local CLI stack: seeded tests never touch a cloud
 * project (docs/product-questions.md).
 */
function localStack() {
  if (process.env.TEST_LOCAL_SUPABASE !== "1") {
    throw new Error("Local integration tests require explicit opt-in.");
  }
  const raw = process.env.TEST_SUPABASE_URL;
  if (!raw || raw !== process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Test and app database URLs must match.");
  }
  const url = new URL(raw);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.protocol !== "http:" ||
    !url.port
  ) {
    throw new Error("Refusing to seed a nonlocal database.");
  }
  const secret = process.env.TEST_SUPABASE_SECRET_KEY;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!secret || !publishable) throw new Error("Missing local stack keys.");
  return { api: raw, secret, publishable };
}

const password = `Tennis-test-${crypto.randomUUID().slice(0, 8)}!Aa9`;

export type Player = { name: string; email: string; id: string; token: string };

export async function createPlayer(name: string): Promise<Player> {
  const { api, secret, publishable } = localStack();
  const email = `${name.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}@example.test`;
  const created = await fetch(`${api}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: secret,
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
    headers: { apikey: publishable, "content-type": "application/json" },
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
  const { api, publishable } = localStack();
  const response = await fetch(`${api}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: publishable,
      Authorization: `Bearer ${player.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const body = await response.text();
  expect(response.ok, body).toBe(true);
  return body ? JSON.parse(body) : null;
}

// The test runner's browser.newContext() applies the project's options, so a
// mobile project signs players in on the mobile device profile.
export async function signIn(browser: Browser, player: Player): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(player.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return page;
}

// The smallest valid PNG: one opaque pixel.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Gives a player a profile picture the way the settings form does: one object
 * under their own prefix, then avatar_path on their row. Setup, not the thing
 * under test, so it skips the browser.
 */
export async function giveAvatar(player: Player) {
  const { api, publishable } = localStack();
  const path = `${player.id}/avatar`;
  const headers = {
    apikey: publishable,
    Authorization: `Bearer ${player.token}`,
  };

  const upload = await fetch(`${api}/storage/v1/object/avatars/${path}`, {
    method: "POST",
    headers: { ...headers, "content-type": "image/png" },
    body: PIXEL,
  });
  expect(upload.ok, await upload.text()).toBe(true);

  const update = await fetch(`${api}/rest/v1/profiles?id=eq.${player.id}`, {
    method: "PATCH",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ avatar_path: path }),
  });
  expect(update.ok, await update.text()).toBe(true);
}

/** A group organized by the first player, joined by the rest. */
export async function groupOf(organizer: Player, ...members: Player[]) {
  const { api, publishable } = localStack();
  const groupId: string = await rpc(organizer, "create_group", {
    group_name: `Ladder ${crypto.randomUUID().slice(0, 6)}`,
  });
  const [{ invite_code }] = await fetch(
    `${api}/rest/v1/groups?id=eq.${groupId}&select=invite_code`,
    {
      headers: {
        apikey: publishable,
        Authorization: `Bearer ${organizer.token}`,
      },
    },
  ).then((response) => response.json());
  for (const member of members) {
    await rpc(member, "join_group_by_code", { code: invite_code });
  }
  return groupId;
}

/** A best-of-three score in the database's set format. */
export function sets(...games: [number, number][]) {
  return games.map(([a, b], index) => ({
    set_number: index + 1,
    games_a: a,
    games_b: b,
    tiebreak_a: null,
    tiebreak_b: null,
    complete: true,
  }));
}

export const today = () => new Date().toISOString().slice(0, 10);
