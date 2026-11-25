# Transaction Visibility UI Mockup

**Branch:** `feat/transaction-visibility-ui-mockup`  
**Status:** Visual prototype with dummy data ready for review

## How to View

1. **Dev server should be running on port 3000**
2. Navigate to: **`http://localhost:3000/mockup/transaction-visibility`**
3. Click "View →" on any transaction row to see the detail panel

## What's Included

### Mock Data
- **6 sample transactions** in various states:
  - 🟨 Detected (2 mins ago) - Just started
  - 🟨 Attesting (8 mins ago) - Waiting for Circle
  - 🟨 Minting (15 mins ago) - Destination mint in progress
  - 🟩 Credited (45 mins ago) - Fully settled
  - 🟨 Stuck (65 mins ago) ⚠️ - Old + no progress (flagged)
  - 🟥 Failed (120 mins ago) ⚠️ - Error state

### Enhanced Transaction List
**New columns answering three key questions:**
1. **Status** - Color-coded stage badge showing current state
2. **Route & Amount** - "BASE → STELLAR" and "$X USDC"
3. **Elapsed** - Time since transaction started (2m, 8m, 1h, etc.)
4. **Next Step** - "Waiting for X" (Circle attestation, chain confirmation, payment provider, etc.)
5. **⚠️** - Attention flag for stuck/failed transfers
6. **Details** - Button to expand

### Enhanced Detail View
When you click "View →", you see:

**Transaction Summary**
- Route, amount, total elapsed time

**Stage Timeline**
- Deposit detected → Burn → Attestation → Mint → Funds landed
- Each stage shows:
  - Chain and tx hash (truncated)
  - Gas fees (native + USD)
  - Payer (customer, element_sponsor, circle_sponsor)

**Settlement Status** (Two distinct boxes)
- 🟦 **Crypto Settlement** - Blockchain confirmation (on-chain hash proves transfer on destination)
- 🟧 **Fiat Settlement** - Payment provider confirmation (PSP webhook shows money landed in bank account)
  
  Example: Shows "⏳ Pending" for crypto and "⏳ Awaiting provider confirmation" for fiat separately

**Fee Breakdown**
- Circle fee (PSP fee)
- Element gas sponsor cost

**Settlement Notifications**
- Webhook delivery status
- Attempts count
- Error messages if failed

## Design Philosophy

✅ **What you're evaluating:**
- Does the **information density** feel right? (can you answer the three questions at a glance?)
- Are the **stage colors** intuitive? (yellow = in progress, green = done, red = failed)
- Is the **separation of crypto vs fiat settlement** clear?
- Does the **timeline view** make sense for understanding where a transfer is stuck?
- Is the **attention flag** (⚠️) useful for surfacing problems?

⚠️ **What's NOT included yet:**
- Actual API integration (uses mock data)
- Responsive mobile layout
- Real-time auto-refresh
- Actual styling/design system (pure inline styles)
- Performance optimization

## Mockup Files

```
app/mockup/transaction-visibility/page.tsx  — Main mockup page (React component)
lib/mockData/transactionsMockup.ts           — Mock transactions + helper functions
```

## Quick Decision Guide

**Keep this approach if:**
- ✓ The layout answers your three key questions
- ✓ The settlement distinction (crypto vs fiat) is valuable
- ✓ The timeline view helps diagnose stuck transfers
- ✓ You like the information hierarchy

**Pivot if:**
- ✗ Too much information / too cluttered
- ✗ The stage timeline is confusing
- ✗ The settlement distinction isn't necessary
- ✗ Different column order would help

## Next Steps (If Approved)

1. **Refine the UI** based on your feedback
2. **Wire it to real APIs** (`GET /admin/cctp/transfers`, `GET /admin/cctp/transfers/{id}`)
3. **Add real-time polling** (5-10s for in-flight, 30s+ for completed)
4. **Responsive design** for mobile
5. **Performance optimization** (virtualize list, smart caching)
6. **Apply design system** styles

## To Clean Up

This branch is marked as **deletable**. Once you review:
- **Keep it:** `git checkout main && git merge feat/transaction-visibility-ui-mockup`
- **Delete it:** `git checkout main && git branch -D feat/transaction-visibility-ui-mockup`

---

**Let me know:**
1. Does this layout solve the problem you described?
2. What would you change?
3. Worth building the real integration, or pivot on something?
