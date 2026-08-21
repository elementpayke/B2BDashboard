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
 * Home "Show in" display currencies come from live Mboka FX
 * (`GET /v1/exchange-rates` ∪ summary `fx_rates`), not a hardcoded catalog.
 * YC African corridors today: KES, NGN, GHS, UGX, TZS, ZAR, MWK. USDC always
 * offered (pegs to USD when no explicit quote). EUR/GBP/CAD only appear when
 * the rates payload includes them.
 */
export const DEFAULT_DISPLAY_CURRENCY = "USD";

/** While FX is loading / missing — never invent unsupported fiats. */
export const DISPLAY_CURRENCY_FALLBACK = ["USD", "USDC"] as const;

/**
 * @deprecated Prefer {@link displayCurrencyOptionsFromRates}. Kept as the
 * loading fallback so older imports still resolve to supported-only codes.
 */
export const DISPLAY_CURRENCY_OPTIONS = DISPLAY_CURRENCY_FALLBACK;

export type DisplayCurrency = string;

const DISPLAY_CURRENCY_STORAGE_KEY = "ep.displayCurrency.v1";
const CURRENCY_CODE_RE = /^[A-Z]{3,5}$/;

/** Preferred order for codes present in the live rate book. */
const DISPLAY_CURRENCY_SORT_ORDER = [
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
  "USDT",
] as const;

export function isCurrencyCode(value: string): boolean {
  return CURRENCY_CODE_RE.test(value.trim().toUpperCase());
}

/** True when `value` is a plausible currency code (storage / UI guard). */
export function isDisplayCurrency(value: string): value is DisplayCurrency {
  return isCurrencyCode(value);
}

/**
 * Build the Home display-currency list from a live FX snapshot.
 * Always includes the FX base and USDC; quote codes come from `rates` only.
 */
export function displayCurrencyOptionsFromRates(
  fx: ExchangeRates | null | undefined,
): string[] {
  const normalized = normalizeExchangeRates(fx);
  if (!normalized) return [...DISPLAY_CURRENCY_FALLBACK];

  const codes = new Set<string>([
    normalized.base,
    ...Object.keys(normalized.rates),
    "USDC",
  ]);

  return Array.from(codes).sort((a, b) => {
    const order = DISPLAY_CURRENCY_SORT_ORDER as readonly string[];
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b);
  });
}

/** Pick a selectable code: prefer stored choice, else USD, else first option. */
export function resolveDisplayCurrency(
  preferred: string | null | undefined,
  options: readonly string[],
): string {
  const code = (preferred || "").trim().toUpperCase();
  if (code && options.includes(code)) return code;
  if (options.includes(DEFAULT_DISPLAY_CURRENCY)) return DEFAULT_DISPLAY_CURRENCY;
  return options[0] || DEFAULT_DISPLAY_CURRENCY;
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

/** Booked balance for the headline total; falls back to available when omitted. */
export function currentBalanceFromAccount(
  balance: AccountBalance | null | undefined,
): AccountBalance | null {
  const current = balance?.current?.trim() || balance?.available?.trim();
  if (!current) return null;
  return { available: current, current, currency: balance?.currency };
}

/** Amount booked but not yet available. Requires both values from the partner. */
export function pendingBalanceFromAccount(
  balance: AccountBalance | null | undefined,
): AccountBalance | null {
  const availableRaw = balance?.available?.trim();
  const currentRaw = balance?.current?.trim();
  if (!availableRaw || !currentRaw) return null;

  const available = Number(availableRaw.replace(/,/g, ""));
  const current = Number(currentRaw.replace(/,/g, ""));
  if (!Number.isFinite(available) || !Number.isFinite(current)) {
    return null;
  }

  const pending = String(Math.max(current - available, 0));
  return { available: pending, current: pending, currency: balance?.currency };
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
  const maximumFractionDigits = opts?.maximumFractionDigits ?? 2;
  const minimumFractionDigits = Math.min(2, maximumFractionDigits);
  return total.toLocaleString(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
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

/** Dollar-pegged stables: treat as USD when Mboka has no explicit quote. */
const USD_PEGGED_STABLECOINS = new Set(["USDC", "USDT"]);

/**
 * Map a ledger currency onto the FX book. USDC/USDT use an explicit quote
 * when present; otherwise they alias to USD so every wallet can roll into
 * one indicative total.
 */
export function resolveFxCurrency(
  currency: string,
  fx: ExchangeRates | null | undefined,
): string {
  const code = currency.trim().toUpperCase();
  if (!code) return code;
  if (!USD_PEGGED_STABLECOINS.has(code)) return code;
  const normalized = normalizeExchangeRates(fx);
  if (normalized?.rates[code]) return code;
  return "USD";
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
  const from = resolveFxCurrency(fromCurrency, fx);
  if (!from) return null;
  if (from === "USD") {
    const normalized = normalizeExchangeRates(fx);
    if (!normalized || normalized.base === "USD") return amount;
  }
  const normalized = normalizeExchangeRates(fx);
  if (!normalized) return null;
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
  const to = resolveFxCurrency(toCurrency, fx);
  if (!to) return null;
  if (to === "USD") {
    const normalized = normalizeExchangeRates(fx);
    if (!normalized || normalized.base === "USD") return amountInBase;
  }
  const normalized = normalizeExchangeRates(fx);
  if (!normalized) return null;
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
  const from = resolveFxCurrency(fromCurrency, fx);
  const to = resolveFxCurrency(toCurrency, fx);
  if (!from || !to) return null;
  if (from === to) return amount;
  const inBase = amountToFxBase(amount, from, fx);
  if (inBase == null) return null;
  return amountFromFxBase(inBase, to, fx);
}

/** Compact USD equivalent under the Home hero, e.g. `"≈ $20.00 USD"`. */
export function formatUsdEquivalentSub(
  totalUsd: number | null,
  opts?: { maximumFractionDigits?: number },
): string | null {
  if (totalUsd == null || !Number.isFinite(totalUsd)) return null;
  return `≈ $${formatBalanceAmount(totalUsd, opts)} USD`;
}

/**
 * Design hero figure: `≈ $548,830.55` for USD, `≈ KES 45,984.47` otherwise.
 */
export function formatHeroTotalLabel(
  total: number | null,
  currency: string,
  opts?: { maximumFractionDigits?: number },
): string {
  if (total == null || !Number.isFinite(total)) return "—";
  const amount = formatBalanceAmount(total, opts);
  const code = currency.trim().toUpperCase() || DEFAULT_DISPLAY_CURRENCY;
  if (code === "USD") return `≈ $${amount}`;
  return `≈ ${code} ${amount}`;
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
