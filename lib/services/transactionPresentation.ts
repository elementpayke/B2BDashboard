import type { Transaction } from "./transactions";
import { describeTransactionStatus } from "./transactionStatus";

export type TransactionPresentation = Transaction & {
  client: string;
  type: string;
  amount: string;
  amountColor: string;
  ref: string;
  meta: string;
  dateLabel: string;
  statusLabel: string;
  statusIcon: string;
  statusColor: string;
  statusSoft: string;
  flagUrl: null;
};

function typeLabel(transaction: Transaction): string {
  if (transaction.direction === "in") return "Deposit";
  if (transaction.direction === "out") return "Payout";
  return "Transaction";
}

function shortReference(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}…${value.slice(-5)}`;
}

export function transactionReference(transaction: Transaction): string {
  return (
    transaction.external_order_id ||
    transaction.aggregator_order_id ||
    transaction.psp_transaction_id ||
    `EP-${transaction.id}`
  );
}

export function formatTransactionDate(value: string, now = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  const time = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDelta = Math.round(
    (startToday.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (dayDelta === 0) return `Today, ${time}`;
  if (dayDelta === 1) return `Yesterday, ${time}`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function presentTransaction(transaction: Transaction): TransactionPresentation {
  const status = describeTransactionStatus(transaction.status);
  const kind = typeLabel(transaction);
  const currency = transaction.currency.toUpperCase();
  const sign = transaction.direction === "out" ? "−" : transaction.direction === "in" ? "+" : "";
  const numericAmount = Number(transaction.amount_fiat);
  const formattedAmount = Number.isFinite(numericAmount)
    ? new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numericAmount)
    : transaction.amount_fiat;
  const ref = transactionReference(transaction);
  const dateLabel = formatTransactionDate(transaction.created_at);
  const provider = transaction.provider?.trim();

  return {
    ...transaction,
    client: provider || `${kind} · ${currency}`,
    type: kind,
    amount: `${sign}${formattedAmount} ${currency}`,
    amountColor: sign === "+" ? "var(--success)" : "var(--ink)",
    ref,
    meta: `${dateLabel} · Ref ${shortReference(ref)}`,
    dateLabel,
    statusLabel: status.label,
    statusIcon: status.icon,
    statusColor: status.color,
    statusSoft: status.soft,
    flagUrl: null,
  };
}
