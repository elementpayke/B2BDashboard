/**
 * Home cash-flow cards (Money in / Money out · 30 days).
 *
 * Prefer FX-converted sums from live Mboka transactions over
 * `dashboard/summary` totals — those SQL aggregates sum raw `amount_fiat`
 * across currencies and the UI previously labeled the mix as `$`.
 */

import { convertAmountWithRates } from "@/lib/services/balances";
import type { ExchangeRates } from "@/lib/services/dashboard";
import type { Transaction } from "@/lib/services/transactions";

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type HomeMoneyFlowUsd = {
  moneyInUsd: number | null;
  moneyOutUsd: number | null;
};

function parseFiatAmount(value: string): number | null {
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Sum completed in/out orders from the last 30 days into USD using real FX.
 * Rows whose amount or currency can't be converted are skipped rather than
 * blanking the whole card — one exotic-currency transaction (e.g. a fiat
 * code the aggregator's indicative-rates snapshot doesn't cover yet)
 * shouldn't hide every other transaction's total. Never invents a rate for
 * the skipped row; it's just left out of the sum.
 */
export function moneyFlowFromTransactions(
  transactions: Transaction[],
  fx: ExchangeRates | null | undefined,
  now = new Date(),
): HomeMoneyFlowUsd {
  const cutoff = now.getTime() - WINDOW_MS;
  let moneyIn = 0;
  let moneyOut = 0;

  for (const tx of transactions) {
    if (tx.status !== "completed") continue;
    const created = Date.parse(tx.created_at);
    if (!Number.isFinite(created) || created < cutoff) continue;

    const amount = parseFiatAmount(tx.amount_fiat);
    if (amount == null) continue;

    const usd = convertAmountWithRates(amount, tx.currency, "USD", fx);
    if (usd == null) continue;
    if (tx.direction === "in") moneyIn += usd;
    else if (tx.direction === "out") moneyOut += usd;
  }

  return { moneyInUsd: moneyIn, moneyOutUsd: moneyOut };
}

/**
 * Sum processing-status transactions (any direction, all time) into USD using
 * real FX. Mirrors the Transactions screen's "Pending" filter
 * (`status === "processing"`, no date window) so the Home card and its
 * click-through agree. Rows that can't be converted are skipped rather than
 * blanking the whole card — see moneyFlowFromTransactions above.
 */
export function pendingAmountFromTransactions(
  transactions: Transaction[],
  fx: ExchangeRates | null | undefined,
): number | null {
  let pending = 0;

  for (const tx of transactions) {
    if (tx.status !== "processing") continue;

    const amount = parseFiatAmount(tx.amount_fiat);
    if (amount == null) continue;

    const usd = convertAmountWithRates(amount, tx.currency, "USD", fx);
    if (usd == null) continue;
    pending += Math.abs(usd);
  }

  return pending;
}

/** Format a USD cash-flow figure for the home stat cards. */
export function formatHomeCashFlowUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
