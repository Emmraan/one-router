# ONE ROUTER — Multi-Provider AI Chat

A feature-rich, multi-provider AI chat client that supports OpenAI, Anthropic, Gemini, and Ollama — all in a single interface.

## Features

- **Multi-Provider**: Add and switch between OpenAI, Anthropic, Gemini, and Ollama providers
- **Streaming Responses**: Real-time SSE streaming from all providers
- **Markdown Rendering**: Rich markdown with syntax-highlighted code blocks, KaTeX math, and Mermaid diagrams
- **Chat History**: Persistent chat history with search and pinning (localStorage)
- **Inline Editing**: Edit, delete, and regenerate messages
- **Prompt Enhancement**: Use Gemini 2.0 Flash to enhance prompts before sending
- **File Attachments**: Drag-and-drop file upload support
- **Export**: Export assistant responses as markdown files
- **Quote & Ask**: Select text to quote, copy, or ask follow-up questions
- **Temporary Mode**: Chat without saving to history
- **Dark/Light Theme**: Toggle between dark and light modes
- **Virtualized List**: Smooth scrolling with `@tanstack/react-virtual` for large conversations

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/) (v10+)

## Getting Started

1. **Clone and install**
   ```bash
   git clone https://github.com/Emmraan/one-router.git
   cd one-router
   pnpm install
   ```

2. **Set up environment**
   Create `.env.local` in the project root:
   ```bash
   MASTER_KEY_LS_KEY=master-key
   ```
   The Gemini key is used for title generation and prompt enhancement. All other provider keys are configured in-app and encrypted in the browser.

3. **Run the development server**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build (includes typecheck) |
| `pnpm lint` | Run ESLint |
| `pnpm clean` | Remove `.next` cache |

## Architecture

- **Next.js 15** App Router (React 19)
- **Tailwind CSS v4** — CSS-native configuration via `@theme` directives
- **State**: Persisted in `localStorage` (chats, providers, API keys, master key)
- **API Keys**: Encrypted client-side with AES-GCM (`lib/crypto.ts`)
- **API Routes**:
  - `/api/chat` — Normalized streaming from all providers via SSE
  - `/api/title` — Auto-generate chat titles (Gemini 2.0 Flash or heuristic)
  - `/api/enhance` — Prompt enhancement (Gemini 2.0 Flash or heuristic)
- **500-Line Limit**: No source file exceeds 500 lines.
- **Query Client**: `@tanstack/react-query` with 5-minute staleTime, no refetch on focus.

## Project Structure

```
├── app/
│   ├── api/chat/       # Chat streaming endpoint
│   ├── api/enhance/    # Prompt enhancement endpoint
│   ├── api/title/      # Title generation endpoint
│   ├── globals.css     # Tailwind v4 theme and global styles
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Main chat page (orchestrator, <300 lines)
│   └── providers.tsx   # React Query provider setup
├── components/
│   ├── chat-message-item.tsx       # Message balloon component
│   ├── drag-overlay.tsx            # Drag-and-drop overlay
│   ├── floating-selection-toolbar.tsx # Text selection toolbar
│   ├── greeting-view.tsx           # Empty-state greeting
│   ├── header-bar.tsx              # Top navigation bar
│   ├── input-deck.tsx              # Input area with attachments
│   ├── markdown-code-block.tsx     # Code block with syntax highlight
│   ├── markdown-math.tsx           # KaTeX and Mermaid renderers
│   ├── markdown-renderer.tsx       # Rich markdown parser
│   ├── model-selector.tsx          # Searchable model picker
│   ├── provider-dashboard.tsx      # Provider CRUD panel (orchestrator)
│   ├── provider-dashboard/
│   │   ├── provider-form.tsx       # Add/edit provider form
│   │   └── provider-list.tsx       # Provider list with presets
│   ├── sidebar.tsx                 # Expandable chat list
│   └── sidebar-chat-item.tsx       # Single chat list item
├── hooks/
│   ├── use-chat-editing.ts   # Inline editing, deletion, export
│   ├── use-chat-state.ts     # Chat/provider state and CRUD
│   ├── use-enhance.ts        # Prompt enhancement flow
│   ├── use-file-upload.ts    # File processing and drag-n-drop
│   ├── use-katex.ts          # Dynamic KaTeX loader
│   ├── use-mermaid.ts        # Dynamic Mermaid loader
│   ├── use-streaming.ts      # SSE streaming pipeline
│   └── use-text-selection.ts # Text selection tracking
└── lib/
    ├── crypto.ts             # AES-GCM encryption
    ├── provider-types.ts     # TypeScript interfaces and defaults
    └── utils.ts              # cn() utility (clsx + tailwind-merge)
```

## License

MIT — see [LICENSE](./LICENSE).