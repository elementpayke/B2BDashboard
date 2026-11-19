---
paths:
  - "lib/api/**"
  - "lib/services/**"
  - "lib/hooks/**"
  - "app/api/**"
  - "lib/server/**"
---
# Backend integration rules

- Browser code calls Mboka only through `mboka.*` (lib/api/mboka.ts) or the older `mbokaApi`/`apiEnvelope` (lib/apiClient.ts). Both go via the same-origin `/api/mboka/[...path]` proxy. Never fetch the backend URL directly and never touch tokens client-side.
- New endpoints: use the typed client. Paths/params/bodies come from `lib/api/generated/mboka.ts`; if an endpoint is missing, refresh the spec (`npm run api:spec` → `npm run api:gen`) rather than hand-writing types. Use `MbokaSchema<"Name">` for schema types.
- A new top-level backend prefix must be added to `MBOKA_PROXY_ALLOWED_PREFIXES` (lib/server/mbokaProxyAllowlist.ts) AND `ALLOWED_PREFIXES` in scripts/fetch-openapi.mjs — a test checks they agree. `webhooks` stays blocked.
- `data` typed `unknown` means the backend has no response_model: write a `normalize…` function in lib/services that validates and fails closed (return null / throw ApiRequestError), and note it in docs/api-contract.md.
- Query keys: `[QK.<root>, ...params]` from lib/api/queryKeys.ts. Add new roots there. After a mutation, invalidate every root whose data it changes (balances live under `QK.dashboardBootstrap`).
- Money-moving POSTs (quotes, accepts, sends, payouts, transfers) send an `Idempotency-Key` header, generated once per user intent and reused on retry.
- Errors: surface `ApiRequestError.message` (backend messages are user-safe); `SessionExpiredError` is handled globally — don't catch-and-ignore it.
- Polling: follow lib/hooks/useOrderStatus.ts (exponential backoff, stop on terminal status, invalidate on completion).
- Update docs/api-contract.md in the same change whenever an endpoint is wired or its semantics change.
- Route handlers in app/api: read cookies via lib/server/cookies.ts, check same-origin (lib/server/sameOrigin.ts) on mutations, and return the Mboka envelope shape `{status, message, data}`.
