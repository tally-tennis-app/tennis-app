import { defineConfig, devices } from "@playwright/test";
const port = process.env.E2E_PORT ?? "3100";
const baseURL = `http://127.0.0.1:${port}`;
const integration = process.env.TEST_LOCAL_SUPABASE === "1";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 2,
  timeout: 60000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "on-first-retry" },
  projects: [
    {
      name: "chromium",
      testIgnore: "matches.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testIgnore: "matches.spec.ts",
      use: { ...devices["Pixel 7"] },
    },
    ...(integration
      ? [
          {
            name: "integration-chromium",
            testMatch: "matches.spec.ts",
            use: { ...devices["Desktop Chrome"] },
          },
          {
            name: "integration-mobile",
            testMatch: "matches.spec.ts",
            use: { ...devices["Pixel 7"] },
          },
        ]
      : []),
  ],
  webServer: {
    command:
      process.env.E2E_PRODUCTION === "1"
        ? `npm run start -- --hostname 127.0.0.1 --port ${port}`
        : `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
