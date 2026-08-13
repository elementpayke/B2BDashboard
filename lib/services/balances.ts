/**
 * Shared partner balance helpers — fiat IBAN and stablecoin FinancialAccounts
 * both expose `{ available, current, currency }` when the aggregator knows it.
 */

import type { ExchangeRates } from "@/lib/services/dashboard";
import { normalizeExchangeRates } from "@/lib/services/dashboard";

export type AccountBalance = {
  available?: string | null;
  current?: string | null;
  currency?: string | null;
};

/**
 * Currencies offered in the Home "default display currency" control.
 * Conversion only works when Mboka FX covers the pair (or source === display).
 * Indicative rates today are USD-base YC corridors (KES, NGN, GHS, UGX, TZS,
 * ZAR, MWK) plus whatever `dashboard/summary` embeds — not EUR/GBP/CAD/USDC.
 */
export const DISPLAY_CURRENCY_OPTIONS = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "KES",
  "TZS",
  "NGN",
  "GHS",
  "UGX",
  "ZAR",
  "MWK",
  "USDC",
] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCY_OPTIONS)[number];

export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrency = "USD";

const DISPLAY_CURRENCY_STORAGE_KEY = "ep.displayCurrency.v1";

export function isDisplayCurrency(value: string): value is DisplayCurrency {
  return (DISPLAY_CURRENCY_OPTIONS as readonly string[]).includes(value);
}

/** Read persisted default display currency (browser only). */
export function readStoredDisplayCurrency(): DisplayCurrency {
  if (typeof window === "undefined") return DEFAULT_DISPLAY_CURRENCY;
  try {
    const raw = window.localStorage.getItem(DISPLAY_CURRENCY_STORAGE_KEY);
    if (!raw) return DEFAULT_DISPLAY_CURRENCY;
    const code = raw.trim().toUpperCase();
    return isDisplayCurrency(code) ? code : DEFAULT_DISPLAY_CURRENCY;
  } catch {
    return DEFAULT_DISPLAY_CURRENCY;
  }
}

/** Persist default display currency (browser only). */
export function writeStoredDisplayCurrency(currency: string): void {
  if (typeof window === "undefined") return;
  const code = currency.trim().toUpperCase();
  if (!isDisplayCurrency(code)) return;
  try {
    window.localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, code);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Prefer available, then current. Empty when the partner omitted balance. */
export function pickAvailableBalance(
  balance: AccountBalance | null | undefined,
): string | null {
  const raw =
    balance?.available?.trim() ||
    balance?.current?.trim() ||
    "";
  return raw || null;
}

export function parseBalanceNumber(
  balance: AccountBalance | null | undefined,
): number | null {
  const raw = pickAvailableBalance(balance);
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Format for UI. Returns `—` when missing/unparseable — never invents a figure.
 */
export function formatAccountBalance(
  balance: AccountBalance | null | undefined,
  opts?: { maximumFractionDigits?: number },
): string {
  const raw = pickAvailableBalance(balance);
  if (!raw) return "—";
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
  });
}

/** Normalize a user-entered amount string (strips commas). */
export function parseAmountInput(amount: string): number | null {
  const trimmed = amount.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * Throw when the spend amount exceeds known available balance.
 * Skips the check when balance is unknown (partner omitted it) so we don't
 * block flows on missing data — the partner still enforces funded balance.
 */
export function assertSufficientBalance(params: {
  amount: string;
  balance: AccountBalance | null | undefined;
  currency: string;
}): void {
  const available = parseBalanceNumber(params.balance);
  if (available == null) return;
  const amount = parseAmountInput(params.amount);
  if (amount == null) return;
  if (amount > available) {
    const label = formatAccountBalance(params.balance);
    throw new Error(
      `Insufficient ${params.currency} balance. Available ${label}; you entered ${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}.`,
    );
  }
}

/** Sum available balances that share the same currency (e.g. USDC across networks). */
export function sumAvailableBalances(
  balances: Array<AccountBalance | null | undefined>,
): number | null {
  let total = 0;
  let any = false;
  for (const bal of balances) {
    const n = parseBalanceNumber(bal);
    if (n == null) continue;
    total += n;
    any = true;
  }
  return any ? total : null;
}

export function formatSummedBalance(
  balances: Array<AccountBalance | null | undefined>,
  opts?: { maximumFractionDigits?: number },
): string {
  const total = sumAvailableBalances(balances);
  if (total == null) return "—";
  return total.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
  });
}

export type CurrencyBalanceLine = {
  currency: string;
  total: number;
  /** Formatted amount without currency code, e.g. `"810.20"`. */
  label: string;
};

export type BalanceLedgerItem = {
  currency?: string | null;
  balance?: AccountBalance | null;
};

function formatBalanceAmount(
  total: number,
  opts?: { maximumFractionDigits?: number },
): string {
  return total.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
  });
}

/**
 * Sum available balances per currency code. Same-currency rails (e.g. USDC
 * on Base + Polygon) collapse into one line. Never FX-converts across codes.
 * Ordered by total descending so the largest known figure leads.
 */
export function sumBalancesByCurrency(
  items: BalanceLedgerItem[],
  opts?: { maximumFractionDigits?: number },
): CurrencyBalanceLine[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const currency = (
      item.currency?.trim() ||
      item.balance?.currency?.trim() ||
      ""
    ).toUpperCase();
    if (!currency) continue;
    const n = parseBalanceNumber(item.balance);
    if (n == null) continue;
    map.set(currency, (map.get(currency) ?? 0) + n);
  }
  return [...map.entries()]
    .map(([currency, total]) => ({
      currency,
      total,
      label: formatBalanceAmount(total, opts),
    }))
    .sort((a, b) => b.total - a.total || a.currency.localeCompare(b.currency));
}

/**
 * Home "Total balance" hero lines — truthful, no cross-currency FX.
 * - empty → `[]` (UI shows `—`)
 * - one currency → single `"810.20 EUR"`-style line via {@link formatCurrencyBalanceLines}
 * - many currencies → one line per code (same-currency rails already summed)
 */
export function formatCurrencyBalanceLines(
  items: BalanceLedgerItem[],
  opts?: { maximumFractionDigits?: number },
): string[] {
  return sumBalancesByCurrency(items, opts).map(
    (line) => `${line.label} ${line.currency}`,
  );
}

/**
 * Compact single-string form (middot-joined). Prefer stacked lines in the
 * hero when there are multiple currencies.
 */
export function formatHomeTotalBalance(
  items: BalanceLedgerItem[],
  opts?: { maximumFractionDigits?: number; joiner?: string },
): string {
  const lines = formatCurrencyBalanceLines(items, opts);
  if (lines.length === 0) return "—";
  return lines.join(opts?.joiner ?? " · ");
}

/**
 * Convert `amount` from `fromCurrency` into units of the FX `base`
 * (typically USD). Returns null when no rate exists — never invents.
 *
 * Contract: `rates[code]` means 1 base = rates[code] units of `code`.
 */
export function amountToFxBase(
  amount: number,
  fromCurrency: string,
  fx: ExchangeRates | null | undefined,
): number | null {
  if (!Number.isFinite(amount)) return null;
  const normalized = normalizeExchangeRates(fx);
  if (!normalized) return null;
  const from = fromCurrency.trim().toUpperCase();
  if (!from) return null;
  if (from === normalized.base) return amount;
  const rate = normalized.rates[from];
  if (typeof rate !== "number" || !(rate > 0)) return null;
  return amount / rate;
}

/**
 * Convert an amount already in FX base into `toCurrency`.
 */
export function amountFromFxBase(
  amountInBase: number,
  toCurrency: string,
  fx: ExchangeRates | null | undefined,
): number | null {
  if (!Number.isFinite(amountInBase)) return null;
  const normalized = normalizeExchangeRates(fx);
  if (!normalized) return null;
  const to = toCurrency.trim().toUpperCase();
  if (!to) return null;
  if (to === normalized.base) return amountInBase;
  const rate = normalized.rates[to];
  if (typeof rate !== "number" || !(rate > 0)) return null;
  return amountInBase * rate;
}

/**
 * Cross-convert using the USD-base indicative map. Same-currency is always 1:1
 * even when FX is missing. Returns null when a required rate is absent.
 */
export function convertAmountWithRates(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  fx: ExchangeRates | null | undefined,
): number | null {
  if (!Number.isFinite(amount)) return null;
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (!from || !to) return null;
  if (from === to) return amount;
  const inBase = amountToFxBase(amount, from, fx);
  if (inBase == null) return null;
  return amountFromFxBase(inBase, to, fx);
}

export type DisplayTotalResult = {
  /** Sum in display currency, or null when nothing convertible. */
  total: number | null;
  /** Formatted primary figure, e.g. `"1,234.56 USD"` or `"—"`. */
  label: string;
  /** Currency codes included in the sum. */
  included: string[];
  /** Known balance currencies skipped because FX was missing. */
  excluded: string[];
};

/**
 * Sum filtered ledger balances into one display-currency total using real
 * Mboka FX only. Components without a rate are listed in `excluded` — never
 * faked into the total.
 */
export function totalBalanceInDisplayCurrency(
  items: BalanceLedgerItem[],
  displayCurrency: string,
  fx: ExchangeRates | null | undefined,
  opts?: { maximumFractionDigits?: number },
): DisplayTotalResult {
  const display = displayCurrency.trim().toUpperCase() || DEFAULT_DISPLAY_CURRENCY;
  const lines = sumBalancesByCurrency(items, opts);
  const included: string[] = [];
  const excluded: string[] = [];
  let total = 0;
  let any = false;

  for (const line of lines) {
    const converted = convertAmountWithRates(
      line.total,
      line.currency,
      display,
      fx,
    );
    if (converted == null) {
      excluded.push(line.currency);
      continue;
    }
    total += converted;
    any = true;
    included.push(line.currency);
  }

  if (!any) {
    return { total: null, label: "—", included, excluded };
  }

  return {
    total,
    label: `${formatBalanceAmount(total, opts)} ${display}`,
    included,
    excluded,
  };
}

/**
 * Short subtitle for the Home Total balance hero.
 */
export function describeDisplayTotalSub(
  result: DisplayTotalResult,
  opts?: {
    balanceView?: "all" | "fiat" | "stablecoin";
    displayCurrency?: string;
  },
): string {
  const view = opts?.balanceView ?? "all";
  const display =
    (opts?.displayCurrency || "").trim().toUpperCase() || DEFAULT_DISPLAY_CURRENCY;

  if (result.total == null) {
    if (result.excluded.length > 0) {
      return `No FX rate for ${result.excluded.join(", ")} → ${display}`;
    }
    if (view === "stablecoin") return "Stablecoin balance not yet available";
    if (view === "fiat") return "Fiat account balance not yet available";
    return "Balance not yet available";
  }

  if (result.excluded.length > 0) {
    return `Excludes ${result.excluded.join(", ")} — no FX rate`;
  }

  if (result.included.length === 1 && result.included[0] === display) {
    return view === "stablecoin"
      ? "Available across USDC rails"
      : `Available ${display}`;
  }

  return `Indicative FX → ${display}`;
}
