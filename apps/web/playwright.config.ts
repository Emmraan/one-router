import { defineConfig, devices } from '@playwright/test';

const external = process.env.E2E_EXTERNAL === '1';

export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/redesign/**',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['github']] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: external ? undefined : [
    {
      command: 'node scripts/serve-static.mjs',
      url: 'http://localhost:3100/login/',
      env: { PORT: '3100' },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm exec tsx e2e/server.ts',
      url: 'http://localhost:4000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
