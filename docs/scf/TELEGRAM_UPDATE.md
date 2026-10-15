# Telegram update — Ashley / SCF Pre-Launch #2 (draft)

> **Gate:** Paste only after Part B dry run on the shared env passes (batch + Refresh status + View onchain + Statements PDF/CSV + Aquarius USDT/EURC). Fill placeholders first.

---

Hi Ashley — quick update on Pre-Launch #2 (no formal resubmit; evidence here).

**1) SDP-style bulk payouts (working)**  
ElementPay runs an **SDP-style** Stellar USDC batch adapter (Horizon payments from the business VA) — not a self-hosted SDP stack. Reviewers can:

- Upload CSV → preview → confirm  
- **Refresh status** on the batch result  
- **View onchain** per completed row  
- **Reconcile** via **Reports → Statements** (period PDF + CSV including batch id, destination, tx hash)

Batch id: `{{BATCH_ID}}`  
Explorer: `{{EXPLORER_URL_1}}` · `{{EXPLORER_URL_2}}`  
Guide: `B2BDASHBOARD/docs/scf/TRANCHE2_VERIFICATION_GUIDE.md`  
Sample CSV: `B2BDASHBOARD/docs/samples/sdp-bulk-payout-smoke-2-3-1.csv`

**2) Aquarius clarified**  
Collect Stellar **USDT/EURC → USDC** uses Horizon path payments tagged Aquarius. Explainer: `TRANCHE2_AQUARIUS_EXPLAINER.md`.  
Live proof: `{{AQUARIUS_EXPLORER_URL}}` (USDT preferred; EURC fallback if testnet liquidity is thin).

**3) CCTP**  
Prior tranche evidence still stands; this update focuses on SDP + Aquarius gaps from the review notes.

Happy to walk through on a short call if useful — otherwise the guide is enough to re-run independently (credentials OOB).
