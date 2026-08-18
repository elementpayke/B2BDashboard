import type { TransactionStatus } from "./transactions";

export type TransactionStatusDescriptor = {
  label: string;
  icon: string;
  color: string;
  soft: string;
  terminal: boolean;
  receiptEligible: boolean;
};

export const TRANSACTION_STATUS: Record<TransactionStatus, TransactionStatusDescriptor> = {
  processing: {
    label: "Pending",
    icon: "●",
    color: "var(--amber)",
    soft: "var(--amber-tint)",
    terminal: false,
    receiptEligible: false,
  },
  completed: {
    label: "Settled",
    icon: "✓",
    color: "var(--success)",
    soft: "color-mix(in srgb, var(--success) 10%, transparent)",
    terminal: true,
    receiptEligible: true,
  },
  failed: {
    label: "Failed",
    icon: "!",
    color: "var(--red)",
    soft: "var(--red-tint)",
    terminal: true,
    receiptEligible: false,
  },
  refunded: {
    label: "Refunded",
    icon: "↩",
    color: "var(--amber)",
    soft: "var(--amber-tint)",
    terminal: true,
    receiptEligible: false,
  },
  canceled: {
    label: "Canceled",
    icon: "×",
    color: "var(--muted)",
    soft: "var(--surface2)",
    terminal: true,
    receiptEligible: false,
  },
  frozen: {
    label: "Frozen",
    icon: "‖",
    color: "var(--red)",
    soft: "var(--red-tint)",
    terminal: false,
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
