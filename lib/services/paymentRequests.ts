/** Payment-request (Interac / open banking) fund APIs via Mboka. */

import { apiEnvelope } from "@/lib/apiClient";

export type PaymentRequestMethod = "interac" | "open_banking" | "momo";

export type PaymentRequestPayer = {
  name?: string | null;
  email?: string | null;
};

export type PaymentRequest = {
  id: string;
  entity_id: string;
  account_id: string;
  method: string;
  status: string;
  currency?: string | null;
  amount?: string | null;
  client_ref?: string | null;
  requires_authentication?: boolean;
  requires_hosted_checkout?: boolean;
  redirect_url?: string | null;
  narration?: string | null;
  payer?: PaymentRequestPayer | null;
  reference_number?: string | null;
  security_question?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  failure?: { code?: string | null } | null;
};

export type PaymentRequestCreatePayload = {
  method: PaymentRequestMethod;
  amount: string;
  client_ref: string;
  redirect_url: string;
  narration: string;
  payer?: { name: string; email: string };
  country_code?: string;
};

const TERMINAL = new Set(["settled", "failed", "expired", "cancelled"]);

export function isTerminalPaymentRequestStatus(status: string | null | undefined): boolean {
  return TERMINAL.has((status || "").trim().toLowerCase());
}

/** Map fiat currency to Aggregator payment-request method when IBAN is unavailable. */
export function remittanceMethodForCurrency(
  currency: string | null | undefined,
): PaymentRequestMethod | null {
  const code = (currency || "").trim().toUpperCase();
  if (code === "CAD") return "interac";
  if (code === "EUR" || code === "GBP") return "open_banking";
  return null;
}

export function remittanceMethodLabel(method: PaymentRequestMethod): string {
  if (method === "interac") return "Interac";
  if (method === "open_banking") return "Open banking";
  return "Mobile money";
}

export const paymentRequestsApi = {
  create: (entityId: string, accountId: string, payload: PaymentRequestCreatePayload) =>
    apiEnvelope<PaymentRequest>(
      "POST",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/payment-requests`,
      payload,
    ),
  list: (entityId: string, accountId: string, params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.limit != null) q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiEnvelope<{ entity_id: string; account_id: string; payment_requests: PaymentRequest[] }>(
      "GET",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/payment-requests${qs ? `?${qs}` : ""}`,
    );
  },
  get: (entityId: string, accountId: string, requestId: string) =>
    apiEnvelope<PaymentRequest>(
      "GET",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/payment-requests/${encodeURIComponent(requestId)}`,
    ),
  confirm: (entityId: string, accountId: string, requestId: string) =>
    apiEnvelope<PaymentRequest>(
      "POST",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/payment-requests/${encodeURIComponent(requestId)}/confirm`,
    ),
};
