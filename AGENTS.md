# ONE ROUTER — Agent Guide

This file is the operating contract for agents working in this repo. It applies to
every phase, feature, fix, review, and release. `context/PRD.md` is the product
spec; this file defines how work is executed.

Current state: a single Next.js app, PRD v0.5, no `context/PLAN.md`, no test
framework. Target state: a pnpm monorepo with `apps/web`, `apps/site`, and
`packages/core`, `packages/db`, `packages/server`, `packages/ui`, `packages/cli`.

## Operating rules

### Gates

After every edit, run the changed-file gates:

- `pnpm lint:changed`
- `pnpm typecheck:changed`
- `pnpm test:changed`

Run the full gate once per phase, before merge, and in CI:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm budget && pnpm audit:gate
```

`pnpm budget` checks the NFR-15 to NFR-21 size, image, memory, and latency budgets
against the production build. `pnpm audit` is pnpm's built-in command and cannot be
shadowed by a script.
`audit:gate` is the project severity gate. `pnpm audit` shows all four severities;
`audit:gate` fails on high or critical findings. Never run the full suite as the
inner dev loop.

Phase 0 wires these scripts before feature work. Until then the repo only has
`pnpm lint` and `pnpm build`; do not pretend the changed gates exist.

### Branches

- Planned work gets a branch: `phase-N-<slug>` for a phase from `context/PLAN.md`,
  or `feat-<slug>` for a feature large enough to justify one.
- Small fixes, wording changes, and doc edits go directly to `main` as a direct
  commit. Do not open a branch for those.
- Merge with `--no-ff` and keep the branch. `main` moves only by merge or by those
  direct small commits.
- An explicit instruction from the owner always wins.

### Skills

Before starting any phase, feature, or fix:

1. Read `.agents/skills/one-router/SKILL.md`.
2. Load only the two to four skills it names for that kind of work.
3. If a skill conflicts with this file, this file wins.

Do not install the full skill collection. The project skill is an index, not a
second rulebook.

### Progress

`context/PROGRESS.md` is a compact phase index, not a changelog.

- Keep a status table and one short entry per merged phase.
- Each entry is limited to the work commit, gate result, deviations, and accepted
  findings. Aim for about 20 lines per entry.
- No narrative, no file-by-file test inventory, no repeated plan text.
- Tighten older entries when a new phase is added; keep the file around 200 lines.
- Append before the phase merge.

`PROGRESS.md` does not exist yet. Phase 0 creates it.

### Doc lifecycle

`context/PRD.md` is the working spec.

- Once `context/PLAN.md` covers everything the PRD describes, rewrite the PRD in
  place to its clean template: the same headings with no content. The next round is
  written there.
- Keep unplanned post-MVP scope in the PRD; empty only the sections the plan covers.
- Once every phase in `PLAN.md` is merged, rewrite `PLAN.md` and `PROGRESS.md` the
  same way: same headings, fields emptied.
- There is no template file. Rewrite in place; do not copy from another file.
- Current state: PRD v0.5 is the source for the v1 plan. `PLAN.md` and
  `PROGRESS.md` do not exist. Do not create `PLAN.md` until the owner asks.

## Testing

### Unit testing

Pure functions only: model and alias parsing, provider URL normalization and
validation, SSE frame parsing, title normalization, attachment MIME and size
checks, cursor encode/decode, date/time formatting, sort comparators, and archive
manifest validation.

Table-driven, no mocks, no network, no DB. One `.test.ts` file per unit, next to
the source. Coverage is not the target; every documented edge case having a case
is.

### Integration testing

Everything that touches the DB or a route: migrations, seed idempotency,
auth/session, chat and message CRUD, provider config encryption, attachment
adapters, import/export, and `/v1` endpoints.

Use one real libSQL file DB per test file in a temp directory, deleted after.
Never mock the DB layer; a mocked DB proves nothing about the SQL that ships.
Provider HTTP is recorded fixtures, never live network.

### Test-driven development

Test first, watch it fail, then write the smallest code that passes. A phase's
tests are written at the start of that phase, not after it. A bug fix without a
reproducing test is not a fix.

### Pen tester pass

After each phase's green tests, switch to adversarial mode and try to break the
build. Cover at least:

| Area | Try |
|---|---|
| Auth bypass | Any `/api/*` or `/v1/*` route without a session or API token; forged cookie; session fixation; expiry not enforced; `mustChangePassword` ignored; temp-chat save bypass. |
| Injection | SQL through sort, cursor, or filter params; FTS5 query smuggling if search ships; XSS in markdown, code blocks, Mermaid/KaTeX, provider names, model names, and filenames; template injection in titles or enhancement prompts. |
| SSRF | Provider base URL, Ollama URL, discovery endpoint, and import URL pointing at `127.0.0.1`, `169.254.169.254`, `[::1]`, `file://`, a redirect chain, or a non-HTTP scheme. Must be blocked and must not leak the response. |
| Resource exhaustion | A 2 GB attachment, 50k messages, a zip bomb `.onerouter` archive, `Content-Length` lies, no timeout, an infinite redirect loop, 10k provider models, `limit=100000`, and a stream that never ends. |
| Secrets | A key in any response body, log line, error string, or stack trace; settings dumpable unauthenticated; reset leaving an old key usable; master key or export passphrase exposed; provider key present in a plaintext export. |
| Rate limiting | 100 parallel logins; does lockout hold with a remote DB; can a spoofed `X-Forwarded-For` reset the counter; chat, title, and enhance cost abuse. |
| Crypto | Non-constant-time compare; reused IV; missing GCM tag check; password change not re-encrypting; salt not rewritten on reset; weak scrypt params; archive integrity not verified. |
| CSRF | Non-GET without `Origin`; `Origin: null`; a cross-site form post; `SameSite` missing in a production build. |
| Client DoS | A 100k-character message; a message of only combining marks; an RTL override; a markdown bomb; a huge code block; a Mermaid bomb; `line-clamp` bypass. |
| Cost abuse | Unauthenticated AI calls; a prompt that triggers unbounded context; a provider retry loop; a title or enhance loop. |
| Info leak | A stack trace in an API error; the data directory in a production error; the source URL of a disabled provider; the version string; the DB path. |
| Headers | CSP actually emitted; no `unsafe-inline`; no missing `nosniff`; authenticated JSON not cached; HSTS behind a proxy. |
| Supply chain | A new dependency with a postinstall script; an unpinned transitive; a lockfile change with no `package.json` change. |

Produce a numbered findings list: severity, what was broken, the exact
reproduction, and the smallest fix.

### Discuss and improve

Critical and high findings are fixed before the phase is committed, with a
reproducing test. Everything else is presented as a list, discussed, prioritised,
then implemented, with the decision recorded next to that phase's work. A finding
may be accepted as a known limitation with a written reason.

## Hard rules

- Never read real environment values from `.env` while implementing or debugging.
  No `cat .env`, no printing an env var, no dumping the process environment. Work
  from the documented variable names only; if a value is genuinely needed, ask for
  it instead of reading it.
- Never log API keys, the master key, session tokens, or export passphrases.
- Tests never touch the network. Recorded fixtures only.
- No file exists before the phase that needs it. No `utils/` dumping ground, no
  convenience barrel files; package public entrypoints are allowed only when
  declared in `package.json` exports. No interface with one implementation.
- A new dependency needs a one-line justification in the PR body: why the stdlib
  or an installed package could not do it. There is no `DECISIONS.md`.
- UI text is English and plain. No AI-pattern copy: no "unlock", "supercharge",
  "seamless", "elevate", "game-changing", no em-dash-heavy marketing voice, no
  emoji headings.
- The app (`apps/web`) must read as a Windows desktop app, not a webpage: no
  gradients or aurora backgrounds, no card grids, no fake window chrome, no serif
  display fonts, no multi-colour status dots, no web fonts. Use Segoe UI Variable,
  Segoe UI, or `system-ui`; use Cascadia Code, Consolas, or `ui-monospace` for
  code. The landing and docs may use a marketing layout, but their product
  previews and copy must match the app.
- Dashboard changes land with their landing counterpart. A change to the app
  shell, sidebar, header, composer, chat transcript, provider dashboard, settings,
  auth screens, or product copy is not complete until the matching landing preview
  and copy are updated in the same change set. The showcase must never describe an
  older dashboard.
- Comments explain why, never what.
- Never use the section-sign glyph (U+00A7) anywhere: docs, comments, UI text, or
  commit messages. Write `section 6.2`, `S9`, or `P4` instead.

## Commands

### Current (pre-monorepo)

- `pnpm dev` — dev server.
- `pnpm build` — production build; also typechecks via `next build`.
- `pnpm lint` — ESLint 9 flat config (`eslint.config.mjs`).
- `pnpm clean` — remove `.next` cache.
- No test framework and no typecheck-only script yet.

### Target (Phase 0+)

- `pnpm lint:changed`, `pnpm typecheck:changed`, `pnpm test:changed` — inner loop.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — full phase gate.
- `pnpm budget` — checks the NFR-15 to NFR-21 size, image, memory, and latency budgets.
- `pnpm audit` — all four severities.
- `pnpm audit:gate` — fails on high or critical.

## Current app (pre-monorepo)

- Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4.
- `app/page.tsx` is a thin orchestrator; state lives in hooks.
- Current persistence is `localStorage`: provider configs, API keys, chats, and the
  master key. This is being replaced by server-side encrypted libSQL/Turso.
- API keys are encrypted client-side with AES-GCM (`lib/crypto.ts`).
- `/api/chat` normalizes streaming from OpenAI, Anthropic, Gemini, and Ollama into
  SSE `data: { text: "..." }`.
- `/api/title` and `/api/enhance` use Gemini 2.0 Flash with heuristic fallback.
- `@tanstack/react-query` is created once in `app/providers.tsx` (staleTime 5 min,
  no refetch on focus). Add queries and mutations via `queryKey`.
- `@tanstack/react-virtual` v3.14.2: `measureElement` reads the `data-index`
  attribute via `indexFromElement`; without it all items map to `-1` and the
  built-in ResizeObserver never fires.
- Virtual-core `measureElement()` returns the cached size when called without a
  `ResizeObserverEntry`; the built-in RO provides the entry and reads the fresh
  size from `borderBoxSize`.

### Repo quirks

- Package manager is pnpm (v10.33.2). Never use npm or yarn.
- Tailwind CSS v4 is CSS-native via `app/globals.css`. Use `@theme` directives,
  not a JS config.
- ESLint uses flat config (`eslint.config.mjs`); a legacy `.eslintrc.json` also
  exists. Prefer the flat config.
- Path alias `@/*` maps to the project root (`tsconfig.json`).
- No Prettier config; code style is whatever ESLint enforces.
- No source file may exceed 500 lines. Extract components, hooks, or utilities.
- The current app still loads Inter and JetBrains Mono through `next/font/google`.
  The redesign must remove them and use the Windows system font stack.

### Current components

| File | Purpose |
|---|---|
| `app/page.tsx` | Main chat UI: thin orchestrator, virtualizer, composer sizing. |
| `components/sidebar.tsx` | Expandable chat list with search, pinning, theme toggle. |
| `components/sidebar-chat-item.tsx` | Single chat list item for pinned and recent sections. |
| `components/chat-message-item.tsx` | Message balloon: user/AI/edit states and actions. |
| `components/markdown-renderer.tsx` | Markdown parser for headings, lists, quotes, tables. |
| `components/markdown-math.tsx` | KaTeX math and Mermaid diagrams. |
| `components/markdown-code-block.tsx` | Code block with highlight, copy, download, collapse. |
| `components/model-selector.tsx` | Searchable model picker with favourites and recents. |
| `components/provider-dashboard.tsx` | Provider CRUD orchestrator. |
| `components/provider-dashboard/provider-form.tsx` | Add/edit provider form. |
| `components/provider-dashboard/provider-list.tsx` | Provider list with presets. |
| `components/header-bar.tsx` | Top nav: model selector and temp mode toggle. |
| `components/input-deck.tsx` | Attachments, textarea, enhance, submit/stop. |
| `components/greeting-view.tsx` | Empty-state branding and preset prompts. |
| `components/drag-overlay.tsx` | Drag-and-drop file overlay. |
| `components/floating-selection-toolbar.tsx` | Ask, quote, and copy bubble. |

### Current hooks

| File | Purpose |
|---|---|
| `hooks/use-chat-state.ts` | Providers, chats, active chat, theme, CRUD, initialization. |
| `hooks/use-file-upload.ts` | File processing, attachment buffer, drag and drop. |
| `hooks/use-streaming.ts` | Send, stop, and the SSE pipeline. |
| `hooks/use-enhance.ts` | Prompt enhancement preview and apply/discard. |
| `hooks/use-chat-editing.ts` | Inline edit, delete, export. |
| `hooks/use-text-selection.ts` | Selection state and copy. |
| `hooks/use-katex.ts` | Dynamic KaTeX CDN loader. |
| `hooks/use-mermaid.ts` | Dynamic Mermaid CDN loader. |

### Styling conventions

- `cn()` from `lib/utils.ts` (clsx plus tailwind-merge) for conditional classes.
- `tw-animate-css` provides animation utilities such as `animate-fade-in`.
- Thin custom scrollbar in `globals.css` for light and dark themes.
- AI balloons use `break-words`; the scroll container uses `overflow-x-hidden`.
- Target motion: 150 to 250 ms transitions, reduced-motion support, no layout
  shift during streaming.

## Target monorepo

```text
apps/
  web/       chat UI: Next.js static export
  site/      landing and /docs: Next.js plus Fumadocs, static
packages/
  core/      provider adapters, parsers, types, schemas
  db/        Drizzle schema, migrations, repositories, encryption
  server/    Hono: auth, data, files, /api, /v1
  ui/        shared design tokens and primitives
  cli/       published onerouter package; bins one-router and onerouter
docker/      Dockerfile and compose for v1; prebuilt image and installer are post-MVP
```

- Static UI export plus portable Hono backend. Do not ship Next.js standalone in
  the npm package.
- Turso/libSQL everywhere: SQLite file locally and on a VPS; Turso on Vercel.
- Single owner in v1, password-only login with scrypt and cookie sessions.
- Encrypted at rest. Local attachments are encrypted SQLite BLOBs; VPS uses an
  encrypted filesystem by default; Vercel requires S3-compatible storage.
- Uploads go through the server so encryption stays authoritative. No presigned
  direct uploads in v1.
- Gateway: `/v1/models` and `/v1/chat/completions` with `provider/model` IDs and
  aliases. Fallback chains are v1.1.
- Export is a portable encrypted `.onerouter` archive, not a raw SQLite dump.

## References

- `context/PRD.md` — product spec, v0.5.
- `.agents/skills/one-router/SKILL.md` — project skill index.
- `context/logo-concepts/` — approved Network O direction and earlier concepts.
