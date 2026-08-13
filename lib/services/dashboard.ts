import { apiEnvelope } from "@/lib/apiClient";

export type DashboardTotals = {
  money_in_30d: string;
  money_out_30d: string;
  pending_count: number;
  user_balance: unknown;
  wallet_address: string | null;
};

export type ExchangeRates = {
  base: string;
  rates: Record<string, number>;
};

export type DashboardSummary = {
  totals: DashboardTotals;
  fx_rates: ExchangeRates;
};

export type LiveRateRow = {
  pair: string;
  value: string;
};

/** Sidebar placeholders when summary FX is missing — never invent rates. */
const LIVE_RATE_PLACEHOLDERS: LiveRateRow[] = [
  { pair: "USD/KES", value: "—" },
  { pair: "USD/NGN", value: "—" },
  { pair: "USDC/USD", value: "—" },
];

const PREFERRED_FX_QUOTES = ["KES", "NGN", "USDC", "USD"];

function formatFxRate(rate: number): string {
  const maxDigits = Math.abs(rate) >= 100 ? 2 : 4;
  return rate.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: maxDigits,
  });
}

/**
 * Normalize a rate map: uppercase keys, finite positive numbers only.
 * Never invents missing quotes.
 */
export function normalizeExchangeRates(
  fx: ExchangeRates | null | undefined,
): ExchangeRates | null {
  if (!fx?.base || !fx.rates || typeof fx.rates !== "object") return null;
  const base = fx.base.trim().toUpperCase();
  if (!base) return null;
  const rates: Record<string, number> = {};
  for (const [rawCode, rawRate] of Object.entries(fx.rates)) {
    const code = rawCode.trim().toUpperCase();
    if (!code || code === base) continue;
    const rate =
      typeof rawRate === "number"
        ? rawRate
        : typeof rawRate === "string"
          ? Number(String(rawRate).replace(/,/g, ""))
          : Number.NaN;
    if (!Number.isFinite(rate) || rate <= 0) continue;
    rates[code] = rate;
  }
  return { base, rates };
}

/**
 * Merge FX snapshots. Later sources win on conflicting quote codes.
 * Base must agree (or later source replaces base + rates).
 */
export function mergeExchangeRates(
  ...sources: Array<ExchangeRates | null | undefined>
): ExchangeRates | null {
  let merged: ExchangeRates | null = null;
  for (const src of sources) {
    const next = normalizeExchangeRates(src);
    if (!next) continue;
    if (!merged || merged.base !== next.base) {
      merged = { base: next.base, rates: { ...next.rates } };
      continue;
    }
    merged = { base: merged.base, rates: { ...merged.rates, ...next.rates } };
  }
  return merged;
}

/**
 * Build up to three LIVE RATES rows from dashboard summary `fx_rates`.
 * Missing/invalid rates render as "—" — never hardcoded fake numbers.
 */
export function liveRateRowsFromSummary(
  fx: ExchangeRates | null | undefined,
): LiveRateRow[] {
  const normalized = normalizeExchangeRates(fx);
  if (!normalized) {
    return LIVE_RATE_PLACEHOLDERS;
  }

  const rows: LiveRateRow[] = [];
  const seen = new Set<string>();

  const pushQuote = (quote: string) => {
    if (quote === normalized.base || seen.has(quote)) return;
    const rate = normalized.rates[quote];
    if (typeof rate !== "number" || !Number.isFinite(rate)) return;
    seen.add(quote);
    rows.push({
      pair: `${normalized.base}/${quote}`,
      value: formatFxRate(rate),
    });
  };

  for (const quote of PREFERRED_FX_QUOTES) pushQuote(quote);
  for (const quote of Object.keys(normalized.rates)) {
    if (rows.length >= 3) break;
    pushQuote(quote);
  }

  return rows.length > 0 ? rows.slice(0, 3) : LIVE_RATE_PLACEHOLDERS;
}

export const dashboardApi = {
  summary: () => apiEnvelope<DashboardSummary>("GET", "/v1/dashboard/summary"),
  /** Public USD-base indicative rates (YC African corridors via Mboka). */
  exchangeRates: () =>
    apiEnvelope<ExchangeRates>("GET", "/v1/exchange-rates"),
};
