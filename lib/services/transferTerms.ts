/**
 * Transfer terms shown before money moves: per-transaction limits, the
 * quote's rate lock, and plain-language copy for bank top-up instructions.
 *
 * Rule: never invent a number. Limits come from the partner catalog, fees
 * and rates from the quote/preview. When a value is unknown we say when it
 * will be shown instead of estimating it.
 */

import type { CatalogProvider } from "@/lib/services/catalog";

export type AmountLimits = {
  min: number | null;
  max: number | null;
  currency: string;
};

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Limits for the chosen provider, or — with no provider picked yet — the
 * widest range any enabled provider accepts. Null when the catalog publishes
 * none, so the UI shows nothing rather than a guess.
 */
export function providerLimits(
  providers: CatalogProvider[] | null | undefined,
  providerName: string,
  fallbackCurrency: string,
): AmountLimits | null {
  const list = providers ?? [];
  const wanted = providerName.trim().toLowerCase();
  const chosen = wanted
    ? list.filter(
        (p) => p.name.trim().toLowerCase() === wanted || p.code.trim().toLowerCase() === wanted,
      )
    : list;
  const pool = chosen.length ? chosen : list;
  let min: number | null = null;
  let max: number | null = null;
  let currency = "";
  const currencies = new Set<string>();
  for (const p of pool) {
    const lo = toNumber(p.min_amount);
    const hi = toNumber(p.max_amount);
    if (lo === null && hi === null) continue;
    if (lo !== null) min = min === null ? lo : Math.min(min, lo);
    if (hi !== null) max = max === null ? hi : Math.max(max, hi);
    const c = String(p.currency || fallbackCurrency).toUpperCase();
    currencies.add(c);
    if (!currency) currency = c;
  }
  if (min === null && max === null) return null;
  // Never merge bounds published in different currencies into one range.
  if (currencies.size > 1) return null;
  return { min, max, currency: currency || fallbackCurrency.toUpperCase() };
}

export function formatLimitAmount(n: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)}`;
}

/** "Min KES 100 · Max KES 150,000" (either side may be absent). */
export function formatLimitsLine(limits: AmountLimits | null): string | null {
  if (!limits) return null;
  const parts: string[] = [];
  if (limits.min !== null) parts.push(`Min ${formatLimitAmount(limits.min, limits.currency)}`);
  if (limits.max !== null) parts.push(`Max ${formatLimitAmount(limits.max, limits.currency)}`);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Inline check while typing. Returns a message only when the amount is a
 * real number outside the published range — never for an empty field.
 */
export function limitViolation(amount: string, limits: AmountLimits | null): string | null {
  if (!limits) return null;
  const n = toNumber(amount);
  if (n === null) return null;
  if (limits.min !== null && n < limits.min) {
    return `Minimum is ${formatLimitAmount(limits.min, limits.currency)} per transaction.`;
  }
  if (limits.max !== null && n > limits.max) {
    return `Maximum is ${formatLimitAmount(limits.max, limits.currency)} per transaction. Split larger amounts.`;
  }
  return null;
}

/**
 * Same check as {@link limitViolation}, but works when the box is in a
 * different currency than the published range (e.g. typing USD against a
 * BWP limit). `localPerUsdRate` is units of `limits.currency` per 1 USD —
 * the same indicative rate used to show the "≈" equivalent line. Without a
 * rate we cannot convert, so no check runs rather than guess a verdict.
 */
export function limitViolationAcrossCurrencies(
  amount: string,
  amountCurrency: string,
  limits: AmountLimits | null,
  localPerUsdRate: number | null,
): string | null {
  if (!limits) return null;
  const typed = amountCurrency.trim().toUpperCase();
  if (typed === limits.currency) return limitViolation(amount, limits);
  if (typed !== "USD" || !localPerUsdRate) return null;
  const usd = toNumber(amount);
  if (usd === null) return null;
  return limitViolation((usd * localPerUsdRate).toFixed(2), limits);
}

/**
 * "Max" fill: the smaller of whatever USD figures are known (corridor max,
 * source wallet balance, …), expressed in the currently typed currency.
 *
 * Rounds the result DOWN to cents — never to nearest. A wallet balance often
 * carries more precision than its rounded display (true 34.7398 shown as
 * "34.74"); rounding the fill *up* to that display figure would exceed the
 * real balance and immediately trip the insufficient-balance check against
 * its own number.
 */
export function maxSendableAmount(
  usdCandidates: Array<number | null | undefined>,
  displayCurrency: string,
  localPerUsdRate: number | null,
): string | null {
  const known = usdCandidates.filter((n): n is number => n != null);
  if (!known.length) return null;
  const usd = Math.min(...known);
  const floorToCents = (n: number) => (Math.floor(n * 100) / 100).toFixed(2);
  if (displayCurrency.trim().toUpperCase() === "USD") return floorToCents(usd);
  if (!localPerUsdRate) return null;
  return floorToCents(usd * localPerUsdRate);
}

/** "4:05" until the quote expires, "0:00" once it has. Null without an expiry. */
export function formatCountdown(expiresAt: string | null | undefined, nowMs: number): string | null {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt);
  if (!Number.isFinite(end)) return null;
  const left = Math.max(0, Math.floor((end - nowMs) / 1000));
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type BankInstructionRow = { k: string; v: string };

/** Plain-text block for "Copy all details" / Share / Download. */
export function bankInstructionsText(params: {
  amount: string;
  currency: string;
  rows: BankInstructionRow[];
  arrival?: string;
}): string {
  const lines = [
    `Pay exactly ${params.amount} ${params.currency}`.trim(),
    ...params.rows.map((r) => `${r.k}: ${r.v}`),
  ];
  if (params.arrival) lines.push(`Arrival: ${params.arrival}`);
  return lines.join("\n");
}
