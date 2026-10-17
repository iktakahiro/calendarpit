import { defineConfig, devices } from '@playwright/test';

/** Port of the server under test, separate from the dev server's 4173. */
const port = 4191;
const ci = !!process.env.CI;

/**
 * Browser E2E tests against the production build with an in-memory database.
 * Tests share one server and reset it before each test, so they run serially.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `bun bin/calendarpit.ts --port ${port} --database :memory:`,
    url: `http://127.0.0.1:${port}/__calendarpit/health`,
    reuseExistingServer: !ci,
    stdout: 'ignore',
  },
});
