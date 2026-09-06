import { expect, test } from "@playwright/test";

test("loads the foundation without browser errors and exposes its manifest", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Your court. Your crew. Every score counts.",
    }),
  ).toBeVisible();

  const manifestPath = await page
    .locator('link[rel="manifest"]')
    .getAttribute("href");
  expect(manifestPath).toBe("/manifest.webmanifest");

  const manifestResponse = await page.request.get(manifestPath!);
  expect(manifestResponse.ok()).toBe(true);
  await expect(manifestResponse.json()).resolves.toMatchObject({
    name: "Tennis App",
    start_url: "/",
    display: "standalone",
  });

  for (const iconPath of ["/icon-192.png", "/icon-512.png"]) {
    const iconResponse = await page.request.get(iconPath);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()["content-type"]).toContain("image/png");
  }

  expect(browserErrors).toEqual([]);
});
