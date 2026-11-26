import { defineConfig, globalIgnores } from 'eslint/config';
import next from 'eslint-config-next';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/.next/**',
    '**/out/**',
    '**/dist/**',
    '**/node_modules/**',
    '.turbo/**',
    '.ci-logs/**',
    'coverage/**',
    '**/next-env.d.ts',
  ]),
  {
    files: ['apps/web/**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    extends: [...next],
    rules: {
      // The app uses the App Router only; there is no pages directory to link to.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    files: ['scripts/**/*.ts', 'vitest.config.ts', 'packages/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
]);
