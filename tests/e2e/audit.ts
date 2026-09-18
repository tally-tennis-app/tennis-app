import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Automated floor, not a substitute for a screen-reader pass: every page has
 * no critical or serious axe violation against WCAG 2.2 AA, and reflows at
 * 320px wide (WCAG 1.4.10) and in phone landscape without sideways scrolling.
 */
export async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    // The Next.js development overlay is not part of the product.
    .exclude("nextjs-portal")
    .analyze();
  const blocking = violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map(
      (v) =>
        `${path}: ${v.id} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
    );
  expect.soft(blocking, `axe violations on ${path}`).toEqual([]);

  for (const viewport of [
    { width: 320, height: 640 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect
      .soft(overflow, `${path} scrolls sideways at ${viewport.width}px`)
      .toBeLessThanOrEqual(0);
  }
}
