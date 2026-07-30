import { defineConfig, devices } from "@playwright/test";

// The suite runs against plain `vite`, not `vercel dev`: every /api route is
// stubbed in tests/fixtures.js. That means no ANTHROPIC_API_KEY, no password, and
// no real model calls — so the tests are fast, free, and deterministic. Anything
// that genuinely needs the serverless functions belongs in a separate suite.
const PORT = 5174;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // The reported bug was phone-specific, so mobile is a first-class target
    // rather than an afterthought.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
