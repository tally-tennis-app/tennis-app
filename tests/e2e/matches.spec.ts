import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

function localAdmin() {
  if (process.env.TEST_LOCAL_SUPABASE !== "1")
    throw new Error("Local integration tests require explicit opt-in.");
  const raw = process.env.TEST_SUPABASE_URL;
  if (!raw || raw !== process.env.NEXT_PUBLIC_SUPABASE_URL)
    throw new Error("Test and app database URLs must match.");
  const url = new URL(raw);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.protocol !== "http:" ||
    !url.port
  )
    throw new Error("Refusing to seed a nonlocal database.");
  const key = process.env.TEST_SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Missing isolated test admin key.");
  return createClient(raw, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function fillCompletedScore(
  page: Page,
  playerA: string,
  playerB: string,
  gamesB1: string,
  gamesB2: string,
) {
  await page.getByLabel(`Set 1 ${playerA} games`, { exact: true }).fill("6");
  await page
    .getByLabel(`Set 1 ${playerB} games`, { exact: true })
    .fill(gamesB1);
  await page.getByLabel(`Set 2 ${playerA} games`, { exact: true }).fill("6");
  await page
    .getByLabel(`Set 2 ${playerB} games`, { exact: true })
    .fill(gamesB2);
}

test("two players complete the verified match lifecycle", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(120000);
  const admin = localAdmin(),
    tag = randomUUID().slice(0, 8),
    password = `Tennis-test-${tag}!Aa9`,
    ids: string[] = [];
  const groupIds: string[] = [];
  const users = [
    { email: `ada-${tag}@example.test`, name: `Ada ${tag}` },
    { email: `bo-${tag}@example.test`, name: `Bo ${tag}` },
  ];
  const otherContext = await browser.newContext({
    baseURL,
    viewport: page.viewportSize() ?? undefined,
    isMobile: testInfo.project.name.includes("mobile"),
    hasTouch: testInfo.project.name.includes("mobile"),
  });
  const other = await otherContext.newPage();
  try {
    for (const u of users) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password,
        email_confirm: true,
        user_metadata: { display_name: u.name },
      });
      if (error) throw error;
      ids.push(data.user.id);
    }
    await login(page, users[0].email, password);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Your tennis", exact: true }),
    ).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/groups");
    await page.getByLabel("Group name", { exact: true }).fill(`Ladder ${tag}`);
    await page
      .getByRole("button", { name: "Create group", exact: true })
      .click();
    await expect(page).toHaveURL(/\/groups\/[\w-]+$/);
    const groupUrl = page.url(),
      groupId = groupUrl.split("/").pop()!;
    groupIds.push(groupId);
    const { data: group, error: ge } = await admin
      .from("groups")
      .select("invite_code")
      .eq("id", groupId)
      .single();
    if (ge) throw ge;
    await login(other, users[1].email, password);
    await other.goto("/groups");
    await other
      .getByLabel("Invite code", { exact: true })
      .fill(group.invite_code);
    await other
      .getByRole("button", { name: "Join group", exact: true })
      .click();
    await expect(other).toHaveURL(groupUrl);
    await page.goto(`/groups/${groupId}/matches/new`);
    await fillCompletedScore(page, users[0].name, users[1].name, "5", "0");
    await page
      .getByRole("button", { name: "Submit match", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Check the score" }),
    ).toContainText("Check the score");
    await expect(
      page.getByLabel(`Set 1 ${users[0].name} games`, { exact: true }),
    ).toHaveValue("6");
    await page
      .getByLabel(`Set 1 ${users[1].name} games`, { exact: true })
      .fill("0");
    await page
      .getByRole("button", { name: "Submit match", exact: true })
      .click();
    await expect(page).toHaveURL(/\/matches\/[0-9a-f-]{36}$/);
    const matchUrl = page.url();
    await expect(
      page.getByRole("button", { name: "Confirm result", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Edit score", exact: true }).click();
    await page
      .getByLabel(`Set 2 ${users[1].name} games`, { exact: true })
      .fill("1");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(page).toHaveURL(matchUrl);
    await expect(
      page.getByRole("row").filter({
        has: page.getByRole("rowheader", { name: "2", exact: true }),
      }),
    ).toContainText("1");
    await other.goto(`/groups/${groupId}/standings`);
    await expect(
      other.getByRole("row").filter({ hasText: users[0].name }),
    ).toContainText("1500.0");
    await other.goto(matchUrl);
    await other
      .getByRole("button", { name: "Confirm result", exact: true })
      .click();
    await expect(other.getByText("confirmed", { exact: true })).toBeVisible();
    await other.goto(`/groups/${groupId}/standings`);
    await expect(
      other.getByRole("row").filter({ hasText: users[0].name }),
    ).toContainText("1519.4");
    await expect(
      other.getByRole("row").filter({ hasText: users[1].name }),
    ).toContainText("1480.6");
    await page.goto(matchUrl);
    await expect(
      page.getByRole("link", { name: "Edit score", exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Void confirmed match", exact: true })
      .click();
    await expect(page.getByText("void", { exact: true })).toBeVisible();
    await page.goto(`/groups/${groupId}/standings`);
    await expect(
      page.getByRole("row").filter({ hasText: users[0].name }),
    ).toContainText("1500.0");

    await page.goto(`/groups/${groupId}/matches/new`);
    await fillCompletedScore(page, users[0].name, users[1].name, "0", "0");
    await page
      .getByRole("button", { name: "Submit match", exact: true })
      .click();
    await expect(page).toHaveURL(/\/matches\/[0-9a-f-]{36}$/);
    const rejectedUrl = page.url();
    await other.goto(rejectedUrl);
    await other
      .getByRole("button", { name: "Reject result", exact: true })
      .click();
    await expect(other.getByText("rejected", { exact: true })).toBeVisible();

    await page.goto(`/groups/${groupId}/matches/new`);
    await fillCompletedScore(page, users[0].name, users[1].name, "2", "2");
    await page
      .getByRole("button", { name: "Submit match", exact: true })
      .click();
    await expect(page).toHaveURL(/\/matches\/[0-9a-f-]{36}$/);
    const withdrawnId = page.url().split("/").pop()!;
    await page
      .getByRole("button", { name: "Withdraw match", exact: true })
      .click();
    await expect(page).toHaveURL(/\/matches$/);
    const { data: withdrawn, error: withdrawnError } = await admin
      .from("matches")
      .select("id")
      .eq("id", withdrawnId)
      .maybeSingle();
    if (withdrawnError) throw withdrawnError;
    expect(withdrawn).toBeNull();

    await page.goto("/profile");
    await page
      .getByLabel("Display name", { exact: true })
      .fill(`Ada updated ${tag}`);
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Profile saved");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=/);
  } finally {
    await otherContext.close();
    for (const id of groupIds) {
      const { error } = await admin.from("groups").delete().eq("id", id);
      if (error) throw error;
    }
    for (const id of ids) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
    }
  }
});
