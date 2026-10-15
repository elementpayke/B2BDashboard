# SCF Tranche 2 — Independent verification guide

Use this to verify **SDP-style bulk USDC payouts** and **Aquarius Collect settlement** on ElementPay without a live call.

**Honesty note:** ElementPay uses an Aggregator **SDP-style** Horizon batch adapter (`StellarPaymentSdpAdapter`), not a self-hosted Stellar Disbursement Platform deployment. Aquarius means **Horizon path payments** tagged `venue: "aquarius"` (stable → USDC), not a live Aquarius HTTP trading API unless ops snapshots are populated.

## Prerequisites

| Item | Expectation |
|------|-------------|
| Dashboard | Demo / KYB-approved business on the shared env |
| Feature flags (Aggregator) | `STELLAR_DISBURSEMENTS_ENABLED=true`, `ELEMENT_STELLAR_COLLECT_SWAP_ENABLED=true`, Stellar USDT issuer set for testnet |
| Source wallet | Funded **Stellar USDC** home balance (≥ smoke total + fees) |
| Destinations | Trustlined / funded sample wallets (see CSVs below) |
| Sample CSV | [`docs/samples/sdp-bulk-payout-smoke-2-3-1.csv`](../samples/sdp-bulk-payout-smoke-2-3-1.csv) (2+3+1 USDC) or [`sdp-bulk-payout-sample.csv`](../samples/sdp-bulk-payout-sample.csv) |

Pre-check (testnet, Oct 2026): sample destinations `GAIZK4…`, `GDYZID…`, `GB5W37…` hold USDC with trustlines active.

## A. SDP-style bulk payout

1. Login → **Accounts** → open Stellar USDC → **Bulk payouts** (or Send money → Bulk).
2. Upload smoke CSV → **Review rows** → **Preview batch** → **Confirm**.
3. Note **batch id** on the result screen.
4. Click **Refresh status** until rows show `completed` / failed with **Why?**.
5. On a completed row, open **View onchain ↗** → stellar.expert testnet → confirm amount + destination.
6. Optional: deliberate bad destination → confirm **Why?** shows a plain-language trustline / account message.

## B. Reconcile records (Reports → Statements)

1. Open **Reports** (page title **Statements**).
2. Filters: pick the **Stellar USDC** account · year · month covering the batch (or leave All).
3. Confirm the period row shows **AVAILABLE** (and **MTD** if current month).
4. Download **PDF** and **CSV**.
5. Confirm lines include bulk payouts: description, amount, **batch id**, destination, **tx_hash**.

API (merchant):

- `GET /api/v1/statements` — period × account list
- `GET /api/v1/statements/{entity_id}/{account_id}/{YYYY-MM}?format=pdf|csv`

## C. Aquarius — Stellar USDT → USDC

1. Open Fund / Collect for **USDT on Stellar**. Copy should say **Converts to USDC via Aquarius**.
2. Send a small testnet USDT amount to the business Stellar deposit address.
3. Activity: converting → completed; **USDC** home balance increases.
4. Open explorer on the path/swap hash.
5. In **Statements** for that period, confirm the deposit (and/or swap credit) appears when indexed.

**Fallback:** if USDT liquidity is thin on testnet, use **EURC on Stellar** (same Aquarius path wording).

**Ops liquidity panel:** Developer → Stellar liquidity. If empty/error, **do not** treat it as Aquarius proof — settlement + explorer is sufficient.

## D. Pass / fail

| Check | Pass when |
|-------|-----------|
| Create batch | batch id returned |
| Refresh status | row statuses update; completed rows have `tx_hash` |
| View onchain | explorer matches payment |
| Statements | PDF+CSV contain disbursement rows for the batch |
| Aquarius | USDT (or EURC) → USDC with explorer path |

Record batch ids + 2–3 explorer URLs + Statements screenshot for the Telegram update.
