import type { ActivityItem } from "@/components/ui/ActivityList";
import { transactionPartyLabel } from "@/lib/services/channelLabels";
import { formatNetworkLabel } from "@/lib/services/entities";
import { formatTransactionDate } from "@/lib/services/transactionPresentation";
import { describeTransactionStatus } from "@/lib/services/transactionStatus";
import { stellarExplorerTxUrl } from "@/lib/stellar/network";
import type { OnchainWalletPayment } from "./walletPayments";

export type LinkedWalletActivityItem = ActivityItem & {
  tx_hash?: string | null;
  created_at?: string | null;
};

/** Prefix for in-app detail ids that are Horizon-only (not ElementPay rows). */
export const ONCHAIN_TX_DETAIL_PREFIX = "onchain:";

export function onchainTxDetailId(txHash: string): string {
  return `${ONCHAIN_TX_DETAIL_PREFIX}${txHash.trim()}`;
}

export function parseOnchainTxDetailId(
  id: string | number | null | undefined,
): string | null {
  const value = String(id ?? "").trim();
  if (!value.startsWith(ONCHAIN_TX_DETAIL_PREFIX)) return null;
  const hash = value.slice(ONCHAIN_TX_DETAIL_PREFIX.length).trim();
  return hash || null;
}

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

/**
 * Presentation shape for TxDetailModal — row click opens this, not the explorer.
 * Explorer is a separate "View on chain" action inside the modal.
 */
export function presentOnchainWalletPayment(
  payment: OnchainWalletPayment,
  options: { network: string },
) {
  const status = describeTransactionStatus("completed");
  const dateLabel = formatTransactionDate(payment.createdAt);
  const amountSign = payment.direction === "out" ? "−" : "+";
  const explorerUrl = stellarExplorerTxUrl({
    txHash: payment.txHash,
    network: options.network,
  });
  const type = payment.direction === "in" ? "Stellar deposit" : "Stellar send";
  const amount = `${amountSign}${formatUsdcAmount(payment.amount)} USDC`;

  return {
    id: onchainTxDetailId(payment.txHash),
    direction: payment.direction,
    status: "completed" as const,
    currency: "USDC",
    amount_fiat: payment.amount,
    created_at: payment.createdAt,
    updated_at: payment.createdAt,
    tx_hash: payment.txHash,
    from_address: payment.from,
    to_address: payment.to,
    memo: payment.memo,
    crypto_network: options.network,
    provider: "stellar",
    wallet_address: payment.direction === "in" ? payment.to : payment.from,
    client: transactionPartyLabel({
      direction: payment.direction,
      currency: "USDC",
      provider: "stellar",
    }),
    type,
    amount,
    amountColor: payment.direction === "in" ? "var(--success)" : "var(--ink)",
    ref: payment.txHash,
    meta: `${dateLabel} · Tx ${shortHash(payment.txHash)}`,
    dateLabel,
    statusLabel: status.label,
    statusIcon: status.icon,
    statusColor: status.color,
    statusSoft: status.soft,
    flagUrl: null,
    partyName: null,
    accountNumber: null,
    accountKind: null,
    networkName: null,
    methodType: null,
    railType: null,
    explorerUrl,
    cryptoNetworkLabel: formatNetworkLabel(options.network) || "Stellar",
    /** Horizon-only rows — no ElementPay receipt yet. */
    hideReceipt: true,
  };
}

export function walletPaymentToActivityItem(
  payment: OnchainWalletPayment,
  options: {
    network: string;
    /** Opens in-app detail (from/to/time). Explorer stays a modal action. */
    onOpenDetail?: (payment: OnchainWalletPayment) => void;
  },
): ActivityItem {
  const presented = presentOnchainWalletPayment(payment, { network: options.network });

  return {
    id: presented.id,
    client: presented.client,
    type: presented.type,
    amount: presented.amount,
    amountColor: presented.amountColor,
    statusLabel: presented.statusLabel,
    statusIcon: presented.statusIcon,
    statusColor: presented.statusColor,
    statusSoft: presented.statusSoft,
    dateLabel: presented.dateLabel,
    meta: presented.meta,
    openDetail: options.onOpenDetail
      ? () => options.onOpenDetail?.(payment)
      : undefined,
  };
}

export function mergeWalletPaymentsWithElementActivity(opts: {
  payments: OnchainWalletPayment[];
  elementActivity: LinkedWalletActivityItem[];
  network: string;
  limit?: number;
  onOpenDetail?: (payment: OnchainWalletPayment) => void;
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
      return (
        linked ??
        walletPaymentToActivityItem(payment, {
          network: opts.network,
          onOpenDetail: opts.onOpenDetail,
        })
      );
    })
    .slice(0, opts.limit ?? 25);
}
