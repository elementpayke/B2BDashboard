import type { TransactionStatus } from "./transactions";

/** Semantic tone — drives colour in badges, the detail hero and documents. */
export type TransactionStatusTone = "success" | "warning" | "danger" | "neutral";

export type TransactionStatusDescriptor = {
  label: string;
  tone: TransactionStatusTone;
  icon: string;
  color: string;
  soft: string;
  terminal: boolean;
  receiptEligible: boolean;
};

export const TRANSACTION_STATUS: Record<TransactionStatus, TransactionStatusDescriptor> = {
  processing: {
    tone: "warning",
    label: "Pending",
    icon: "●",
    color: "var(--amber-text)",
    soft: "var(--amber-tint)",
    terminal: false,
    receiptEligible: false,
  },
  completed: {
    tone: "success",
    label: "Settled",
    icon: "✓",
    color: "var(--success)",
    soft: "var(--success-tint)",
    terminal: true,
    receiptEligible: true,
  },
  failed: {
    tone: "danger",
    label: "Failed",
    icon: "!",
    color: "var(--red-text)",
    soft: "var(--red-tint)",
    terminal: true,
    receiptEligible: false,
  },
  refunded: {
    tone: "warning",
    label: "Refunded",
    icon: "↩",
    color: "var(--amber-text)",
    soft: "var(--amber-tint)",
    terminal: true,
    receiptEligible: false,
  },
  canceled: {
    tone: "neutral",
    label: "Canceled",
    icon: "×",
    color: "var(--muted)",
    soft: "var(--surface2)",
    terminal: true,
    receiptEligible: false,
  },
  frozen: {
    tone: "danger",
    label: "Frozen",
    icon: "‖",
    color: "var(--red-text)",
    soft: "var(--red-tint)",
    terminal: false,
    receiptEligible: false,
  },
  declined: {
    tone: "danger",
    label: "Declined",
    icon: "!",
    color: "var(--red-text)",
    soft: "var(--red-tint)",
    terminal: true,
    receiptEligible: false,
  },
};

export function describeTransactionStatus(
  status: TransactionStatus,
): TransactionStatusDescriptor {
  return TRANSACTION_STATUS[status];
}

export function isTerminalTransactionStatus(status: TransactionStatus): boolean {
  return TRANSACTION_STATUS[status].terminal;
}
