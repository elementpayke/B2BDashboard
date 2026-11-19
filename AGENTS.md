<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Mboka B2B Dashboard

Business banking dashboard for **Mboka** (a product of ElementPay). Next.js 16 App Router + TanStack Query; all data comes from the Mboka FastAPI backend through our own BFF routes.

## Backend reference (Mboka-Backend)
Never guess a field, status or route — look it up, in this order:
1. **Local checkout** `../Mboka-Backend` (sibling folder) if it exists: routes in `app/`, Pydantic schemas, `app/docs/`, `docs/`.
2. **Docs in this repo**: `docs/api-contract.md` (wiring + semantics), `lib/api/openapi.json` / `lib/api/generated/mboka.ts` (spec snapshot), other `docs/*-contract.md`.
3. **GitHub** (private, use the authenticated `gh` CLI — plain web fetches won't work): https://github.com/elementpayHQ/Mboka-Backend (branch `main`)
   - one file: `gh api "repos/elementpayHQ/Mboka-Backend/contents/<path>?ref=main" --jq .content | base64 -d`
   - search: `gh search code --repo elementpayHQ/Mboka-Backend "<term>"`
   - broad reading: `gh repo clone elementpayHQ/Mboka-Backend <tmp-dir> -- --depth 1` into a temp/scratch dir (never inside this repo), then grep it.

Say which source you used. If the local checkout and GitHub `main` disagree, the local one may be on a feature branch — mention the difference rather than picking silently.

## Commands
- Everything CI runs: `npm run check` (tokens:check → typecheck → lint → test)
- One test file: `npx vitest run path/to/file.test.ts`
- Typecheck: `npm run typecheck` (loose root config + `tsconfig.strict.json` for new code)
- Lint: `npm run lint` — errors must be 0; warnings are legacy debt, don't add more
- Tokens: edit `design/tokens.json`, then `npm run tokens`
- API types: `npm run api:spec` (needs Mboka on :8000, or `-- --file spec.json`) then `npm run api:gen`
- Component catalogue: `npm run storybook` (http://localhost:6006)

## Where things go
- `design/tokens.json` — the ONLY place colours, type scale, radii, shadows are defined. `design/BRAND.md` for usage.
- `components/ui/` — primitives (Button, Field, Input, Dialog, Card, Badge, Amount, Skeleton, EmptyState). Reuse before building; check Storybook.
- `components/patterns/` — compositions of primitives (PageHeader, StatTile).
- `features/<domain>/` — new screens and their feature components (see `features/README.md`).
- `lib/api/` — typed Mboka client (`mboka.get("/v1/…")`), generated types, query keys (`QK`).
- `lib/services/` — normalize/present API data; fail closed. No raw wire types for new endpoints — use `MbokaSchema<"…">`.
- `app/api/` — BFF route handlers (auth cookies, `/api/mboka/[...path]` proxy). Tokens never reach the browser.

## Conventions
- New UI: Tailwind utilities from our token theme (`bg-primary`, `text-muted-foreground`, `rounded-2xl`, `text-body`, `desktop:`). Tailwind's default palette, type/radius/tracking scales and breakpoints are removed on purpose — names are listed in `.claude/rules/ui.md`. No hex/rgba, no static `style={{}}`, no arbitrary `[...]` colours/px — ESLint errors on these in new folders.
- Money is always `<Amount>`; status is always `<Badge>` (dot + label, never colour alone); forms always `<Field>`; modals always `<Dialog>`.
- Touch targets ≥ 44px. Every async view has loading (Skeleton), empty and error (EmptyState) states.
- Data: TanStack Query with keys from `QK` (lib/api/queryKeys.ts) — never string literals. Mutations that move money send an `Idempotency-Key`.
- Fail closed: if the API is unavailable show an error state — never mock data, never `0.00` for unknown balances (use `—`).
- When you wire or change an endpoint, update `docs/api-contract.md`.

## Gotchas
- `components/DashboardApp.tsx` (7k lines) and the `.ep-*` rules in `app/globals.css` are legacy. Work in them when needed, but don't copy their patterns (inline styles, hand-rolled modals, per-feature CSS namespaces) into new code.
- `components/mockData.ts` is fixtures for stories/tests only (it re-exports theme tokens for legacy wiring).
- Generated files (`lib/api/generated/`, `lib/api/openapi.json`, `lib/theme/tokens.generated.ts`, `app/tokens.generated.css`) are never hand-edited.
- Tailwind only scans the folders listed by `@source` in `app/globals.css`; add a folder there when you start using utilities in it.
- About 40% of Mboka endpoints lack a `response_model`, so their `data` type is `unknown` — normalize in lib/services, don't cast.
- UI copy says chain names, never "CCTP"/bridge jargon (see docs/api-contract.md).
