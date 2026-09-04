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
 * Returns `0` when nothing settled in-window; `null` when any in-window
 * completed row cannot be converted (fail closed — never invent rates).
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
    if (amount == null) {
      return { moneyInUsd: null, moneyOutUsd: null };
    }

    const usd = convertAmountWithRates(amount, tx.currency, "USD", fx);
    if (usd == null) {
      return { moneyInUsd: null, moneyOutUsd: null };
    }
    if (tx.direction === "in") moneyIn += usd;
    else if (tx.direction === "out") moneyOut += usd;
  }

  return { moneyInUsd: moneyIn, moneyOutUsd: moneyOut };
}

/** Format a USD cash-flow figure for the home stat cards. */
export function formatHomeCashFlowUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
