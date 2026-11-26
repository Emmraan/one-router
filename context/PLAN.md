# ONE ROUTER — MVP Plan

| Field | Value |
|---|---|
| Status | Active |
| Spec | Locked v0.7 on `docs/prd-one-router`; `context/PRD.md` now keeps the post-MVP backlog |
| Scope | MVP only; post-MVP stays in PRD Section 13 |
| Runtime | Node 24 LTS, pnpm 10, Turborepo, Vitest |
| Branch | `phase-N-<slug>` -> `main`, merge `--no-ff`, keep branch |
| Updated | 2026-11-26 |

## 0. Contract

- **Agent read order:** `AGENTS.md` -> this file's phase block only -> the files listed for that phase. Do not read other phase blocks. Read the archived PRD (`git show docs/prd-one-router:context/PRD.md`) only when an FR ID is ambiguous. Load 2-4 skills named by `.agents/skills/one-router/SKILL.md`.
- One phase per branch. Tests first: red, then smallest green.
- After edits: `pnpm lint:changed && pnpm typecheck:changed && pnpm test:changed`.
- Before merge: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm budget && pnpm audit:gate`.
- Pen test the phase surface. Critical/high fixed with a reproducing test. Others listed and recorded.
- Append `context/PROGRESS.md` before merge: commit, gate, deviations, accepted findings.
- Push the phase branch for CI. Required red blocks merge. Skipped/unavailable = unverified, never pass. CI prints the failing command plus 40 lines; full logs are uploaded as artifacts.
- New heavy job: scratch `.github/workflows/scratch-phase-N.yml` (`workflow_dispatch` + `push`, path filters, cancel-in-progress) -> promote to `ci.yml` -> delete scratch before merge.
- Phase 6+: any UI or product-copy change updates the landing preview/copy in the same change set.
- No file >500 lines. No section-sign glyph. English UI/docs. Windows desktop look.
- `main` stays local and is never pushed until the MVP is complete. Push only the phase or feature branch and run CI there.

**Done:** red-first tests, changed gates, full gate, pen test, PROGRESS, landing counterpart, CI promoted, `--no-ff` merge.

## 1. Scope

### 1.1 In MVP

| Area | Phase |
|---|---|
| Workspace, gates, CI, semantic-release config | 0 |
| Core adapters, SSE, schemas, URL/SSRF, models, titles, attachments, cursor | 1 |
| DB schema, migrations, crypto, repositories, search, archive | 2 |
| Hono server: auth, data, files, chat, `/v1`, OpenAPI | 3 |
| Web cutover: static export, auth, server data, streaming, search/pin | 4 |
| Web parity: files, enhance, titles, temp chat, export/import, legacy import, bugs | 5 |
| Redesign: tokens, primitives, brand, shell, markdown, themes, a11y, landing scaffold | 6 |
| CLI: `onerouter`, bins, init/config/serve/reset, static serving, pack <5 MB | 7 |
| Docker, compose, systemd, Vercel, per-target env | 8 |
| Landing, Fumadocs, executable commands, README | 9 |
| E2E matrix, budgets, pen test, release | 10 |

### 1.2 Out of MVP

Prebuilt GHCR image, `install-vps.sh`, manual prebuilt pull/run, upgrade/uninstall scripts around the image; fallback chains; FTS5; multi-user/teams/RBAC/SSO/2FA/passkeys; custom domain; i18n/RTL; observability; automated key rotation; Office attachments; presigned uploads; PWA; desktop app; GenUI; agents; MCP; plugins; connectors; multi-instance sync. Everything in PRD Section 13.

### 1.3 Fixed decisions

- Search = server decrypt + filter. FTS5 is post-MVP.
- Temp chat = client memory. Attachments are ephemeral, deleted on discard, orphan-cleaned.
- Vercel uploads pass through the server. No presigned direct uploads.
- Docker v1 builds from source. No published image in this plan.
- Single owner, password-only. Schema leaves room for more users.
- Theme cookie only paints the first frame. Server settings are the source of truth.
- `INITIAL_PASSWORD` seeds bootstrap only. After a user exists it is ignored.
- Keys are masked in responses. Plaintext keys exist only inside the encrypted archive.
- `/v1` requires a session cookie or the configured bearer token. Never anonymous.

## 2. Architecture

### 2.1 Tree

```text
apps/web/       chat UI: Next.js static export
apps/site/      landing + /docs: Next.js + Fumadocs, static
packages/core/  providers, parsers, types, schemas
packages/db/    Drizzle, migrations, repositories, crypto
packages/server/ Hono: auth, data, files, /api, /v1
packages/ui/    tokens, primitives, brand
packages/cli/   published onerouter; bins one-router, onerouter
docker/         Dockerfile + compose for v1
```

Root: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.mjs`, `vitest.config.ts`, `.releaserc.json`, `.nvmrc`, `.github/workflows/ci.yml`.

### 2.2 Boundaries

| Package | May use | Must not use |
|---|---|---|
| core | zod, standard APIs | React, Next, Hono, DB |
| db | core, Drizzle, libSQL | React, Next, Hono |
| server | core, db, Hono, storage | React, Next, UI |
| ui | React, Tailwind tokens, lucide | API, DB, server |
| web | core types, ui, React Query | DB, server internals |
| cli | server, db, core | React components |
| site | ui tokens, brand | server, DB |

### 2.3 Build rules

- Internal packages export TS source in dev. `apps/web` transpiles `@one-router/core` and `@one-router/ui`.
- Typecheck: `tsc --noEmit` per package via Turbo.
- Server/CLI/Docker/Vercel bundle with `tsup`/esbuild. Published package ships no raw source.
- CLI copies `apps/web/out` to `packages/cli/web`. `files` = `dist`, `web`, `README.md`, `LICENSE`.
- `pnpm dev` runs web + Hono. Production never runs a Next server.

### 2.4 Data order

1. P2 creates `0000_initial.sql`. Later migrations are additive and numbered; never edit a shipped migration.
2. P3 runs migrations on start; failure aborts with a clear error.
3. P4 cuts web reads/writes to the API. No application data in localStorage after this.
4. P5 imports legacy `onerouter_*` once, previews, clears only on success.
5. Export = encrypted `.onerouter`. Import validates manifest, checksum, passphrase, key policy before writing.

### 2.5 Runtime matrix

| Target | UI | API | DB | Attachments | Entry |
|---|---|---|---|---|---|
| Dev | `next dev` :3000 | Hono :4000, proxied | SQLite file | encrypted SQLite BLOBs | `pnpm dev` |
| Local | static, CLI | Hono in CLI | SQLite `~/.one-router/` | encrypted SQLite BLOBs | `npx onerouter` |
| VPS Docker | static, server | Hono container | SQLite `/data` | encrypted files; optional S3/MinIO | `docker compose up` |
| VPS no Docker | static, CLI | Hono in CLI | SQLite disk | encrypted files | `one-router serve` + systemd |
| Vercel | static build | Hono serverless | Turso | S3 required | same-origin project |

## 3. Phases

### P0 — Workspace, gates, CI

- **Depends:** none.
- **Build:** pnpm workspace + Turbo. Move `app/`, `components/`, `hooks/`, `lib/`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json` to `apps/web/`. Root scripts, `tsconfig.base.json`, flat ESLint, Vitest, `.nvmrc` 24, `context/PROGRESS.md`, minimal README, `.releaserc.json`. Latest stable deps; lockfile committed.
- **Scripts:** `scripts/budget.mjs` (gzip initial JS/CSS from Next manifest/out), `scripts/audit-gate.mjs`, `scripts/changed.mjs`.
- **CI:** `ci.yml`, matrix Node 24 + current stable; install, lint, typecheck, test, build, budget, audit.
- **Tests:** budget parser, audit parser, changed mapper, app build smoke.
- **Exit:** app runs from `apps/web`; full gate + CI green; no behavior change. Keep `output: 'standalone'` until P4. No empty packages.
- **Landing:** n/a.

### P1 — Core

- **Depends:** P0.
- **Build:** `packages/core/src/{types,schemas,errors,sse,url,models,titles,attachments,cursor,index}.ts`; `src/providers/{openai,anthropic,gemini,ollama,registry}.ts`.
- **Move:** provider logic out of `apps/web/app/api/*`; routes delegate.
- **Rules:** fetch only; no SDK; no React/Next/DB. SSRF blocks private/link-local/metadata; localhost allowed only for explicit Ollama preset.
- **Tests:** table-driven fixtures; SSE frames; URL cases; titles; MIME magic; cursor; model/alias parsing.
- **Exit:** old app streams unchanged; core tests green.
- **Landing:** n/a.

### P2 — DB

- **Depends:** P1.
- **Build:** `packages/db/{drizzle.config.ts,src/{client,migrate,seed}.ts,src/schema/*,src/crypto/*,src/repositories/*,src/{search,pagination}.ts,src/archive/*,src/migrations/0000_initial.sql}`.
- **Schema:** users, sessions, providers, chats, messages, attachments, settings, migrations; lockout fields. Encrypted text `v1:<base64>`; attachment BLOB or object key.
- **Crypto:** AES-256-GCM per value, 12-byte IV + tag; scrypt; key from env or `~/.one-router/encryption.key` 0600; prod fail fast.
- **Repos:** CRUD, transactions, cursor pagination, decrypt-filter search, soft delete/restore, orphan cleanup, backup/restore helpers.
- **Archive:** manifest + checksum + scrypt + AES-GCM; reject wrong pass/tamper/plaintext keys; merge remaps IDs.
- **Tests:** temp libSQL file per test; migration fresh/idempotent; crypto vectors; archive round-trip; search; seed.
- **Exit:** db tests green; no Hono/React.
- **Landing:** n/a.

### P3 — Server

- **Depends:** P2.
- **Build:** `packages/server/src/{app,index,env,node,vercel}.ts`; `src/middleware/{request-id,logger,error,body-limit,cors,security-headers,csrf,auth,rate-limit}.ts`; `src/routes/{health,auth,chats,messages,providers,settings,files,data,chat,title,enhance,discovery,v1,openapi}.ts`; `src/auth/*`; `src/files/{sqlite,filesystem,s3}.ts`; `src/v1/*`.
- **Auth:** bootstrap owner; scrypt; hashed session tokens; HttpOnly/Secure/SameSite=Lax; 30-day sliding; revoke on password change; forced change; lockout persisted + IP throttle memory.
- **Data:** chats/messages/providers/settings; key resolution transient -> DB -> env; masked keys.
- **Chat:** `/api/chat` SSE `data: {"text":"..."}`; title/enhance/discovery; timeouts; abort.
- **Files:** `POST/GET/DELETE /api/files`; count/size/MIME magic checks; encrypt before storage; signed short-lived URL or auth proxy.
- **`/v1`:** `/v1/models`, `/v1/chat/completions` OpenAI-compatible; `provider/model` + aliases; session or bearer; never anonymous.
- **Security:** Origin/Sec-Fetch-Site CSRF; CORS allowlist; body limits; headers; redacted logs; request IDs; OpenAPI.
- **Tests:** `app.request` + injected fake fetch fixtures; auth/session/CSRF/rate limit; CRUD; encryption-at-rest; files; `/v1`; no secrets in logs.
- **Exit:** server standalone :4000; tests green.
- **Landing:** n/a.

### P4 — Web cutover

- **Depends:** P3.
- **Build:** `apps/web/next.config.ts` with `output: 'export'`, `images.unoptimized`, `transpilePackages`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BASE_PATH`; delete `app/api/*`; `lib/{api,auth,query,sse}.ts`; `app/(auth)/{login,change-password}/page.tsx`; `app/(app)/layout.tsx`; rewrite state hooks.
- **Data:** React Query for chats/messages/providers/settings; streaming; search/pin; optimistic rollback; 401 -> login; DB error/offline screens; theme server setting; no localStorage.
- **Dev proxy:** Next `rewrites` in dev; if unsupported with export, add `apps/web/dev-proxy.mjs`.
- **E2E:** Playwright against static `out` + Hono + fixture provider: bootstrap, login, forced change, send, reload, logout, 401.
- **Exit:** fully functional on server data with old visuals; no app data in localStorage; static build.
- **Landing:** n/a (site not created; exception).

### P5 — Web parity

- **Depends:** P4.
- **Build:** attachments UI (drag/paste/picker/progress/retry/remove), enhance preview apply/discard/undo, titles, temp chat (memory, Save chat, exit confirm, ephemeral cleanup), export/import UI, search/pin/trash, legacy `onerouter_*` import (preview, clear on success), preserve regenerate/delete/inline edit and quote/ask, bug inventory + FR-G3/G4.
- **Server/db:** only gaps; additive migration if needed; ephemeral attachment flag/TTL.
- **E2E:** image/text/PDF upload, enhance fixture, temp chat DB assertion, save, export/import, search/pin.
- **Exit:** full feature parity; no base64 in chat; temp chat never DB; archive round-trip.
- **Landing:** n/a (exception).

### P6 — Redesign

- **Depends:** P5.
- **Build:** `packages/ui/src/{tokens.css,motion.css,utils.ts,primitives/*,brand/*}`, `packages/ui/assets/brand/*`, icon generation script; `apps/web` shell/sidebar/header/composer/transcript/empty/error/offline/loading/auth/provider dashboard/settings/model selector; `apps/site` scaffold + live preview.
- **Design:** Segoe UI Variable/Segoe UI/system-ui; Cascadia/Consolas/ui-monospace; no gradients, card grids, or web fonts; dark/light/system; theme cookie first paint; 150-250 ms CSS; reduced motion; stable streaming; keyboard/focus/ARIA; usable to 768 px.
- **Markdown:** renderer, code block, KaTeX, Mermaid, highlighter as local dynamic chunks; no CDN; lazy first use; keep `data-index` virtualization contract.
- **Tests:** Playwright visual/behavior at 1440/1024/768; no external requests; budget NFR-15/16/21; manual visual QA checklist.
- **Exit:** redesigned feature-complete app; budgets green; landing preview matches; old components deleted.
- **Landing:** create/update preview + copy in the same change set.

### P7 — CLI

- **Depends:** P6.
- **Build:** `packages/cli/{package.json,src/{index,config,paths,server,static,logger,shutdown,prompt}.ts,src/commands/{init,config,serve,user}.ts}`.
- **Package:** name `onerouter`; bins `one-router`/`onerouter`; `files` whitelist; `engines >=24`; bundle tsup/esbuild; copy `apps/web/out` -> `web`; pack <5 MB.
- **Commands:** `init` (password/key/presets/Ollama detect); `config --path/--print/--edit` (redact); `serve --port/--host/--api-only/--no-open` (port fallback, graceful shutdown, print password/data dir once); `user reset-password`.
- **CI:** artifact clean `node:24-alpine` (pack, only tarball, `--version`, start, `/health`, bootstrap, forced change, login); OS npm matrix windows/ubuntu/macos.
- **Exit:** `npx onerouter` works; package <5 MB; CI green.
- **Landing:** no UI change (CLI docs in P9).

### P8 — Docker, VPS, Vercel

- **Depends:** P7.
- **Build:** `docker/Dockerfile` (multi-stage Node 24 Alpine pinned digest, pnpm, web+server+CLI, prod deps, non-root UID 1000, HEALTHCHECK Node fetch, `/data`, `INITIAL_PASSWORD`, migrate on start, warn if `/data` not mounted); `docker/compose.yml` (`127.0.0.1:3000`, `one-router-data`, restart unless-stopped, env file, optional MinIO profile); `docker/.env.example`; `packages/cli/templates/one-router.service`; `apps/web/vercel.json` + `apps/web/api/index.ts` (Hono adapter, rewrites `/api/*`, `/v1/*`, `/health`, static export, Turso+S3, same-origin cookies); `.env.*.example`.
- **CI:** Docker build/inspect/size <=250 MB/non-root/HEALTHCHECK/prod deps/lifecycle matrix (FR-V6); systemd ubuntu; Vercel preview smoke; OS conformance.
- **Lifecycle:** fresh volume + `INITIAL_PASSWORD`; print once; forced change; restart persists; `rm` + recreate same volume decrypts; `INITIAL_PASSWORD` after bootstrap no reset; upgrade N-1 runs migrations; `exec reset-password`; uninstall with/without `--purge`; missing `/data` warns; non-root writes.
- **Exit:** image valid per FR-V5/V6; Vercel/systemd green.
- **Landing:** no (deployment docs in P9).

### P9 — Landing, docs, README

- **Depends:** P8.
- **Build:** `apps/site` Fumadocs (`source.config.ts`, docs layout/page, search, TOC, copy); all FR-L3 pages; overview Local/VPS/Vercel matrix; command blocks with `verify` IDs + manifest; versions from `package.json`; link/anchor checks; PowerShell+POSIX variants; landing complete (npm/Docker install, deploy buttons, live previews, SEO/OG/sitemap/robots); README minimal `/docs` + animated SVG <300 KB with no external requests; package READMEs/license.
- **CI:** docs command coverage, links, OS blocks.
- **Exit:** static site builds; every command covered; landing matches app; README minimal.
- **Landing:** complete.

### P10 — Hardening and release

- **Depends:** P9.
- **Run:** full gate; E2E same suite on packed tarball clean Node 24, Docker image, Vercel preview; Docker lifecycle; OS conformance; budgets JS/CSS/image/memory/p95/cold start; pen tester pass (AGENTS table); fix critical/high with tests, record others; CSP/no `unsafe-inline`/nosniff/cache/HSTS docs; supply chain audit/lockfile/postinstall; semantic-release workflow (npm only if `NPM_TOKEN`); manual pre-release checklist (provider smoke owner-run; real VPS/TLS declined -> unverified; backup/restore; upgrade N-1; uninstall); SC-1-SC-23 except SC-19; PROGRESS final; tag.
- **Exit:** MVP released; required jobs green; unverified items recorded.
- **Landing:** final copy check.

## 4. Traceability

| Group | Phases |
|---|---|
| FR-M | 0, 2, 7, 9 |
| FR-C | 7 |
| FR-U | 6 |
| FR-B | 6 |
| FR-W | 4, 5, 6 |
| FR-A | 3, 4, 6 |
| FR-P | 2, 3, 4, 5 |
| FR-F | 3, 5, 8 |
| FR-E | 1, 3, 5 |
| FR-R | 1, 3, 5, 6 |
| FR-T | 5 |
| FR-G | 4, 5, 6, 10 |
| FR-S | 3, 8 |
| FR-K | 1 |
| FR-L | 6, 9 |
| FR-X | 3, 6, 8 |
| FR-D | 0, 4, 7, 8, 9 |
| FR-Q | 0, 2, 7, 9, 10 |
| FR-V | 0, 4, 7, 8, 9, 10 |
| NFR | 2, 4, 6, 8, 10 |
| SC | 10 (SC-19 post-MVP) |

## 5. CI

| Phase | New job | Required | Notes |
|---|---|---|---|
| 0 | quality | yes | lint/typecheck/unit/build/budget/audit; Node 24 + current |
| 3 | integration | yes | temp libSQL, fixtures |
| 4 | e2e-local | yes | Playwright Chromium, static export + Hono |
| 5 | e2e-features | yes | uploads/enhance/temp/export |
| 6 | budget-web, visual | yes | NFR-15/16/21 absolute |
| 7 | artifact, os-npm | yes | clean `node:24-alpine`; windows/ubuntu/macos |
| 8 | docker, lifecycle, systemd, vercel | yes | image valid only if FR-V5+V6 |
| 9 | docs-commands, links | yes | every fenced command covered |
| 10 | e2e-targets, budget-runtime, release | yes | full matrix |

**Rules:** secrets `VERCEL_TOKEN`, Turso, S3. Missing -> unverified, release blocked. Manual provider smoke is not CI. Required jobs: quality, integration, e2e, budget, artifact, docker, lifecycle, systemd, vercel, docs, release. A skipped job never counts as green.

## 6. Risks

| Risk | Phase | Mitigation |
|---|---|---|
| Markdown stack over 220 KB | 6 | lazy KaTeX/Mermaid/highlighter; measure; lighter highlighter |
| PDF parser size/license | 3/5 | server-only lazy import; pick smallest maintained |
| S3 client size | 3 | `aws4fetch` or lazy SDK |
| Vercel Hono routing | 8 | same-origin rewrites; preview test |
| Docker image >250 MB | 8 | multi-stage, prod deps only, prune |
| scrypt over 150 ms auth | 3 | benchmark; document params |
| Theme flash | 6 | cookie + inline pre-paint script |
| Playwright download | 4 | Chromium only; cache |
| Vercel rate limit | 3 | DB account lockout + best-effort IP |
| Legacy import edges | 5 | versioned parser, preview, skip invalid, clear on success |
| 500-line limit | all | extract hooks/subcomponents |
| Search decrypt cost | 2 | batch/paginate; FTS5 post-MVP |
| npm >5 MB | 7 | check pack; trim UI assets |
| `INITIAL_PASSWORD` reset | 3/8 | bootstrap-only guard + test |
| Non-root `/data` | 8 | image-owned dir; clear error; lifecycle test |
| Vercel cold start >2 s | 8 | small bundle, lazy imports, no SDK |
| Audit findings | 0/10 | fix high/critical; record accepted |

## 7. Release

- `semantic-release` on `main`: changelog, GitHub release, tag. npm publish only when `NPM_TOKEN` exists.
- Pre-release: full gate, E2E three targets, Docker lifecycle, OS conformance, budgets, pen test, backup/restore, upgrade N-1, uninstall.
- Manual and not CI: real provider smoke (`pnpm smoke:providers`, owner-run) and real VPS/TLS (owner declined; record as unverified).
- MVP sign-off: SC-1-SC-23 except SC-19 (post-MVP), `PROGRESS.md` final entry, `--no-ff` merge, tag.
- Post-MVP next: prebuilt multi-arch GHCR image, `install-vps.sh`, manual pull/run, upgrade/uninstall scripts.
