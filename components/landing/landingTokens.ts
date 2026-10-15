/**
 * Exact design tokens for the Mboka marketing landing page — lifted verbatim
 * from the approved design handoff (`landing.html`'s `:root` / `[data-theme]`
 * rules). Deliberately separate from the dashboard's shared LIGHT/DARK tokens
 * in components/mockData.ts: a couple of values (muted2/muted3, the dedicated
 * --landing-bg vs --bg split for the dark "soft panel on black" effect) only
 * exist on this page, and keeping them local avoids any risk of this page's
 * styling drifting the rest of the app if either set is edited later.
 */
export const LANDING_LIGHT: Record<string, string> = {
  "--landing-bg": "#F6F4EF",
  "--bg": "#F6F4EF",
  "--surface": "rgba(255,255,255,0.55)",
  "--surface2": "rgba(19,17,38,0.045)",
  "--border": "rgba(19,17,38,0.08)",
  "--glass-border": "rgba(19,17,38,0.08)",
  "--ink": "#131126",
  "--muted": "#4C4A66",
  "--muted2": "#6E6C8A",
  "--muted3": "#8B89A6",
  "--indigo": "#3B2ED3",
  "--indigo-on": "#fff",
  "--indigo-text": "#3B2ED3",
  "--indigo-tint": "#EEEDFB",
  "--panel": "#FFFFFF",
};

export const LANDING_DARK: Record<string, string> = {
  "--landing-bg": "rgba(255,255,255,0.045)",
  "--bg": "#000",
  "--surface": "rgba(255,255,255,0.045)",
  "--surface2": "rgba(255,255,255,0.055)",
  "--border": "rgba(255,255,255,0.1)",
  "--glass-border": "rgba(255,255,255,0.1)",
  "--ink": "#F2F0FA",
  "--muted": "#B4B1D0",
  "--muted2": "#8E8BAB",
  "--muted3": "#807D9E",
  "--indigo": "#7C6FFF",
  "--indigo-on": "#0E0D1C",
  "--indigo-text": "#A79EFF",
  "--indigo-tint": "#221E4A",
  "--panel": "#121116",
};

/** Brand palette used on capability cards (not theme-dependent). */
export const LANDING_BRAND = {
  indigo: "#3B2ED3",
  amber: "#FFB224",
  violet: "#7C6FFF",
  ink: "#131126",
  mint: "#5ED6B4",
  coral: "#FF6A55",
  positive: "#0E7A5A",
  positiveOnDark: "#0E9A70",
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
