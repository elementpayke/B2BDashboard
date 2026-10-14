# Backend contract — Nuvion-backed local bank accounts

This consolidates the backend contract implied by 5 frontend-only PRs
(#185–#189) that shipped defensively ahead of any backend work, so the
Mboka backend team has one place to read everything the dashboard now
expects instead of digging through 5 PR descriptions. Mirrors the format
of `docs/api-contract.md` — read that first for the proxy/auth architecture
these endpoints sit behind.

**Status as of 2026-10-13:** [Mboka-Backend #274](https://github.com/elementpayHQ/Mboka-Backend/pull/274)
**merged** to `main` at 15:32 UTC today, implementing everything below —
`supported_accounts` on eligibility/bootstrap (§1), the new `DepositAccountOut`
identifier fields (§2), `country_code` on create (§3), the activity endpoint
(§4), and the sync endpoint (§5). The companion fix on
`elementpayHQ/element-pay-aggregator` is now up as
[#1114](https://github.com/elementpayHQ/element-pay-aggregator/pull/1114)
(not yet merged) to unblock the inbound Canada/Mexico field extraction
described in open question 4 below — not required for what's listed in
§1 today (GBP only; see that section). Every field and endpoint below was
additive and optional, so nothing in this merge is a breaking change for
the frontend.

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
- **Shipped in #274:** lives on the existing eligibility endpoint as drafted
  above, not a separate one (resolves open question 1). Today it declares
  exactly one rail — `app.services.deposit_accounts.supported_rails
  .SUPPORTED_LOCAL_RAILS` lists only
  `{ currency: "GBP", country_code: "GB", rail_type: "uk_local_bank",
  fields: ["account_number", "sort_code"], label: "UK local bank transfer" }`.
  That module's docstring is explicit about staying conservative: a rail is
  only added once there's in-code evidence of a working Nuvion
  deposit-instructions path for it, so Canada/Mexico/Ghana are deliberately
  not listed yet (see open question 4). This means live behavior today is
  USD + EUR (hardcoded fallback) + GBP (via `supported_accounts`) — not the
  full `CURRENCY_OPTIONS` list the Add Account picker renders.

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
- **Resolved (verified against the aggregator's actual code, not Nuvion's
  docs):** Mboka never receives a raw Nuvion webhook at all. Nuvion's
  `entities.*`/`accounts.*`/`account_details.*` events are consumed
  internally by the aggregator (`element-pay-aggregator`'s
  `app/routes/nuvion/nuvion_webhook_routes.py`), which re-emits only three
  coarse typed events to partners: `account.opened`, `account.ready`,
  `account.credited` (`_notify_partner_account` in
  `app/services/psp/nuvion/accounts.py`). Mboka's existing
  `webhook_inbox_worker.ENTITY_ACCOUNT_EVENT_TYPES` →
  `entities_ctrl.apply_webhook` pipeline already receives exactly these
  three. PR #274 wires the activity log into that real pipeline instead of
  a speculative raw-Nuvion stub. If finer-grained entries are wanted later
  (e.g. distinguishing "bank details issued" from "account opened"), that
  requires the aggregator to start emitting a new typed partner event —
  out of scope for Mboka alone, not attempted in #274.

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

1. ~~**Where does `supported_accounts` live?**~~ **Resolved** — extends the
   existing `GET /v1/iban/accounts/eligibility` endpoint, mirrored onto
   `GET /v1/bootstrap`, exactly as drafted in §1. Implemented in
   Mboka-Backend #274.
2. ~~**Exact current Nuvion webhook event list.**~~ **Resolved** — turned
   out doc verification was never the right tool for this; the aggregator's
   own code is. Nuvion's raw events never reach Mboka: the aggregator
   consumes them internally and re-emits only `account.opened`/
   `account.ready`/`account.credited` to partners. See §4 above for the
   exact file/function references. Implemented in Mboka-Backend #274.
3. ~~**Monthly maintenance fee amount has no Nuvion API source.**~~
   **Resolved, as a deliberate placeholder.** #274 adds
   `app.services.deposit_accounts.fee_config` as Mboka-side config, exactly
   as anticipated — but it ships with an **empty** lookup table and a
   docstring warning not to fill in a plausible-looking number without a
   real, signed-off figure from Finance/Commercial. Every currency currently
   returns `None` (no fee shown), so the fee-disclosure UI from PR #188
   stays dark until real numbers are handed over and added to that file.
4. ~~**Are field names consistent across local bank rails?**~~ **Resolved,
   no — they are not.** Confirmed in the aggregator's own outbound-payout
   code (`app/services/psp/nuvion/transfers/bank_payout.py`): Canadian
   EFT/Interac needs `bank_institution_number` (3 digits) +
   `transit_number` (5 digits) as a distinct pair, separate from US
   `routing_number` and UK-style `sort_code`. That's fine for the frontend
   either way, since its field-presence-driven label mapping (§2) already
   renders whichever fields are actually present — no per-country branching
   needed there regardless of the answer.
   The real blocker this surfaced: the aggregator's *inbound/partner-facing*
   path (as opposed to its outbound-payout path, which already knew about
   this) was collapsing `routing_number`/`sort_code` into one ambiguous
   `bank_code` and had no extraction at all for the Canadian pair or
   Mexico's `clabe` — so Mboka's new distinct columns had no live data
   source. Fix now up as
   [element-pay-aggregator#1114](https://github.com/elementpayHQ/element-pay-aggregator/pull/1114)
   (branch `feat/nuvion-bank-coords-extraction`, not yet merged), which
   extends `_coords_from_details`/`account_to_partner_dict` to expose
   `routing_number`, `sort_code`, `institution_number`, `transit_number`,
   and `clabe` as their own fields (keeping `bank_code` unchanged for
   existing consumers), plus a migration adding the matching nullable
   columns on `nuvion_accounts`. Mboka's schema in #274 needs no further
   change once that merges.
5. ~~**Will `country_code` on `DepositAccountCreateIn` actually be
   validated/used**~~ **Resolved, yes.** #274 adds ISO-3166-1 alpha-2
   validation (`_country_iso3166_alpha2`) and persists the value on the
   local `FinancialAccount` mirror; it's also forwarded to the aggregator
   open-account call. Whether the upstream Nuvion partner itself honors it
   is still unconfirmed — the backend only guarantees it round-trips through
   Mboka's own storage and response.
6. ~~**`/sync` reconciliation semantics against Mboka's "aggregator"
   layer.**~~ **Resolved.** There is no separate "aggregator layer" to diff
   against — the local `FinancialAccount` row *is* the cached mirror, and
   `sync_account` does a full-overwrite reconcile from a fresh live Nuvion
   read, the same merge path `create_or_refresh`/`list_accounts` already
   use. It also appends an `account_synced` activity entry (§4), but only
   when a reconciliation-relevant field (status, identifiers, balance)
   actually changed — not on every call.
