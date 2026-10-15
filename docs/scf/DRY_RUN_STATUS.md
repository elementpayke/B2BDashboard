# Tranche 2 dry-run status

Updated during implementation. Live UI dry-run on **dev-mboka** requires deploying Mboka Statements + B2B Refresh/Statements build first.

## Code / local verification (done)

| Step | Result |
|------|--------|
| `getBatch` + Refresh status UI | Implemented; unit tests pass |
| Confirm `tx_hash` → View onchain | Mapping covered in normalize + Mboka confirm merge |
| Statements list + PDF/CSV API | Routes registered: `/api/v1/statements`, download path; PDF unit test pass |
| Statements UI (Reports) | Replaces ComingSoon; filters + AVAILABLE/MTD + download menu |
| USDT Stellar Collect copy | “Converts to USDC via Aquarius”; EVM USDT unchanged |
| Sample destination wallets (testnet) | GAIZK4 / GDYZID / GB5W37 hold USDC (~9–10) |
| Ops liquidity panel | Do **not** claim in Telegram unless pairs load on env |

## Deploy checklist before live Part B

1. Deploy **Mboka** with statements router + confirm/getBatch paths already present.
2. Deploy **B2B** with Bulk refresh + Statements panel + fundCopy.
3. Aggregator env: `STELLAR_DISBURSEMENTS_ENABLED=true`, Collect swap on, USDT issuer set.
4. Run Part B from `TRANCHE2_VERIFICATION_GUIDE.md`.
5. Fill `TELEGRAM_UPDATE.md` placeholders → then post.

## Live Part B (pending deploy)

| Step | Status |
|------|--------|
| SDP create / refresh / onchain | Pending env with new B2B build |
| Statements PDF+CSV with batch lines | Pending Mboka deploy (`/api/v1/statements` 404 on current remote until ship) |
| Aquarius USDT→USDC | Pending live deposit on shared env |

## Automated checks run this session

- Mboka: `tests/unit/test_statements.py` + `test_statements_routes.py` — pass
- B2B: `stellarDisbursements` (incl. getBatch), `fundCopy`, `statements` — pass
- Testnet sample destinations still funded with USDC
- Local Mboka MySQL schema is behind model (`routing_number` missing) — do not use local DB for live statements until migrated; use deployed env

**Telegram gate:** keep `TELEGRAM_UPDATE.md` unsent until live Part B on shared env passes.
