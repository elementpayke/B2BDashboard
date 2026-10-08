# What “Aquarius” means in ElementPay

## Short version

When a merchant deposits a supported **Stellar stable** (today: **USDT** or **EURC**) into Collect, ElementPay settles that credit into the business **USDC home** using a **Stellar Horizon path payment**. We tag that venue as **`aquarius`** because Aquarius is the Stellar DEX liquidity venue we route through for those pairs.

## What we claim

- Collect deposit → home credit → **path payment** to USDC when the inbound asset is not USDC.
- Ops can persist **liquidity snapshots** for pair visibility (`venue: aquarius`).
- Merchants see product copy: **“Converts to USDC via Aquarius.”** (Stellar USDT / EURC).

## What we do **not** claim

- We do **not** claim a live Aquarius HTTP market-data / trading API is the settlement engine.
- We do **not** claim every EVM USDT rail converts via Aquarius (EVM USDT copy stays “credits USDT” / CCTP as applicable).
- An empty Developer **Ops liquidity** panel is **not** failure of Collect settlement — prove Aquarius with a live deposit + explorer hash.

## How to verify

1. Fund Stellar USDT (or EURC) to the business deposit address.
2. Watch Activity → converting → completed; USDC balance up.
3. Open the path/swap transaction on stellar.expert (testnet or public as configured).
4. Optionally download the period **Statement** and confirm the credit line.

Code references (Aggregator):

- `element-pay-aggregator/app/services/chains/stellar/collect_autoswap.py`
- `element-pay-aggregator/app/services/chains/stellar/path_swap.py`
