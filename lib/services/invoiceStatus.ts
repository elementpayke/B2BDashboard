import type { InvoiceStatus } from "./invoices";

export type InvoiceStatusDescriptor = {
  label: string;
  icon: string;
  color: string;
  soft: string;
};

export const INVOICE_STATUS: Record<InvoiceStatus, InvoiceStatusDescriptor> = {
  issued: {
    label: "Draft",
    icon: "✎",
    color: "var(--muted)",
    soft: "var(--surface2)",
  },
  pending: {
    label: "Pending",
    icon: "●",
    color: "var(--amber)",
    soft: "var(--amber-tint)",
  },
  sent: {
    label: "Sent",
    icon: "↗",
    color: "var(--amber)",
    soft: "var(--amber-tint)",
  },
  partially_paid: {
    label: "Partially Paid",
    icon: "◐",
    color: "var(--amber)",
    soft: "var(--amber-tint)",
  },
  paid: {
    label: "Paid",
    icon: "✓",
    color: "var(--success)",
    soft: "color-mix(in srgb, var(--success) 10%, transparent)",
  },
  expired: {
    label: "Expired",
    icon: "⏱",
    color: "var(--muted)",
    soft: "var(--surface2)",
  },
  failed: {
    label: "Failed",
    icon: "!",
    color: "var(--red)",
    soft: "var(--red-tint)",
  },
  void: {
    label: "Void",
    icon: "×",
    color: "var(--muted)",
    soft: "var(--surface2)",
  },
  canceled: {
    label: "Canceled",
    icon: "×",
    color: "var(--muted)",
    soft: "var(--surface2)",
  },
};

export function describeInvoiceStatus(status: string): InvoiceStatusDescriptor {
  return (
    INVOICE_STATUS[status as InvoiceStatus] ?? {
      label: status,
      icon: "·",
      color: "var(--muted)",
      soft: "var(--surface2)",
    }
  );
}
