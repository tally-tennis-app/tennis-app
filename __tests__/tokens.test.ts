import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");

function block(source: string) {
  const tokens: Record<string, string> = {};
  for (const [, name, value] of source.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

const light = block(css.slice(0, css.indexOf("@media (prefers-color-scheme")));
const dark = {
  ...light,
  ...block(css.slice(css.indexOf("@media (prefers-color-scheme"))),
};

function hex(tokens: Record<string, string>, name: string): string {
  const value = tokens[name];
  const ref = value.match(/^var\(--([\w-]+)\)$/);
  return ref ? hex(tokens, ref[1]) : value;
}

function luminance(color: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(color.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, WCAG minimum]
const pairs: [string, string, number][] = [
  ["ink", "canvas", 4.5],
  ["ink", "surface", 4.5],
  ["ink-strong", "canvas", 4.5],
  ["muted", "canvas", 4.5],
  ["muted", "surface", 4.5],
  ["accent", "surface", 4.5],
  ["positive", "canvas", 4.5],
  ["warning", "canvas", 4.5],
  ["critical", "canvas", 4.5],
  ["critical", "surface", 4.5],
  ["on-action", "action", 4.5],
  ["line-strong", "surface", 3],
  ["line-strong", "canvas", 3],
  ["focus", "canvas", 3],
  ["focus", "surface", 3],
];

describe("design tokens", () => {
  it.each([
    ["light", light],
    ["dark", dark],
  ] as const)("meet WCAG AA contrast in %s mode", (_, tokens) => {
    for (const [fg, bg, min] of pairs) {
      expect(
        contrast(hex(tokens, fg), hex(tokens, bg)),
        `${fg} on ${bg}`,
      ).toBeGreaterThanOrEqual(min);
    }
  });
});
