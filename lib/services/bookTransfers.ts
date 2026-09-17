/** Same-currency book transfers via Mboka entity accounts. */

import { apiEnvelope } from "@/lib/apiClient";

export type BookTransferPreview = {
  preview_token?: string;
  amount?: string;
  currency?: string;
  fee?: string | null;
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
