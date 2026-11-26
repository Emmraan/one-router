# ONE ROUTER

A multi-provider AI chat client. The current app supports OpenAI, Anthropic, Gemini, and Ollama through one interface.

This repository is moving from a single Next.js app to a pnpm monorepo. Phase 0 moved the app to `apps/web` and added the shared gates. Later phases add the core, database, server, CLI, and landing site.

## Requirements

- Node.js 24 or newer
- pnpm 10.33.2

## Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the web app |
| `pnpm build` | Production build and build smoke check |
| `pnpm start` | Start the production server |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Typecheck the app and root scripts |
| `pnpm test` | Run the unit tests |
| `pnpm budget` | Check the NFR-15 JS and CSS budgets |
| `pnpm audit:gate` | Fail on high or critical dependency advisories |
| `pnpm lint:changed` | Lint only the changed targets |
| `pnpm typecheck:changed` | Typecheck only the changed targets |
| `pnpm test:changed` | Test only the changed targets |
| `pnpm clean` | Remove build and Turbo caches |

The full phase gate is:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm budget && pnpm audit:gate
```

## Layout

```text
apps/web/      Next.js chat app
scripts/       changed-target, budget, audit, build smoke, and CI helpers
context/       PRD, plan, and progress
.github/       CI workflows
```

## Current state

The app still stores providers, API keys, chats, and the master key in `localStorage`, and encrypts API keys in the browser with AES-GCM. Phase 4 moves application data to the server. The Next config keeps `output: 'standalone'` until the static export lands in Phase 4.

## Links

- [Agent guide](./AGENTS.md)
- [Plan](./context/PLAN.md)
- [Progress](./context/PROGRESS.md)
- [License](./LICENSE)
