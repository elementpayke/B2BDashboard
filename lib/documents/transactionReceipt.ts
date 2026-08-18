import type { BrandedDocument } from "@/lib/documents/brandedDocument";
import type { TransactionStatus } from "@/lib/services/transactions";
import { TRANSACTION_STATUS } from "@/lib/services/transactionStatus";

/**
 * Payment receipt for a settled transaction.
 *
 * Only the fields the backend actually returns on a transaction appear here
 * (see `Transaction` in lib/services/transactions.ts). There is no corridor
 * or provider column on that row yet, so the receipt states the settlement
 * layer and the order references rather than inventing a payout provider.
 */
export type ReceiptTransaction = {
  id: number;
  direction: string;
  status: string;
  amount_fiat: string;
  currency: string;
  aggregator_order_id?: string | null;
  external_order_id?: string | null;
  wallet_address?: string | null;
  provider?: string | null;
  crypto_currency?: string | null;
  crypto_network?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/** Terminal-and-successful — the only states a receipt should exist for. */
export function isReceiptable(status: string | null | undefined): boolean {
  const normalized = (status || "").toLowerCase() as TransactionStatus;
  return TRANSACTION_STATUS[normalized]?.receiptEligible ?? false;
}

function formatTimestamp(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(d);
}

export function receiptFilename(tx: ReceiptTransaction): string {
  const ref = tx.aggregator_order_id || tx.external_order_id || String(tx.id);
  return `mboka-receipt-${ref}`.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
}

export function buildTransactionReceipt(tx: ReceiptTransaction): BrandedDocument {
  const isOut = tx.direction === "out";
  const kind = isOut ? "Payout" : tx.direction === "in" ? "Deposit" : "Transaction";
  const created = formatTimestamp(tx.created_at);
  const settled = formatTimestamp(tx.updated_at);

  const reference: { label: string; value: string; mono?: boolean }[] = [
    { label: "Order ID", value: String(tx.id), mono: true },
  ];
  if (tx.aggregator_order_id) {
    reference.push({ label: "Aggregator reference", value: tx.aggregator_order_id, mono: true });
  }
  if (tx.external_order_id) {
    reference.push({ label: "Your reference", value: tx.external_order_id, mono: true });
  }

  const settlement: { label: string; value: string; mono?: boolean }[] = [];
  if (tx.provider) {
    settlement.push({ label: "Provider", value: tx.provider });
  }
  if (tx.crypto_currency || tx.crypto_network) {
    settlement.push({
      label: "Settlement asset",
      value: [tx.crypto_currency, tx.crypto_network].filter(Boolean).join(" · "),
    });
  }
  if (tx.wallet_address) {
    settlement.push({ label: "Wallet", value: tx.wallet_address, mono: true });
  }
  if (created) settlement.push({ label: "Created", value: created, mono: true });
  if (settled && settled !== created) {
    settlement.push({ label: "Settled", value: settled, mono: true });
  }

  return {
    fileTitle: `Mboka — ${kind.toLowerCase()} receipt`,
    heading: `${kind} receipt`,
    subheading: "This payment has settled.",
    amount: `${tx.currency} ${tx.amount_fiat}`,
    amountCaption: isOut ? "Sent" : "Received",
    sections: [
      { title: "Reference", rows: reference },
      { title: "Settlement", rows: settlement },
    ],
    footnote: "Keep this receipt for your records.",
  };
}
