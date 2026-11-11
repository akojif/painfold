import { defineConfig, devices } from '@playwright/test'

const port = 4173
// PAINFOLD_URL runs the tests against a deployed site instead, such as a
// Cloudflare preview (see docs/development.md); no local server is started.
const deployed = process.env.PAINFOLD_URL || undefined

// End-to-end tests run against the generated static site, as it will be served.
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Every test has its own browser context, so tests from one file can run on
  // different workers. CI uses every core of its runner; locally Playwright's
  // default (half the cores) leaves room for other work.
  fullyParallel: true,
  // Against a deployed site, every model test downloads 152 MB over the internet; two at a time keeps them inside their time limits.
  workers: deployed ? 2 : process.env.CI ? '100%' : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: deployed ?? `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: deployed
    ? undefined
    : {
        command: `node scripts/serve-static.ts --port ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: !process.env.CI,
      },
})
