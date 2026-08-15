import type { ActivityItem } from "@/components/ui/ActivityList";
import type { BrandedDocument } from "@/lib/documents/brandedDocument";
import { formatTransactionDate } from "@/lib/services/transactionPresentation";
import {
  describeStellarStatus,
  formatStellarTxHash,
  stellarExplorerUrl,
  STELLAR_ASSET,
  STELLAR_NETWORK,
  type StellarActivity,
  type StellarActivityStatus,
} from "@/lib/services/stellarSimulation";

/**
 * Maps simulated Stellar activity onto the dashboard's shared presentation
 * shapes, so it renders through the same `ActivityList`, detail rows and
 * receipt template as everything else rather than growing a parallel UI.
 *
 * Chain-specific fields are emitted **only when present**. A pending transfer
 * has no transaction hash yet, and a deposit that arrived without a reference
 * has no memo — rendering empty rows for those would be worse than omitting
 * them, and would also break the assumption EVM rows rely on.
 */

/** `settled` is the one activity status without an account-level counterpart. */
function statusDescriptor(status: StellarActivityStatus) {
  if (status === "settled") {
    return {
      label: "Settled",
      icon: "✓",
      color: "var(--success)",
      soft: "color-mix(in srgb, var(--success) 10%, transparent)",
    };
  }
  return describeStellarStatus(status);
}

export function presentStellarActivity(
  activity: StellarActivity,
  now = new Date(),
): ActivityItem {
  const status = statusDescriptor(activity.status);
  const dateLabel = formatTransactionDate(activity.createdAt, now);
  return {
    id: activity.id,
    client: activity.title,
    type: activity.subtitle,
    amount: `${activity.direction === "in" ? "+" : "−"}${STELLAR_ASSET} ${activity.amount.replace(/^[+−-]/, "")}`,
    amountColor: activity.direction === "in" ? "var(--success)" : "var(--ink)",
    statusLabel: status.label,
    statusIcon: status.icon,
    statusColor: status.color,
    statusSoft: status.soft,
    dateLabel,
    meta: activity.memo ? `${dateLabel} · Ref ${activity.memo}` : dateLabel,
    flagUrl: null,
  };
}

export type StellarDetailRow = {
  label: string;
  value: string;
  mono?: boolean;
  /** Set only for a confirmed transaction — drives the explorer affordance. */
  href?: string;
};

/**
 * Detail rows for a Stellar transfer. Asset and network are always known;
 * hash and reference are conditional, which is what keeps this safe to splice
 * into the shared transaction detail beside EVM fields.
 */
export function buildStellarDetailRows(activity: StellarActivity): StellarDetailRow[] {
  const rows: StellarDetailRow[] = [
    { label: "Asset", value: activity.asset },
    { label: "Network", value: activity.network },
  ];

  if (activity.txHash) {
    const href = stellarExplorerUrl(activity.txHash);
    rows.push({
      label: "Transaction hash",
      value: formatStellarTxHash(activity.txHash),
      mono: true,
      ...(href ? { href } : {}),
    });
  }
  if (activity.memo) {
    rows.push({ label: "Payment reference", value: activity.memo, mono: true });
  }
  return rows;
}

/** Receipts exist only for transfers that actually settled. */
export function isStellarReceiptable(status: StellarActivityStatus): boolean {
  return status === "settled";
}

export function buildStellarReceipt(activity: StellarActivity): BrandedDocument {
  const inbound = activity.direction === "in";
  const settlement: { label: string; value: string; mono?: boolean }[] = [
    { label: "Asset", value: activity.asset },
    { label: "Network", value: activity.network },
  ];
  if (activity.txHash) {
    settlement.push({ label: "Transaction hash", value: activity.txHash, mono: true });
  }
  if (activity.memo) {
    settlement.push({ label: "Payment reference", value: activity.memo, mono: true });
  }
  settlement.push({
    label: inbound ? "Credited" : "Sent",
    value: new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(
      new Date(activity.createdAt),
    ),
    mono: true,
  });

  return {
    fileTitle: `Mboka — ${inbound ? "deposit" : "payout"} receipt`,
    heading: `${inbound ? "Deposit" : "Payout"} receipt`,
    subheading: activity.subtitle,
    amount: `${STELLAR_ASSET} ${activity.amount.replace(/^[+−-]/, "")}`,
    amountCaption: inbound ? "Received" : "Sent",
    sections: [
      {
        title: "Account",
        rows: [
          { label: "Account", value: "USDC Account" },
          { label: "Settlement network", value: STELLAR_NETWORK },
        ],
      },
      { title: "Settlement", rows: settlement },
    ],
    footnote: "Keep this receipt for your records.",
  };
}
