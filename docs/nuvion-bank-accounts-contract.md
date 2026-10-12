# Backend contract — Nuvion-backed local bank accounts

This consolidates the backend contract implied by 5 frontend-only PRs
(#185–#189) that shipped defensively ahead of any backend work, so the
Mboka backend team has one place to read everything the dashboard now
expects instead of digging through 5 PR descriptions. Mirrors the format
of `docs/api-contract.md` — read that first for the proxy/auth architecture
these endpoints sit behind.

**Nothing here is built on the backend yet.** Every field and endpoint
below is additive and optional: today's backend (USD/EUR only, no fee,
no activity log, no sync) continues to work unchanged, since the frontend
falls back to current behavior whenever a new field/endpoint is absent.
There is no forced migration timeline — ship pieces in any order.

| PR | Branch | What it added |
|---|---|---|
| [#185](https://github.com/elementpayke/B2BDashboard/pull/185) | `feat/bank-accounts-eligibility-driven` | Backend-driven currency/rail list on eligibility; new local-rail identifier fields + monthly fee field on `DepositAccountOut`; `country_code` on create |
| [#186](https://github.com/elementpayke/B2BDashboard/pull/186) | `test/settlement-visibility-rail-agnostic` | Regression tests only — no new contract (see below) |
| [#187](https://github.com/elementpayke/B2BDashboard/pull/187) | `feat/account-activity-audit-trail` | New `GET /v1/iban/accounts/{id}/activity` endpoint |
| [#188](https://github.com/elementpayke/B2BDashboard/pull/188) | `feat/monthly-maintenance-fee-disclosure` | Frontend-only; consumes #185's fee field, no new contract |
| [#189](https://github.com/elementpayke/B2BDashboard/pull/189) | `feat/account-refresh-sync-button` | New `POST /v1/iban/accounts/{id}/sync` endpoint |

## 1. Eligibility-driven currency/rail list (`GET /v1/iban/accounts/eligibility`)

Today's response is `{ eligible: boolean, verification_status: string }`.
PR #185 adds an optional `supported_accounts` array (also mirrored onto
`GET /v1/bootstrap`'s eligibility block, since that's the primary path the
dashboard's Add Account picker and wallet list read from):

```ts
supported_accounts?: Array<{
  currency: string;
  country_code?: string | null;
  rail_type: string;
  fields: string[];
  label?: string | null;
  monthly_maintenance_fee?: { amount: string; currency: string } | null;
}>
```

- When absent or empty, the frontend falls back to the hardcoded
  `SUPPORTED_IBAN_CURRENCIES = ["USD", "EUR"]` gate on the Add Account
  currency picker — today's exact behavior, unchanged.
- When present, each entry's `currency` becomes an available option in the
  Add Account picker (`currencyOptionsFor()` renders a currency with no
  local display metadata using its raw code as the label, so a brand-new
  currency doesn't need a frontend code change to appear).
- `fields` is part of the declared shape but the frontend does **not**
  currently branch on it — the account-detail rendering is driven by which
  fields are actually present on the returned `DepositAccountOut` (see §2),
  not by this descriptor's `fields` list. Backend can populate it for other
  future consumers, but the dashboard doesn't require it to be accurate
  today.
- `monthly_maintenance_fee` here is what drives the Add Account modal's
  fee disclosure + required checkbox (PR #188) — see §2 for the shape and
  §4 (open question 3) for why this can't be sourced live from Nuvion.
- See §5 (open question 1) for whether this belongs on this endpoint at
  all versus a dedicated one.

## 2. New fields on `DepositAccountOut` (bank account detail/list shape)

PR #185 extends the account shape returned by `GET /v1/iban/accounts`,
`POST /v1/iban/accounts`, and (per §3) `POST .../sync`:

```ts
{
  // existing fields unchanged: iban, bic, routing_number, bank_name,
  // bank_address, account_holder_name, reference, destination_wallet,
  // currency, status, balance, ...

  account_number?: string | null;       // generic local account number (UK, Canada, Ghana, ...)
  sort_code?: string | null;            // UK local bank rail
  institution_number?: string | null;   // Canada — always paired with transit_number
  transit_number?: string | null;       // Canada
  bank_code?: string | null;            // Ghana and similar local bank rails
  clabe?: string | null;                // Mexico

  monthly_maintenance_fee?: { amount: string; currency: string } | null;
}
```

- The frontend's detail-view rendering is **field-presence-driven**, not
  currency-driven: whichever of these fields the backend populates on a
  given account is what renders, in the fixed order above (see
  `IDENTIFIER_FIELDS` in `lib/services/depositAccounts.ts`). No frontend
  change is needed to support a new rail that reuses these field names —
  only to add a genuinely new field name.
- The one currency-specific exception that remains: an account carrying
  **both** `iban` (used generically as "account number" for USD) and
  `routing_number` gets a two-section "Domestic transfer (ACH/wire)" /
  "International wire (SWIFT)" breakdown instead of one flat list, because
  a US-style account genuinely needs two different identifiers depending
  on which rail the sender uses. Every other field combination renders as
  a single "Bank details" section.
- `monthly_maintenance_fee` here is a persistent row ("Monthly fee") on the
  account detail view, independent of whether the disclosure in §1 fired at
  creation time — if the backend ever changes a fee after account creation,
  this field is what keeps the detail view honest.
- See §5 (open question 4) on whether field names are actually generic
  across rails/countries or need per-country variants.

## 3. `country_code` on `DepositAccountCreateIn` (`POST /v1/iban/accounts`)

```ts
{
  currency: string;
  wallet_address?: string;
  country_code?: string;   // new, optional
}
```

Only sent when the selected currency's eligibility descriptor (§1) declares
a `country_code` — most currencies map to exactly one country and the
frontend omits the field entirely in that case. See §5 (open question 5):
today's backend silently drops unknown keys via Pydantic (the same reason
`accountName` is never sent, despite being collected in the UI) — this doc
does not assume `country_code` will be read without backend confirmation.

## 4. Account activity audit trail (`GET /v1/iban/accounts/{id}/activity`) — PR #187

New endpoint, does not exist yet:

```ts
GET /v1/iban/accounts/{id}/activity?limit=&offset=

→ {
  entries: Array<{
    event_type: string;   // Mboka's own stable identifier — never a raw Nuvion event name
    label: string;         // white-labeled, human-readable, e.g. "Bank details issued"
    occurred_at: string;   // ISO timestamp
    detail?: string | null;
  }>;
  total: number;
}
```

- Pagination is offset/limit, matching this codebase's existing convention
  (`GET /v1/orders?limit=&offset=`) rather than cursor-based.
- `label` **must** already be white-labeled and human-readable — the
  dashboard will render it verbatim and must never show a raw Nuvion event
  name to a customer.
- Per this repo's existing webhook-handling boundary (`app/api/mboka/[...path]/route.ts`
  blocks `webhooks/*` from ever being proxied to the browser), this
  dashboard never receives or verifies a Nuvion webhook itself. The
  expectation is that Mboka's backend ingests Nuvion's account webhooks
  server-side, translates each into a white-labeled entry, and this
  endpoint is purely a read of that resulting log.
- Frontend behavior when this endpoint 404s or errors: the "Activity"
  section on the account detail modal renders nothing (no error banner) —
  this is treated as a pure enhancement, not a required feature. Backend
  can ship it whenever ready with no frontend coordination needed.
- See §5 (open question 2) on the exact Nuvion webhook event list backing
  this (`entities.*`, `accounts.*`, `account_details.*`) — needs direct
  verification against Nuvion's current docs before implementation.

## 5. Account refresh/sync (`POST /v1/iban/accounts/{id}/sync`) — PR #189

New endpoint, does not exist yet:

```ts
POST /v1/iban/accounts/{id}/sync

→ DepositAccountOut   // same shape as GET /v1/iban/accounts, refreshed
```

- Scoped to a single account per call — not a bulk/all-accounts sync.
- Frontend expectation: this queries Nuvion live for the account's current
  state and reconciles whatever Mboka/the aggregator has stored if it's
  stale, then returns the refreshed `DepositAccountOut`. The dashboard
  invalidates its account-list/detail queries on success so the refreshed
  fields (including any new §2 identifier fields) appear immediately.
- The frontend has no visibility into Mboka's internal "aggregator" data
  layer or its reconciliation semantics — see §6 (open question 6), this
  needs the owning backend team to fill in the actual behavior.
- Nuvion's own API has no dedicated refresh/webhook-trigger endpoint, but
  `GET /accounts/{id}` on their side returns live state on every call, so
  the assumption going in is that this is "call Nuvion fresh, diff against
  the stored copy, update if changed" — not a new capability Nuvion itself
  needs to expose.

## 6. Settlement visibility — no new contract (PR #186)

PR #186 is verification-only: it added regression tests proving the
existing `TxDetailModal.tsx` settlement-status badge and "Bank reference"
row (driven by `payment.account_kind` / `method_type`) are already
currency-agnostic, using a synthetic KES (non-USD/EUR) bank-rail
transaction. **No production code or contract changed.** This is included
here only so the backend team knows that transaction-level settlement
display for new local-rail currencies needs no frontend follow-up — it
already works once orders for those currencies exist.

## Open questions for backend team

These need a backend-team decision before implementation — pulled directly
from the 5 PR descriptions:

1. **Where does `supported_accounts` live?** Should it extend the existing
   `GET /v1/iban/accounts/eligibility` endpoint (as drafted in §1), or does
   it make more sense as a separate endpoint?
2. **Exact current Nuvion webhook event list.** Two `docs.nuvion.co` fetches
   during planning returned slightly different account-event names (one
   surfaced `accounts.updated`/`accounts.deleted` that the other didn't
   list). This needs direct verification against
   `docs.nuvion.co/webhooks/event-types` before implementing §4 — don't
   trust this document's `entities.*`/`accounts.*`/`account_details.*`
   wildcards as exhaustive or current.
3. **Monthly maintenance fee amount has no Nuvion API source.** Checked
   against Nuvion's full documented API surface — there is no fee/pricing
   endpoint anywhere; the only fee-related field on their Account object is
   a boolean `maintenance_fee_opted_out`, with no amount, currency, or
   schedule. Backend will need to source real fee figures from Mboka's
   commercial/contract terms with Nuvion and maintain them as **Mboka-side
   config** — this cannot be a live Nuvion API call.
4. **Are field names consistent across local bank rails?** Does Nuvion
   return one generic `account_number`/`bank_code` pair for every country,
   or does each country need its own field names? This determines whether
   the frontend's field-presence-driven label mapping (§2) can stay generic
   or needs per-country handling added later.
5. **Will `country_code` on `DepositAccountCreateIn` actually be
   validated/used**, or will it be silently dropped the way the existing
   `accountName` field already is (Pydantic drops unknown keys)? The
   frontend sends it (§3) on the assumption it'll eventually be read.
6. **`/sync` reconciliation semantics against Mboka's "aggregator" layer.**
   This repo has no visibility into that backend concept — the owning
   backend team needs to specify what "sync" actually does to the stored
   copy (full overwrite? diff-and-patch? conflict handling if Nuvion and
   the aggregator disagree?) before §5 can be implemented confidently.
