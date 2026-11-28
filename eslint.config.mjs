import { defineConfig, globalIgnores } from 'eslint/config';
import next from 'eslint-config-next';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/.next/**',
    '**/.vercel/**',
    '**/out/**',
    '**/dist/**',
    '**/node_modules/**',
    '.turbo/**',
    '.ci-logs/**',
    'coverage/**',
    '**/next-env.d.ts',
    '**/playwright-report/**',
    '**/test-results/**',
  ]),
  {
    files: ['apps/{web,site}/**/*.{js,jsx,mjs,cjs,ts,mts,tsx}'],
    extends: [...next],
    rules: {
      // The app uses the App Router only; there is no pages directory to link to.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    files: ['scripts/**/*.ts', 'vitest.config.ts', 'packages/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]);
