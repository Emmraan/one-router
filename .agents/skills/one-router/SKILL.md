---
name: one-router
description: Project skill router for ONE ROUTER. Read at the start of every phase, feature, or fix. Selects the smallest relevant set of skills from emmraan/agent-skills and applies ONE ROUTER conventions. AGENTS.md always wins.
---

# ONE ROUTER skill router

This is an index, not an installed skill pack. It selects the few external skills
that fit the current task so the whole collection does not need to be installed.
Do not run `npx skills add` for the table below.

## Precedence

1. `AGENTS.md` in the repo root.
2. `context/PRD.md` for product behavior.
3. This file for skill selection.
4. The external skill's `SKILL.md`.

If an external skill conflicts with `AGENTS.md`, follow `AGENTS.md` and note the
conflict in the phase entry or PR body.

## How to load a skill

1. Read `AGENTS.md`.
2. Pick two to four skills from the tables below. More than four is usually noise.
3. Fetch the raw file:

```text
https://raw.githubusercontent.com/Emmraan/agent-skills/main/skills/<category>/<skill>/SKILL.md
```

4. Apply only the parts that fit ONE ROUTER. Ignore stack assumptions that do not
   apply, especially Server Actions, Postgres, OAuth, and presigned uploads.
5. Do not vendor or copy the external skill into this repo.

## Baseline for planned work

This is a menu, not a checklist. Start with the lifecycle skill and add only what
the task needs.

| Category | Skill | Load when |
|---|---|---|
| agent-meta | `loop-orchestrator` | Starting a planned phase or any multi-step task. |
| agent-meta | `planning-and-task-breakdown` | Turning a phase into ordered, verifiable tasks. |
| agent-meta | `incremental-implementation` | Writing code that touches more than one file. |
| testing-quality | `testing` | Designing the phase test strategy. |
| testing-quality | `test-master` | Writing or expanding test files. |
| testing-quality | `code-reviewer` | Before a phase merge or PR review. |
| testing-quality | `code-simplification` | Refactoring code that works but is too complex. |
| devops-cloud | `version-control` | Branch, commit, merge, and release work. |
| agent-meta | `sdlc-workflow` | Running a feature through the full lifecycle. |
| agent-meta | `forward-deployed-engineer` | Working in unfamiliar or existing code. |
| devops-cloud | `security-baseline` | Phase start or phase close security floor. |
| agent-meta | `technical-writer` | README, docs, guides, and release notes. |
| agent-meta | `using-agent-skills` | Starting a session and unsure which skill applies. |

## Task packs

### Architecture and migration

| Category | Skill | Load when |
|---|---|---|
| agent-meta | `architecture-designer` | Designing the monorepo, package boundaries, or data flow. |
| agent-meta | `legacy-modernizer` | Moving the single app into `apps/web` without behavior loss. |
| agent-meta | `repository-foundation-scaffold` | Phase 0 workspace, CI, and repo setup. |
| agent-meta | `fullstack-guardian` | Auth, encrypted data, and cross-layer security work. |
| agent-meta | `doubt-driven-development` | Crypto, auth, migrations, or other high-stakes decisions. |
| agent-meta | `open-source-project-maintainer` | Release policy, npm publishing, and OSS governance. |
| agent-meta | `cli-developer` | The `onerouter` CLI, flags, prompts, and cross-platform behavior. |

### Frontend and UI

| Category | Skill | Load when |
|---|---|---|
| frontend-ui | `nextjs` | App shell, static export, routing, and landing pages. |
| frontend-ui | `react` | Components, hooks, state, and rendering behavior. |
| frontend-ui | `typescript` | Types, generics, narrowing, and public package types. |
| frontend-ui | `tailwind-css` | Tailwind v4 tokens, variants, and CSS-first configuration. |
| frontend-ui | `frontend-core` | Frontend architecture, state, and API integration. |
| frontend-ui | `frontend-craft` | Visual quality and the Windows desktop feel. |
| frontend-ui | `frontend-performance` | Bundle size, rendering, and Core Web Vitals. |
| animation-webgl | `motion` | Streaming caret, list transitions, and reduced motion. |
| animation-webgl | `microinteractions` | Button, toggle, loading, and feedback details. |
| design-ux | `refactoring-ui` | Spacing, hierarchy, color, and depth audits. |
| design-ux | `ux-heuristics` | Forms, navigation, empty states, and usability reviews. |
| design-ux | `web-typography` | System font stack, type scale, and code typography. |

### Backend, data, and security

| Category | Skill | Load when |
|---|---|---|
| backend-apis | `backend-core` | Hono service structure, data flow, and infrastructure. |
| backend-apis | `backend-craft` | Production-grade handler and adapter implementation. |
| backend-apis | `api-design` | `/api` and `/v1` contracts, errors, and versioning. |
| backend-apis | `authentication` | Password login, sessions, cookies, and password reset. |
| backend-apis | `node` | Node APIs, streams, errors, and TypeScript runtime behavior. |
| backend-apis | `file-storage` | Attachment upload, storage adapters, and retrieval. |
| databases-data | `database-architecture` | Schema, migrations, indexes, and libSQL/Turso design. |
| databases-data | `database-performance` | Slow queries, pagination, and connection behavior. |
| databases-data | `sql-pro` | Complex SQL, joins, and query troubleshooting. |
| devops-cloud | `security-baseline` | Security floor at the start or review of a phase. |
| devops-cloud | `security` | Threat modeling, secrets, and supply-chain review. |
| devops-cloud | `secure-code-guardian` | Auth, input handling, CORS, CSP, and OWASP issues. |

### Testing and debugging

| Category | Skill | Load when |
|---|---|---|
| testing-quality | `browser-testing-with-devtools` | Real browser DOM, console, network, or visual checks. Requires the Chrome DevTools MCP. |
| testing-quality | `playwright-expert` | E2E tests, fixtures, visual regression, and flaky tests. |
| testing-quality | `debugging-wizard` | A failing test, stack trace, or unclear runtime behavior. |
| testing-quality | `change-friendly-code` | Refactoring for readability and safe change. |

### DevOps and release

| Category | Skill | Load when |
|---|---|---|
| devops-cloud | `devops` | Docker, VPS, CI/CD, environment, and operations. |
| devops-cloud | `github-actions-engineering` | Workflows, matrices, caching, and release jobs. |
| agent-meta | `open-source-project-maintainer` | semantic-release, npm, GitHub releases, and OSS files. |

### Docs and landing

| Category | Skill | Load when |
|---|---|---|
| agent-meta | `technical-writer` | README, `/docs`, quickstart, and troubleshooting. |
| agent-meta | `code-documenter` | API reference, OpenAPI, and code-level docs. |
| marketing-growth | `seo` | Landing metadata, sitemap, robots, and structured data. |
| marketing-growth | `one-page-marketing` | Landing narrative and conversion structure. |
| marketing-growth | `storybrand-messaging` | Hero copy, one-liner, and product messaging. |
| agent-meta | `markdown-for-agents` | Optional: Markdown mirrors and `/llms.txt` for the docs site. |
| design-ux | `web-typography` | Landing and docs type scale. |

### AI and prompts

| Category | Skill | Load when |
|---|---|---|
| agent-meta | `prompt-engineer` | Enhancement, title, and provider prompt behavior. |
| agent-meta | `mcp-developer` | Post-MVP only: custom MCP support. Do not load for v1. |

## Project overrides

These override the external skill whenever they disagree.

- **Next.js:** `apps/web` is a static export. Hono owns APIs, auth, files, and
  streaming. Do not introduce Server Actions, route handlers, or server components
  for app data. `apps/site` is static plus Fumadocs.
- **React:** client components, React 19, React Query. Keep the existing
  virtualization behavior and `data-index` contract.
- **Tailwind:** v4 CSS-native configuration in `globals.css`. Use `@theme`, not a
  JS config.
- **Database:** libSQL/Turso with Drizzle. No Postgres or Neon adapter in v1.
- **Auth:** single owner, password-only, scrypt, cookie sessions. No OAuth, SSO,
  teams, or 2FA in v1. `mustChangePassword` is enforced server-side.
- **Files:** server-side encrypted uploads. Local storage is encrypted SQLite
  BLOBs; VPS defaults to encrypted filesystem; Vercel requires S3-compatible
  storage. No presigned direct uploads in v1.
- **Export:** portable encrypted `.onerouter` archive, not a raw SQLite dump. API
  keys are included only inside the encrypted archive.
- **UI:** Windows desktop app, not a creative showcase. No gradients, aurora
  backgrounds, card grids, fake window chrome, serif display fonts, multi-colour
  status dots, or web fonts. Use Segoe UI Variable/Segoe UI/`system-ui` and
  Cascadia Code/Consolas/`ui-monospace`.
- **Motion:** 150 to 250 ms, reduced-motion support, stable layout during
  streaming.
- **Docs:** English only. README is minimal; detailed docs live at `/docs`.
- **Release:** semantic-release. Publish npm only when `NPM_TOKEN` exists;
  otherwise create the GitHub release only.
- **Branches:** follow `AGENTS.md`. Phase branches merge with `--no-ff` and are
  kept. Small docs and wording changes go directly to `main`.
- **Gates:** changed-file gates after edits; full gate once per phase and in CI.
  `pnpm audit` is pnpm's built-in command; `audit:gate` is the severity gate.

## Conflict examples

| External skill may suggest | ONE ROUTER does |
|---|---|
| Next.js Server Actions or server components for data | Static export plus Hono APIs. |
| Postgres, Neon, or Prisma defaults | libSQL/Turso plus Drizzle. |
| OAuth, SSO, or multi-tenant auth | Single owner password and cookie session. |
| Presigned S3 uploads | Server-side encrypted uploads. |
| Awwwards or cinematic frontend mode | Calm Windows desktop app. |
| Long, elaborate animation | 150 to 250 ms, reduced motion, no layout shift. |
| Install every skill in a category | Read this index; fetch two to four raw files. |

## Phase checklist

- Read `AGENTS.md` and this file.
- Pick two to four skills and fetch them.
- Write the phase tests first.
- Run `pnpm lint:changed`, `pnpm typecheck:changed`, and `pnpm test:changed` after
  each edit.
- Run the full gate before merge.
- Do the pen tester pass after green tests.
- Update the landing preview and copy for any UI change.
- Append the phase entry to `context/PROGRESS.md` before merge.
- Record deviations and accepted findings in that entry.
