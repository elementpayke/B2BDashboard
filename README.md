# Mboka B2B Dashboard

Business banking dashboard for Mboka (by ElementPay): accounts, cards, payouts, collections, stablecoins, invoices and team/API management. Next.js 16 (App Router) + TanStack Query, backed by the Mboka FastAPI backend through same-origin BFF routes.

## Getting started

```bash
npm ci
echo "MBOKA_API_BASE_URL=http://localhost:8000" > .env.local   # Mboka backend (default shown)
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run check` | Everything CI runs: tokens:check, typecheck, lint, tests |
| `npm test` / `npx vitest run <file>` | Unit tests (Vitest, jsdom for components) |
| `npm run typecheck` | Root typecheck + strict typecheck for new code (`tsconfig.strict.json`) |
| `npm run lint` | ESLint (Next + design-system rules). 0 errors required |
| `npm run storybook` | Component catalogue on :6006 (also serves the Storybook MCP for agents) |
| `npm run tokens` | Regenerate theme outputs from `design/tokens.json` |
| `npm run api:spec` / `npm run api:gen` | Snapshot Mboka's OpenAPI spec / regenerate typed client types |

## Architecture

- **Design system** — `design/tokens.json` (single source of truth, DTCG format) → `app/tokens.generated.css` (CSS variables + Tailwind v4 theme) and `lib/theme/tokens.generated.ts`. Usage guide: `design/BRAND.md`. Primitives in `components/ui`, compositions in `components/patterns`, new screens in `features/`.
- **Routing** — `/dashboard/[[...screen]]` gives each top-level screen a URL (`/dashboard/transactions`); the dashboard shell (`components/DashboardApp.tsx`, legacy) keeps the URL in sync client-side.
- **Backend** — browser → `/api/mboka/*` (BFF proxy with httpOnly cookie auth, refresh, signing, allowlist) → Mboka. Typed calls via `lib/api/mboka.ts`; contract and wiring status in `docs/api-contract.md`.

## Working with Claude Code (and other agents)

`AGENTS.md` holds the project conventions every coding agent reads; `CLAUDE.md` imports it and adds Claude Code specifics. `.claude/` contains path-scoped rules, skills (`/new-ui`, `/wire-endpoint`, `/migrate-legacy-screen`, `/update-tokens`, `/brand-review`), a design-review subagent and hooks that lint every edit and typecheck before a turn ends. `.mcp.json` connects Storybook, Next.js devtools, Playwright and shadcn.
