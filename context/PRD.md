# ONE ROUTER — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| Status | Locked v0.7 — approved for implementation |
| Date | 2026-11-26 |
| Owner | Emmraan |
| Repo | `one-router` (currently a single Next.js app) |
| Next artifact | `context/PLAN.md` — MVP phase plan (authorized 2026-11-26) |

> v0.7 changes: verification strategy added in Section 6.19. Heavy environment tests
> run in CI only; one smoke suite covers the packed npm tarball, the Docker image, and
> the Vercel preview; the Docker lifecycle matrix is required; documented commands are
> executable tests; and a release is blocked while a required environment is unverified.
>
> v0.6 changes: Node 24 LTS is the minimum supported runtime; performance and footprint
> budgets added (NFR-15 to NFR-22); docs scope completed with an overview matrix,
> uninstall, password recovery, per-target configuration, and a development page;
> post-MVP adds a prebuilt multi-arch Docker image, a one-command VPS installer, and the
> manual pull/run path. Docker remains build-from-source in v1.
>
> v0.5 changes: all remaining questions resolved (no custom domain in v1, English-only
> docs, live SVG/HTML landing previews); **Network O** selected as the logo direction;
> post-MVP backlog expanded with Generative UI (GenUI), agentic capabilities, custom MCP,
> plugins, and connectors.
>
> v0.4 changes: resolved database (Turso/libSQL everywhere), auth scope (single owner,
> future-ready schema), scrypt hashing, attachment storage matrix, encrypted export
> including API keys, in-memory temporary chats with Save chat, and logo/design freedom.
>
> v0.3 changes: temporary chats get an explicit Save chat action; latest-stable
> dependency policy; minimal README with an animated SVG dashboard demo; semantic-release
> with conditional npm publishing; audit severity gate; section-sign symbol banned.
>
> v0.2 changes: server-side encrypted persistence replaces all browser storage;
> authentication and forced password change added; premium UI redesign and symbol
> logo added; attachment, enhancement, rename, and temporary-chat behavior
> specified; post-MVP feature backlog added.

---

## 1. Summary

ONE ROUTER is a multi-provider AI chat client and routing layer. Today it is a single
Next.js 15 app supporting OpenAI, Anthropic, Gemini, and Ollama behind one chat UI.

The product will become a monorepo with:

1. A publishable npm package (`onerouter`) runnable via `npx` or a global install,
   serving both the chat UI and an OpenAI-compatible API gateway.
2. A premium, redesigned chat UI with a **server-side encrypted database**, login,
   forced first-login password change, and data import/export.
3. A static landing page (`/`) and detailed docs (`/docs`).
4. One codebase deployable **locally** (SQLite), on a **VPS** (SQLite + volume), and
   on **Vercel** (serverless + managed Turso/libSQL database).

MVP = the redesign plus all existing features working correctly on the new
auth + persistence foundation. New AI/product features come after MVP, guided by the
backlog in Section 13.

---

## 2. Problem & Motivation

- The current app is private, not installable, and only runs by cloning the repo.
- Provider logic lives inside Next.js route handlers and cannot be reused by a CLI,
  gateway, or another frontend.
- All data is trapped in `localStorage`: no login, no multi-device access, no backup,
  no server-side encryption, and no durability.
- The UI does not meet the desired premium bar and has known rough edges in file
  upload, prompt enhancement, renaming, and temporary chats.
- There is no docs site and no repeatable Vercel/VPS deployment path.

---

## 3. Goals

| ID | Goal |
|---|---|
| G1 | `npx onerouter` runs the full app on a clean machine. |
| G2 | `npm i -g onerouter` provides the `one-router` command. |
| G3 | The same server exposes an OpenAI-compatible `/v1` API. |
| G4 | Landing + `/docs` are static and deploy anywhere, including Vercel. |
| G5 | The full stack deploys to a VPS with Docker and to Vercel. |
| G6 | All existing chat features are preserved in the redesign, with bugs fixed. |
| G7 | The UI feels premium and smooth, comparable to the ChatGPT Windows desktop app. |
| G8 | All user data is stored server-side and encrypted at rest. |
| G9 | Login is required; first-run password is shown once and must be changed. |
| G10 | Users can export and import their data. |
| G11 | File uploads, prompt enhancement, rename, and temporary chats work correctly. |
| G12 | The product has a symbol-based brand mark, not a text-only logo. |
| G13 | The codebase stays modular: no source file over 500 lines. |

## 4. Non-Goals (v1)

- A hosted multi-tenant SaaS, billing, subscriptions, or usage metering.
- Team workspaces, RBAC, SSO, or organization administration.
- Native mobile apps.
- Cloud sync between independently deployed instances.
- Plugin marketplace.
- Telemetry that sends user content off-device.
- Automatic two-factor authentication (considered post-MVP).

> Note: "no database" and "no authentication" from v0.1 are now explicitly **in scope**
> and replace the previous non-goals.

---

## 5. Target Users

| Persona | Need |
|---|---|
| Individual developer | One command to run a secure, multi-provider chat UI with local data. |
| Self-hoster | Private VPS/Docker deployment with login and encrypted storage. |
| Tooling user | Point Cursor / Continue / any OpenAI-compatible client at `/v1`. |
| Evaluator | Understand and install the product from the landing page and docs. |

---

## 6. Product Requirements

Requirement IDs are stable and must be referenced by `PLAN.md`.

### 6.1 Monorepo & Tooling

| ID | Requirement |
|---|---|
| FR-M1 | Convert the repo to a pnpm workspace monorepo; pnpm remains the only package manager. |
| FR-M2 | Use Turborepo for `build`, `dev`, `lint`, `typecheck`, and `test`. |
| FR-M3 | Target layout: `apps/web`, `apps/site`, `packages/core`, `packages/db`, `packages/server`, `packages/ui`, `packages/cli`. |
| FR-M4 | Move the existing Next.js app into `apps/web` without losing behavior. |
| FR-M5 | Provide shared base TypeScript and ESLint configs at the root. |
| FR-M6 | Keep the 500-line-per-source-file limit across all packages. |
| FR-M7 | Use semantic-release with Conventional Commits for versioning, changelogs, GitHub releases, and conditional npm publishing. |
| FR-M8 | Update `AGENTS.md` and `README.md` for the monorepo. |
| FR-M9 | Database migrations are versioned in `packages/db` and run automatically on server start. |
| FR-M10 | Every existing or newly added package must use the latest **stable** release at implementation time; no deprecated, experimental, or unmaintained versions unless documented and approved. |

### 6.2 npm Package & CLI

| ID | Requirement |
|---|---|
| FR-C1 | Publishable package name is `onerouter` (`one-router` is taken on npm). |
| FR-C2 | Expose two binaries: `one-router` and `onerouter`, same entry point. |
| FR-C3 | `npx onerouter` starts UI + API, prints the URL, and opens the browser. |
| FR-C4 | `npm i -g onerouter` installs a working `one-router` command. |
| FR-C5 | `one-router init` runs an interactive setup: admin password, encryption key, provider presets, optional best-effort Ollama detection. |
| FR-C6 | `one-router config` supports `--path`, `--print`, and `--edit`. |
| FR-C7 | `one-router serve` supports `--port`, `--host`, `--api-only`, and `--no-open`. |
| FR-C8 | Default port is 3000; if busy, pick the next free port and print it. |
| FR-C9 | `--api-only` serves only `/v1`, auth, health, and data APIs (no UI). |
| FR-C10 | The package ships the prebuilt static UI; no build step at install time. |
| FR-C11 | Target packed size < 5 MB excluding optional platform deps. |
| FR-C12 | `--help` and `--version` are implemented and documented. |
| FR-C13 | Graceful shutdown on SIGINT/SIGTERM. |
| FR-C14 | Works on Windows, macOS, and Linux (Node >= 24 LTS). |
| FR-C15 | `one-router user reset-password` allows an operator to reset a locked-out admin password from the host. |
| FR-C16 | On first run, the CLI prints the generated default password and the data directory once, clearly marked as sensitive. |

### 6.3 UX & Visual Redesign

Reference: **ChatGPT desktop app on Windows** — calm, premium, minimal chrome,
generous spacing, smooth motion, no visual noise.

| ID | Requirement |
|---|---|
| FR-U1 | Redesign the full app shell: sidebar, header, chat area, composer, modals, settings, provider dashboard, auth screens. |
| FR-U2 | Feature parity: every existing feature remains available after the redesign. No feature removal. |
| FR-U3 | Establish a design system: color tokens, typography scale, spacing, radii, elevation, borders, icon sizes, motion curves. |
| FR-U4 | Dark, light, and system themes with persistence in server settings. |
| FR-U5 | Motion guidelines: 150–250 ms transitions, streaming caret, list enter/exit, reduced-motion support. |
| FR-U6 | Consistent primitives for buttons, inputs, selects, menus, dialogs, tooltips, toasts, and skeletons. |
| FR-U7 | Designed loading, empty, error, offline, and unauthorized states. |
| FR-U8 | Keyboard navigation and focus management across menus, dialogs, and the composer. |
| FR-U9 | Desktop-first responsive layout; usable down to 768 px, functional on mobile. |
| FR-U10 | No layout shift during streaming; messages and list items keep stable dimensions. |
| FR-U11 | Accessibility basics: semantic landmarks, ARIA labels, contrast, visible focus rings. |
| FR-U12 | Consistent visual language between app, login, landing, and docs. |
| FR-U13 | A manual visual QA checklist must be completed before the redesign is considered done. |

### 6.4 Brand & Logo

| ID | Requirement |
|---|---|
| FR-B1 | Replace the text-based logo with a **symbol-based mark**. |
| FR-B2 | Provide symbol-only, full lockup (symbol + wordmark), and monochrome variants. |
| FR-B3 | The symbol must remain legible at 16×16 (favicon) and work on light and dark backgrounds. |
| FR-B4 | Ship SVG sources plus favicon, Apple touch icon, PWA icons, and an Open Graph image. |
| FR-B5 | Apply the mark consistently in the app, sidebar, login, landing, docs, README, and npm listing. |
| FR-B6 | Selected direction: **Network O** — three arc segments joined by nodes, reading as an abstract "O"; monochrome and legible at 16×16. |
| FR-B7 | Owner approved Network O; refine its geometry, build the full lockup and icon assets, and allow minor optical adjustments. |

### 6.5 Chat Web App (`apps/web`)

| ID | Requirement |
|---|---|
| FR-W1 | Preserve all existing features: multi-provider chat, streaming, markdown/code, KaTeX, Mermaid, history, search, pinning, inline edit, regenerate, delete, export, prompt enhance, attachments, quote/ask, temporary mode, themes, virtualization. |
| FR-W2 | Static export (`output: 'export'`); no Next.js server runtime dependency. |
| FR-W3 | API calls use a configurable base URL, defaulting to same-origin `/api`. |
| FR-W4 | `NEXT_PUBLIC_API_BASE_URL` supports separately hosted UI + API. |
| FR-W5 | Local dev runs web + Hono together, with `/api/*` proxied to the server. |
| FR-W6 | **No application data in `localStorage`**: no chats, messages, providers, keys, or settings. All reads/writes go through the API. |
| FR-W7 | Auth-aware routing: login screen, forced password change screen, logout, session-expiry handling. |
| FR-W8 | Stored provider API keys are never returned to the browser in plaintext; only masked values. |
| FR-W9 | Server-backed search and pagination for chats and messages. |
| FR-W10 | Attachment uploads use the file API, not base64 blobs embedded in every chat request. |
| FR-W11 | Optimistic updates with rollback and user-visible errors. |
| FR-W12 | No server-only Next features (route handlers, server actions, dynamic SSR). |
| FR-W13 | Support serving the UI from a configurable subpath. |
| FR-W14 | On first login, detect legacy `onerouter_*` localStorage data and offer a one-time import. |
| FR-W15 | A user-friendly database/DB-connection error screen when the server cannot reach its database. |
| FR-W16 | Non-secret UI preferences (theme, sidebar state, density) are stored server-side in user settings, not `localStorage`. |

### 6.6 Authentication & Account

| ID | Requirement |
|---|---|
| FR-A1 | Login is required for all UI and data APIs. |
| FR-A2 | On first run, an owner account is created automatically if none exists. |
| FR-A3 | A strong default password is generated and shown **once** in the server console/startup output. |
| FR-A4 | `INITIAL_PASSWORD` env var overrides the generated password at bootstrap. |
| FR-A5 | After the first successful login, the user is **forced** to change the password before using the app. |
| FR-A6 | Password rules: minimum 12 characters, reject the current/default password, confirmation field, strength feedback. |
| FR-A7 | Passwords are hashed with **scrypt** using Node's built-in `crypto` with documented memory-hard parameters; never stored reversibly. |
| FR-A8 | Sessions use HTTP-only, `Secure` (production), `SameSite=Lax` cookies with random opaque tokens stored hashed server-side. |
| FR-A9 | Session expiry is configurable (default 30 days, sliding); logout revokes the session; no separate "remember me" in v1. |
| FR-A10 | Changing the password revokes all other sessions. |
| FR-A11 | Login attempts are rate-limited per IP/account with backoff. |
| FR-A12 | State-changing requests validate `Origin`/`Sec-Fetch-Site` (CSRF defense). |
| FR-A13 | All APIs except `/health` and the login/status endpoints require authentication. |
| FR-A14 | Error responses do not reveal whether the account exists. |
| FR-A15 | A CLI command can reset the admin password for recovery. |
| FR-A16 | Login and forced-change screens follow the redesigned visual language. |
| FR-A17 | v1 is single-owner: one account, password-only login (no username/email). |
| FR-A18 | The schema supports additional users later without a redesign; v1 still enforces one owner. |

### 6.7 Persistence, Database & Encryption

| ID | Requirement |
|---|---|
| FR-P1 | Local and VPS use **SQLite** (SQLite3) as the database. |
| FR-P2 | Vercel uses **Turso (libSQL)** as the managed serverless database; no Postgres adapter in v1. |
| FR-P3 | Use **Drizzle ORM** with versioned migrations. |
| FR-P4 | Encrypt sensitive data at rest with AES-256-GCM: chat titles, message content, provider API keys, user profile fields, and attachment bytes. |
| FR-P5 | Each encrypted value stores its own random IV; ciphertext format is versioned (e.g. `v1:<base64>`). |
| FR-P6 | Encryption uses a master key from `ONE_ROUTER_ENCRYPTION_KEY`, or a generated key file with `0600` permissions locally. |
| FR-P7 | Production deployments must fail fast if the encryption key is missing; no silent ephemeral key. |
| FR-P8 | Queryable metadata (IDs, timestamps, roles, model names, message ordering) may remain plaintext. |
| FR-P9 | Schema covers: users, sessions, providers, chats, messages, attachments, settings, migrations. |
| FR-P10 | All multi-row writes are transactional. |
| FR-P11 | Chats support soft delete/trash with restore, plus permanent delete. |
| FR-P12 | Chat/message lists are paginated; search decrypts and filters server-side within the owner's data. |
| FR-P13 | `POST /api/data/export` produces a versioned **encrypted archive** (`.onerouter`); `POST /api/data/import` validates, previews, and supports merge or replace. |
| FR-P14 | The encrypted archive includes chats, messages, settings, providers, and API keys by default; keys are never exported in plaintext. |
| FR-P15 | Legacy `localStorage` data can be migrated once and then cleared. |
| FR-P16 | A documented backup/restore procedure exists for SQLite files, data directories, and Turso databases. |
| FR-P17 | Database failure produces clear server logs and a user-facing error state. |
| FR-P18 | Encryption-key rotation is documented; automated rotation is post-MVP. |
| FR-P19 | Export encryption uses a user-supplied passphrase with scrypt KDF and AES-256-GCM; the passphrase is never stored or logged. |
| FR-P20 | A plaintext export **without** provider keys is available for portability/debugging and is clearly labeled. |
| FR-P21 | Import rejects wrong passphrases, tampered archives, and plaintext keys; merge uses ID remapping. |

### 6.8 File Attachments

| ID | Requirement |
|---|---|
| FR-F1 | Uploads use a dedicated multipart endpoint (`POST /api/files`), not inline base64 in chat payloads. |
| FR-F2 | Validate count, per-file size, total size, extension, and MIME type (magic-byte sniffing, not just headers). |
| FR-F3 | Storage is pluggable: encrypted SQLite BLOBs for local; encrypted files in the data directory for VPS by default, with optional S3-compatible storage; S3-compatible storage is required on Vercel. |
| FR-F4 | Images produce previews, dimensions, and correct vision payloads for each provider format. |
| FR-F5 | Text-like files and PDFs are parsed to text and included as context with clear provenance. |
| FR-F6 | Attachment lifecycle: delete with its message, cancel uploads, clean orphans. |
| FR-F7 | Composer supports drag-and-drop, paste, file picker, upload progress, retry, remove, and per-file errors. |
| FR-F8 | Limits are configurable (`ONE_ROUTER_MAX_FILE_MB`, `ONE_ROUTER_MAX_FILES`); Vercel-aware defaults respect serverless body limits. |
| FR-F9 | Chat requests reference attachment IDs; the server resolves and decrypts them. |
| FR-F10 | Filenames are sanitized, content is never executed, and downloads require authentication via short-lived signed URLs or an authenticated proxy. |
| FR-F11 | S3-compatible configuration uses `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_FORCE_PATH_STYLE`; uploads are disabled with clear setup guidance when required config is missing. |
| FR-F12 | Attachment bytes are encrypted with AES-256-GCM before being written to disk, SQLite, or object storage; object keys are random opaque IDs. |
| FR-F13 | On Vercel, uploads go through the server and are capped to the serverless request-body limit; direct-to-S3 presigned uploads are post-MVP because they bypass server-side encryption. |

### 6.9 Prompt Enhancement

| ID | Requirement |
|---|---|
| FR-E1 | Enhancement is an explicit action that shows a **before/after preview**; nothing is sent automatically. |
| FR-E2 | The user can Apply, Discard, or Undo; the original prompt is always preserved. |
| FR-E3 | The enhancer uses a configurable provider/model; defaults to the active chat model when suitable. |
| FR-E4 | The enhancement prompt is structured and preserves original intent, constraints, language, and formatting. |
| FR-E5 | No silent fallback that appends arbitrary text; failures surface a clear error and leave the prompt unchanged. |
| FR-E6 | Enforce input/output length limits and handle timeouts. |
| FR-E7 | The behavior is covered by regression tests with representative prompts. |

### 6.10 Chat Rename & Titles

| ID | Requirement |
|---|---|
| FR-R1 | Rename is available inline from the sidebar and the chat header. |
| FR-R2 | Rename autofocuses and selects the title; Enter saves, Esc cancels, blur saves or cancels consistently. |
| FR-R3 | Titles are trimmed, length-limited, and cannot be empty. |
| FR-R4 | Rename is optimistic with rollback and a toast on failure. |
| FR-R5 | A manual rename marks the chat as manually titled; auto-titling must never overwrite it. |
| FR-R6 | Auto-titles are meaningful: 3–6 words, no quotes/prefixes, derived from the first exchange, language-aware. |
| FR-R7 | Titles are encrypted at rest and indexed for server-side search after decryption. |
| FR-R8 | Rename/delete/pin/export are available from a consistent context menu. |
| FR-R9 | Auto-titling uses a dedicated low-cost model when configured, with a local heuristic fallback; it never blocks chat streaming. |

### 6.11 Temporary Chat

| ID | Requirement |
|---|---|
| FR-T1 | Temporary mode is an explicit, clearly indicated toggle. |
| FR-T2 | Temporary chats live only in client memory and are **never written to the database or browser storage**. |
| FR-T3 | Leaving or refreshing a temporary chat warns that it will be lost. |
| FR-T4 | Temporary chats are excluded from server-side search and export until saved. |
| FR-T5 | A visible **Save chat** action converts a temporary chat into a permanent chat, persisting its messages, attachments, and title. |
| FR-T6 | On exit/refresh with unsaved content, show a confirmation with Save, Discard, and Cancel options. |
| FR-T7 | Attachments work in temporary mode but are ephemeral and deleted when the chat is discarded. |
| FR-T8 | The UI visually distinguishes temporary chats from saved chats, and the saved chat appears in the sidebar immediately. |

### 6.12 Bug Fixes & Regression

| ID | Requirement |
|---|---|
| FR-G1 | Maintain a bug inventory of the current app; each confirmed bug is fixed or explicitly deferred. |
| FR-G2 | Complete a regression checklist for every existing feature before MVP sign-off. |
| FR-G3 | Streaming handles abort, provider errors, malformed chunks, and reconnect without stuck states. |
| FR-G4 | Provider discovery handles missing keys, network failures, and custom base URLs gracefully. |
| FR-G5 | Markdown, code blocks, KaTeX, Mermaid, and tables render correctly on narrow screens. |
| FR-G6 | Virtualized scrolling remains stable with long chats and dynamic message heights. |
| FR-G7 | File upload, prompt enhancement, rename, and temporary mode bugs are explicitly closed. |
| FR-G8 | No unhandled promise rejections or console errors in normal flows. |

### 6.13 API Server (`packages/server`)

| ID | Requirement |
|---|---|
| FR-S1 | Implement with Hono; runnable on Node, Vercel, and in Docker. |
| FR-S2 | Preserve `POST /api/chat`, `/api/title`, `/api/enhance`, `/api/discovery`. |
| FR-S3 | `/api/chat` keeps the normalized SSE contract `data: {"text":"..."}` for the UI. |
| FR-S4 | Add `GET /health` with status, version, and database connectivity. |
| FR-S5 | Add `GET /v1/models` listing routable models and aliases. |
| FR-S6 | Add `POST /v1/chat/completions` with OpenAI-compatible request/streaming response. |
| FR-S7 | Support `provider/model` IDs and config aliases (`fast`, `smart`). |
| FR-S8 | Fallback chains per alias/model are **post-MVP (v1.1)**; v1 resolves one provider/model per request. |
| FR-S9 | Normalize provider errors into a consistent JSON shape. |
| FR-S10 | CORS allowlist with credentials support. |
| FR-S11 | Optional bearer-token auth for the entire server. |
| FR-S12 | Auth, chat, provider, settings, file, and data import/export endpoints. |
| FR-S13 | Request validation, body-size limits, and structured error codes. |
| FR-S14 | No secrets in logs; redact keys and auth headers. |
| FR-S15 | Request IDs and structured server logging. |
| FR-S16 | Publish an OpenAPI description for `/v1` (and optionally `/api`). |

### 6.14 Shared Core (`packages/core`)

| ID | Requirement |
|---|---|
| FR-K1 | Extract provider adapters and message mapping from current route handlers. |
| FR-K2 | Export streaming parsers for OpenAI, Anthropic, Gemini, and Ollama. |
| FR-K3 | Export shared types (`Provider`, `Message`, `Attachment`, etc.). |
| FR-K4 | Export zod schemas for config and API payloads. |
| FR-K5 | No Next.js/React dependency; no Node-only APIs where avoidable. |
| FR-K6 | Unit-testable in isolation. |
| FR-K7 | Preserve existing provider payload behavior unless a documented fix is required. |

### 6.15 Landing Page & Docs (`apps/site`)

| ID | Requirement |
|---|---|
| FR-L1 | Static landing page at `/`: hero, feature grid, provider support, live SVG/HTML product renders (not screenshots), install commands, deploy buttons, footer. |
| FR-L2 | Detailed docs at `/docs` using Next.js + Fumadocs (MDX). |
| FR-L3 | Docs cover: Overview (deployment matrix), Introduction, Quick Start, Installation, CLI, Configuration (per-target environment matrix), Authentication, Passwords and Recovery, Database & Encryption, Providers, API Gateway, Web UI, File Uploads, Import/Export, Self-hosting (Vercel/VPS/Docker/systemd), Backup, Uninstall, Architecture, Troubleshooting, FAQ, Development. |
| FR-L4 | Searchable sidebar, TOC, and copyable command blocks. |
| FR-L5 | Fully static (`output: 'export'`) and deployable to Vercel or any static host. |
| FR-L6 | Shared branding, typography, and theme tokens with the app. |
| FR-L7 | SEO: metadata, Open Graph, sitemap, robots. |
| FR-L8 | Links to npm, GitHub, and a live demo when available. |
| FR-L9 | No secrets or provider keys in the site build. |
| FR-L10 | Security docs clearly cover default password, forced change, encryption key backup, and public-server risks. |
| FR-L11 | All product previews on the landing page are rendered from SVG/HTML components, not raster screenshots. |
| FR-L12 | Docs are English-only in v1. |
| FR-L13 | No analytics or third-party tracking in v1. |
| FR-L14 | Docs open with a target matrix: Local, VPS (Docker or systemd), and Vercel, each with its database, first-password rule, reset behaviour, and install command. |
| FR-L15 | Every command block is copyable and complete, with PowerShell and POSIX variants where they differ. No placeholders except the host name and secret values. |
| FR-L16 | Installation docs advertise only the paths that ship in the current release; unreleased install methods are not shown. |

### 6.16 Configuration & Security

| ID | Requirement |
|---|---|
| FR-X1 | Config lives at `~/.one-router/config.json`; override with `ONE_ROUTER_CONFIG`. |
| FR-X2 | Config supports providers, default model, aliases, server settings, limits, and paths; fallback fields are reserved for v1.1. |
| FR-X3 | Key resolution: request-provided transient key → encrypted DB provider key → environment variable. |
| FR-X4 | Environment variables: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_BASE_URL`, `INITIAL_PASSWORD`, `ONE_ROUTER_ENCRYPTION_KEY`, `ONE_ROUTER_AUTH_TOKEN`, `ONE_ROUTER_ALLOWED_ORIGINS`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ONE_ROUTER_DATA_DIR`, `ONE_ROUTER_SESSION_DAYS`, `ONE_ROUTER_MAX_FILE_MB`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`. |
| FR-X5 | Config values may reference env vars (`${OPENAI_API_KEY}`). |
| FR-X6 | Secret files are written with `0600` on POSIX. |
| FR-X7 | Docs warn that a public server with stored keys is an open proxy unless auth is enabled. |
| FR-X8 | The UI can use stored provider keys or a transient key for one session; transient keys are never persisted. |
| FR-X9 | Production fails fast when the encryption key or database is misconfigured. |
| FR-X10 | Encryption-key rotation procedure is documented. |
| FR-X11 | Passwords use **scrypt** with documented parameters. |
| FR-X12 | Session cookies are HTTP-only, Secure in production, SameSite=Lax; tokens are hashed at rest. |
| FR-X13 | CORS credentials are limited to configured origins. |
| FR-X14 | Upload limits and content-type checks are enforced server-side. |
| FR-X15 | Security headers: `X-Content-Type-Options`, `Referrer-Policy`, frame protection, and a reasonable CSP. |

### 6.17 Deployment

| ID | Requirement |
|---|---|
| FR-D1 | Local contributor dev: `pnpm dev`. |
| FR-D2 | Local end user: `npx onerouter` with SQLite in `~/.one-router/`. |
| FR-D3 | Vercel: same-origin static UI + Hono serverless function + **Turso (libSQL)**. |
| FR-D4 | VPS: multi-stage `docker/Dockerfile` (Node 24 LTS Alpine) with a persisted `/data` volume for SQLite and encrypted attachments. |
| FR-D5 | `docker/compose.yml` with port, env, volume, and restart policy. |
| FR-D6 | Reverse-proxy docs for Caddy or Nginx with HTTPS. |
| FR-D7 | Non-Docker VPS path via `npm i -g onerouter` + systemd unit. |
| FR-D8 | One server build for all targets; no target-specific business logic forks. |
| FR-D9 | `.env.example` files for each deployable target. |
| FR-D10 | Migrations run on startup; a failed migration aborts startup with a clear error. |
| FR-D11 | Vercel deployment is same-origin so cookie auth works without cross-site cookie configuration. |
| FR-D12 | Backup/restore instructions for SQLite files, data directories, and Turso databases. |
| FR-D13 | Vercel requires Turso credentials and S3-compatible storage for attachments; missing config disables uploads with clear guidance. |
| FR-D14 | `docker/compose.yml` includes an optional MinIO profile for S3-compatible storage; the default VPS attachment store is encrypted filesystem. |
| FR-D15 | Local attachments default to encrypted SQLite BLOBs for zero-config, single-file backups. |
| FR-D16 | No custom domain in v1: use the Vercel-provided domain and localhost; custom domains are post-MVP. |
| FR-D17 | Uninstall is documented for every v1 path: global npm package, Docker container and volume, systemd unit and data directory. Every step warns before data is deleted. |
| FR-D18 | The Docker image stores data in `/data` and supports `docker exec one-router one-router user reset-password` for a locked-out owner; password recovery docs cover it. |

### 6.18 Quality & Developer Experience

| ID | Requirement |
|---|---|
| FR-Q1 | Root `pnpm lint`, `typecheck`, `build`, and `test` run via Turborepo. |
| FR-Q2 | Vitest for `core`, `db`, and `server`; adapter/parser and endpoint tests. |
| FR-Q3 | CLI smoke test: pack, install in a temp dir, verify `--version` and `--help`. |
| FR-Q4 | GitHub Actions CI runs lint, typecheck, test, and build on PRs. |
| FR-Q5 | semantic-release workflow on the main branch: if `NPM_TOKEN` is available, publish `onerouter` to npm with provenance; otherwise create the GitHub release/tag only and skip npm. |
| FR-Q6 | Root README is intentionally minimal: what it is, install/run, feature bullets, and links to the detailed docs. It must not duplicate `/docs`. |
| FR-Q7 | Root README embeds a smooth animated SVG of the chat dashboard, committed to the repo, with no external network requests and a file size under 300 KB. |
| FR-Q8 | Each public package has a README and license reference. |
| FR-Q9 | A database migration test runs against a fresh SQLite file in CI. |
| FR-Q10 | Root `pnpm audit` shows all severities (critical, high, moderate, low); `pnpm audit:gate` fails on high or critical. |
| FR-Q11 | Any critical or high vulnerability is fixed immediately in the same change; moderate and low findings are tracked. |
| FR-Q12 | CI runs the audit gate on every pull request and release build. |
| FR-Q13 | CI runs on Node 24 LTS and the current stable release; Node 24 LTS remains the minimum supported version. |

### 6.19 Verification & CI

The owner does not run Docker, VPS, or Vercel verification on a local machine. Those paths
are proven in CI. A slice is not done because it compiles; it is done when the required CI
jobs for its environment pass.

| ID | Requirement |
|---|---|
| FR-V1 | Heavy environment verification runs in CI only: Docker build and run, container lifecycle, VPS installer, systemd, and Vercel preview. No contributor machine needs Docker, a VPS, or deploy credentials. |
| FR-V2 | One smoke/E2E suite runs unchanged against three targets: the packed npm tarball installed in a clean Node 24 container, the Docker image, and the Vercel preview deployment. Target-specific tests are allowed only for target-specific behavior. |
| FR-V3 | CI is layered: fast (lint, typecheck, unit, integration, build, budget), artifact (pack and clean install), Docker (build, inspect, run), Vercel (build and preview), OS and docs conformance, and real-user E2E. Each layer runs when its inputs change. |
| FR-V4 | The artifact job installs the packed tarball in a clean `node:24-alpine` container that receives only the tarball, then checks `--version`, starts the server, calls `GET /health`, completes bootstrap, forces the password change, and logs in. |
| FR-V5 | The Docker job asserts the image is at most 250 MB, runs as non-root, declares a `HEALTHCHECK` against `/health`, and ships production dependencies only. |
| FR-V6 | The Docker job runs the lifecycle matrix: fresh volume with `INITIAL_PASSWORD`; password printed once; forced change; restart preserves data; `docker rm` plus recreate on the same volume preserves data and decrypts old messages; `INITIAL_PASSWORD` after bootstrap does not reset the password; an upgrade from the previous tag runs migrations and keeps data readable; `docker exec one-router one-router user reset-password` recovers a locked-out owner; uninstall works with and without `--purge`; a missing `/data` mount warns instead of losing data silently; the non-root user can write `/data`. |
| FR-V7 | The Docker image is considered valid only when FR-V5 and FR-V6 pass. |
| FR-V8 | The Vercel job runs `vercel build` and deploys a preview against an ephemeral Turso database and an S3-compatible bucket, then runs the same smoke suite, including `Secure` and `SameSite` cookies, uploads, and static export paths. |
| FR-V9 | OS conformance: `windows-latest` runs the PowerShell command blocks and the npm path; `ubuntu-latest` runs the POSIX blocks and the systemd unit; `macos-latest` runs the npm path. |
| FR-V10 | Docs are executable: every fenced command in `/docs` carries a `verify` id, a manifest maps each id to a test, and CI fails when a documented command has no test. Versions are interpolated from `package.json`, and internal links and anchors are checked. |
| FR-V11 | Implement branches get a scratch workflow (`workflow_dispatch` plus `push`) with path filters and cancel-in-progress. Before merge, stable jobs move into the permanent `ci.yml` and the scratch file is deleted; `main` never keeps a temporary workflow. |
| FR-V12 | Jobs are required or advisory. A slice is verified only when every required job passes. A skipped or unavailable job is reported as unverified with its reason and the manual step needed; it is never treated as passing. |
| FR-V13 | Failure loop: push, read the failing job log, fix the root cause, push again. A red required job blocks merge, and each fix is its own commit. CI prints a bounded failure summary (failing command plus 40 lines) and uploads full logs as artifacts. |
| FR-V14 | CI boundaries: product tests use recorded fixtures and never call live provider APIs. Real VPS kernel, Docker version, TLS issuance, and Vercel/Turso platform behavior stay outside CI; they are covered by a documented pre-release checklist and a manual `pnpm smoke:providers` run, and anything not run is marked unverified. |
| FR-V15 | `VERCEL_TOKEN`, Turso credentials, and S3 credentials are repository secrets. Missing secrets downgrade the job to unverified and never produce a silent pass. |
| FR-V16 | The release tag runs the full matrix. A release is blocked when a required job is red or a required environment is unverified. |

---

## 7. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Local UI first meaningful paint within 2 seconds on a typical developer machine. |
| NFR-2 | `npx onerouter` cold start (excluding download) under 3 seconds. |
| NFR-3 | Streaming is incremental; no full-response buffering. |
| NFR-4 | Idle server RSS < 150 MB (SQLite target). |
| NFR-5 | Ollama works fully offline; no ONE ROUTER cloud dependency. |
| NFR-6 | No telemetry by default. |
| NFR-7 | WCAG-minded basics: keyboard navigation, focus states, contrast. |
| NFR-8 | Current Chrome, Firefox, Safari, Edge. |
| NFR-9 | Node.js >= 24 LTS. |
| NFR-10 | Reproducible build from a clean `pnpm install`. |
| NFR-11 | Authentication adds no more than ~150 ms to a normal API request (excluding provider latency). |
| NFR-12 | Database writes are durable and transactional; no partial chat/message states. |
| NFR-13 | The app must remain usable with hundreds of chats and thousands of messages (pagination + virtualization). |
| NFR-14 | Encryption/decryption overhead stays acceptable for streaming and list views. |
| NFR-15 | Initial route JS is at most 220 KB gzip and CSS at most 50 KB gzip, measured on the production build. |
| NFR-16 | KaTeX, Mermaid, and the syntax highlighter load as local dynamic chunks on first use; no runtime CDN or third-party script. |
| NFR-17 | The Docker image is at most 250 MB uncompressed, built in stages, ships production dependencies only, and runs as a non-root user. |
| NFR-18 | The documented VPS container limit is 256 MB; idle RSS stays under 150 MB. |
| NFR-19 | Provider adapters use `fetch`; no vendor SDK is part of the default server bundle, and heavy imports are lazy. |
| NFR-20 | Warm API p95 stays at or below 200 ms excluding provider latency; Vercel cold start stays at or below 2 seconds. |
| NFR-21 | Motion uses CSS transitions unless a JS animation is necessary; the JS animation library is excluded from the initial route bundle. |
| NFR-22 | CI measures the NFR-15 to NFR-21 budgets on the production build and fails on a regression above budget. |

---

## 8. Architecture Overview

```
one-router/                        # pnpm workspace + Turborepo
├── apps/
│   ├── web/                       # chat UI — Next.js, output: 'export'
│   └── site/                      # landing "/" + "/docs" — Next.js + Fumadocs, static
├── packages/
│   ├── core/                      # adapters, parsers, types, schemas
│   ├── db/                        # Drizzle schema, migrations, repositories, encryption
│   ├── server/                    # Hono app: auth, data, files, /api, /v1
│   ├── ui/                        # shared design tokens + primitives
│   └── cli/                       # onerouter (published) — bins: one-router, onerouter
├── docker/
├── .releaserc.json
├── turbo.json
└── pnpm-workspace.yaml
```

**Data flow**

- Browser → static UI → same-origin `/api` (or configured API base)
- Auth cookie → Hono auth middleware → route handler
- Route handler → repository (`packages/db`) → encrypted fields → SQLite/libSQL
- `/api/chat` → provider adapter (`packages/core`) → provider API → normalized SSE
- `/v1/chat/completions` → router/aliases (fallbacks in v1.1) → provider → OpenAI-compatible SSE
- CLI serves the static UI and mounts the same Hono app, with SQLite in `~/.one-router/`

**Key architectural decisions**

1. Static UI export + portable Hono backend — avoids shipping a Next.js standalone
   server inside the npm package and keeps one backend for local/VPS/Docker/Vercel.
2. Storage abstraction — SQLite/libSQL everywhere: file database locally and on VPS,
   Turso on Vercel, behind one repository interface and one migration history.
3. Field-level AES-256-GCM encryption — portable across SQLite and libSQL; queryable
   metadata stays plaintext, while content, keys, and attachment bytes are encrypted.
4. Cookie sessions with same-origin Vercel deployment — avoids cross-site cookie and
   CSRF complexity.
5. Pluggable attachment storage — SQLite BLOBs locally, encrypted filesystem on VPS,
   S3-compatible object storage on Vercel.

---

## 9. Deployment Matrix

| Target | UI | API | Database | Attachments | Entry point |
|---|---|---|---|---|---|
| Contributor dev | `next dev` :3000 | Hono :4000, proxied | SQLite file | encrypted SQLite BLOBs | `pnpm dev` |
| Local end user | static, CLI-served | Hono inside CLI | SQLite `~/.one-router/` | encrypted SQLite BLOBs | `npx onerouter` |
| VPS (Docker) | static, server-served | Hono container | SQLite on `/data` | encrypted files on `/data`; optional S3/MinIO | `docker compose up` |
| VPS (no Docker) | static, CLI-served | Hono inside CLI | SQLite on disk | encrypted files in data dir | `one-router serve` + systemd |
| Vercel | static build | Hono serverless | Turso (libSQL) | S3-compatible (required) | same-origin Vercel project |

v1 builds the Docker image from the repository. Once the post-MVP Docker phase ships,
the same row also accepts the published image through `docker pull`, the one-command
installer, or a compose `image:` entry. The container layout does not change.

---

## 10. Constraints & Conventions

- pnpm only (v10.x). Tailwind v4, CSS-native config.
- No application data in browser storage.
- 500-line maximum per source file.
- Latest stable Next.js App Router / React for `apps/web` and `apps/site`.
- Every existing or new dependency uses the latest stable release at implementation
  time; verify with `pnpm outdated` and keep the lockfile committed.
- Never use the section sign in any repo content (code, docs, commits, PRD);
  write "Section N" instead.
- `README.md` stays minimal; detailed documentation lives at `/docs`.
- Releases use semantic-release; npm publishing happens only when `NPM_TOKEN` is present.
- `pnpm audit` reports all severities; high/critical findings block merges and are fixed immediately.
- Heavy environment verification (Docker, Vercel, systemd) runs in CI; no contributor machine needs Docker or deploy credentials.
- MIT license retained.
- Existing localStorage data must be migratable, not silently lost.
- All public APIs are versioned where practical; export format is versioned.
- No plaintext secrets in logs, database dumps, or error responses.

---

## 11. Decision Log

| ID | Decision | Rationale |
|---|---|---|
| D-1 | npm package `onerouter`, bins `one-router` + `onerouter` | `one-router` is taken; `onerouter` is available. |
| D-2 | CLI runs UI + API gateway | One command delivers the product; `--api-only` serves tooling users. |
| D-3 | Landing + docs: Next.js + Fumadocs | One React/Tailwind stack; MDX docs with search and TOC; static. |
| D-4 | Hybrid key model: transient request key → encrypted DB key → env | Preserves per-request flexibility while enabling server-side keys. |
| D-5 | Static UI export + Hono backend | Small package, one backend for all targets, no Next server runtime. |
| D-6 | pnpm workspaces + Turborepo | Scales task orchestration and caching. |
| D-7 | semantic-release for releases | Automated versioning, changelog, GitHub release, and conditional npm publish. |
| D-8 | Config dir `~/.one-router/` | Matches branding; override via `ONE_ROUTER_CONFIG`. |
| D-9 | Redesign scope = feature parity + premium polish; new features post-MVP | Prevents scope creep while raising quality. |
| D-10 | All app data moves server-side; no browser persistence | Durability, auth, multi-device access, encrypted storage. |
| D-11 | SQLite for local/VPS; Turso (libSQL) on Vercel | Serverless has no persistent disk; one libSQL dialect and one migration history everywhere. |
| D-12 | Login required; bootstrap owner; forced first-login password change; `INITIAL_PASSWORD` override | Secure first-run without a manual setup step. |
| D-13 | Field-level AES-256-GCM with a master key | Portable across SQLite/libSQL; protects content, keys, and attachment bytes. |
| D-14 | Symbol-based logo with full asset set | Stronger brand, works at favicon size, premium feel. |
| D-15 | Same-origin Vercel deployment | Cookie auth works without cross-site cookie complexity. |
| D-16 | semantic-release publishes npm only when `NPM_TOKEN` exists; otherwise GitHub release only | CI stays green on forks and environments without npm credentials. |
| D-17 | Latest stable versions for all dependencies | Security, support, and maintainability; avoids deprecated APIs. |
| D-18 | Minimal README with an animated SVG dashboard demo | README is a showcase; detailed docs live in `/docs`. |
| D-19 | Audit gate blocks high/critical vulnerabilities | Prevents shipping known-vulnerable builds. |
| D-20 | Turso/libSQL for every target; no Postgres adapter in v1 | Single dialect, single migration history, simplest cross-target behavior. |
| D-21 | Single owner account, password-only login; schema supports more users later | Matches the self-hosted product; avoids premature team features. |
| D-22 | scrypt for password hashing | Node built-in, no native dependency, small package, memory-hard. |
| D-23 | Attachment storage: SQLite BLOBs locally, encrypted files on VPS, S3-compatible on Vercel | Best operational fit per target; S3 avoids serverless disk limits. |
| D-24 | Encrypted export archive includes API keys, protected by a user passphrase | Full backups without leaking keys; portable across instances. |
| D-25 | Logo direction is designer-led (routing-node/abstract mark); owner reviews concepts | Faster progress while keeping owner approval. |
| D-26 | Vercel uploads go through the server, capped at the body limit; no presigned direct uploads in v1 | Keeps server-side encryption authoritative and avoids shipping plaintext to object storage. |
| D-27 | No custom domain in v1; use the Vercel-provided domain and localhost | Faster launch; a custom domain can be attached later without code changes. |
| D-28 | English-only docs in v1 | Focus; i18n and RTL are post-MVP. |
| D-29 | Landing product previews are live SVG/HTML renders, not screenshots | Crisper, theme-aware, and never stale. |
| D-30 | Fallback chains are post-MVP (v1.1) | Keeps MVP focused on feature parity and the redesign. |
| D-31 | Logo direction: **Network O** (three arc segments joined by nodes) | Owner approved concept 03; distinctive and legible at favicon size. |
| D-32 | Post-MVP roadmap themes: GenUI, agentic capabilities, custom MCP, plugins, connectors | Captures the owner's expansion priorities without expanding MVP scope. |
| D-33 | Prebuilt multi-arch image on GHCR plus a one-command VPS installer; v1 builds the image from source | Servers should not need a Node toolchain to run the product, but the image is published only after the v1 Dockerfile and entrypoint are stable. |
| D-34 | Docs cover uninstall and password recovery for every target | An install path without a removal or recovery path strands self-hosters. |
| D-35 | Heavy environment verification runs in CI only; one smoke suite runs against the npm tarball, the Docker image, and the Vercel preview | The owner does not run Docker or deploy targets locally; the same suite on three targets catches environment-specific breakage that unit tests cannot. |
| D-36 | Documented commands are executable tests with a coverage gate | Keeps `/docs` and the shipped behavior from drifting; a command that cannot be tested is not documented. |

---

## 12. Decisions & Open Questions

### 12.1 Resolved in v0.4

| ID | Decision |
|---|---|
| O-13 | **Turso/libSQL everywhere**: SQLite file for local/VPS, Turso for Vercel; no Postgres adapter in v1. |
| O-14 | **Single owner account**, password-only login; schema supports more users later. |
| O-15 | **scrypt** via Node's built-in `crypto`. |
| O-16 | **SQLite encrypted BLOBs locally; encrypted filesystem on VPS with optional S3; S3-compatible required on Vercel.** Docker Compose gets an optional MinIO profile. |
| O-17 | v1 attachments: **images, text/code, PDF**; Office docs post-MVP. |
| O-18 | **Encrypted `.onerouter` archive** with scrypt + AES-256-GCM; includes API keys; passphrase required. Plaintext export without keys is optional. |
| O-19 | **In-memory only** temporary chats, with explicit Save chat and exit confirmation. |
| O-22 | Use the ChatGPT Windows desktop feel as the high-level reference; no pixel-copy; owner reviews the redesign. |
| O-23 | **Network O selected** (concept 03): three arc segments joined by nodes; final geometry and assets are refined during implementation. |

### 12.2 Resolved in v0.5

| ID | Decision |
|---|---|
| O-1 | Single brand: **ONE ROUTER** everywhere; npm package stays `onerouter`. |
| O-2 | Node 24 LTS minimum; CI on Node 24 LTS and the current stable release. |
| O-3 | **Vitest** for unit and integration tests. |
| O-4 | **Turborepo** for task orchestration and caching. |
| O-5 | **No custom domain in v1**; use the Vercel-provided domain and localhost. Custom domains post-MVP. |
| O-6 | **English-only docs** in v1. |
| O-7 | **Fallback chains are post-MVP (v1.1)**; v1 keeps per-request provider/model routing. |
| O-8 | Reuse app branding; product previews use **live SVG/HTML renders**, not raster screenshots. |
| O-9 | Publish only `onerouter`; internal packages stay private. |
| O-10 | Provider presets are available with masked/empty keys. |
| O-11 | **No analytics** or third-party tracking in v1. |
| O-12 | `one-router init` performs best-effort Ollama detection. |
| O-20 | **Both**: generated key file locally; mandatory env var in production. |
| O-21 | 30-day sliding session; no separate remember-me in v1. |
| O-24 | Auto-title uses a dedicated low-cost model with a local heuristic fallback. |
| O-25 | Prompt once after first login for legacy localStorage import; manual import also available. |
| O-26 | 2FA/passkeys are post-MVP. |
| O-27 | Non-secret UI preferences are stored server-side in user settings. |
| O-28 | Metadata (IDs, timestamps, roles, model names, ordering) stays plaintext for querying; content, keys, and profile fields are encrypted. |

### 12.3 Open Questions

None. All requirements questions are resolved. Do not create `context/PLAN.md` until the
owner explicitly asks.

---

## 13. Future Feature Backlog (Post-MVP)

Not in the MVP redesign. Captured so nothing is forgotten; priority is indicative.

> **Major post-MVP themes:** Generative UI (GenUI), progressively deeper agentic
> capabilities (tool calling first, then planning and background agents), and
> extensibility through custom MCP servers, plugins, and connectors.
>
> **Suggested sequence:** GenUI foundation → agentic tool calling → custom MCP,
> connectors, and plugins → multi-step planning and background agents → memory and
> computer-use capabilities.

### 13.1 Chat & Productivity

| Priority | Feature |
|---|---|
| P1 | Server-side full-text chat search with filters |
| P1 | Projects/folders, archive, trash with restore |
| P1 | Message branching and edit/regenerate tree |
| P1 | Multi-model side-by-side comparison |
| P1 | Read-only conversation sharing links |
| P1 | Prompt library and reusable templates |
| P1 | Custom instructions and memory |
| P2 | Tags, pinned messages, bulk actions |
| P2 | Export to PDF/HTML, scheduled prompts |
| P2 | Command palette and richer keyboard shortcuts |
| P3 | Chat snapshots and version history |

### 13.2 AI Capabilities

| Priority | Feature |
|---|---|
| P1 | Web search with citations |
| P1 | Vision/image understanding improvements |
| P1 | Image generation |
| P1 | Voice input and text-to-speech |
| P1 | **Generative UI (GenUI)**: dynamically generate and render AI responses as structured, interactive, component-based interfaces instead of plain Markdown. |
| P1 | **Agentic tool calling**: model-initiated tool calls with approval prompts, streaming status, and structured results. |
| P1 | **Custom MCP servers**: user-configurable connections with auth, tool discovery, permissions, and a tool registry. |
| P1 | PDF/OCR ingestion and knowledge bases (RAG) |
| P1 | Reasoning/thinking trace display |
| P2 | Artifacts/canvas and code execution |
| P2 | **Plugins**: installable extensions with scoped permissions and a sandboxed runtime. |
| P2 | **Connectors**: Google Drive, Notion, GitHub, and custom webhooks. |
| P2 | **Agentic planning**: multi-step plans, task lists, background execution, and approval checkpoints. |
| P2 | Deep research agent |
| P2 | Context-window management and summarization |
| P2 | Translation and language detection |
| P3 | **Agent memory and long-running tasks** |
| P3 | Computer-use style agents |
| P3 | Fine-tuning workflows |

### 13.3 Routing & Cost

| Priority | Feature |
|---|---|
| P1 | Cost and token tracking per chat/model |
| P1 | Usage dashboard and budgets |
| P1 | Cost/latency-aware routing policies |
| P1 | Retries, circuit breakers, health checks |
| P1 | Model fallback chains (v1.1) |
| P2 | Response caching and prompt caching indicators |
| P2 | Virtual API keys with scopes and quotas |
| P3 | Provider load balancing and A/B routing |

### 13.4 Platform & Team

| Priority | Feature |
|---|---|
| P1 | Multi-user accounts with isolated data |
| P2 | Teams/workspaces and RBAC |
| P2 | SSO/OIDC, 2FA, passkeys |
| P2 | Audit logs and session management |
| P2 | Usage quotas and admin dashboard |
| P3 | Billing/subscriptions (if SaaS) |
| P3 | Plugin marketplace and distribution |

### 13.5 Clients & Integrations

| Priority | Feature |
|---|---|
| P1 | PWA install + mobile polish |
| P1 | OpenAI-compatible gateway improvements |
| P2 | Desktop app (Tauri) |
| P2 | Browser extension (quick ask) |
| P2 | Slack/Discord bot integrations |
| P3 | Native mobile apps |

### 13.6 Operations

| Priority | Feature |
|---|---|
| P1 | Automated backups and restore |
| P1 | Key rotation automation |
| P1 | **Prebuilt Docker image**: CI publishes a multi-arch image (`linux/amd64`, `linux/arm64`) to GHCR as `ghcr.io/<owner>/one-router`, tagged `latest` and semver. The server never builds. |
| P1 | **One-command VPS install**: `curl -fsSL <site>/install-vps.sh \| sudo sh` pulls the image, creates the `one-router-data` volume at `/data`, binds `127.0.0.1:3000`, sets a restart policy, and seeds or generates the first password and prints it once. |
| P1 | **Manual prebuilt install**: documented `docker pull` plus `docker run -d --name one-router --restart unless-stopped -p 127.0.0.1:3000:3000 -v one-router-data:/data -e INITIAL_PASSWORD=... ghcr.io/<owner>/one-router:<tag>`. Compose uses `image:` with a contributor-only `build:` override. |
| P1 | **Upgrade and uninstall**: a new tag is applied by pulling and recreating the container; the volume keeps SQLite, attachments, and the encryption key, and migrations run on start. Uninstall removes the container and volume, with `--purge` and a data-loss warning. |
| P2 | Observability (metrics, traces, error reporting, opt-in) |
| P2 | i18n and RTL |
| P2 | Theme packs and customization |
| P2 | **Image hardening**: non-root UID, healthcheck, read-only root filesystem where possible, SBOM and provenance, cosign signature, and digest pinning in the documented examples. |
| P2 | **Compose profiles**: MinIO for S3-compatible attachments and Caddy for automatic TLS, both opt-in. |
| P3 | Multi-instance sync |

**Docker packaging sequence.** v1 ships `docker/Dockerfile` and `docker/compose.yml` and
builds the image on the host. The prebuilt image, `docker/install-vps.sh`, the uninstall
script, and the GHCR publish workflow land in the post-MVP phase as one change set, so
the docs never advertise an image that does not exist yet. That change set also adds the
Docker tab to the landing install block and the prebuilt-image section to the install and
self-hosting docs.

---

## 14. Out of Scope (v1)

- Hosted SaaS, billing, subscriptions.
- Team workspaces, RBAC, SSO.
- Native mobile apps.
- Plugin marketplace.
- Automatic 2FA/passkeys.
- Cloud sync between independent instances.
- Fine-tuning.
- Automated encryption-key rotation.
- Postgres/Neon database adapter (Turso/libSQL only in v1).
- Office document attachments such as docx/xlsx (post-MVP).

---

## 15. Success Criteria

| ID | Criterion |
|---|---|
| SC-1 | Clean machine runs `npx onerouter`, logs in with the printed password, is forced to change it, and chats with a provider. |
| SC-2 | All chats/messages/providers/settings persist across restart in SQLite, encrypted at rest. |
| SC-3 | No application data is written to `localStorage`. |
| SC-4 | `one-router --api-only` serves `/v1/models` and streams `/v1/chat/completions` for all four provider types. |
| SC-5 | Vercel deployment works end-to-end with Turso and S3-compatible attachments, including login cookies. |
| SC-6 | Docker/VPS deployment works with a persistent `/data` volume for SQLite and attachments. |
| SC-7 | Encrypted export produces a valid `.onerouter` archive including API keys; import prompts for the passphrase and restores chats on a fresh instance. |
| SC-8 | File uploads work end-to-end for images, text/code, and PDFs across SQLite, filesystem, and S3 storage adapters, with no base64 blobs in chat requests. |
| SC-9 | Prompt enhancement shows a preview and never silently alters or sends the prompt. |
| SC-10 | Rename and temporary chat behaviors match Sections 6.10 and 6.11, including Save chat. |
| SC-11 | The redesigned UI passes the visual QA checklist and all existing features regress cleanly. |
| SC-12 | The Network O symbol and all icon assets are present and used consistently. |
| SC-13 | Root `lint`, `typecheck`, `build`, and `test` pass in CI. |
| SC-14 | No source file exceeds 500 lines. |
| SC-15 | semantic-release runs on main; npm publishes only when `NPM_TOKEN` exists, otherwise a GitHub release is created. |
| SC-16 | `pnpm audit` shows all four severity levels and CI blocks high/critical findings. |
| SC-17 | README is minimal, links to `/docs`, and its animated SVG renders on GitHub without external requests. |
| SC-18 | All dependencies are on their latest stable versions at implementation time. |
| SC-19 | **Post-MVP:** a clean VPS with Docker installs ONE ROUTER with one command, keeps data across container recreation, and upgrades by pulling a new image tag. |
| SC-20 | Every v1 install path has a matching uninstall path in the docs, and each deletion step names what data is lost. |
| SC-21 | CI installs the packed npm tarball in a clean container and passes the shared smoke suite; the same suite passes against the Docker image and a Vercel preview. |
| SC-22 | The Docker lifecycle matrix in FR-V6 passes: persistence across recreation, upgrade, password recovery, and uninstall. |
| SC-23 | Every documented command has a CI test, and an uncovered command fails the build. |

---

## 16. Next Step

1. PRD v0.7 is locked and archived on the `docs/prd-one-router` branch.
2. `context/PLAN.md` is the active implementation artifact; it defines the MVP cut line.
3. Keep the post-MVP backlog in Section 13.
4. Once `PLAN.md` covers the MVP, rewrite the MVP sections to the clean template and
   keep the post-MVP backlog.
5. During implementation, refine Network O geometry and build the full lockup and icon assets.
6. Follow `AGENTS.md` for gates, branches, skills, progress, testing, security review,
   and UI rules.
