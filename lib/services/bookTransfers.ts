/** Same-currency book transfers via Mboka entity accounts. */

import { apiEnvelope } from "@/lib/apiClient";

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
