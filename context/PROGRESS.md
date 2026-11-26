# Progress

| Phase | Status | Branch |
|---|---|---|
| 0 | merged | phase-0-workspace |
| 1 | merged | phase-1-core |

## Phase 0 - Workspace, gates, CI

- Work commits: 9984377 (workspace and gates), bf9c665 (CI), merged as a7d5285.
- Moved `app/`, `components/`, `hooks/`, `lib/`, Next, PostCSS, and TypeScript config into `apps/web`.
- Added the pnpm workspace, Turbo, shared `tsconfig.base.json`, flat ESLint, Vitest, `.nvmrc` 24, `.releaserc.json`, and root scripts.
- Added `scripts/changed.mjs`, `scripts/budget.mjs`, `scripts/audit-gate.mjs`, `scripts/build-smoke.mjs`, and `scripts/ci-run.mjs` with unit coverage.
- Gate: lint, typecheck, test (47), build, budget (218.3/220 KB JS, 10.3/50 KB CSS), audit gate (0 high or critical). `next start` served the page from `apps/web`.
- Deviation: Next 16 Turbopack emits `server/app-paths-manifest.json` and prerendered HTML instead of `app-build-manifest.json`. The budget reads the route HTML, ignores legacy `noModule` polyfills, and keeps the manifest as a webpack fallback.
- Deviation: the provider dashboard is dynamically imported so the initial route stays under NFR-15. The Next 15 `transpilePackages: ['motion']` entry was removed because Next 16 resolves the package natively.
- Overrides: `brace-expansion@1` 1.1.22, `browserslist` 4.29.6, `source-map-js` 1.2.4, `zod` 4.6.7. These clear high advisories in dev tooling.
- Accepted: two moderate advisories in `baseline-browser-mapping` and `postcss-selector-parser`; both are dev-only and below the gate.
- Accepted findings: action tags are not SHA-pinned; `ci-run.mjs` relies on the job timeout for spawn errors; pnpm ignores the `unrs-resolver` build script; workflow-only changes skip the changed gates; an empty audit object parses as clean. All are low and deferred.
- CI: Node 24 and 26 matrix, frozen lockfile, failure logs as artifacts. Scratch workflow removed before merge.

## Phase 1 - Core package

- Work commit: 60f0178; local `--no-ff` merge into `main`.
- Added `packages/core` with shared types, zod schemas, errors, SSE parsing, URL and SSRF policy, model references, cursors, title and enhance helpers, attachment validation, and OpenAI, Anthropic, Gemini, and Ollama adapters with a registry.
- `apps/web` chat, discovery, title, and enhance routes now delegate to `@one-router/core`; valid-request streaming and payloads are unchanged.
- Gate: lint, typecheck, test (280), build, budget (218.3/220 KB JS, 10.3/50 KB CSS), audit gate (0 high or critical).
- Deviation: Gemini model names and keys are URL-encoded; titles request 3 to 6 words (FR-R6); Anthropic discovery avoids `/v1/v1` when the stored base already ends in `/v1`.
- Security: SSRF blocks literal private, loopback, link-local, metadata, mapped IPv6, NAT64, 6to4, and rebinding hostnames; localhost is allowed only for Ollama. Redirects are manual and rejected. Custom headers reject CR/LF and forbidden transport headers.
- Pen test fixed: base URL errors no longer echo credentials; upstream stream lines are capped at 1 MiB and the reader is cancelled; adapter lookup rejects inherited keys; Anthropic discovery base duplication fixed.
- Accepted: DNS rebinding through an owner-supplied public hostname remains possible because core validates literals only; resolver pinning belongs to the server phase. Routes remain unauthenticated until the auth phase. Upstream error bodies are capped at 8 KiB and returned for actionable failures.
- No new runtime dependency; zod was already pinned in the workspace lockfile.
