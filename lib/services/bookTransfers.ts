/** Same-currency book transfers via Mboka entity accounts. */

import { apiEnvelope } from "@/lib/apiClient";
import type { ConversionOut } from "@/lib/services/conversions";

export type BookTransferPreview = {
  preview_token?: string;
  amount?: string;
  currency?: string;
  fee?: string | null;
  /** What actually leaves the source account, when the aggregator states it. */
  total_debit?: string | null;
  destination_account_id?: string;
  expires_at?: string | null;
  [key: string]: unknown;
};

export type BookTransferResult = {
  id?: string;
  status?: string;
  amount?: string;
  currency?: string;
  [key: string]: unknown;
};

/**
 * The figure to show as "Total deducted", or null when we cannot state one
 * honestly.
 *
 * Prefers whatever the aggregator itself returned. The one case where it is
 * safe to fall back to the amount is a fee the backend has explicitly called
 * zero — then the total *is* the amount, which is an identity rather than a
 * client-side sum. A missing or unparseable fee yields null so the UI says
 * when the total will be known instead of adding numbers on the user's
 * behalf.
 */
export function bookTransferTotalDebit(
  preview: BookTransferPreview | null | undefined,
): string | null {
  if (!preview) return null;
  const stated = preview.total_debit ?? preview.total ?? preview.balance_required;
  if (stated != null && String(stated).trim()) return String(stated).trim();
  const fee = preview.fee;
  if (fee == null || !String(fee).trim()) return null;
  const feeNumber = Number(String(fee).replace(/,/g, ""));
  if (!Number.isFinite(feeNumber) || feeNumber !== 0) return null;
  const amount = preview.amount;
  return amount != null && String(amount).trim() ? String(amount).trim() : null;
}

/**
 * Map a book-transfer preview into the Convert UI's quote shape.
 *
 * Convert resolves a same-currency pair to this rail (route 1), and the rest
 * of the flow — timer, fee row, accept button — is written against
 * `ConversionOut`. Normalizing here is what lets a third backend join without
 * the component growing a third set of branches, the same trick
 * `ledgerPreviewToConversionOut` already plays.
 *
 * Nothing is computed: `destination_amount` is the source amount because a
 * book transfer is not an FX trade — the aggregator credits what it debits
 * and prices the fee at a literal zero (`fee_minor = 0` in `book_transfer.py`),
 * which the fee row then renders as "No fee" on its own.
 */
export function bookTransferPreviewToConversionOut(
  preview: BookTransferPreview | null | undefined,
  ids: { sourceAccountId: string; destinationAccountId: string; currency?: string },
): ConversionOut {
  const token = String(preview?.preview_token || "").trim();
  if (!token) {
    throw new Error("Book transfer preview did not return a preview_token.");
  }
  const currency = String(preview?.currency || ids.currency || "").toUpperCase();
  const amount =
    preview?.amount == null || String(preview.amount).trim() === ""
      ? ""
      : String(preview.amount);
  return {
    id: token,
    status: "quoted",
    direction: "book_transfer",
    source_account_id: String(preview?.from_account_id ?? ids.sourceAccountId),
    destination_account_id: String(
      preview?.to_account_id ?? preview?.destination_account_id ?? ids.destinationAccountId,
    ),
    source_currency: currency,
    destination_currency: currency,
    source_amount: amount,
    destination_amount: amount || null,
    fee_amount: preview?.fee == null ? null : String(preview.fee),
    fee_currency: currency || null,
    quote_id: token,
    order_id: null,
    ledger_journal_reference: null,
    expires_at: preview?.expires_at ? String(preview.expires_at) : null,
  };
}

export function bookTransferResultToConversionOut(
  result: BookTransferResult | null | undefined,
  fallback: ConversionOut,
): ConversionOut {
  const amount =
    result?.amount == null || String(result.amount).trim() === ""
      ? null
      : String(result.amount);
  const currency = String(result?.currency || fallback.source_currency).toUpperCase();
  return {
    ...fallback,
    id: String(result?.id || fallback.id),
    status: String(result?.status || "completed"),
    source_amount: amount ?? fallback.source_amount,
    destination_amount: amount ?? fallback.destination_amount,
    source_currency: currency,
    destination_currency: currency,
    order_id: null,
  };
}

export const bookTransfersApi = {
  preview: (
    entityId: string,
    accountId: string,
    body: { destination_account_id: string; amount: string; currency?: string },
  ) =>
    apiEnvelope<BookTransferPreview>(
      "POST",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/book-transfers/preview`,
      body,
    ),
  confirm: (entityId: string, accountId: string, body: Record<string, unknown>) =>
    apiEnvelope<BookTransferResult>(
      "POST",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/book-transfers`,
      body,
    ),
};
