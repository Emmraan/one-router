# Progress

| Phase | Status | Branch |
|---|---|---|
| 0 | merged | phase-0-workspace |
| 1 | merged | phase-1-core |
| 2 | merged | phase-2-db |
| 3 | merged | phase-3-server |
| 4 | merged | phase-4-web-cutover |

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

## Phase 2 - DB package

- Work commit: 6985049; local `--no-ff` merge into `main`.
- Added `packages/db` with libSQL/Drizzle tables for users, sessions, providers, chats, messages, attachments, settings, and the migration ledger; composite owner foreign keys and a partial single-owner index.
- AES-256-GCM per-value encryption and scrypt password hashing; master key from env or `~/.one-router/encryption.key` created atomically with 0600 permissions.
- Repositories: owner-scoped CRUD, cursor pagination, decrypt-filter search, soft delete and restore, orphan cleanup, and owner seed bootstrap.
- Archive: fixed-header encrypted format with checksum, strict schema, bounded export batches, tamper and wrong-passphrase rejection; merge and replace imports remap IDs; plaintext exports omit provider secrets and reject them on import.
- Gate: lint, typecheck, test (344), build, budget (218.3/220 KB JS, 10.3/50 KB CSS), audit gate (0 high or critical; 3 moderate).
- Security: export charges decoded JSON size and verifies attachment BLOB lengths; replace import returns external attachment objects for cleanup only after commit and keeps metadata on rollback; migrations verify checksums and history.
- Accepted: Windows libSQL file handles need a test-only GC workaround before temp-directory removal; DNS rebinding and route authentication remain server-phase work; callers own external object deletion after import.
- Dependencies: `@libsql/client` for local and remote transports, `drizzle-orm` and `drizzle-kit` for typed SQL and migrations; rationale and backup/restore steps are in `packages/db/README.md`.

## Phase 3 - Server

- Work commits: bcaaac7 (server), b137cec (scratch CI); local `--no-ff` merge into `main`.
- Added `packages/server`: Hono app with request IDs, structured logs, error envelopes, security headers, CORS, CSRF, streamed body caps, auth, rate limits, and OpenAPI at `/openapi.json`.
- Auth: bootstrap owner, scrypt, hashed opaque sessions, 30-day sliding cookie, revocation on password change, forced bootstrap change, persisted lockout plus per-IP throttle, optional bearer token.
- Data: chats, messages, providers, settings, files, archive import/export; transient then DB then environment key resolution; keys masked in responses.
- Chat: `/api/chat` SSE `data: {"text":"..."}` with attachment hydration, 120-second abort, redacted upstream errors; title, enhance, and discovery with 15-second timeouts.
- Files: `POST/GET/DELETE /api/files`, MIME magic checks, encrypted external objects on filesystem or S3, sqlite fallback in development; auth-proxy URLs.
- `/v1`: OpenAI-compatible models and chat completions, `provider/model` references and aliases, streaming and non-streaming.
- Gate: lint, typecheck, test (471), integration (191), build, budget (218.3/220 KB JS, 10.3/50 KB CSS), audit gate (0 high or critical; 3 moderate).
- Security: streamed body caps stop lying `Content-Length` and chunked floods; upstream and discovery errors redacted; bearer tokens honor forced password change; session cookie slides with DB expiry.
- CI: integration job runs the server and DB suites on temp libSQL files; the scratch workflow was removed before merge.
- Deviation: the standalone server runs from TypeScript through tsx; there is no JS build artifact until packaging. Uploads cap at 10 MiB because the attachment table caps a row.
- Accepted: DNS rebinding through an owner-supplied public provider host remains core's literal-only policy; repository domain messages are returned to the owner; S3 path-style detection covers localhost and IPv4 only.
- Dependencies: `hono` and `@hono/node-server` for routing and the Node adapter, `aws4fetch` for SigV4 S3 requests, `tsx` for the standalone start script.

## Phase 4 - Web cutover

- Work commit: aed91ea; local `--no-ff` merge into `main`.
- Static export: `output: 'export'`, trailing slash, optional base path, unoptimized images; deleted the four `app/api/*` route handlers; `build-smoke.mjs` now validates `out/index.html`, the two auth pages, assets, and a client script.
- Data: React Query hooks for auth, chats, messages, providers, and settings; `lib/api.ts` wraps the server contract; `lib/sse.ts` decodes `data:` frames; no application data in localStorage (only sidebar and model preferences remain).
- Auth: login and forced change-password screens; the app layout redirects on a missing session or `mustChangePassword`; 401 and forced-change 403 clear or flip the auth cache from both queries and mutations.
- Streaming: `POST /api/chat` with `providerId` and model, optimistic assistant bubble, persistence of user and assistant messages, abort keeps the partial reply, errors render and persist a routing bubble.
- Theme is a server setting with a first-paint cookie; Google fonts removed; `motion` removed from every initial component (the dashboard still lazy-loads it) to fit NFR-15.
- E2E: Playwright Chromium against the static export and a real Hono server with a fixture provider; covers bootstrap, wrong password, forced change, streamed send, reload, logout, and the post-logout 401.
- CI: `e2e-local` job builds the export and runs the suite; the scratch workflow was removed before merge.
- Gate: lint, typecheck, test (551), build, budget (177.8/220 KB JS, 9.4/50 KB CSS), audit gate (0 high or critical; 3 moderate).
- Pen test fixed: markdown link URLs accepted `javascript:` and could break out of `href`; `safeLinkHref` allows only http, https, and mailto and escapes quotes (16 tests). Mermaid ran with `securityLevel: 'loose'` and injected its SVG; now `strict`.
- Accepted: KaTeX and Mermaid still load pinned builds from jsdelivr without SRI; P6 localizes them. Static HTML carries frame, base, and form CSP only; the script CSP belongs to the CLI host in P8. The preview static server binds all interfaces, like Hono. Chat search stays client-side over at most 100 chats.
- Deviation: temp chat, attachment upload, and AI titles move to P5; enhance is wired to the existing endpoint; new chats are titled from the first ten words; the active chat is not restored on reload.
- Dependencies: `@playwright/test` and `tsx` for browser E2E, `@hono/node-server` to boot the fixture server. Browser E2E cannot be covered by Vitest.

