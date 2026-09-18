import { test } from "@playwright/test";

import { audit } from "./audit";

test("public pages are accessible and reflow", async ({ page }) => {
  for (const path of [
    "/",
    "/login",
    "/signup",
    "/reset-password",
    "/no-such-page",
  ]) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await audit(page, path);
  }
});
