import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    execArgv: process.platform === 'win32' ? ['--expose-gc'] : [],
    include: ['scripts/**/*.test.ts', 'packages/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/out/**'],
  },
});
