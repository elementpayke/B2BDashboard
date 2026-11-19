# Mboka brand & UI guide

How the brand shows up in the B2B dashboard. Values live in [`tokens.json`](./tokens.json), which merges the original designer's spec (2026-11). This file is about **usage**. The components that implement it live in `components/ui` (see Storybook). In `tokens.json`, **PROPOSED** marks a value the designer filled in while formalising the system. Everything else is **DECIDED**: the designed brand. Don't change DECIDED values casually.

**Mboka** is the product (business banking for Africa and the Global South); **ElementPay** is the company. Product UI says "Mboka". Legal and footer copy may say "Mboka, a product of ElementPay".

## Palette

| Token | Value | Use |
|---|---|---|
| `brand.indigo` | `#3B2ED3` | Primary on light: CTAs, links, focus, selected |
| `brand.indigo-lift` | `#7C6FFF` | Primary on dark. Also the "Indigo Lift" card colour |
| `brand.ink` | `#131126` | Text on light; ink panels |
| `brand.bone` | `#F6F4EF` | Light canvas. **Never a pure white canvas.** White (`brand.white`) is for panels and inputs only |
| `brand.marigold` `mint` `coral` `lavender` | `#FFB224` `#5ED6B4` `#FF6A55` `#9590E6` | Accent **fills** for illustrations, landing and charts. Never text on light, never UI state |
| `brand.cobalt` `orchid` `sky` `plum` (+ indigo, indigo-lift) | `#2457E6` `#A94BD9` `#63B3FF` `#4A1D6E` | Virtual card colours |
| `brand.positive` | `#0E7A5A` | Incoming-money amounts. Not a status colour |

`brand.amber` and `brand.violet` are deprecated aliases kept for landing code. Use `marigold` and `indigo-lift`.

### Semantic colours

UI code never uses brand colours for states. It uses semantic utilities, which switch correctly between the light, dark and high-contrast dark themes. Each designer name maps to a Tailwind utility and to the CSS variable that legacy code reads:

| Designer name | Utility | CSS var | Notes |
|---|---|---|---|
| bg / panel / surface | `bg-background` / `bg-card` / — | `--bg` `--panel` `--surface` | surface = glass (sidebar, header, bottom nav) |
| surface-2 / surface-3 | `bg-muted` `bg-secondary` / `bg-surface-3` | `--surface2` `--surface3` | inset fills / tracks |
| text / text-muted | `text-foreground` / `text-muted-foreground` | `--ink` `--muted` | |
| text-muted-2 | `text-subtle-foreground` | `--muted2` | labels, overlines, meta |
| text-muted-3 | `text-placeholder` | `--muted3` | placeholder and decoration only (3.07:1) |
| primary / -foreground / -tint | `bg-primary` `text-primary-foreground` `bg-accent` | `--indigo` `--indigo-on` `--indigo-tint` | |
| primary-text, link | `text-accent-foreground` `text-link` | `--indigo-text` | |
| focus-ring | `ring` / `shadow-focus` | `--focus-ring` | |
| danger / danger-text / -tint | `destructive` / `text-destructive-text` / `bg-destructive-tint` | `--red` `--red-text` `--red-tint` | `destructive` is for fills and icons; text uses `-text` |
| warning / warning-text / -tint | `warning` / `text-warning-text` / `bg-warning-tint` | `--amber` `--amber-text` `--amber-tint` | same rule |
| success / -tint | `success` / `bg-success-tint` | `--success` `--success-tint` | see "Awaiting sign-off" |
| info / -tint | `info` / `bg-info-tint` | `--info` `--info-tint` | PROPOSED |
| positive | `text-positive` | `--positive` | incoming amounts (`<Amount direction="in">`) |
| overlay / overlay-doc | `bg-overlay` / `bg-overlay-doc` | `--overlay-bg` `--overlay-doc-bg` | doc = behind invoices and receipts |

## Type

| Face | Use | Utility |
|---|---|---|
| Space Grotesk 600/700 | Headings, nav chrome, buttons, tab labels | `font-display` |
| DM Sans 400–700 | Body copy, form text, descriptions | `font-body` (default) |
| DM Mono 400/500 | **Every** amount, balance, account/IBAN/phone number, hash, reference | `font-mono` + `tabular-nums` (`<Amount>` does this) |

Pick a size by **role**; no other sizes exist:

| Utility | px | Role |
|---|---|---|
| `text-overline-sm` | 10.5 | small overline |
| `text-label` | 11 | uppercase labels (`font-bold uppercase tracking-label`), status chips |
| `text-caption` | 11.5 | captions, hints, field errors |
| `text-dense` | 12 | dense body, chips |
| `text-body` | 12.5 | body, table cells, pill buttons |
| `text-body-lg` | 13 | large body, CTAs |
| `text-lead` | 14 | lead body, descriptions |
| `text-title` | 16 | card and modal titles; mobile input text (stops iOS zoom) |
| `text-headline` | 19 | sheet headline |
| `text-page-sm` / `text-page` | 20 / 26 | page title mobile / desktop |
| `text-stat` | 22 | stat tile value |
| `text-amount` | 24 | amount input |
| `text-hero` | 32 | hero amount (`leading-tight tracking-display`) |

- **Line height:** `leading-tight` 1.05 (display) · `heading` 1.2 · `snug` 1.35 · `body` 1.55 · `relaxed` 1.6.
- **Tracking:** `tracking-display` −0.04em · `heading` −0.02em (page titles) · `title` −0.01em (card/modal titles) · `label` 0.06em (uppercase labels) · `overline` 0.12em (document overlines).

## Space & layout
- **Spacing steps:** 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 32 px, which are Tailwind `1 1.5 2 2.5 3 3.5 4 5 6 8`. Use no other steps for padding or gaps.
- **One breakpoint:** `desktop:` = 900px. Below it you get the drawer sidebar, bottom nav and full-screen or bottom sheets. Write mobile-first; 390px must work.
- **Tables:** scroll horizontally below 820px (`min-w-table` inside `overflow-x-auto`).
- **Landing sections:** `max-w-content` (1200px).
- Touch targets ≥ 44px. Standard CTAs are 48px tall.

## Shape & depth
- **Radius:**
  - `xs 6` status chips
  - `sm 8` small tiles, menu items
  - `md 12` inputs, alerts
  - `lg 14` CTAs, option cards
  - `xl 16` inner cards, stat tiles
  - `2xl 22` panels
  - `3xl 28` modals, sheets, landing cards
  - `pill` pills, pill buttons, avatars
- **Borders over shadows:** panels have no shadow. Shadows:
  - `shadow-float`: menus and popovers
  - `shadow-modal`: dialogs
  - `shadow-card`: virtual payment cards only
  - `shadow-selection`: selected swatch
  - `shadow-nav-active`: active sidebar item
  - `shadow-hairline`: flags and logos
  - `shadow-focus`: keyboard focus (PROPOSED)
  - `shadow-auth`: auth cards (as shipped)

## Motion
- **Durations:**
  - 150ms: press
  - 160ms: toggles
  - 200ms: drawer, hovers
  - 250–300ms: pop-ins
  - 280ms: mobile sheets
  - 350ms: theme swap
  - 600ms: landing scene enter
  - 1000ms linear: quote countdown tick
- **Easing:** `ease-standard` for most things. `ease-spring` (overshoot) is for pop-ins only. `ease-sheet` is for sheets and `ease-move` for positional moves.
- Respect `prefers-reduced-motion`: drop movement and keep opacity changes.

## Charts (PROPOSED)
- **Categorical, in order:** `chart-1` indigo · `2` marigold · `3` mint · `4` coral · `5` lavender · `6` cobalt · `7` orchid · `8` sky.
- **Sequential:** `chart-seq-1` … `chart-seq-6`, an indigo ramp from light to dark.
- **Gains, losses, other:** `chart-positive` / `chart-negative` / `chart-neutral`.
- Always pair colour with labels or a legend.

## Money
- Always `<Amount>`: grouped, 2 decimals (configurable for crypto), with the currency code after the number in muted text.
- Inbound `+` in `positive`. Outbound `−` (a true minus) in ink, because outbound is normal, not an error.
- Unknown or unavailable → `—`. **Never show `0.00` for a balance we couldn't load**, and never show mock balances.
- FX: show the rate and fees before confirmation (`FeeDisclosure`), and state who pays the fees.

## Status
Use `<Badge>`: dot + label in a 6px-radius chip, never colour alone.

Transaction mapping (source of truth: `lib/services/transactionStatus.ts`):
- completed → success
- processing, refunded → warning
- failed, declined, frozen → danger (frozen = needs manual review)
- canceled → neutral

Use the `brand` tone for informational pills.

## Voice
- Plain, confident, short. "Send money", "Add account", "Couldn't load transactions. Try again."
- Say what happens and when: "Arrives in seconds", "Arrives within 1 business day".
- Use chain and rail names, not infrastructure: "USDC on Base → Stellar". Never "CCTP", "bridge" or "burn/mint" in UI copy.
- Errors: say what failed and what to do. Pass backend messages through (they're user-safe). No blame, no exclamation marks.
- Sentence case for everything (buttons, titles, menus).
- Verification is **KYB** (business), not KYC.

## Patterns
- One primary button per view. Destructive actions confirm in a dialog that names the consequence.
- Every async view has loading (Skeleton), empty and error states.

## Marks
`components/brand/` holds:
- `MbokaLogo` (lockup) and `MbokaMark` (glyph)
- `AuthBrand` (auth header)
- `NetworkMark` / `CoinMark` (chain and asset marks)

Mobile-money marks are in `public/brand/mobile/`. Don't recolour, stretch or recreate any of them.

## Mobile parity (resolved)
The designer's spec keeps indigo `#3B2ED3` on bone with Space Grotesk / DM Sans / DM Mono as DECIDED. The mobile app's palette (`#4f2ce0` → `#83007c`, Geist) proposed in `docs/ux-parity-mobile.md` is **not** adopted for the dashboard.

## Awaiting sign-off
The designer's spec changes these live values. They're not applied yet because each one changes shipped screens. The token keeps the current value until approved.

| Token (CSS var) | Current | Designer | Notes |
|---|---|---|---|
| `muted2` light / dark | `#8B89A6` / `#807D9E` | `#6E6C8A` / `#8E8BAB` | Labels go from 3.07:1 to 4.58:1 on bone (AA). The old value moves to `muted3` (placeholder) |
| `success` (+ `-tint`) light / dark | green `#1A8A4A` / `#4ADE80` | indigo `#3B2ED3` / `#7C6FFF` | "Settled/Paid use indigo, not green". Incoming amounts move to `positive` at the same time |
| `ink-panel-text` | `#C4C2DC` | `#8B89A6` | Secondary text on ink panels |
| `input-bg` light / dark / HC | `#FFFFFF` / `#1C1B24` / `#232029` | `rgba(255,255,255,0.6)` / `rgba(255,255,255,0.05)` / `rgba(255,255,255,0.09)` | Translucent inputs |
| `modal-bg` light / dark / HC | opaque `#FFFFFF` / `#121116` / `#17161d` | `rgba(251,250,247,0.85)` / `rgba(14,13,22,0.82)` / `rgba(10,9,17,0.97)` | Glass dialogs. Reverses a deliberate fix ("opaque, so background UI never bleeds through") |
| `overlay-bg` light / dark | `0.58` / `0.74` | `0.32` / `0.6` | Lighter scrim. Reverses a deliberate fix (heavier scrim to stop the page showing through) |
