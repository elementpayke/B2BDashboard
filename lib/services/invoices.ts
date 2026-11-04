import { apiEnvelope } from "@/lib/apiClient";

export type SendVia = "none" | "email" | "whatsapp" | "both";

export type DraftPayload = {
  line_items: Record<string, unknown>[];
  currency: string;
  notes?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  details?: Record<string, unknown> | null;
  supporting_documents?: { id: string; name: string; size_bytes: number; mime_type: string }[];
  /** Set to "stellar" to issue a USDC-on-Stellar invoice instead of the
   * manual/Interac flow. See InvoiceOut's Stellar fields below. */
  network?: "stellar" | null;
  amount?: string | number | null;
  description?: string | null;
  reference?: string | null;
  expires_in_days?: number | null;
};

export type InvoiceDraft = {
  id: number;
  business_id: number;
  title: string | null;
  due_date: string | null;
  payload: DraftPayload;
  created_at: string | null;
  updated_at: string | null;
};

export type InvoiceStatus =
  | "issued"
  | "sent"
  | "paid"
  | "void"
  | "canceled"
  | "pending"
  | "partially_paid"
  | "expired"
  | "failed";

export type Invoice = {
  id: number;
  business_id: number;
  draft_id: number | null;
  invoice_number: string;
  status: InvoiceStatus;
  payload: DraftPayload;
  send_via: string | null;
  sent_at: string | null;
  paid_at: string | null;
  public_token: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Stellar USDC collections — null for non-Stellar (manual/Interac) invoices.
  network: string | null;
  asset_code: string | null;
  expected_amount: string | null;
  amount_received: string | null;
  outstanding_balance: string | null;
  stellar_memo: string | null;
  receiving_address: string | null;
  expires_at: string | null;
};

export type InvoiceList = { items: Invoice[]; total: number; limit: number; offset: number };

export type InvoiceStellarPayment = {
  id: number;
  invoice_id: number;
  tx_hash: string;
  from_address: string | null;
  memo: string | null;
  amount: string;
  currency: string;
  is_late: boolean;
  received_at: string | null;
  created_at: string | null;
};

export type InvoiceStellarPaymentList = { items: InvoiceStellarPayment[]; total: number };

export const invoicesApi = {
  createDraft: (title: string | null, payload: DraftPayload) =>
    apiEnvelope<InvoiceDraft>("POST", "/v1/invoices/drafts", { title, payload }),

  issue: (draft_id: number, send_via: SendVia = "none") =>
    apiEnvelope<Invoice>("POST", "/v1/invoices", { draft_id, send_via }),

  list: (params?: { status?: string; network?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.network) qs.set("network", params.network);
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.offset != null) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return apiEnvelope<InvoiceList>("GET", `/v1/invoices${query ? `?${query}` : ""}`);
  },

  get: (id: number) => apiEnvelope<Invoice>("GET", `/v1/invoices/${id}`),

  payments: (id: number) =>
    apiEnvelope<InvoiceStellarPaymentList>("GET", `/v1/invoices/${id}/payments`),

  markPaid: (id: number, body?: { paid_at?: string; reference?: string; payment_method?: string }) =>
    apiEnvelope<Invoice>("POST", `/v1/invoices/${id}/mark-paid`, body ?? {}),

  send: (id: number, send_via: SendVia) =>
    apiEnvelope<Invoice>("POST", `/v1/invoices/${id}/send`, { send_via }),

  publicLink: (id: number) =>
    apiEnvelope<{ public_url: string; public_pdf_url: string }>("GET", `/v1/invoices/${id}/public-link`),

  remove: (id: number) => apiEnvelope<null>("DELETE", `/v1/invoices/${id}`),
};

/** Builds the minimal valid draft payload from the dashboard's simple
 * "client + amount" invoice modal, so the two-step backend draft->issue
 * flow can hide behind the existing one-shot UI. */
export function buildSimpleDraftPayload(clientName: string, amountUsd: string): DraftPayload {
  return {
    currency: "USD",
    client_name: clientName,
    line_items: [{ description: clientName, quantity: 1, unit_amount: amountUsd }],
  };
}

/** Draft payload for a USDC-on-Stellar invoice — the amount/network fields
 * the backend actually reads at issue time; line_items stays empty since
 * Stellar invoices don't itemize. */
export function buildStellarDraftPayload(opts: {
  clientName: string;
  clientEmail?: string;
  amountUsdc: string;
  description?: string;
  reference?: string;
  expiresInDays?: number;
}): DraftPayload {
  return {
    currency: "USDC",
    client_name: opts.clientName,
    client_email: opts.clientEmail || null,
    line_items: [],
    network: "stellar",
    amount: opts.amountUsdc,
    description: opts.description || null,
    reference: opts.reference || null,
    expires_in_days: opts.expiresInDays ?? null,
  };
}
