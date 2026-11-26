# Progress

| Phase | Status | Branch |
|---|---|---|
| 0 | CI green | phase-0-workspace |

## Phase 0 - Workspace, gates, CI

- Work commit: 9984377 (workspace and gates).
- Moved `app/`, `components/`, `hooks/`, `lib/`, Next, PostCSS, and TypeScript config into `apps/web`.
- Added the pnpm workspace, Turbo, shared `tsconfig.base.json`, flat ESLint, Vitest, `.nvmrc` 24, `.releaserc.json`, and root scripts.
- Added `scripts/changed.mjs`, `scripts/budget.mjs`, `scripts/audit-gate.mjs`, `scripts/build-smoke.mjs`, and `scripts/ci-run.mjs` with unit coverage.
- Gate: lint, typecheck, test (47), build, budget (218.3/220 KB JS, 10.3/50 KB CSS), audit gate (0 high or critical). `next start` served the page from `apps/web`.
- Deviation: Next 16 Turbopack emits `server/app-paths-manifest.json` and prerendered HTML instead of `app-build-manifest.json`. The budget reads the route HTML, ignores legacy `noModule` polyfills, and keeps the manifest as a webpack fallback.
- Deviation: the provider dashboard is dynamically imported so the initial route stays under NFR-15. The Next 15 `transpilePackages: ['motion']` entry was removed because Next 16 resolves the package natively.
- Overrides: `brace-expansion@1` 1.1.22, `browserslist` 4.29.6, `source-map-js` 1.2.4, `zod` 4.6.7. These clear high advisories in dev tooling.
- Accepted: two moderate advisories in `baseline-browser-mapping` and `postcss-selector-parser`; both are dev-only and below the gate.
- CI: Node 24 and 26 matrix, frozen lockfile, failure logs as artifacts. Scratch workflow removed before merge.
