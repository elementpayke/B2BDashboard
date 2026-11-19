import {
  BRAND,
  THEME_LANDING_DARK,
  THEME_LANDING_LIGHT,
} from "@/lib/theme/tokens.generated";

/**
 * Design tokens for the Mboka marketing landing page, from the approved
 * landing handoff. The values live in design/tokens.json under
 * `theme.landing-light` / `theme.landing-dark` — deliberately separate from
 * the dashboard themes: a couple of values (muted2/muted3, the dedicated
 * --landing-bg vs --bg split for the dark "soft panel on black" effect) only
 * exist on this page, so landing tweaks can't drift the rest of the app.
 */
export const LANDING_LIGHT: Record<string, string> = THEME_LANDING_LIGHT;

export const LANDING_DARK: Record<string, string> = THEME_LANDING_DARK;

/** Brand palette used on capability cards (not theme-dependent). */
export const LANDING_BRAND = {
  indigo: BRAND.indigo,
  amber: BRAND.amber,
  violet: BRAND.violet,
  ink: BRAND.ink,
  mint: BRAND.mint,
  coral: BRAND.coral,
  positive: BRAND.positive,
  positiveOnDark: BRAND.positiveOnDark,
} as const;

/** Rotating hero headline words, synced 1:1 with the hero visual scenes. */
export const HERO_SCENES = [
  { word: "spending online", dot: LANDING_BRAND.amber },
  { word: "banked everywhere", dot: LANDING_BRAND.indigo },
  { word: "paid in, paid out", dot: LANDING_BRAND.violet },
  { word: "using stablecoins", dot: LANDING_BRAND.mint },
] as const;

export const HERO_SCENE_MS = 4500;

/** Payouts card corridors — order and flags exactly as designed. */
export const PAYOUT_CORRIDORS = [
  { code: "KES", iso: "ke" },
  { code: "NGN", iso: "ng" },
  { code: "UGX", iso: "ug" },
  { code: "GHS", iso: "gh" },
  { code: "TZS", iso: "tz" },
  { code: "ZAR", iso: "za" },
] as const;

/** Design-time fallback rates — only used until the live endpoint answers. */
export const PAYOUT_RATE_FALLBACK: Record<string, number> = {
  KES: 128.65,
  NGN: 1512.0,
  UGX: 3720.0,
  GHS: 12.85,
  TZS: 2485.0,
  ZAR: 17.42,
};

/** Flat fee shown on the calculator — no live per-corridor fee source yet. */
export const PAYOUT_FEE_PERCENT = "0.20%";

/** Flag marquee strip — exact order from the design. */
export const MARQUEE_CURRENCIES = [
  { code: "KES", iso: "ke" },
  { code: "NGN", iso: "ng" },
  { code: "UGX", iso: "ug" },
  { code: "GHS", iso: "gh" },
  { code: "TZS", iso: "tz" },
  { code: "ZAR", iso: "za" },
  { code: "EGP", iso: "eg" },
  { code: "USD", iso: "us" },
  { code: "GBP", iso: "gb" },
  { code: "EUR", iso: "de" },
] as const;

export function flagCdnUrl(iso: string): string {
  return `https://flagcdn.com/w40/${iso}.png`;
}
