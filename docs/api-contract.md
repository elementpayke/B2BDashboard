# API contract — ElementPay B2B Dashboard ↔ Mboka Backend

This tracks which dashboard screens/flows are wired to the real Mboka backend
(`../Mboka-Backend`) versus which are still local simulations, and why. Keep
this updated when the contract changes — mirrors the format of
`mobile-app/docs/loop/api-contract.md`.

## Architecture

Tokens never reach the browser. `POST /api/auth/login` (and `/api/auth/me`,
`refresh`, etc.) are handled by our own Next.js Route Handlers
(`app/api/auth/*`, `app/api/mboka/[...path]`), which store the backend's
access/refresh JWTs as `httpOnly` cookies and inject `Authorization: Bearer
<token>` server-side on every proxied call, refreshing once on a 401. The
proxy also follows the backend's trailing-slash redirects (FastAPI's
`redirect_slashes`, e.g. `POST /api-keys` → `307` → `/api-keys/`) with a
hand-rolled single retry rather than fetch's built-in auto-follow, since
undici detaches the request's `ArrayBuffer` body on an auto-followed
redirect retry (verified live against the API-key-create and invoice-create
flows during e2e testing — see `lib/server/mbokaProxy.ts` and its test for
the exact failure mode). See
`lib/server/mbokaProxy.ts`.

## Wired (real backend calls)

| Area | Endpoints | Notes |
|---|---|---|
| Auth | `POST /api/auth/{businesses/signup,businesses/login,verify-email,password/forgot,password/reset}`, `GET /api/auth/me`, `POST /api/auth/refresh` | Business (B2B) flows only. `/forgot-password` and `/reset-password` call the dashboard BFF routes. Reset email/code are handed off via tab `sessionStorage` (never left in the URL); if Mboka email links still arrive with `?email=&code=`, the reset page migrates them into sessionStorage and immediately strips the query. Access/refresh tokens remain httpOnly cookies. |
| Dashboard (Home) | `GET /v1/dashboard/summary` | Money in/out 30d, pending count. Total-balance hero number stays mock — see Gaps. |
| Transactions | `GET /v1/transactions`, `GET /v1/transactions/{id}` | Filter chips cover all 6 backend statuses (processing/completed/failed/refunded/canceled/frozen). The tx detail modal fetches by id (`GET /v1/transactions/{id}`), not by list index/position — see Order status lifecycle below. |
| Order status lifecycle | `GET /v1/orders/{merchant_order_id}` | Post-accept, `lib/hooks/useOrderStatus.ts` polls with exponential backoff (2s → 30s cap) until the order reaches a terminal status (`completed`/`failed`/`refunded`/`canceled`) or freezes (`frozen`, needs manual review — not terminal, see `app/services/orders/status.py` `_ALLOWED_TRANSITIONS`). On terminal, it invalidates `["transactions"]`, `["transaction", id]`, and `["dashboard-summary"]` so the rest of the app reflects the settled order without a manual refresh. Wired into the tx detail modal and the send-modal success step. |
| Reports | derived from `dashboard summary` + `transactions` | Volume-by-day and success-rate are computed client-side from fetched transactions, not hardcoded. |
| Invoices | `POST /v1/invoices/drafts`, `POST /v1/invoices`, `GET /v1/invoices`, `POST /v1/invoices/{id}/mark-paid`, `GET /v1/invoices/{id}/public-link` | The dashboard's simple 2-field ("client" + "amount") modal composes a minimal `DraftPayloadIn` and calls create-draft → issue in sequence. |
| Verification | `GET /api/auth/me` → `kyb_summary.profile.kyb_status` | Tier badges reflect real KYB status. The "upload documents" submission flow stays simulated — see Gaps. |
| Developer / API keys | `POST/GET/PATCH/DELETE /api-keys/*`, `POST /api-keys/{id}/revoke`, `POST /api-keys/{id}/rotate` | Keeps the original three-row design (secret key / webhook URL / webhook signing secret). The list endpoint (`ApiKeyListOut`) omits `webhook_url`/`webhook_secret`, so each key's detail is fetched via `GET /api-keys/{id}` to fill those rows. Full plaintext key exists only in the create/rotate response — that key's row auto-reveals with working Reveal/Copy; for every other key those two buttons render in place but disabled, with a title explaining the key is only shown once. |
| Add Account → Bank Account | `POST /v1/iban/accounts` | Issues IBAN/bank deposit coordinates. Backend accepts **EUR and USD only**; the design's other 9 currencies render disabled rather than failing after a click. The **Account Name** field is collected but *not sent* — `DepositAccountCreateIn` has no name field and Pydantic would silently drop it, so it is deliberately omitted until the API adds one. Currently gated behind KYB approval. |
| Wallets screen — currency account list | `GET /v1/iban/accounts/eligibility`, `GET /v1/iban/accounts` | Eligibility is checked first so an unverified business sees a "Verification required" banner instead of a raw 400 from the list call (`list_accounts` requires KYB/KYC approval — see `app/controllers/deposit_accounts.py`). The list call only runs once eligibility confirms `eligible: true`. Account cards show real `currency`/`status`/masked `iban`/`bank_name`/`bic` — `DepositAccountOut` has **no balance field**, so cards never show one (see Simulated table below). |
| Send money ("by country" tab) | `POST /v1/orders/quote`, `POST /v1/orders/{quote_id}/accept`, `GET /v1/supported/catalog` | OffRamp payout flow. See mapping notes below. |

## Simulated (local only, no backend call)

| Area | Why |
|---|---|
| Wallets / **per-account balance number** and **"Main wallet" stablecoin balance** | **No real source exists.** `DepositAccountOut` (the list/create response) has no balance field — the aggregator's IBAN rail only ever returns deposit coordinates, not a live balance, and there's no stablecoin-wallet balance endpoint either. Account cards show currency, status, and masked IBAN/bank coordinates instead of a number; the "Main wallet" hero renders `—`. It previously showed a hardcoded per-currency mock balance (e.g. `$184,220.55`) and `USDC 180,860.00` — do not restore either until backed by a real source. |
| Add Account → **Stablecoin Account** | **No backend concept.** There is no endpoint that issues a standalone stablecoin account — `DepositAccountCreateIn` exposes `crypto_currency`/`crypto_network` only as the payout side of a EUR/USD IBAN. The modal is built to the design and refuses on submit rather than faking success. |
| Home "Total balance" | **No real source exists.** It is a currency-accounts aggregate (individual accounts have no balance field either — see above), and `totals.user_balance` is an untyped Privy passthrough that reports `null` when Privy has no balance. Renders `—` rather than a number. It previously showed a hardcoded `$548,830.55`, which on a real empty account was indistinguishable from a true balance — do not restore a figure here until it is computed from a real source. The currency chip strip beneath it now lists real deposit-account currencies (from `GET /v1/iban/accounts`) with `—` in place of the old per-currency mock balances. |
| Deposit / Receive / Swap / Bulk-payout modals | Real money-in flows (deposit-account rails, on/off-ramp swap, bulk CSV payouts) are each a bigger feature than this pass covers; only Send (the core payout action) was wired for real. |
| Send money "Stablecoin" tab (direct on-chain transfer) | No backend endpoint exists for a direct wallet-to-wallet crypto send — only the fiat-rail order flow. |
| Verification "Upload documents" submit | The real KYB flow (`app/routes/kyb.py`) is a large multi-step wizard — business type, registered address, associates/UBOs, per-document upload/submit. The dashboard's existing 3-button modal doesn't match that shape; wiring it properly is its own task. |
| Team screen (+ invite modal) | **No backend at all.** `BusinessMembership` model exists with the right `role` enum, but there is no route/controller to list/invite/update/remove members. The original design renders in full against local mock data — invites/role changes/removals persist only in component state for the session. |
| Cards screen (+ card detail / fund / issue modals) | **No backend at all**, not even a data model. The original design renders in full against local mock data; all card actions are local-only. |

> ⚠️ Team and Cards render mock data behind an in-product **Preview** banner
> so demo balances, card numbers, and teammates are clearly marked as
> simulated. Wiring them to real backends is tracked in Gaps 1 and 2 below.

## Send-money mapping notes (`lib/services/orders.ts`)

- Always `order_type: "OffRamp"` (business wallet → recipient's fiat rail).
- `crypto_amount` = the amount the user types in the "Amount (USD)" field,
  treated 1:1 as USDC — a deliberate simplification, not a real FX quote
  until `POST /v1/orders/quote` returns one.
- `refund_address` = `dashboard summary.totals.wallet_address` (the
  business's custodial treasury wallet). **Server-derived** — the backend
  resolves it from the authenticated principal and the client never supplies
  it, since a caller-supplied refund address could redirect a failed payout.
  This field was missing from `GET /v1/dashboard/summary` until 2026-08-02,
  which made the Send flow fail closed on every attempt with "No treasury
  wallet is provisioned for this business yet".
- `destination.accountType`: `mobile` rail → `momo`, `bank` rail → `bank`.
  Any other rail type throws rather than guessing.
- `destination.accountNumber` is normalised to **E.164** for mobile rails via
  `toE164()`, using `COUNTRIES[].dialCode`. The corridor rejects local formats
  (`"Invalid phone number for this corridor", expected_dial_code: 254`), and
  the input's own placeholder is local (`0712 345 678`) — so before this every
  mobile-money payout failed. Bank account numbers are passed through
  untouched: they can legitimately start with `0`, and rewriting one would
  send money to a different account.
- `destination.networkId` (aggregator provider id) is now resolved from
  `GET /v1/supported/catalog` (`lib/services/catalog.ts`,
  `offRampProvidersForRail`/`networkIdForProvider`), for the country + rail
  type the user picked in the "by country" tab. When the catalog has a real,
  enabled provider list for that corridor
  (`data.offramp.countries[ISO]`, falling back to
  `data.international_bank.currencies[CCY]` for cross-border wire
  currencies like EUR/USD/GBP that aren't modeled as "countries" upstream),
  the send modal's provider chips render those real providers and the
  selected one's `id` is sent as `networkId`. When the catalog has no match
  yet for a corridor (not onboarded, still loading, or the aggregator is
  unreachable), the modal falls back to the existing hardcoded
  `COUNTRIES[].rails[].options` list and `networkId` is omitted, same as
  before — the aggregator then falls back to its own default provider for
  the rail. `refund_address` and mobile E.164 normalisation are unaffected.
- **410 quote expired** on `POST /orders/{quote_id}/accept`: the UI clears
  the stale quote, returns to the amount/recipient step, and shows "That
  quote expired. Press Review to get a fresh price, then try again." —
  pressing Review re-runs `POST /v1/orders/quote` with the same inputs
  rather than retrying `accept` on a dead `quote_id`
  (`isQuoteExpiredError` in `lib/services/orders.ts`).
- **409 already accepted** on `POST /orders/{quote_id}/accept` (e.g. a
  double-click): treated as a completed send rather than an error, since a
  duplicate accept means the order already exists
  (`isQuoteAlreadyAcceptedError`). The success screen falls back to its
  generic amount/recipient summary line since the 409 response doesn't
  carry the original accept payload.

## Order status lifecycle (`lib/hooks/useOrderStatus.ts`)

Backend docs (`ORDER_STATUS_WEBSOCKET.md`) recommend a WebSocket for live
order-status updates, but that socket authenticates via a raw JWT in the
query string (`?token=`). This app never puts a JWT in the browser — tokens
live in httpOnly cookies handled entirely by `lib/server/mbokaProxy.ts` — so
the socket is unreachable from client code without breaking that rule.
**Deliberately polling instead**, through the existing cookie-authenticated
proxy, with exponential backoff (2s → 30s cap) rather than a fixed interval.

`useOrderStatus(merchantOrderId)` polls `GET /v1/orders/{id}` and stops once
the order is terminal (`completed`/`failed`/`refunded`/`canceled`) or frozen
(needs manual review; not terminal — Mboka's own transition table allows a
frozen order to later resolve). On terminal it invalidates the transactions
list, that transaction's own detail query, and the dashboard summary.

## Gaps / follow-up tasks

> **Track 0 (UI extraction):** Send / Transactions / Wallets / Deposit modal
> UI was extracted from `DashboardApp.tsx` into domain modules under
> `components/{send,transactions,wallets,deposit}/` for parallel Mboka
> integration. Extraction-only — **no wiring change**.

> **Track 3 (Wallets / deposit accounts):** `components/wallets/**` now reads
> real deposit accounts (`GET /v1/iban/accounts/eligibility`, `GET /v1/iban/accounts`)
> instead of the `ACCOUNTS` mock, and the existing `POST /v1/iban/accounts`
> create flow is fully wired end to end (create → list invalidation). Pure
> display mappers (masking, status labels, detail-row selection) live in
> `lib/services/depositAccounts.ts` with Vitest coverage. `components/deposit/ReceiveModal.tsx`
> and the Home screen's "Total balance"/quick-actions still use the `ACCOUNTS`
> mock for fiat receive coordinates — out of this track's scope (see OnRamp
> deposit-quote and Home tracks).

1. **Team backend**: add `GET/POST /api/businesses/{id}/members`,
   `POST .../members/invite`, `PATCH .../members/{user_id}`,
   `DELETE .../members/{user_id}` using the existing `BusinessMembership`
   model, then wire the Team screen for real.
2. **Cards**: no data model exists; would need a card-issuing integration
   (own scope, own review).
3. **KYB wizard**: build the real multi-step business-verification form
   (`app/schema/kyb.py` is the source of truth for fields/enums) to replace
   the simulated "upload 3 documents" modal.
4. **Send modal — Stablecoin tab**: no backend endpoint for direct
   wallet-to-wallet transfers; stays simulated until one exists.
5. **Supported catalog**: ~~wire `GET /v1/supported/catalog` into the Send/
   Deposit modals' country+provider pickers instead of the hardcoded list,
   which would also unlock real `networkId` routing.~~ **Done for Send** —
   the "by country" tab's provider chips and `destination.networkId` are now
   catalog-driven (see mapping notes above), falling back to the hardcoded
   list for corridors the catalog doesn't cover. The **Deposit modal**'s
   country+provider pickers are still the hardcoded list — that flow is
   explicitly out of scope for this change (see `components/deposit/**`)
   and stays a follow-up.
6. **Dead code**: a few now-unreachable rendervals/handlers remain from the
   original all-mock prototype (e.g. `modalTitle`'s `cardDetail`/`newCard`/
   `fundCard` entries) — harmless, safe to prune in a follow-up pass.
