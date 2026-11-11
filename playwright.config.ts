import { defineConfig, devices } from '@playwright/test'

const port = 4173

// End-to-end tests run against the generated static site, as it will be served.
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Every test has its own browser context, so tests from one file can run on
  // different workers. CI uses every core of its runner; locally Playwright's
  // default (half the cores) leaves room for other work.
  fullyParallel: true,
  workers: process.env.CI ? '100%' : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `node scripts/serve-static.ts --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
})
