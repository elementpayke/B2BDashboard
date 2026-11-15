/**
 * Dual-currency amount entry and display for the payout flow.
 *
 * The transparency goal is that a user always sees what leaves in USD *and*
 * what lands in the destination currency. The commercial constraint is that
 * we must never appear to promise a local figure we haven't been quoted.
 *
 * So there are deliberately two classes of number here, and they must not be
 * confused:
 *
 *   INDICATIVE — derived from `/v1/dashboard/summary`'s `fx_rates` before a
 *     quote exists. Used only to help someone size an amount. Always rendered
 *     with a "≈" and paired with a line saying the real figure is confirmed
 *     at review. Never sent anywhere.
 *
 *   QUOTED — `quote.amounts.rate` / `user_receives`, returned by the
 *     aggregator and binding until `expires_at`. Used for every number on the
 *     review step and the receipt. Exact, no "≈".
 *
 * `crypto_amount` on the payload is always the USD figure regardless of which
 * currency the user typed in, because that is what the backend prices from.
 */

import { feeOnTopUsd, totalWithFee } from "@/lib/services/transferTerms";

/** Amount the payload is built from — always USD, whatever was typed. */
export const PAYLOAD_CURRENCY = "USD";

export type AmountEntryMode = {
  /** Currency the user is typing in. */
  currency: string;
  /** Indicative units of `currency` per 1 USD, or null when we have no rate. */
  rate: number | null;
};

/** Indicative rate for a currency from the summary's USD-base `fx_rates`. */
export function indicativeRate(
  rates: Record<string, number> | null | undefined,
  currency: string,
): number | null {
  const value = rates?.[currency.toUpperCase()];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * Whether the destination currency can be offered as an entry option.
 * Without a rate we cannot turn local input into the USD the payload needs,
 * so the toggle is hidden rather than shown broken.
 */
export function canEnterInLocalCurrency(
  rates: Record<string, number> | null | undefined,
  currency: string,
): boolean {
  return indicativeRate(rates, currency) !== null;
}

function parseAmount(raw: string): number | null {
  const cleaned = (raw ?? "").replace(/[\s,]/g, "");
  if (!/^\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The USD figure to put on the quote payload.
 *
 * Entered in USD → passed through untouched (no rounding drift on the common
 * path). Entered in local → divided by the indicative rate and fixed to
 * cents. The resulting quote may land a little either side of the local
 * amount the user typed; that is why the local figure is only ever shown as
 * an estimate until the quote comes back.
 */
export function toPayloadUsdAmount(raw: string, mode: AmountEntryMode): string | null {
  const amount = parseAmount(raw);
  if (amount === null) return null;
  if (mode.currency.toUpperCase() === PAYLOAD_CURRENCY) {
    return raw.replace(/[\s,]/g, "");
  }
  if (!mode.rate) return null;
  return (amount / mode.rate).toFixed(2);
}

/**
 * Whether a typed amount — *plus the fee charged on top of it* — converts to
 * more than the known USD-equivalent balance.
 *
 * Comparing the amount alone is the bug this guards against: someone holding
 * exactly 7,000 and sending 7,000 against a 17.50 fee passed the client-side
 * check with no warning, then got rejected by the backend. `feeUsd` is
 * omitted until a quote or preview has returned one, at which point the
 * check becomes exact — it is never estimated in the meantime.
 */
export function amountExceedsBalance(
  raw: string,
  mode: AmountEntryMode,
  availableUsd: number | null,
  feeUsd?: string | number | null,
): boolean {
  if (availableUsd === null || !Number.isFinite(availableUsd) || availableUsd < 0) return false;
  const usdAmount = toPayloadUsdAmount(raw, mode);
  if (usdAmount === null) return false;
  return totalWithFee(Number(usdAmount), feeOnTopUsd(feeUsd)) > availableUsd;
}

/**
 * Maximum entry amount whose USD value *plus the fee* fits the available USD
 * balance — the largest figure "Max" can fill that the rails will actually
 * accept. Without a known fee this is the balance itself, as before.
 */
export function maxAmountForBalance(
  availableUsd: number,
  mode: AmountEntryMode,
  feeUsd?: string | number | null,
): string | null {
  if (!Number.isFinite(availableUsd) || availableUsd <= 0) return null;
  const budget = availableUsd - feeOnTopUsd(feeUsd);
  if (budget <= 0) return null;
  const currency = mode.currency.toUpperCase();
  let multiplier = 1;
  if (currency !== PAYLOAD_CURRENCY) {
    if (mode.rate === null || !Number.isFinite(mode.rate) || mode.rate <= 0) return null;
    multiplier = mode.rate;
  }
  let amount = Math.floor((budget * multiplier + Number.EPSILON) * 100) / 100;
  while (amount > 0) {
    const entered = amount.toFixed(2);
    const usdAmount = toPayloadUsdAmount(entered, mode);
    if (usdAmount !== null && Number(usdAmount) <= budget) return entered;
    amount = Math.round((amount - 0.01) * 100) / 100;
  }
  return null;
}

function formatMoney(value: number, currency: string): string {
  const isUsd = currency.toUpperCase() === PAYLOAD_CURRENCY;
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency.toUpperCase()}${isUsd ? "" : ""}`;
}

/**
 * The "≈ 129,000.00 KES" helper under the amount input — the other side of
 * whatever the user is currently typing in. Indicative only.
 */
export function describeAmountEquivalent(
  raw: string,
  mode: AmountEntryMode,
  localCurrency: string,
): string | null {
  const amount = parseAmount(raw);
  if (amount === null || !mode.rate) return null;
  const enteringUsd = mode.currency.toUpperCase() === PAYLOAD_CURRENCY;
  const converted = enteringUsd ? amount * mode.rate : amount / mode.rate;
  const target = enteringUsd ? localCurrency : PAYLOAD_CURRENCY;
  return `≈ ${formatMoney(converted, target)}`;
}

/** "1 USD = 130.50 KES". Used for both indicative and quoted rates — the
 *  caller decides which by what it passes in. */
export function formatRateLine(rate: number | string | null, currency: string): string | null {
  const n = typeof rate === "string" ? Number(rate) : rate;
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return null;
  return `1 ${PAYLOAD_CURRENCY} = ${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n)} ${currency.toUpperCase()}`;
}

/**
 * Fee shown in both currencies, e.g. "$1.20 (≈ 157.00 KES)".
 *
 * The local half is derived from the *quote's* rate, so it is consistent with
 * the figures beside it rather than with an indicative rate that may have
 * moved. Falls back to the USD half alone when there is no rate — showing one
 * honest number beats showing two where one is invented.
 */
export function formatFeeDual(
  usdFee: string,
  rate: number | string | null,
  currency: string,
): string {
  if (!/^\$?\d/.test(usdFee)) return usdFee; // "Included in the rate"
  const usd = parseAmount(usdFee.replace(/^\$/, ""));
  const n = typeof rate === "string" ? Number(rate) : rate;
  if (usd === null || n === null || n === undefined || !Number.isFinite(n) || n <= 0) {
    return usdFee;
  }
  return `${usdFee} (≈ ${formatMoney(usd * n, currency)})`;
}
