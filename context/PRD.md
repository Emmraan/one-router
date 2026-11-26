# ONE ROUTER — Product Requirements Document (PRD)

| Field | Value |
|---|---|
| Status | Template — MVP sections cleared; post-MVP backlog retained |
| Date | 2026-11-26 |
| Owner | Emmraan |
| Repo | `one-router` |
| Locked spec | `docs/prd-one-router` — `context/PRD.md` v0.7 |
| Active plan | `context/PLAN.md` — MVP phase plan |
| Post-MVP | Section 13 |

> The locked v0.7 specification is archived on the `docs/prd-one-router` branch.
> MVP implementation is defined by `context/PLAN.md`. The MVP headings below are
> kept as the template for the next round; Section 13 keeps the post-MVP backlog.

---

## 1. Summary

## 2. Problem & Motivation

## 3. Goals

## 4. Non-Goals (v1)

## 5. Target Users

## 6. Product Requirements

### 6.1 Monorepo & Tooling

### 6.2 npm Package & CLI

### 6.3 UX & Visual Redesign

### 6.4 Brand & Logo

### 6.5 Chat Web App (`apps/web`)

### 6.6 Authentication & Account

### 6.7 Persistence, Database & Encryption

### 6.8 File Attachments

### 6.9 Prompt Enhancement

### 6.10 Chat Rename & Titles

### 6.11 Temporary Chat

### 6.12 Bug Fixes & Regression

### 6.13 API Server (`packages/server`)

### 6.14 Shared Core (`packages/core`)

### 6.15 Landing Page & Docs (`apps/site`)

### 6.16 Configuration & Security

### 6.17 Deployment

### 6.18 Quality & Developer Experience

### 6.19 Verification & CI

## 7. Non-Functional Requirements

## 8. Architecture Overview

## 9. Deployment Matrix

## 10. Constraints & Conventions

## 11. Decision Log

## 12. Decisions & Open Questions

### 12.1 Resolved in v0.4

### 12.2 Resolved in v0.5

### 12.3 Open Questions

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

## 15. Success Criteria

## 16. Next Step
