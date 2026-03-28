import { defineConfig, devices } from "@playwright/test";

/** Dedicated port so tests never attach to another app on the default dev port (8080). */
const E2E_PORT = 5199;
const E2E_ORIGIN = `http://127.0.0.1:${E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: E2E_ORIGIN,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${E2E_PORT} --strictPort`,
    url: E2E_ORIGIN,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
