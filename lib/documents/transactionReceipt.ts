import type { BrandedDocument } from "@/lib/documents/brandedDocument";
import {
  displayChannelName,
  isInternalProviderName,
  type RailKind,
} from "@/lib/services/channelLabels";
import type { TransactionStatus } from "@/lib/services/transactions";
import { TRANSACTION_STATUS } from "@/lib/services/transactionStatus";

/**
 * Customer-facing payment receipt for a settled transaction.
 *
 * Intentionally web2 / fintech: no wallet addresses, chains, or crypto asset
 * lines. Payment rails surface as Mobile money / Bank transfer / M-Pesa, with
 * PSP refs (M-Pesa code, bank reference) when the backend provides them.
 */
export type ReceiptTransaction = {
  id: number | string;
  direction: string;
  status: string;
  amount_fiat: string;
  currency: string;
  aggregator_order_id?: string | null;
  external_order_id?: string | null;
  psp_transaction_id?: string | null;
  provider?: string | null;
  /** Optional rail hint when known (mobile / bank). */
  railType?: RailKind | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Presentation party label when already computed (e.g. "Deposit · KES"). */
  client?: string | null;
  /** Recipient (payout) or payer (deposit). */
  partyName?: string | null;
  /**
   * Account-holder name when distinct from `partyName`
   * (quote `destination.accountName` / `payment.account_name`).
   */
  accountName?: string | null;
  /** Bank account or M-Pesa / mobile-money number. */
  accountNumber?: string | null;
  accountKind?: "phone" | "bank_account" | string | null;
  /** Human rail label from quote (e.g. M-PESA). */
  networkName?: string | null;
  methodType?: string | null;
  /** On-chain hash when Mboka returned one (Stellar inbound credits). */
  tx_hash?: string | null;
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

function formatMoney(amount: string, currency: string): string {
  const code = (currency || "").trim().toUpperCase() || "USD";
  const n = Number(String(amount).replace(/,/g, ""));
  if (!Number.isFinite(n)) return `${code} ${amount}`.trim();
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${code} ${formatted}`;
}

function kindLabel(direction: string): "Payout" | "Deposit" | "Payment" {
  if (direction === "out") return "Payout";
  if (direction === "in") return "Deposit";
  return "Payment";
}

function railFromPayment(tx: ReceiptTransaction): RailKind | null {
  if (tx.railType) return tx.railType;
  const kind = (tx.accountKind || "").toLowerCase();
  const method = (tx.methodType || "").toLowerCase();
  if (kind === "phone" || method.includes("mobile") || method === "momo") return "mobile";
  if (kind === "bank_account" || method === "bank") return "bank";
  return null;
}

/**
 * Customer-facing payment method. Prefer the catalog / PSP institution name
 * (M-PESA, Access Bank) when known; never surface aggregator slugs.
 */
export function receiptPaymentMethod(
  provider?: string | null,
  railType?: RailKind | null,
  networkName?: string | null,
): string {
  const institution = networkName?.trim() || "";
  if (institution && !isInternalProviderName(institution)) {
    return institution;
  }
  const hint = `${networkName || ""} ${provider || ""}`.trim();
  const lower = hint.toLowerCase();
  if (/\bm-?pesa\b/.test(lower)) return "M-Pesa";
  if (/\bairtel\b/.test(lower)) return "Airtel Money";
  if (/\bmtn\b|\bmomo\b/.test(lower)) return "Mobile money";
  if (/\btigo\b|\bhalopesa\b|\bt[\s-]?pesa\b/.test(lower)) return "Mobile money";
  if (/\bbank\b|\beft\b|\bsepa\b|\bach\b|\bswift\b|\biban\b/.test(lower)) {
    return "Bank transfer";
  }
  if (railType === "mobile" || railType === "momo") return "Mobile money";
  if (railType === "bank") return "Bank transfer";
  const raw = provider?.trim() || "";
  if (!raw || isInternalProviderName(raw)) {
    return displayChannelName(railType, null);
  }
  return displayChannelName(railType, raw);
}

/** Label for the PSP / network confirmation code. */
export function receiptPaymentRefLabel(
  provider?: string | null,
  railType?: RailKind | null,
  networkName?: string | null,
): string {
  const method = receiptPaymentMethod(provider, railType, networkName).toLowerCase();
  if (method.includes("m-pesa") || method.includes("mpesa")) return "M-Pesa reference";
  if (method.includes("airtel")) return "Airtel Money reference";
  if (method.includes("mobile")) return "Mobile money reference";
  if (method.includes("bank")) return "Bank reference";
  return "Payment reference";
}

/** Counterparty name row label. */
export function receiptPartyLabel(direction: string): string {
  if (direction === "out") return "Recipient";
  if (direction === "in") return "Payer";
  return "Counterparty";
}

/** Account / phone row label. */
export function receiptAccountLabel(
  direction: string,
  accountKind?: string | null,
  networkName?: string | null,
  provider?: string | null,
  railType?: RailKind | null,
): string {
  const method = receiptPaymentMethod(provider, railType, networkName).toLowerCase();
  const kind = (accountKind || "").toLowerCase();
  if (kind === "phone" || method.includes("m-pesa") || method.includes("mobile")) {
    if (method.includes("m-pesa")) return "M-Pesa number";
    return "Mobile number";
  }
  if (kind === "bank_account" || method.includes("bank")) return "Bank account";
  return direction === "out" ? "Destination account" : "Source account";
}

/** Label for the bank / mobile-money institution (catalog provider name). */
export function receiptInstitutionLabel(
  railType?: RailKind | null,
  accountKind?: string | null,
  networkName?: string | null,
  provider?: string | null,
): string {
  const method = receiptPaymentMethod(provider, railType, networkName).toLowerCase();
  const kind = (accountKind || "").toLowerCase();
  if (kind === "bank_account" || method.includes("bank")) return "Bank";
  if (method.includes("m-pesa") || method.includes("airtel") || method.includes("mobile")) {
    return "Network";
  }
  if (kind === "phone") return "Network";
  return "Institution";
}

/** Primary customer-facing receipt / order number. */
export function receiptNumber(tx: ReceiptTransaction): string {
  return (
    tx.external_order_id?.trim() ||
    tx.aggregator_order_id?.trim() ||
    `MBK-${tx.id}`
  );
}

export function receiptFilename(tx: ReceiptTransaction): string {
  const ref = receiptNumber(tx);
  return `mboka-receipt-${ref}`.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
}

export function buildTransactionReceipt(tx: ReceiptTransaction): BrandedDocument {
  const kind = kindLabel(tx.direction);
  const isOut = tx.direction === "out";
  const created = formatTimestamp(tx.created_at);
  const settled = formatTimestamp(tx.updated_at);
  const rail = railFromPayment(tx);
  const method = receiptPaymentMethod(tx.provider, rail, tx.networkName);
  const number = receiptNumber(tx);
  const party =
    tx.client?.trim() ||
    `${kind} · ${(tx.currency || "").toUpperCase() || "—"}`;

  const paymentRows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Payment method", value: method },
    { label: "Currency", value: (tx.currency || "").toUpperCase() || "—" },
  ];
  const partyName = tx.partyName?.trim();
  if (partyName) {
    paymentRows.push({ label: receiptPartyLabel(tx.direction), value: partyName });
  }
  const accountName = tx.accountName?.trim();
  if (accountName && accountName.toLowerCase() !== (partyName || "").toLowerCase()) {
    paymentRows.push({ label: "Account name", value: accountName });
  }
  const institution = tx.networkName?.trim();
  const methodIsInstitution =
    Boolean(institution) &&
    institution!.toLowerCase() === method.toLowerCase();
  if (institution && !methodIsInstitution) {
    paymentRows.push({
      label: receiptInstitutionLabel(rail, tx.accountKind, institution, tx.provider),
      value: institution,
    });
  }
  const accountNumber = tx.accountNumber?.trim();
  if (accountNumber) {
    paymentRows.push({
      label: receiptAccountLabel(
        tx.direction,
        tx.accountKind,
        tx.networkName,
        tx.provider,
        rail,
      ),
      value: accountNumber,
      mono: true,
    });
  }
  if (tx.psp_transaction_id?.trim()) {
    paymentRows.push({
      label: receiptPaymentRefLabel(tx.provider, rail, tx.networkName),
      value: tx.psp_transaction_id.trim(),
      mono: true,
    });
  }

  const referenceRows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Receipt number", value: number, mono: true },
    { label: "Transaction ID", value: String(tx.id), mono: true },
  ];
  const txHash = tx.tx_hash?.trim();
  if (txHash) {
    referenceRows.push({ label: "Tx hash", value: txHash, mono: true });
  }
  // Second order id when both external and aggregator exist and differ.
  if (
    tx.external_order_id?.trim() &&
    tx.aggregator_order_id?.trim() &&
    tx.external_order_id.trim() !== tx.aggregator_order_id.trim()
  ) {
    referenceRows.push({
      label: "Order reference",
      value: tx.aggregator_order_id.trim(),
      mono: true,
    });
  }
  if (created) referenceRows.push({ label: "Date initiated", value: created });
  if (settled && settled !== created) {
    referenceRows.push({ label: "Date settled", value: settled });
  }

  return {
    fileTitle: `Mboka — ${kind.toLowerCase()} receipt`,
    heading: `${kind} receipt`,
    subheading:
      "Official confirmation of a settled payment on your Mboka business account.",
    statusBadge: "Settled",
    amount: formatMoney(tx.amount_fiat, tx.currency),
    amountCaption: isOut ? "Amount sent" : "Amount received",
    party,
    sections: [
      { title: "Payment", rows: paymentRows },
      { title: "References", rows: referenceRows },
    ],
    footnote: "Keep this receipt for your records and reconciliation.",
  };
}
