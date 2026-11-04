import { ApiRequestError, apiEnvelope } from "@/lib/apiClient";

export type SendVia = "none" | "email" | "whatsapp" | "both";
export type InvoiceMethod = "usdc" | "usdt" | "mpesa" | "bank";
export type SettlementPreference = "asset" | "stellar_usdc" | "USD" | "KES" | "EUR";

export type LineItem = {
  name: string;
  detail?: string;
  qty: number;
  unit_price: string;
};

export type DraftPayload = {
  line_items: LineItem[] | Record<string, unknown>[];
  currency: string;
  notes?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  description?: string | null;
  amount?: string | null;
  methods?: InvoiceMethod[];
  settlement?: SettlementPreference | null;
  allow_partial?: boolean;
  email_on_create?: boolean;
  note?: string | null;
  due_date?: string | null;
  network?: "stellar" | null;
  timeline?: { event: string; at: string }[];
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
  status: string;
  ui_status?: string | null;
  payload: DraftPayload;
  send_via: string | null;
  sent_at: string | null;
  paid_at: string | null;
  public_token: string | null;
  created_at: string | null;
  updated_at: string | null;
  expected_amount?: string | null;
  amount_received?: string | null;
  outstanding_balance?: string | null;
  stellar_memo?: string | null;
  receiving_address?: string | null;
  due_date?: string | null;
};

export type InvoiceSummary = {
  total_invoiced: string;
  total_paid: string;
  total_pending: string;
  total_overdue: string;
  currency: string;
};

export type InvoicePayment = {
  id: string;
  invoice_id: number;
  method: string;
  amount: string;
  currency: string;
  status: string;
  source_chain?: string | null;
  source_tx?: string | null;
  stellar_tx?: string | null;
  reference?: string | null;
  received_at?: string | null;
};

export type InvoiceList = { items: Invoice[]; total: number; limit: number; offset: number };

export type UiInvoiceStatus =
  | "draft"
  | "pending"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

export type InvoiceListRow = {
  id: number;
  displayId: string;
  customer: string;
  amountLabel: string;
  methods: InvoiceMethod[];
  status: UiInvoiceStatus;
  statusLabel: string;
  dueLabel: string;
};

const STATUS_LABELS: Record<UiInvoiceStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export const FORBIDDEN_INVOICE_UI_STRINGS = [
  "pay.mboka.co",
  "payment link",
  "Copy link",
  "Copy payment link",
] as const;

export function formatInvoiceAmount(amount: string | number, currency: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `0.00 ${currency}`;
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function resolveUiStatus(inv: Invoice): UiInvoiceStatus {
  const ui = inv.ui_status as UiInvoiceStatus | undefined;
  if (ui && ui in STATUS_LABELS) return ui;
  const st = inv.status.toLowerCase();
  if (st === "paid") return "paid";
  if (st === "partially_paid") return "partially_paid";
  if (st === "canceled" || st === "void") return "cancelled";
  if (st === "expired") return "overdue";
  return "pending";
}

export function mapInvoiceToListRow(inv: Invoice): InvoiceListRow {
  const payload: DraftPayload = inv.payload ?? { currency: "USD", line_items: [] };
  const currency = payload.currency || "USD";
  const amount =
    inv.expected_amount ??
    payload.amount ??
    lineItemsTotal(payload.line_items as LineItem[]);
  return {
    id: inv.id,
    displayId: inv.invoice_number.toUpperCase(),
    customer: payload.client_name || "—",
    amountLabel: formatInvoiceAmount(String(amount), currency),
    methods: (payload.methods ?? []) as InvoiceMethod[],
    status: resolveUiStatus(inv),
    statusLabel: STATUS_LABELS[resolveUiStatus(inv)],
    dueLabel: payload.due_date || inv.due_date || "—",
  };
}

function lineItemsTotal(items: LineItem[] | undefined): string {
  if (!items?.length) return "0";
  let sum = 0;
  for (const item of items) {
    const qty = Number(item.qty ?? 1);
    const unit = Number(item.unit_price ?? 0);
    sum += qty * unit;
  }
  return String(sum);
}

export function buildCreatePayloadFromWizard(input: {
  clientName: string;
  clientEmail: string;
  currency: string;
  description: string;
  dueDate: string;
  lineItems: LineItem[];
  methods: InvoiceMethod[];
  settlement: SettlementPreference;
  allowPartial: boolean;
  emailOnCreate: boolean;
  note?: string;
}): DraftPayload {
  const total = lineItemsTotal(input.lineItems);
  return {
    currency: input.currency,
    client_name: input.clientName,
    client_email: input.clientEmail,
    description: input.description,
    due_date: input.dueDate,
    amount: total,
    line_items: input.lineItems,
    methods: input.methods,
    settlement: input.settlement,
    allow_partial: input.allowPartial,
    email_on_create: input.emailOnCreate,
    note: input.note ?? null,
    network: input.methods.includes("usdc") ? "stellar" : null,
  };
}

export function shareMessage(inv: Invoice): string {
  const row = mapInvoiceToListRow(inv);
  return `Invoice ${row.displayId} — ${row.amountLabel}, due ${row.dueLabel}. Payment details are in the attached PDF. Please use ${row.displayId} as your reference.`;
}

export function assertInvoiceUiCopyClean(text: string): void {
  for (const forbidden of FORBIDDEN_INVOICE_UI_STRINGS) {
    if (text.toLowerCase().includes(forbidden.toLowerCase())) {
      throw new Error(`Forbidden invoice UI copy: ${forbidden}`);
    }
  }
  if (/\bcard\b/i.test(text) && /payment method/i.test(text)) {
    throw new Error("Card must not appear as invoice payment method");
  }
}

export const invoicesApi = {
  nextId: () => apiEnvelope<{ next_invoice_number: string }>("GET", "/v1/invoices/next-id"),

  createDraft: (title: string | null, payload: DraftPayload, due_date?: string | null) =>
    apiEnvelope<InvoiceDraft>("POST", "/v1/invoices/drafts", { title, due_date, payload }),

  issue: (draft_id: number, send_via: SendVia = "none") =>
    apiEnvelope<Invoice>("POST", "/v1/invoices", { draft_id, send_via }),

  list: (params?: {
    status?: string;
    payment_method?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.payment_method) qs.set("payment_method", params.payment_method);
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.offset != null) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return apiEnvelope<InvoiceList>("GET", `/v1/invoices${query ? `?${query}` : ""}`);
  },

  listDrafts: () => apiEnvelope<{ items: InvoiceDraft[]; total: number }>("GET", "/v1/invoices/drafts"),

  summary: () => apiEnvelope<InvoiceSummary>("GET", "/v1/invoices/summary"),

  get: (id: number) => apiEnvelope<Invoice>("GET", `/v1/invoices/${id}`),

  payments: (id: number) =>
    apiEnvelope<{ items: InvoicePayment[]; total: number }>("GET", `/v1/invoices/${id}/payments`),

  markPaid: (id: number, body?: { paid_at?: string; reference?: string; payment_method?: string }) =>
    apiEnvelope<Invoice>("POST", `/v1/invoices/${id}/mark-paid`, body ?? {}),

  manualPayment: (
    id: number,
    body: { amount: string; method: InvoiceMethod; reference?: string },
  ) => apiEnvelope<Invoice>("POST", `/v1/invoices/${id}/payments/manual`, body),

  send: (id: number, send_via: SendVia) =>
    apiEnvelope<Invoice>("POST", `/v1/invoices/${id}/send`, { send_via }),

  sendReminder: (id: number, send_via: SendVia = "email") =>
    apiEnvelope<Invoice>("POST", `/v1/invoices/${id}/send-reminder`, { send_via }),

  cancel: (id: number) => apiEnvelope<Invoice>("POST", `/v1/invoices/${id}/cancel`, {}),

  duplicate: (id: number) => apiEnvelope<InvoiceDraft>("POST", `/v1/invoices/${id}/duplicate`, {}),

  remove: (id: number) => apiEnvelope<null>("DELETE", `/v1/invoices/${id}`),

  async downloadPdf(id: number): Promise<{ blob: Blob; filename: string }> {
    const res = await fetch(`/api/mboka/v1/invoices/${id}/pdf`, {
      method: "POST",
      credentials: "same-origin",
    });
    if (!res.ok) {
      let message = `Download failed (${res.status})`;
      try {
        const json = (await res.json()) as { message?: string };
        if (json?.message) message = json.message;
      } catch {
        /* binary error */
      }
      throw new ApiRequestError(message, res.status);
    }
    const disposition = res.headers.get("content-disposition") || "";
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const filename = match?.[1] ?? `invoice-${id}.pdf`;
    return { blob: await res.blob(), filename };
  },
};

/** Legacy helper for simple flows. */
export function buildSimpleDraftPayload(clientName: string, amountUsd: string): DraftPayload {
  return {
    currency: "USD",
    client_name: clientName,
    methods: ["usdc"],
    line_items: [{ name: clientName, qty: 1, unit_price: amountUsd }],
    amount: amountUsd,
    network: "stellar",
  };
}
