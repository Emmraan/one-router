# ONE ROUTER — Agent Guide

## Commands
- `pnpm dev` — dev server
- `pnpm build` — production build (also runs typecheck via next build; no separate `typecheck` script)
- `pnpm lint` — ESLint 9 flat config (`eslint.config.mjs`)
- `pnpm clean` — remove `.next` cache
- No test framework is configured. No typecheck-only script exists.

## Repo quirks
- **Package manager is pnpm** (v10.33.2). Never use npm/yarn.
- **Tailwind CSS v4** — no `tailwind.config.*`. Configuration is CSS-native via `app/globals.css`. Use `@theme` directives for custom values, not `extend` in JS.
- **ESLint** uses flat config (`eslint.config.mjs`), but a legacy `.eslintrc.json` also exists referencing `"extends": "next"`. Prefer the flat config.
- **Path alias** `@/*` maps to project root (`tsconfig.json` paths).
- **No Prettier config** — code style is whatever ESLint enforces.

## Architecture
- Next.js 15 App Router (React 19). `app/page.tsx` (~1319 lines) is the single-page chat client.
- State persisted in `localStorage` (provider configs, API keys, chats, master key).
- API keys are encrypted client-side with AES-GCM (`lib/crypto.ts`) using a master key stored under `onerouter_master_key` in localStorage.
- `/api/chat` normalizes streaming from OpenAI/Anthropic/Gemini/Ollama into SSE `data: { text: "..." }`.
- `/api/title`, `/api/enhance` use Gemini 2.0 Flash (fall back to heuristic if no `GEMINI_API_KEY`).
- `@tanstack/react-query` client is created once in `app/providers.tsx` (staleTime 5 min, no refetch on focus). Add queries/mutations via `queryKey` — no global cache config needed.

## Critical Context
- `@tanstack/react-virtual` v3.14.2 — `measureElement` reads `data-index` attribute via `indexFromElement`; without it all items map to `-1`, built-in ResizeObserver never fires
- Virtual-core `measureElement()` returns cached size when called without `ResizeObserverEntry`; the built-in RO provides the entry and reads fresh size from `borderBoxSize`

## Components
| File | Purpose |
|------|---------|
| `app/page.tsx` | Main chat UI, virtualizer, input area, multi-provider orchestration, file uploads |
| `components/sidebar.tsx` | Expandable chat list with search, pinning, theme toggle |
| `components/chat-message-item.tsx` | Message balloon: user/AI/edit states, action buttons (copy/quote/regenerate/export/delete) |
| `components/markdown-renderer.tsx` | Rich markdown: code highlight, KaTeX, Mermaid, tables, collapsible code blocks |
| `components/model-selector.tsx` | Searchable model picker with favourites, recents, grouped by provider |
| `components/provider-dashboard.tsx` | CRUD panel for managing provider endpoints, API keys, models |

## Styling conventions
- `cn()` utility from `lib/utils.ts` (clsx + tailwind-merge) for conditional classes.
- `tw-animate-css` provides animation utilities (e.g., `animate-fade-in`).
- Thin custom scrollbar via global CSS in `globals.css` (both light/dark).
- AI message balloons use `break-words`; scroll container uses `overflow-x-hidden` to prevent X scroll on narrow windows.

## Relevant Files
| File | Purpose |
|------|---------|
| `components/chat-message-item.tsx` | Message balloon rendering, edit state, action buttons, `data-index`, role-based padding, overflow prevention |
| `app/page.tsx` | Virtualizer setup, input textarea auto-resize, upload dropdown, container height |
| `components/sidebar.tsx` | Chat history lists with `overflow-x-hidden` |
| `components/markdown-renderer.tsx` | AI response content rendering (overflow handled by parent balloon) |
