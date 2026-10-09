# What “Aquarius” means in ElementPay

## Short version

When a merchant deposits a supported **Stellar stable** (**USDT** or **EURC**) into Collect, ElementPay settles that credit into the business **USDC home** using the **Aquarius AMM**:

1. Quote via Aquarius Backend API `POST …/api/external/v2/find-path/`
2. Execute via Soroban AMM router `swap_chained` (mainnet / testnet router IDs from Aquarius docs)

If AMM returns no route, we may use a **gated Horizon SDEX** `path_payment_strict_send` only when that quote passes **rate-sanity** (~1:1 within configured bps). Horizon-only fills are labeled `horizon_sdex`, not Aquarius.

## Anti-stuck rule

Deposit instructions expose `collect.stellar_eurc` / `stellar_usdt` **addresses only when convertible**. A probe (AMM first, then optional Horizon) must quote a rate-sane path for the configured probe amount. Otherwise `convertible: false` and `address: null` — Top up hides the rail.

## What we claim

- Collect deposit → home credit → **Aquarius AMM swap** to USDC when the inbound asset is not USDC (primary).
- Horizon classic path payment only as a **rate-sane fallback**.
- Ops can persist **liquidity snapshots** from AMM find-path health (`venue: aquarius_amm`).
- Merchants see product copy: **“Converts to USDC via Aquarius.”** when the rail is offered.

## What we do **not** claim

- We do **not** treat every Horizon multi-hop as “Aquarius.”
- We do **not** claim every EVM USDT rail converts via Aquarius (EVM USDT copy stays “credits USDT” / CCTP as applicable).
- An empty Developer **Ops liquidity** panel with convertible Aquarius rails showing is a bug — probe should populate snapshots.
- **Testnet caveat:** Aquarius testnet pools use Aquarius test issuers, not Circle’s SDF testnet EURC. Circle EURC on SDF testnet may only clear via classic SDEX (or stay parked) until a Circle-EURC SAC pool exists on Aquarius testnet. **Mainnet Collect** uses Circle EURC/USDC SACs + Aquarius mainnet pools.

## How to verify

1. Confirm Top up shows Stellar EURC/USDT only when deposit-instructions report `convertible: true`.
2. Fund that address; watch Activity → converting → completed; USDC balance up.
3. Open the swap on stellar.expert — Soroban `swap_chained` for AMM, or classic path payment for fallback.
4. Optionally download the period **Statement** and confirm the credit line.

## Ops: already-received stuck balance

If funds arrived before the rail was gated (e.g. thin testnet book):

1. Seed classic EURC↔USDC near 1:1 **or** manually path-pay convert on the home G.
2. Confirm Horizon/AMM quote for the parked amount is rate-sane; home-credit tick retries.
3. Merchant sees `swap.updated` with `status: parked` + reason until cleared.

Code references (Aggregator):

- `element-pay-aggregator/app/services/chains/stellar/amm_api.py`
- `element-pay-aggregator/app/services/chains/stellar/collect_convertibility.py`
- `element-pay-aggregator/app/services/chains/stellar/swaps.py` (`AquariusPathSwapClient`)
- `element-pay-aggregator/app/services/chains/stellar/path_swap.py` (Horizon fallback)
- `element-pay-aggregator/app/services/chains/cctp/collect_enrich.py` (fail-closed rails)
