"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import CreateInvoiceModal from "./CreateInvoiceModal";
import InvoiceBrandingPanel from "./InvoiceBrandingPanel";
import ShareInvoiceSheet from "./ShareInvoiceSheet";
import InvoicePreviewModal from "./InvoicePreviewModal";
import StatusBadge from "@/components/ui/StatusBadge";
import { createInvoiceCustomer, fetchInvoiceCustomers } from "@/lib/services/invoiceCustomersApi";
import {
  INVOICE_LIST_MAX_LIMIT,
  fetchInvoicePayments,
  fetchInvoiceSummary,
  invoicesApi,
  lineItemsTotal as computeLineItemsTotal,
  mapInvoiceToListRow,
  summarizeInvoices,
  formatMoneyAmount,
  formatInvoiceAmount,
  normalizeInvoiceDisplayCurrency,
  type DraftPayload,
  type Invoice,
  type InvoiceDraft,
  type InvoiceMethod,
  type InvoicePayment,
  type LineItem,
  type UiInvoiceStatus,
} from "@/lib/services/invoices";

const STATUS_BADGE: Record<
  UiInvoiceStatus,
  { color: string; soft: string }
> = {
  draft: { color: "var(--muted2)", soft: "var(--surface2)" },
  pending: { color: "var(--amber, #b47700)", soft: "var(--amber-tint, #fbf2de)" },
  partially_paid: { color: "var(--amber, #b47700)", soft: "var(--amber-tint, #fbf2de)" },
  paid: { color: "var(--success, #1a8a4a)", soft: "var(--success-tint, rgba(26,138,74,0.12))" },
  overdue: { color: "var(--red-text, #c42a2f)", soft: "var(--red-tint, #fcebec)" },
  cancelled: { color: "var(--muted2)", soft: "var(--surface2)" },
};

const METHOD_LABELS: Record<InvoiceMethod, string> = {
  usdc: "USDC",
  usdt: "USDT",
  mpesa: "M-Pesa",
  bank: "Bank",
};

const PAYMENT_STEPS = ["Created", "Sent", "Opened", "Payment initiated", "Paid"] as const;

type DraftRow = {
  id: number;
  isDraft: true;
  draft: InvoiceDraft;
  displayId: string;
  customer: string;
  amountLabel: string;
  methods: InvoiceMethod[];
  status: "draft";
  statusLabel: "Draft";
  dueLabel: string;
};

type ListRow =
  | DraftRow
  | (ReturnType<typeof mapInvoiceToListRow> & { isDraft?: false });

function draftToRow(d: InvoiceDraft): DraftRow {
  const payload = d.payload ?? { currency: "USD", line_items: [] };
  const amount = payload.amount ?? "0";
  return {
    id: d.id,
    isDraft: true,
    draft: d,
    displayId: `DRAFT-${d.id}`,
    customer: payload.client_name || "—",
    amountLabel: formatInvoiceAmount(amount, payload.currency || "USD"),
    methods: (payload.methods ?? []) as InvoiceMethod[],
    status: "draft",
    statusLabel: "Draft",
    dueLabel: payload.due_date || d.due_date || "—",
  };
}

function MethodChips({ methods }: { methods: InvoiceMethod[] }) {
  const visible = methods.slice(0, 2);
  const extra = methods.length - visible.length;
  return (
    <span className="ep-invoices-methods">
      {visible.map((m) => (
        <span key={m} className="ep-invoices-rail-chip">
          {METHOD_LABELS[m] ?? m.toUpperCase()}
        </span>
      ))}
      {extra > 0 ? <span className="ep-invoices-rail-chip">+{extra}</span> : null}
    </span>
  );
}

function formatStat(value: string | undefined, currency: string, loading: boolean) {
  if (loading) return "…";
  if (value == null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatMoneyAmount(n, currency);
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Prefixes formula-triggering leading characters so Excel/Sheets never
 * executes a customer-controlled cell as a formula on open. */
function csvCell(value: unknown): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** CSV export is a plain client-side download — no backend endpoint needed
 * for "every column already visible in the table". */
function exportInvoicesCsv(rows: ListRow[]) {
  const header = ["Invoice", "Customer", "Amount", "Methods", "Status", "Due"];
  const lines = rows.map((r) => [
    r.displayId,
    r.customer,
    r.amountLabel,
    r.methods.map((m) => METHOD_LABELS[m] ?? m).join("; "),
    r.statusLabel,
    r.dueLabel,
  ]);
  const csv = [header, ...lines].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function InvoiceRowMenu({
  open,
  onToggle,
  row,
  onView,
  onPreview,
  onShare,
  onPdf,
  onSendReminder,
  onDuplicate,
  onCancel,
  onDelete,
}: {
  open: boolean;
  onToggle: () => void;
  row: ListRow;
  onView: () => void;
  onPreview: () => void;
  onShare: () => void;
  onPdf: () => void;
  onSendReminder: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const isDraft = Boolean(row.isDraft);
  const isUnpaid = row.status !== "paid" && row.status !== "cancelled";
  const isCancellable = !isDraft && row.status !== "paid" && row.status !== "cancelled";
  return (
    <div className="ep-invoices-row-menu ep-invoices-row-menu--list">
      <button
        type="button"
        className="ep-invoices-row-menu__trigger"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-label="Invoice actions"
      >
        ⋯
      </button>
      {open ? (
        <div className="ep-invoices-row-menu__pop" role="menu">
          <button type="button" onClick={onView}>
            {isDraft ? "Edit draft" : "View invoice"}
          </button>
          {!isDraft ? (
            <>
              <button type="button" onClick={onPreview}>
                Preview invoice
              </button>
              <button type="button" onClick={onShare}>
                Share invoice…
              </button>
              {isUnpaid ? (
                <button type="button" onClick={onSendReminder}>
                  Send reminder
                </button>
              ) : null}
              <button type="button" onClick={onDuplicate}>
                Duplicate
              </button>
              <button type="button" onClick={onPdf}>
                Download PDF
              </button>
            </>
          ) : null}
          <div className="ep-invoices-row-menu__divider" role="separator" />
          {isCancellable ? (
            <button type="button" className="ep-invoices-danger" onClick={onCancel}>
              Cancel invoice
            </button>
          ) : null}
          <button type="button" className="ep-invoices-danger" onClick={onDelete}>
            {isDraft ? "Delete draft" : "Delete invoice"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ManualPaymentForm({
  methods,
  currency,
  onSubmit,
  onCancel,
}: {
  methods: InvoiceMethod[];
  currency: string;
  onSubmit: (body: { amount: string; method: InvoiceMethod; reference?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const recordable = methods.filter((m) => m !== "usdc");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<InvoiceMethod>(recordable[0] ?? "bank");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (recordable.length === 0) return null;

  return (
    <form
      className="ep-invoices-manual-payment"
      onSubmit={(e) => {
        e.preventDefault();
        const amountValue = Number(amount);
        if (!amount.trim() || !Number.isFinite(amountValue) || amountValue <= 0) {
          setError("Enter an amount greater than zero.");
          return;
        }
        setBusy(true);
        setError(null);
        void onSubmit({ amount, method, reference: reference || undefined })
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not record payment."))
          .finally(() => setBusy(false));
      }}
    >
      <p className="ep-invoices-muted">
        USDT, M-Pesa, and bank transfers aren't auto-detected yet — record what you received here
        once it lands.
      </p>
      <div className="ep-invoices-manual-payment__fields">
        <label>
          <span>Method</span>
          <select value={method} onChange={(e) => setMethod(e.target.value as InvoiceMethod)}>
            {recordable.map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Amount ({currency})</span>
          <input
            className="ep-mono"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </label>
        <label>
          <span>Reference (optional)</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Receipt / txn ID" />
        </label>
      </div>
      {error ? (
        <p className="ep-invoices-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="ep-invoices-manual-payment__actions">
        <button type="button" className="ep-invoices-btn ep-invoices-btn--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="ep-invoices-btn ep-invoices-btn--primary" disabled={busy}>
          {busy ? "Recording…" : "Record payment"}
        </button>
      </div>
    </form>
  );
}

export default function InvoicesScreen() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareInvoice, setShareInvoice] = useState<Invoice | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [menuId, setMenuId] = useState<number | string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () =>
      invoicesApi.list({
        status: statusFilter || undefined,
        limit: INVOICE_LIST_MAX_LIMIT,
      }),
    enabled: statusFilter !== "draft",
  });

  const draftsQuery = useQuery({
    queryKey: ["invoice-drafts"],
    queryFn: () => invoicesApi.listDrafts(),
  });

  const summaryQuery = useQuery({
    queryKey: ["invoices-summary"],
    queryFn: fetchInvoiceSummary,
  });

  const customersQuery = useQuery({
    queryKey: ["invoice-customers"],
    queryFn: fetchInvoiceCustomers,
  });

  const detailQuery = useQuery({
    queryKey: ["invoice", selectedId],
    queryFn: () => invoicesApi.get(selectedId!),
    enabled: selectedId != null,
  });

  const paymentsQuery = useQuery({
    queryKey: ["invoice-payments", selectedId],
    queryFn: () => fetchInvoicePayments(selectedId!),
    enabled: selectedId != null,
  });

  const rows: ListRow[] = useMemo(() => {
    const invoiceItems = listQuery.data?.items ?? [];
    const invoiceRows: ListRow[] = invoiceItems.map((inv) => ({ ...mapInvoiceToListRow(inv), isDraft: false }));
    const draftRows: ListRow[] =
      !statusFilter || statusFilter === "draft" ? (draftsQuery.data?.items ?? []).map(draftToRow) : [];
    const combined = statusFilter === "draft" ? draftRows : [...draftRows, ...invoiceRows];
    const q = search.trim().toLowerCase();
    return combined.filter(
      (r) => !q || r.displayId.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q),
    );
  }, [listQuery.data, draftsQuery.data, statusFilter, search]);

  const selected = detailQuery.data;
  const selectedDraft = (draftsQuery.data?.items ?? []).find((d) => d.id === selectedDraftId);
  const payments: InvoicePayment[] = paymentsQuery.data?.items ?? [];

  const summary =
    summaryQuery.data ??
    (listQuery.data?.items?.length ? summarizeInvoices(listQuery.data.items) : undefined);

  const summaryCurrency = normalizeInvoiceDisplayCurrency(summary?.currency);

  async function refreshAll() {
    await qc.invalidateQueries({ queryKey: ["invoices"] });
    await qc.invalidateQueries({ queryKey: ["invoices-summary"] });
    await qc.invalidateQueries({ queryKey: ["invoice-drafts"] });
    if (selectedId != null) {
      await qc.invalidateQueries({ queryKey: ["invoice", selectedId] });
      await qc.invalidateQueries({ queryKey: ["invoice-payments", selectedId] });
    }
  }

  async function downloadPdf(id: number) {
    setDownloadError(null);
    setDownloadingId(id);
    try {
      const { blob, filename } = await invoicesApi.downloadPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Could not download PDF");
    } finally {
      setDownloadingId(null);
    }
  }

  async function runRowAction(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      await refreshAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "That action didn't go through.");
    }
  }

  // ── Draft detail (lightweight: issue or delete, no full re-edit flow) ──
  if (selectedDraftId != null && selectedDraft) {
    const payload = selectedDraft.payload ?? { currency: "USD", line_items: [] };
    return (
      <div className="ep-invoices">
        <button type="button" className="ep-invoices-back" onClick={() => setSelectedDraftId(null)}>
          ← Back to invoices
        </button>
        <section className="ep-panel ep-invoices-detail-head">
          <div className="ep-invoices-detail-head__top">
            <span className="ep-mono ep-invoices-id">DRAFT-{selectedDraft.id}</span>
            <StatusBadge label="Draft" color={STATUS_BADGE.draft.color} soft={STATUS_BADGE.draft.soft} size="sm" />
          </div>
          <p className="ep-mono ep-invoices-detail-amount">
            {formatInvoiceAmount(payload.amount ?? "0", payload.currency || "USD")}
          </p>
          <p className="ep-invoices-detail-meta">{payload.client_name || "No customer yet"}</p>
          {actionError ? (
            <p className="ep-invoices-error" role="alert">
              {actionError}
            </p>
          ) : null}
          <div className="ep-invoices-detail-actions">
            <button
              type="button"
              className="ep-invoices-btn ep-invoices-btn--secondary"
              onClick={() =>
                void runRowAction(async () => {
                  await invoicesApi.deleteDraft(selectedDraft.id);
                  setSelectedDraftId(null);
                })
              }
            >
              Delete draft
            </button>
            <button
              type="button"
              className="ep-invoices-btn ep-invoices-btn--primary"
              onClick={() =>
                void runRowAction(async () => {
                  const invoice = await invoicesApi.issue(selectedDraft.id, "none");
                  setSelectedDraftId(null);
                  setSelectedId(invoice.id);
                })
              }
            >
              Issue invoice
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ── Invoice detail ──
  if (selectedId != null && selected) {
    const payload: DraftPayload = selected.payload ?? { currency: "USD", line_items: [] };
    const currency = payload.currency || "USD";
    const expected =
      selected.expected_amount ??
      payload.amount ??
      computeLineItemsTotal(payload.line_items as LineItem[]);
    const received = selected.amount_received ?? "0";
    const outstanding =
      selected.outstanding_balance ??
      String(Math.max(Number(expected) - Number(received), 0));
    const settledInFull = Number(outstanding) <= 0 && Number(received) > 0;
    const row = mapInvoiceToListRow(selected);
    const badge = STATUS_BADGE[row.status];
    const timeline = payload.timeline ?? [];
    // `DraftPayload.line_items` is a union of two array shapes (not an array
    // of a union), which trips up inference on .reduce/.map below — flatten
    // to one shape up front.
    const lineItems = (payload.line_items ?? []) as Array<{
      name?: string;
      detail?: string;
      qty?: number;
      unit_price?: string;
    }>;
    const lineItemsTotal = lineItems.reduce(
      (sum, item) => sum + Number(item.qty ?? 1) * Number(item.unit_price ?? 0),
      0,
    );
    return (
      <div className="ep-invoices">
        <button type="button" className="ep-invoices-back" onClick={() => setSelectedId(null)}>
          ← Back to invoices
        </button>
        <section className="ep-panel ep-invoices-detail-head">
          <div className="ep-invoices-detail-head__top">
            <span className="ep-mono ep-invoices-id">{selected.invoice_number.toUpperCase()}</span>
            <StatusBadge label={row.statusLabel} color={badge.color} soft={badge.soft} size="sm" />
          </div>
          <p className="ep-mono ep-invoices-detail-amount">
            {formatInvoiceAmount(expected, currency)}
          </p>
          <p className="ep-invoices-detail-meta">
            {payload.client_name}
            {payload.description ? ` · ${payload.description}` : ""}
          </p>
          <p className="ep-invoices-detail-dates">
            Created {formatDateTime(selected.created_at)} · Due {payload.due_date || selected.due_date || "—"}
          </p>
          <p className="ep-invoices-detail-balance">
            {settledInFull ? (
              <span className="ep-invoices-settled">Settled in full</span>
            ) : (
              <span className="ep-invoices-outstanding">
                {formatInvoiceAmount(outstanding, currency)} outstanding
              </span>
            )}
          </p>
          <MethodChips methods={row.methods} />
          {actionError ? (
            <p className="ep-invoices-error" role="alert">
              {actionError}
            </p>
          ) : null}
          <div className="ep-invoices-detail-actions">
            <button
              type="button"
              className="ep-invoices-btn ep-invoices-btn--secondary"
              onClick={() => setPreviewInvoice(selected)}
            >
              Preview invoice
            </button>
            <button
              type="button"
              className="ep-invoices-btn ep-invoices-btn--secondary"
              disabled={downloadingId === selected.id}
              onClick={() => void downloadPdf(selected.id)}
            >
              {downloadingId === selected.id ? "Preparing PDF…" : "Download PDF"}
            </button>
            <button type="button" className="ep-invoices-btn ep-invoices-btn--primary" onClick={() => setShareInvoice(selected)}>
              Share invoice
            </button>
          </div>
        </section>

        {timeline.length > 0 ? (
          <section className="ep-panel ep-invoices-section">
            <h3 className="ep-invoices-section__title">Payment status</h3>
            <ol className="ep-invoices-timeline">
              {PAYMENT_STEPS.map((step) => {
                const entry = timeline.find((t) => t.event === step);
                return (
                  <li
                    key={step}
                    className={`ep-invoices-timeline__step${entry ? " ep-invoices-timeline__step--done" : ""}`}
                  >
                    <span className="ep-invoices-timeline__dot" aria-hidden />
                    <span className="ep-invoices-timeline__label">{step}</span>
                    {entry ? (
                      <span className="ep-mono ep-invoices-timeline__time">{formatDateTime(entry.at)}</span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        <section className="ep-panel ep-invoices-section">
          <h3 className="ep-invoices-section__title">Payment breakdown</h3>
          {payments.length === 0 ? (
            <p className="ep-invoices-muted">Your customer can pay this invoice in USDC on Stellar.</p>
          ) : (
            <>
              <p className="ep-mono ep-invoices-muted">
                {formatInvoiceAmount(received, currency)} of {formatInvoiceAmount(expected, currency)} received
              </p>
              {payments.map((p) => (
                <div key={p.id} className="ep-invoices-payment-row">
                  <div className="ep-invoices-payment-row__meta">
                    <span>{METHOD_LABELS[p.method as InvoiceMethod] ?? p.method.toUpperCase()}</span>
                    <span className="ep-invoices-payment-row__date">{formatDateTime(p.received_at)}</span>
                  </div>
                  <span className="ep-mono">{formatInvoiceAmount(p.amount, p.currency || currency)}</span>
                  <StatusBadge
                    label={p.status === "done" ? "Settled" : p.status === "failed" ? "Failed" : "Pending"}
                    color={p.status === "done" ? STATUS_BADGE.paid.color : STATUS_BADGE.pending.color}
                    soft={p.status === "done" ? STATUS_BADGE.paid.soft : STATUS_BADGE.pending.soft}
                    size="sm"
                  />
                </div>
              ))}
              <button type="button" className="ep-invoices-btn ep-invoices-btn--ghost" onClick={() => setSettlementOpen((v) => !v)}>
                {settlementOpen ? "Hide settlement details" : "Settlement details"}
              </button>
              {settlementOpen
                ? payments.map((p) => (
                    <div key={`${p.id}-s`} className="ep-invoices-settlement-block">
                      {p.method === "usdc"
                        ? `${p.source_chain ?? "Stellar"} → settled on Stellar`
                        : `${METHOD_LABELS[p.method as InvoiceMethod] ?? p.method} · ref ${p.reference || p.stellar_tx || p.source_tx || "—"}`}
                    </div>
                  ))
                : null}
            </>
          )}
          {row.status !== "paid" && row.status !== "cancelled" ? (
            manualPaymentOpen ? (
              <ManualPaymentForm
                methods={row.methods}
                currency={currency}
                onCancel={() => setManualPaymentOpen(false)}
                onSubmit={async (body) => {
                  await invoicesApi.manualPayment(selected.id, body);
                  setManualPaymentOpen(false);
                  await refreshAll();
                }}
              />
            ) : row.methods.some((m) => m !== "usdc") ? (
              <button
                type="button"
                className="ep-invoices-btn ep-invoices-btn--ghost"
                onClick={() => setManualPaymentOpen(true)}
              >
                + Record a payment
              </button>
            ) : null
          ) : null}
        </section>

        {lineItems.length > 0 ? (
          <section className="ep-panel ep-invoices-section">
            <div className="ep-invoices-section__header">
              <h3 className="ep-invoices-section__title">Invoice items</h3>
              <span className="ep-invoices-muted">Payment reference {selected.invoice_number.toUpperCase()}</span>
            </div>
            <table className="ep-invoices-items-table ep-mono">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => {
                  const qty = Number(item.qty ?? 1);
                  const unit = Number(item.unit_price ?? 0);
                  return (
                    <tr key={idx}>
                      <td>
                        {item.name || "Item"}
                        {item.detail ? <span className="ep-invoices-muted"> — {item.detail}</span> : null}
                      </td>
                      <td>{qty}</td>
                      <td>{formatInvoiceAmount(unit, currency)}</td>
                      <td>{formatInvoiceAmount(qty * unit, currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="ep-invoices-items-table__total-label">
                    Total
                  </td>
                  <td>{formatInvoiceAmount(lineItemsTotal, currency)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
        ) : null}

        {shareInvoice ? <ShareInvoiceSheet invoice={shareInvoice} onClose={() => setShareInvoice(null)} /> : null}
        {previewInvoice ? (
          <InvoicePreviewModal
            invoice={previewInvoice}
            onClose={() => setPreviewInvoice(null)}
            onShare={() => {
              setShareInvoice(previewInvoice);
              setPreviewInvoice(null);
            }}
          />
        ) : null}
      </div>
    );
  }

  const loading = listQuery.isLoading || draftsQuery.isLoading;
  const hasFilters = Boolean(search || statusFilter);
  const empty = !loading && rows.length === 0;
  const statsLoading = listQuery.isLoading || (summaryQuery.isLoading && !summary);

  return (
    <div className="ep-invoices">
      <div className="ep-invoices__stats">
        {(
          [
            ["total_invoiced", "Total invoiced", "total"],
            ["total_paid", "Paid", "paid"],
            ["total_pending", "Pending", "pending"],
            ["total_overdue", "Overdue", "overdue"],
          ] as const
        ).map(([key, label, tone]) => (
          <div key={key} className={`ep-invoices-stat ep-invoices-stat--${tone}`}>
            <span className="ep-invoices-stat__dot" aria-hidden />
            <span className="ep-invoices-stat__label">{label}</span>
            <span className="ep-invoices-stat__value ep-mono">
              {formatStat(summary?.[key], summaryCurrency, statsLoading)}
            </span>
          </div>
        ))}
      </div>

      <InvoiceBrandingPanel />

      {downloadError ? (
        <p className="ep-invoices-error" role="alert">
          {downloadError}
        </p>
      ) : null}
      {actionError ? (
        <p className="ep-invoices-error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="ep-statements__toolbar ep-invoices__toolbar">
        <div className="ep-invoices-toolbar ep-statements__filters">
          <label className="ep-txn-search">
            <span className="ep-sr-only">Search invoices</span>
            <input
              placeholder="Search invoice, customer, or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="ep-statements__filter">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="partially_paid">Partially paid</option>
              <option value="paid">Paid</option>
              <option value="expired">Overdue</option>
              <option value="canceled">Cancelled</option>
            </select>
          </label>
          <span className="ep-invoices-rail-pill" title="Every invoice settles in USDC on Stellar for now">
            Stellar · USDC
          </span>
        </div>
        <div className="ep-statements__toolbar-actions">
          <button
            type="button"
            className="ep-invoices-btn ep-invoices-btn--secondary"
            onClick={() => exportInvoicesCsv(rows)}
            disabled={rows.length === 0}
          >
            Export
          </button>
          <button type="button" className="ep-invoices-btn ep-invoices-btn--primary" onClick={() => setCreateOpen(true)}>
            + Create invoice
          </button>
        </div>
      </div>

      {empty ? (
        <section className="ep-panel ep-invoices-empty">
          {hasFilters ? (
            <>
              <h3>No invoices match these filters</h3>
              <p>Try a different search term or status.</p>
              <button
                type="button"
                className="ep-invoices-btn ep-invoices-btn--secondary"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                }}
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <h3>Create your first invoice</h3>
              <p>
                Send one invoice and let customers pay with USDC (any network), USDT, M-Pesa, or bank transfer.
                Payment instructions live on the PDF — no hosted payment page.
              </p>
              <button type="button" className="ep-invoices-btn ep-invoices-btn--primary" onClick={() => setCreateOpen(true)}>
                Create invoice
              </button>
            </>
          )}
        </section>
      ) : (
        <section className="ep-panel ep-activity ep-invoices-list" aria-label="Invoices">
          <div className="ep-invoices-list-head" aria-hidden>
            <span>Invoice</span>
            <span>Customer</span>
            <span>Amount</span>
            <span>Methods</span>
            <span>Status</span>
            <span>Due</span>
            <span />
          </div>
          <ul className="ep-activity__list">
            {rows.map((row) => {
              const badge = STATUS_BADGE[row.status];
              const rowKey = `${row.isDraft ? "draft" : "inv"}-${row.id}`;
              const openRow = () =>
                row.isDraft ? setSelectedDraftId(row.id) : setSelectedId(row.id);
              return (
                <li key={rowKey} className="ep-invoices-list__item">
                  <button type="button" className="ep-activity__row" onClick={openRow}>
                    <div className="ep-activity__card">
                      <div className="ep-activity__card-top">
                        <span className="ep-mono ep-invoice__id">{row.displayId}</span>
                        <span className="ep-mono ep-activity__amount">{row.amountLabel}</span>
                      </div>
                      <div className="ep-activity__card-bottom">
                        <span>{row.customer}</span>
                        <StatusBadge label={row.statusLabel} color={badge.color} soft={badge.soft} size="sm" />
                      </div>
                      <MethodChips methods={row.methods} />
                      <span className="ep-activity__meta">Due {row.dueLabel}</span>
                    </div>
                    <div className="ep-activity__desktop ep-invoices-list-row">
                      <span className="ep-mono ep-invoice__id">{row.displayId}</span>
                      <span className="ep-invoice__client">{row.customer}</span>
                      <span className="ep-mono ep-activity__amount">{row.amountLabel}</span>
                      <MethodChips methods={row.methods} />
                      <StatusBadge label={row.statusLabel} color={badge.color} soft={badge.soft} size="sm" />
                      <span className="ep-activity__date">{row.dueLabel}</span>
                      <span />
                    </div>
                  </button>
                  <InvoiceRowMenu
                    open={menuId === rowKey}
                    onToggle={() => setMenuId(menuId === rowKey ? null : rowKey)}
                    row={row}
                    onView={openRow}
                    onPreview={() => void invoicesApi.get(row.id).then(setPreviewInvoice)}
                    onShare={() => void invoicesApi.get(row.id).then(setShareInvoice)}
                    onPdf={() => void downloadPdf(row.id)}
                    onSendReminder={() => void runRowAction(() => invoicesApi.sendReminder(row.id))}
                    onDuplicate={() => void runRowAction(() => invoicesApi.duplicate(row.id))}
                    onCancel={() => {
                      if (!window.confirm(`Cancel invoice ${row.displayId}? This can't be undone.`)) return;
                      void runRowAction(() => invoicesApi.cancel(row.id));
                    }}
                    onDelete={() => {
                      if (!window.confirm(`Delete ${row.isDraft ? "draft" : "invoice"} ${row.displayId}? This can't be undone.`))
                        return;
                      void runRowAction(() =>
                        row.isDraft ? invoicesApi.deleteDraft(row.id) : invoicesApi.remove(row.id),
                      );
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {createOpen ? (
        <CreateInvoiceModal
          customers={customersQuery.data ?? []}
          onRefreshCustomers={() => void customersQuery.refetch()}
          onSaveCustomer={createInvoiceCustomer}
          onClose={() => setCreateOpen(false)}
          onCreated={() => void refreshAll()}
        />
      ) : null}
      {shareInvoice ? <ShareInvoiceSheet invoice={shareInvoice} onClose={() => setShareInvoice(null)} /> : null}
        {previewInvoice ? (
          <InvoicePreviewModal
            invoice={previewInvoice}
            onClose={() => setPreviewInvoice(null)}
            onShare={() => {
              setShareInvoice(previewInvoice);
              setPreviewInvoice(null);
            }}
          />
        ) : null}
    </div>
  );
}
