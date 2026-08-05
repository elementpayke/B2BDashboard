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

export type Invoice = {
  id: number;
  business_id: number;
  draft_id: number | null;
  invoice_number: string;
  status: string; // paid | pending | overdue | ... (business-defined lifecycle)
  payload: DraftPayload;
  send_via: string | null;
  sent_at: string | null;
  paid_at: string | null;
  public_token: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type InvoiceList = { items: Invoice[]; total: number; limit: number; offset: number };

export const invoicesApi = {
  createDraft: (title: string | null, payload: DraftPayload) =>
    apiEnvelope<InvoiceDraft>("POST", "/v1/invoices/drafts", { title, payload }),

  issue: (draft_id: number, send_via: SendVia = "none") =>
    apiEnvelope<Invoice>("POST", "/v1/invoices", { draft_id, send_via }),

  list: (params?: { status?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.offset != null) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return apiEnvelope<InvoiceList>("GET", `/v1/invoices${query ? `?${query}` : ""}`);
  },

  get: (id: number) => apiEnvelope<Invoice>("GET", `/v1/invoices/${id}`),

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
