/** External bank payouts via Mboka (methods discovered from Aggregator). */

import { apiEnvelope } from "@/lib/apiClient";

export type PayoutMethod = {
  id?: string;
  method?: string;
  currency?: string;
  country?: string;
  label?: string;
  [key: string]: unknown;
};

export type PayoutPreview = {
  preview_token?: string;
  amount?: string;
  fee?: string | null;
  currency?: string;
  [key: string]: unknown;
};

export type PayoutResult = {
  id?: string;
  status?: string;
  amount?: string;
  currency?: string;
  [key: string]: unknown;
};

export const payoutsApi = {
  methods: (entityId: string, accountId: string) =>
    apiEnvelope<{ methods?: PayoutMethod[] } | PayoutMethod[]>(
      "GET",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/payout-methods`,
    ),
  banks: (entityId: string, accountId: string, country?: string) => {
    const q = country ? `?country=${encodeURIComponent(country)}` : "";
    return apiEnvelope<{ banks?: unknown[] } | unknown[]>(
      "GET",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/payout-banks${q}`,
    );
  },
  preview: (entityId: string, accountId: string, body: Record<string, unknown>) =>
    apiEnvelope<PayoutPreview>(
      "POST",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/payouts/preview`,
      body,
    ),
  confirm: (entityId: string, accountId: string, body: Record<string, unknown>) =>
    apiEnvelope<PayoutResult>(
      "POST",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/payouts`,
      body,
    ),
  get: (entityId: string, accountId: string, payoutId: string) =>
    apiEnvelope<PayoutResult>(
      "GET",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/payouts/${encodeURIComponent(payoutId)}`,
    ),
};
