import { expect, test, type Page } from "@playwright/test";

/**
 * The primary product loop with two real accounts: create a group, join it,
 * submit a score, confirm it as the opponent, and watch the standings move.
 *
 * It writes users and data, so it runs only against the local Supabase stack
 * (docs/product-questions.md forbids seeded tests on the shared project). Set
 * E2E_LOCAL_SUPABASE_SECRET to the `SECRET_KEY` from `npx supabase status`.
 */
const secret = process.env.E2E_LOCAL_SUPABASE_SECRET;
const api = "http://127.0.0.1:54321";

test.skip(!secret, "needs the local Supabase stack");

async function createUser(name: string) {
  const email = `${name.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}@tenny.test`;
  const response = await fetch(`${api}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: secret!,
      Authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: "tennis-pass-1",
      email_confirm: true,
      user_metadata: { display_name: name },
    }),
  });
  expect(response.ok).toBe(true);
  return email;
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("tennis-pass-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("a score goes from submission to confirmed standings", async ({
  browser,
}) => {
  const suffix = crypto.randomUUID().slice(0, 6);
  const [adaEmail, boEmail] = await Promise.all([
    createUser(`Ada${suffix}`),
    createUser(`Bo${suffix}`),
  ]);
  const ada = await (await browser.newContext()).newPage();
  const bo = await (await browser.newContext()).newPage();

  // Ada creates a group from the first-run dashboard.
  await signIn(ada, adaEmail);
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
  await signIn(bo, boEmail);
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
