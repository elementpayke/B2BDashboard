# Mboka brand & UI guide

How the brand shows up in the B2B dashboard. Values live in [`tokens.json`](./tokens.json); this file is about **usage**. Components that implement it live in `components/ui` (see Storybook).

**Mboka** is the product (business banking for Africa and the Global South); **ElementPay** is the company. Product UI says "Mboka". Legal/footer copy may say "Mboka, a product of ElementPay".

## Palette

| Token | Value | Use |
|---|---|---|
| `brand.indigo` | `#3B2ED3` | Primary actions, links, focus, selected states (light theme) |
| `brand.indigo-lift` | `#7C6FFF` | Indigo on dark backgrounds — dark theme only |
| `brand.ink` | `#131126` | Primary text on light; dark panels |
| `brand.bone` | `#F6F4EF` | App canvas. **Never pure white canvas**; white is for raised panels/inputs only |
| amber / violet / mint / coral | — | Illustration and marketing accents (landing, empty-state art). Not for UI states |

UI code never uses brand colours directly for states — it uses semantic tokens: `primary`, `destructive`, `warning`, `success`, `muted-foreground`… which switch correctly between light, dark and high-contrast dark.

## Type

| Face | Use | Utility |
|---|---|---|
| Space Grotesk 600/700 | Headings, nav chrome, buttons, tab labels | `font-display` |
| DM Sans 400–700 | Body copy, form text, descriptions | `font-body` (default) |
| DM Mono 400/500 | **Every** amount, balance, account/IBAN/phone number, hash, reference | `font-mono` + `tabular-nums` (`<Amount>` does this) |

Scale (use these, nothing in between): `2xs 11` overlines/labels · `xs 12.5` meta · `sm 14` UI default · `base 15` body · `lg 17` card titles · `xl 20` modal/section titles · `2xl 24` page titles · `3xl 32` hero balances. Overline labels are uppercase, bold, `tracking-wider`.

## Shape & depth
Radius: `md 12` inputs/buttons · `lg 16` inner cards · `xl 22` panels · `2xl 28` modals/sheets · `full` pills. Borders over shadows; `shadow-card` only for floating auth cards, `shadow-overlay` only for dialogs.

## Money
- Always `<Amount>`: grouped, 2 decimals (configurable for crypto), currency code after the number in muted text.
- Inbound `+` in success colour; outbound `−` (true minus) in ink — outbound is normal, not an error.
- Unknown / unavailable → `—`. **Never show `0.00` for a balance we couldn't load**, and never show mock balances.
- FX: show the rate and fees before confirmation (`FeeDisclosure`); state who pays fees.

## Status
`<Badge>` with dot + label (never colour alone). Transaction mapping (source of truth: `lib/services/transactionStatus.ts`): completed → success · processing, refunded → warning · failed, declined, frozen → danger (frozen = needs manual review) · canceled → neutral. Use `brand` tone for informational pills (e.g. "Paid" invoices).

## Voice
- Plain, confident, short. "Send money", "Add account", "Couldn't load transactions. Try again."
- Say what happens and when: "Arrives in seconds", "Arrives within 1 business day".
- Chain and rail names, not infrastructure: "USDC on Base → Stellar", never "CCTP", "bridge", "burn/mint" in UI copy.
- Errors: what failed + what to do; pass through backend messages (they're user-safe); no blame, no exclamation marks.
- Sentence case for everything (buttons, titles, menus).
- Verification is **KYB** (business), not KYC.

## Layout
- Mobile-first: 390px must work; desktop ≥1024px gets the sidebar shell. Touch targets ≥ 44px.
- One primary button per view; destructive actions confirm in a dialog that names the consequence.
- Every async view has loading (Skeleton), empty and error states.

## Marks
`components/brand/` — `MbokaLogo` (lockup), `MbokaMark` (glyph), `AuthBrand` (auth header), `NetworkMark`/`CoinMark` (chain & asset marks), mobile-money marks in `public/brand/mobile/`. Don't recolour, stretch or recreate them.

## Open decision
`docs/ux-parity-mobile.md` proposes aligning with the mobile app (brand `#4f2ce0`, Geist type, mobile radius scale). Not adopted. If it is, it's a change to `tokens.json` (+ font loading in `app/layout.tsx`), not to components.
