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
| Transactions | `GET /v1/transactions`, `GET /v1/transactions/{id}`, `GET /v1/orders` | Filter chips cover all 6 backend statuses (processing/completed/failed/refunded/canceled/frozen). The tx detail modal fetches by id (`GET /v1/transactions/{id}`), not by list index/position — see Order status lifecycle below. The dedicated Transactions screen's status filter + Prev/Next pagination are server-side via `GET /v1/orders?status=&limit=&offset=` — see Transaction history pagination below for why. |
| Order status lifecycle | `GET /v1/orders/{merchant_order_id}` | Post-accept, `lib/hooks/useOrderStatus.ts` polls with exponential backoff (2s → 30s cap) until the order reaches a terminal status (`completed`/`failed`/`refunded`/`canceled`) or freezes (`frozen`, needs manual review — not terminal, see `app/services/orders/status.py` `_ALLOWED_TRANSITIONS`). On terminal, it invalidates `["transactions"]`, `["transactions-page"]`, `["transaction", id]`, and `["dashboard-summary"]` so the rest of the app reflects the settled order without a manual refresh. Wired into the tx detail modal and the send-modal success step. |
| Reports | derived from `dashboard summary` + `transactions` | Volume-by-day and success-rate are computed client-side from fetched transactions, not hardcoded. |
| Invoices | `POST /v1/invoices/drafts`, `POST /v1/invoices`, `GET /v1/invoices`, `POST /v1/invoices/{id}/mark-paid`, `GET /v1/invoices/{id}/public-link` | The dashboard's simple 2-field ("client" + "amount") modal composes a minimal `DraftPayloadIn` and calls create-draft → issue in sequence. |
| Verification | `GET /api/auth/me` → `kyb_summary.profile.kyb_status`; full KYB wizard via `GET/POST/PATCH /api/businesses/{id}/kyb/*` | Tier badges reflect real KYB status. The multi-step wizard (profile, address, UBO, document upload/submit, final submit) replaces the old simulated 3-button upload modal. Multipart uploads go through `/api/mboka/...` — tokens never reach the browser. Money CTAs (Send, Bulk, Top up) and IBAN account creation are gated until `kyb_status === "approved"`. |
| Developer / API keys | `POST/GET/PATCH/DELETE /api-keys/*`, `POST /api-keys/{id}/revoke`, `POST /api-keys/{id}/rotate` | Keeps the original three-row design (secret key / webhook URL / webhook signing secret). The list endpoint (`ApiKeyListOut`) omits `webhook_url`/`webhook_secret`, so each key's detail is fetched via `GET /api-keys/{id}` to fill those rows. Full plaintext key exists only in the create/rotate response — that key's row auto-reveals with working Reveal/Copy; for every other key those two buttons render in place but disabled, with a title explaining the key is only shown once. |
| Add Account → Bank Account | `POST /v1/iban/accounts` | Issues IBAN/bank deposit coordinates. Backend accepts **EUR and USD only**; the design's other 9 currencies render disabled rather than failing after a click. The **Account Name** field is collected but *not sent* — `DepositAccountCreateIn` has no name field and Pydantic would silently drop it, so it is deliberately omitted until the API adds one. Currently gated behind KYB approval. |
| Add Account → Stablecoin Account | `GET /v1/entities`, `POST /v1/entities/{id}/accounts` | Opens a partner FinancialAccount (`asset_type: stablecoin`). **USDC on Base/Polygon only** — USDT and Ethereum render disabled (same Phase 4 limits as Send). Uses the first linked entity; fails closed with a clear message when none exist. `display_name` is sent from the Account name field. |
| Wallets screen — currency account list | `GET /v1/iban/accounts/eligibility`, `GET /v1/iban/accounts`, `GET /v1/entities` → `GET /v1/entities/{id}/accounts` | Eligibility is checked first so an unverified business sees a "Verification required" banner instead of a raw 400 from the list call (`list_accounts` requires KYB/KYC approval — see `app/controllers/deposit_accounts.py`). The IBAN list call only runs once eligibility confirms `eligible: true`. Cards merge fiat IBAN accounts with partner USDC Base/Polygon accounts (including pending). **No balance field** on either source — cards never invent one (see Simulated table below). |
| Send money ("by country" tab) | `POST /v1/orders/quote`, `POST /v1/orders/{quote_id}/accept`, `GET /v1/supported/catalog` | OffRamp payout flow. See mapping notes below. |
| Send money ("Stablecoin" tab) | `GET /v1/entities`, `GET /v1/entities/{id}/accounts`, `POST /v1/accounts/{account_id}/sends/preview`, `POST /v1/accounts/{account_id}/sends` | Phase 4 account-native USDC send (Base/Polygon). Preview → confirm with **required** `Idempotency-Key`. Not Privy wallet transfer. See Account-send mapping notes below. |
| Deposit / Top up ("by country" tab) | `POST /v1/orders/quote` (`order_type: OnRamp`), `POST /v1/orders/{quote_id}/accept` | Fiat-in top-up to the business treasury wallet. Shows `payment_instructions` after accept (momo STK prompt or bank coordinates). Reuses `GET /v1/supported/catalog` for OnRamp provider `networkId`, `useOrderStatus` for post-accept polling, and `Idempotency-Key` on quote. See OnRamp mapping notes below. |
| Receive (fiat tab) | `GET /v1/iban/accounts` | Shows real IBAN/bank deposit coordinates from issued currency accounts (Track 3). No balances — coordinates only. |
| Receive (stablecoin tab) | `GET /v1/dashboard/summary` → `totals.wallet_address` | Shows the business treasury wallet address for on-chain deposits. Network/asset picker stays UI-only until a real multi-chain deposit endpoint exists. |

## Simulated (local only, no backend call)

| Area | Why |
|---|---|
| Wallets / **per-account balance number** and **"Main wallet" stablecoin balance** | **No real source exists.** `DepositAccountOut` (the list/create response) has no balance field — the aggregator's IBAN rail only ever returns deposit coordinates, not a live balance, and there's no stablecoin-wallet balance endpoint either. Account cards show currency, status, and masked IBAN/bank coordinates (or network for stablecoin) instead of a number; the "Main wallet" hero renders `—`. It previously showed a hardcoded per-currency mock balance (e.g. `$184,220.55`) and `USDC 180,860.00` — do not restore either until backed by a real source. |
| Home "Total balance" | **No real source exists.** It is a currency-accounts aggregate (individual accounts have no balance field either — see above), and `totals.user_balance` is an untyped Privy passthrough that reports `null` when Privy has no balance. Renders `—` rather than a number. It previously showed a hardcoded `$548,830.55`, which on a real empty account was indistinguishable from a true balance — do not restore a figure here until it is computed from a real source. The currency chip strip beneath it now lists real deposit-account currencies (from `GET /v1/iban/accounts`) and partner USDC networks with `—` in place of the old per-currency mock balances. |
| Deposit / Top up — **Stablecoin** tab | No standalone stablecoin deposit endpoint — the tab shows the treasury wallet from dashboard summary (same address OnRamp settles to) rather than faking a separate account. |
| Swap / Bulk-payout modals | Real on/off-ramp swap and bulk CSV payouts are each a bigger feature than this pass covers. **Send**, **Bulk**, and **Top up** entry points are KYB-gated like IBAN accounts until `kyb_status === "approved"`. |
| Team screen (+ invite modal) | **No backend at all.** `BusinessMembership` model exists with the right `role` enum, but there is no route/controller to list/invite/update/remove members. The original design renders in full against local mock data — invites/role changes/removals persist only in component state for the session. |
| Cards screen (+ card detail / fund / issue modals) | **No backend at all**, not even a data model. The original design renders in full against local mock data; all card actions are local-only. |
| Send money — **saved recipients** | **No Mboka beneficiaries API.** Dashboard-owned BFF: `GET/POST /api/saved-recipients`, `DELETE /api/saved-recipients/{id}`, file-backed under `.data/` for now. Contract: `docs/saved-recipients.md`. Wired in Send (save + pick from saved details). |

> ⚠️ Team and Cards render mock data behind an in-product **Preview** banner
> so demo balances, card numbers, and teammates are clearly marked as
> simulated. Wiring them to real backends is tracked in Gaps 1 and 2 below.

## Account-send mapping notes (`lib/services/accountSends.ts`)

- Uses Phase 4 partner accounts — **not** the Privy treasury wallet on
  dashboard summary. Source accounts come from `GET /v1/entities` →
  `GET /v1/entities/{id}/accounts`, filtered to ready `stablecoin` / `USDC`
  on **Base** or **Polygon** (`lib/services/entities.ts`).
- Create Account → Stablecoin opens the same surface via
  `POST /v1/entities/{id}/accounts` with
  `{ asset_type: "stablecoin", currency: "USDC", network: "Base"|"Polygon", display_name }`
  (`buildStablecoinOpenPayload` / `entitiesApi.openAccount`).
- Preview: `POST /v1/accounts/{account_id}/sends/preview` with
  `{ to_address, amount, network }`. `to_address` must be a 20-byte `0x`
  EVM address (ENS / `.eth` rejected). Min amount **1.00 USDC**.
- Confirm: `POST /v1/accounts/{account_id}/sends` with `{ preview_token }`
  and a required `Idempotency-Key` header (8–64 chars). The dashboard mints
  a fresh UUID per confirm attempt.
- USDT / Ethereum / Solana chips are intentionally not offered — the backend
  rejects them (`assert_stablecoin_account`).
- If no ready account exists for the chosen network, the Stablecoin tab
  fails closed with a clear message rather than simulating a send.

## OnRamp (deposit) mapping notes (`lib/services/orders.ts`)

- Always `order_type: "OnRamp"` (fiat in → crypto to the business treasury wallet).
- `local_amount` = the amount the user types in the deposit modal, in the corridor's fiat currency (not USD).
- `wallet_address` = `dashboard summary.totals.wallet_address` (same server-derived treasury wallet as Send's `refund_address`).
- `source.accountType`: `mobile` rail → `momo`, `bank` rail → `bank`. Same E.164 normalisation as OffRamp, applied to the payer's MoMo number only.
- `source.accountName` = the authenticated business's legal/display name from `GET /api/auth/me`.
- `source.networkId` comes from `GET /v1/supported/catalog` → `onramp.countries` (via `onRampProvidersForRail`) when the catalog has a match; omitted otherwise.
- After accept, `payment_instructions` is mapped to display rows via `buildPaymentInstructionRows()` — bank account/reference fields or momo "check your phone" UI, never raw JSON.
- Quote creation sends a fresh `Idempotency-Key` per attempt; accept reuses `quote_id` as the idempotency key (backend contract). Handles **401** (session refresh via proxy), **410** (re-quote), **409** (duplicate accept treated as success).

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

## Transaction history filters & pagination (`lib/services/transactions.ts`, `lib/hooks/useTransactionsPage.ts`)

`GET /v1/transactions` takes **no query parameters** — it always returns the
newest 50 rows for the authenticated business/user (`TransactionListOut` is
just `{items, total}`, no `limit`/`offset` echo, and the repository call
underneath hard-defaults to `limit=50, offset=0`). There is no way to move
past row 50 or filter server-side through that endpoint today.

`GET /v1/orders` is a **same-scope, same-underlying-row** view (both read
`merchant_orders`, filtered by the same `business_id`/`user_id` principal
rule) that *does* accept `status`, `limit` (≤200), and `offset`, and echoes
them back in `OrderListOut`. So the dedicated Transactions screen's status
filter chips and Prev/Next pagination are powered by
`ordersApi.list({status, limit, offset})`
(`lib/services/orders.ts`), with each `OrderOut` row mapped back into the
existing `Transaction` shape via `mapOrderToTransaction`
(`lib/services/transactions.ts`) — including deriving `direction` from
`order_type` (`OnRamp` → `in`, `OffRamp` → `out`), which mirrors the
backend's own projection (`app/domain/order_direction.py`) since `OrderOut`
has no `direction` field of its own. `OrderOut.id` is the same
`MerchantOrder.id` used by `GET /v1/transactions/{id}` and
`useOrderStatus`, so the tx detail modal and live-status polling work
unchanged against rows sourced from either endpoint.

Home's "Recent activity", the Wallets/Cards "recent transactions" widgets,
and Reports (see below) intentionally keep using the original unpaginated
`transactionsApi.list()` — they already only ever showed the fetched page's
worth of data, so leaving them as-is doesn't change what they report, it
just doesn't extend pagination to surfaces that were never asking for it.
Reports' "don't invent" rule (see below) is unaffected: it still only
computes from the newest 50 rows, exactly as it did before this pagination
work, never from a status-filtered `/v1/orders` page.

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
> create flow is fully wired end to end (create → list invalidation), gated on
> eligibility. Pure display mappers (masking, status labels, detail-row
> selection) live in `lib/services/depositAccounts.ts` with Vitest coverage.
> Home "Total balance" stays `—`; its currency chip strip lists real deposit-
> account currencies (also `—` per chip). `components/deposit/ReceiveModal.tsx`
> still uses the `ACCOUNTS` mock for fiat receive coordinates — out of this
> track's scope (see OnRamp deposit-quote track).

1. **Team backend**: add `GET/POST /api/businesses/{id}/members`,
   `POST .../members/invite`, `PATCH .../members/{user_id}`,
   `DELETE .../members/{user_id}` using the existing `BusinessMembership`
   model, then wire the Team screen for real.
2. **Cards**: no data model exists; would need a card-issuing integration
   (own scope, own review).
3. **KYB wizard**: ~~build the real multi-step business-verification form~~ **Done (Track 5)** — `components/verification/*` + `lib/services/kyb.ts` drive `POST/PATCH …/kyb/profile`, `PUT …/kyb/address`, `POST …/kyb/initiate`, multipart `POST …/kyb/documents`, `POST …/documents/submit`, `POST …/shareholders`, `POST …/shareholders/documents`, `POST …/kyb/submit`. Tier 3 institutional upgrade modal remains simulated.
4. **Send modal — Stablecoin tab**: ~~no backend endpoint for direct
   wallet-to-wallet transfers~~ **Done (Track 8)** — Phase 4
   `POST /v1/accounts/{id}/sends/preview` → confirm with required
   `Idempotency-Key` (`lib/services/accountSends.ts`). Opening partner
   FinancialAccounts is also wired: Add Account → Stablecoin calls
   `POST /v1/entities/{id}/accounts` (USDC on Base/Polygon) via
   `lib/services/entities.ts`.
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
7. **Saved recipients persistence**: dashboard BFF + Send UI exist
   (`docs/saved-recipients.md`); swap `.data/saved-recipients.json` for
   Postgres/KV before multi-instance production.
