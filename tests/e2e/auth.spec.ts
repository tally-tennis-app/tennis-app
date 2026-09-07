import { expect, test } from "@playwright/test";

test("sends an anonymous visitor from a protected route to sign in", async ({
  page,
}) => {
  await page.goto("/dashboard");

  // The proxy redirects before the page renders, preserving the destination.
  await expect(page).toHaveURL("/login?next=%2Fdashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
});

test("offers a labelled sign-in form and a route to the other auth pages", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/login");

  // getByLabel only resolves when the label is correctly associated, so this
  // doubles as the accessibility check for these fields.
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();

  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL("/signup");
  await expect(page.getByLabel("Display name")).toBeVisible();

  await page.goto("/reset-password");
  await expect(
    page.getByRole("button", { name: "Send reset link" }),
  ).toBeEnabled();

  expect(browserErrors).toEqual([]);
});

// Protection is deny-by-default: anything not on the public list is guarded,
// so a route added later is covered without anyone remembering to list it.
for (const path of [
  "/dashboard",
  "/groups",
  "/groups/00000000-0000-0000-0000-000000000000",
]) {
  test(`protects ${path} from anonymous visitors`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
  });
}

test("keeps the marketing page reachable while signed out", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
});
