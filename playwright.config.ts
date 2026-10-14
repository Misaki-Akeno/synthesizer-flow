import { defineConfig, devices } from '@playwright/test';

const production = process.env.E2E_PRODUCTION === '1';
const port = production ? 3200 : 3100;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.E2E_BROWSER_CHANNEL || undefined,
      },
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next ${production ? 'start' : 'dev'} --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/zh-CN`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
