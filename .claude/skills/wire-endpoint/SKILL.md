---
name: wire-endpoint
description: Wire a Mboka backend endpoint into the dashboard end-to-end — spec refresh, typed client call, normalizer, TanStack Query hook with QK keys, invalidation, tests and docs/api-contract.md. Use when connecting UI to a backend route or when a backend contract changed.
argument-hint: "[METHOD /v1/path or feature]"
---

Wire: $ARGUMENTS

1. **Read the contract at the source.** Find the route in `../Mboka-Backend/app` (grep the path) and its Pydantic in/out schemas. Note: auth requirements, status values, idempotency, error envelopes, and whether it has a `response_model`.
2. **Types.** Check `lib/api/generated/mboka.ts` has the path. If not (or it changed): `npm run api:spec` (Mboka on :8000) or export without a server:
   `(cd ../Mboka-Backend && myenv/bin/python -c "import json; from app.main import app; print(json.dumps(app.openapi()))") > /tmp/mboka-openapi.json && npm run api:spec -- --file /tmp/mboka-openapi.json`
   then `npm run api:gen`. New top-level prefix? update both allowlists (see `.claude/rules/api.md`).
3. **Service.** In `lib/services/<domain>.ts` call `mboka.<method>("/v1/…", { path, query, body, headers })`. If `data` is `unknown`, write `normalize<Thing>()` that validates required fields and fails closed. Money-moving POSTs get an `Idempotency-Key`.
4. **Query hook.** Add a `QK` root in `lib/api/queryKeys.ts` if needed; expose a `useX` hook or `queryOptions` in `lib/hooks/`. On mutations, invalidate every affected root (balances: `QK.dashboardBootstrap`; lists: `QK.transactions`, `QK.transactionsPage`).
5. **Tests.** Unit-test the normalizer (happy path, missing fields → fail closed, upstream error) and the hook/service with a stubbed `fetch` (see `lib/api/mboka.test.ts`).
6. **Docs.** Add/update the row in `docs/api-contract.md` (endpoints, gating, fail-closed behaviour).
7. **Verify:** `npx vitest run <tests>`, `npm run typecheck`, `npm run lint` — report the output.
