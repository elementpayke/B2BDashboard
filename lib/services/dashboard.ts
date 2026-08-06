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
 * Build up to three LIVE RATES rows from dashboard summary `fx_rates`.
 * Missing/invalid rates render as "—" — never hardcoded fake numbers.
 */
export function liveRateRowsFromSummary(
  fx: ExchangeRates | null | undefined,
): LiveRateRow[] {
  if (!fx?.base || !fx.rates || typeof fx.rates !== "object") {
    return LIVE_RATE_PLACEHOLDERS;
  }

  const rows: LiveRateRow[] = [];
  const seen = new Set<string>();

  const pushQuote = (quote: string) => {
    if (quote === fx.base || seen.has(quote)) return;
    const rate = fx.rates[quote];
    if (typeof rate !== "number" || !Number.isFinite(rate)) return;
    seen.add(quote);
    rows.push({ pair: `${fx.base}/${quote}`, value: formatFxRate(rate) });
  };

  for (const quote of PREFERRED_FX_QUOTES) pushQuote(quote);
  for (const quote of Object.keys(fx.rates)) {
    if (rows.length >= 3) break;
    pushQuote(quote);
  }

  return rows.length > 0 ? rows.slice(0, 3) : LIVE_RATE_PLACEHOLDERS;
}

export const dashboardApi = {
  summary: () => apiEnvelope<DashboardSummary>("GET", "/v1/dashboard/summary"),
};
