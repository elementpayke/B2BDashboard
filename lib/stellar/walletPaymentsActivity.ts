import type { ActivityItem } from "@/components/ui/ActivityList";
import { transactionPartyLabel } from "@/lib/services/channelLabels";
import { formatTransactionDate } from "@/lib/services/transactionPresentation";
import { describeTransactionStatus } from "@/lib/services/transactionStatus";
import { stellarExplorerTxUrl } from "@/lib/stellar/network";
import type { OnchainWalletPayment } from "./walletPayments";

export type LinkedWalletActivityItem = ActivityItem & {
  tx_hash?: string | null;
  created_at?: string | null;
};

function formatUsdcAmount(amount: string): string {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return amount;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericAmount);
}

function shortHash(hash: string): string {
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function normalizeHash(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function createdAtMs(value: string | null | undefined): number {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? time : 0;
}

export function walletPaymentToActivityItem(
  payment: OnchainWalletPayment,
  options: { network: string },
): ActivityItem {
  const status = describeTransactionStatus("completed");
  const dateLabel = formatTransactionDate(payment.createdAt);
  const amountSign = payment.direction === "out" ? "−" : "+";
  const explorerUrl = stellarExplorerTxUrl({
    txHash: payment.txHash,
    network: options.network,
  });

  return {
    id: payment.pagingToken,
    client: transactionPartyLabel({
      direction: payment.direction,
      currency: "USDC",
      provider: "stellar",
    }),
    type: payment.direction === "in" ? "Stellar deposit" : "Stellar send",
    amount: `${amountSign}${formatUsdcAmount(payment.amount)} USDC`,
    amountColor: payment.direction === "in" ? "var(--success)" : "var(--ink)",
    statusLabel: status.label,
    statusIcon: status.icon,
    statusColor: status.color,
    statusSoft: status.soft,
    dateLabel,
    meta: `${dateLabel} · Tx ${shortHash(payment.txHash)}`,
    openDetail: explorerUrl
      ? () => window.open(explorerUrl, "_blank", "noopener,noreferrer")
      : undefined,
  };
}

export function mergeWalletPaymentsWithElementActivity(opts: {
  payments: OnchainWalletPayment[];
  elementActivity: LinkedWalletActivityItem[];
  network: string;
  limit?: number;
}): ActivityItem[] {
  const byHash = new Map<string, LinkedWalletActivityItem>();
  for (const item of opts.elementActivity) {
    const hash = normalizeHash(item.tx_hash);
    if (!hash || byHash.has(hash)) continue;
    byHash.set(hash, item);
  }

  return [...opts.payments]
    .sort((a, b) => createdAtMs(b.createdAt) - createdAtMs(a.createdAt))
    .map((payment) => {
      const linked = byHash.get(normalizeHash(payment.txHash));
      return linked ?? walletPaymentToActivityItem(payment, { network: opts.network });
    })
    .slice(0, opts.limit ?? 25);
}
