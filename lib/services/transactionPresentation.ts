import { buildSendExplorerUrl } from "./accountSends";
import { isInboundStellarDeposit } from "./accountCredits";
import { transactionPartyLabel } from "./channelLabels";
import { formatNetworkLabel } from "./entities";
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
  /** Flattened for modal + PDF receipt. Recipient (out) / payer (in). */
  partyName: string | null;
  /**
   * Account-holder name when present and distinct from `partyName`
   * (send quote stores recipient as `payment.account_name`).
   */
  accountName: string | null;
  accountNumber: string | null;
  accountKind: string | null;
  networkName: string | null;
  methodType: string | null;
  railType: "mobile" | "bank" | null;
  /** Network-aware explorer URL (or null) when `tx_hash` can be linked. */
  explorerUrl: string | null;
  /** Human network label for detail rows (e.g. Stellar). */
  cryptoNetworkLabel: string | null;
};

/** Receiver/payer display name: party_name preferred, else account_name (quote destination). */
export function resolvePartyDisplayName(payment: Transaction["payment"]): {
  partyName: string | null;
  accountName: string | null;
} {
  const party = payment?.party_name?.trim() || null;
  const account = payment?.account_name?.trim() || null;
  if (party && account && party.toLowerCase() !== account.toLowerCase()) {
    return { partyName: party, accountName: account };
  }
  return {
    partyName: party || account,
    accountName: null,
  };
}

function typeLabel(transaction: Transaction): string {
  if (isInboundStellarDeposit(transaction)) return "Stellar deposit";
  if (transaction.direction === "in") return "Deposit";
  if (transaction.direction === "out") return "Payout";
  return "Transaction";
}

function shortReference(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}…${value.slice(-5)}`;
}

export function transactionReference(transaction: Transaction): string {
  if (isInboundStellarDeposit(transaction)) {
    const hash = transaction.tx_hash?.trim();
    if (hash) return hash;
    const creditId = String(transaction.id || "").trim();
    if (creditId.startsWith("acr_")) return creditId;
  }
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

function railTypeFromPayment(transaction: Transaction): "mobile" | "bank" | null {
  const payment = transaction.payment;
  if (!payment) return null;
  const kind = (payment.account_kind || "").toLowerCase();
  const method = (payment.method_type || "").toLowerCase();
  if (kind === "phone" || method.includes("mobile") || method === "momo") return "mobile";
  if (kind === "bank_account" || method === "bank") return "bank";
  return null;
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
  const payment = transaction.payment;
  const { partyName, accountName } = resolvePartyDisplayName(payment);
  const workflowLabel = transactionPartyLabel({
    direction: transaction.direction,
    currency: transaction.currency,
    provider: transaction.provider,
  });
  const explorerUrl = buildSendExplorerUrl({
    txHash: transaction.tx_hash,
    network: transaction.crypto_network,
  });
  const cryptoNetworkLabel = transaction.crypto_network
    ? formatNetworkLabel(transaction.crypto_network)
    : null;

  // List title: prefer recipient/payer name when Mboka sent payment details.
  // Fallback stays workflow · currency (never partner brands).
  const client = partyName || workflowLabel;
  const meta = partyName
    ? `${workflowLabel} · ${dateLabel} · Ref ${shortReference(ref)}`
    : `${dateLabel} · Ref ${shortReference(ref)}`;

  return {
    ...transaction,
    client,
    type: kind,
    amount: `${sign}${formattedAmount} ${currency}`,
    amountColor: sign === "+" ? "var(--success)" : "var(--ink)",
    ref,
    meta,
    dateLabel,
    statusLabel: status.label,
    statusIcon: status.icon,
    statusColor: status.color,
    statusSoft: status.soft,
    flagUrl: null,
    partyName,
    accountName,
    accountNumber: payment?.account_number?.trim() || null,
    accountKind: payment?.account_kind?.trim() || null,
    networkName: payment?.network_name?.trim() || null,
    methodType: payment?.method_type?.trim() || null,
    railType: railTypeFromPayment(transaction),
    explorerUrl,
    cryptoNetworkLabel,
  };
}
