import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/redesign',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  snapshotPathTemplate: '{testDir}/snapshots/{platform}/{projectName}/{arg}{ext}',
  expect: { toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.001 } },
  use: { baseURL: 'http://localhost:3200', trace: 'retain-on-failure', screenshot: 'only-on-failure',
    colorScheme: 'dark', reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'UTC' },
  projects: [1440, 1024, 768].map((width) => ({ name: `${width}`, use: { browserName: 'chromium', viewport: { width, height: 900 } } })),
  webServer: [
    { command: 'node scripts/serve-static.mjs', url: 'http://localhost:3200/login/',
      env: { PORT: '3200', ONE_ROUTER_API_ORIGIN: 'http://localhost:4100' }, timeout: 60_000 },
    { command: 'pnpm exec tsx e2e/server.ts', url: 'http://localhost:4100/health',
      env: { E2E_PORT: '4100', E2E_ORIGIN: 'http://localhost:3200' }, timeout: 60_000 },
    { command: 'node scripts/serve-static.mjs', url: 'http://localhost:3300/',
      env: { PORT: '3300', OUT_DIR: '../site/out' }, timeout: 60_000 },
  ],
});
