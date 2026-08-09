# B2B Dashboard ↔ Mobile UX parity plan

Design source: `/home/joe/kazi/company/ELEMENTPAY/mobile-app` (Expo neobank).  
Target: this B2B dashboard.

Audits (2026-08-08): Shell+Home · Money flows · Auth+secondary.

## Product constraints (do not violate)

- **Visual match ≠ product clone.** Mobile = individual KYC + Virtual IBAN consumer app; dashboard = business KYB + treasury/team/API.
- **No fake balances.** Keep `—` until a real balance source exists (`docs/api-contract.md`).
- **Keep live wiring:** auth BFF cookies, deposit accounts, entities/stablecoin, send (OffRamp + account-sends), OnRamp deposit, transactions pagination, KYB wizard, API keys.
- **Cards / Team / Tier 3** stay Preview-gated. Do not copy mobile’s non-functional social login buttons.

## Design DNA to adopt

| Token | Mobile | Dashboard today | Target |
|-------|--------|-----------------|--------|
| Brand | `#4f2ce0` → `#83007c` | `#3B2ED3` indigo | Align to `#4f2ce0` family |
| Canvas | Dark `#0a0a0a` (night-first) | Light cream `#F6F4EF` | Mobile tokens; **default Day for B2B desktop**, Night available |
| Type | Geist + Geist Mono (amounts) | Space Grotesk / DM Sans | Adopt Geist (+ Mono for money/IBAN) |
| Radii | 4→32 + pill | Mixed 12–24 | Match mobile scale |

## Consolidated findings

| Area | Verdict |
|------|---------|
| **Shell / Home** | Largest visual gap: brand hexes, fonts, tab shell (mobile Pay FAB vs dashboard Send/More), home hero (mobile brand gradient + IBAN card vs flat balance strip). API summary/activity already wired. |
| **Money** | APIs largely in place. Gap is wizard depth: amount heroes, transit success, receive method/QR chooser, wallets/activity chrome—prefer step shells over dense 3-step modals. |
| **Auth / secondary** | Auth jobs map; chrome uneven (login polished, signup/verify thinner). Verification is KYB not KYC. Profile/settings weak on web. Cards/Team Preview-mock only; Developer real. |

## PR-sized track order

### Wave 0 — Foundation
1. **T1 Design tokens + type** — Remap CSS vars / `LIGHT`/`DARK` in `components/mockData.ts` + `app/globals.css`; load Geist in `app/layout.tsx`.

### Wave 1 — Shell + Home
2. **T2 Shell nav** — Compact bottom tabs (Home / Wallets / elevated Pay / Activity / Profile|More); Lucide; soften FAB; sidebar labels.
3. **T4 Home hero** — Brand hero gradient, in-hero CTAs, pending/money pills; **still no invented balance**.
4. **T5 Home body** — Section headers, icon quick actions, balance rows, ActivityList → TransactionRow-like chrome.
5. **T3 Header identity + rates strip** — Avatar/business/KYB chip + RatesMarquee from summary FX.

### Wave 2 — Money flows
6. **M1 Send wizard UX** — `components/send/**`; keep catalog + quote/accountSends.
7. **M2 Deposit + transit** — `DepositModal` + transit from `payment_instructions`.
8. **M3 Receive** — Method chooser + QR; fiat IBAN list stays real.
9. **M4 Accounts visual** — `components/wallets/**`; no mock balances.
10. **M5 Activity/Tx detail polish** — keep server filters/pagination.

### Wave 3 — Auth + B2B secondary
11. **A1 Auth chrome unify** — AuthChrome + OTP cells; no dead social buttons.
12. **V1 KYB polish** — Progress / “what you’ll need”; keep KYB APIs.
13. **S1 Settings/profile shell** — Business identity, KYB link, appearance, sign out.
14. **D1 Developer extract/polish** — Real API keys only.
15. **C1/T1 Cards & Team** — Redesign **behind Preview only**.

## Suggested first implementation slice

**T1 → T2 → T4** shipped on `feat/ux-parity-shell-home` (PR #28).  
**T5 + T3** (home body + identity/rates) continue on the same branch.

## Out of scope for parity PRs

Backend new endpoints; inventing balance/FX numbers; replacing KYB with consumer KYC; native QR camera on web (chooser UI only).
