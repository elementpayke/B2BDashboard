"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import CreateInvoiceModal from "./CreateInvoiceModal";
import ShareInvoiceSheet from "./ShareInvoiceSheet";
import StatusBadge from "@/components/ui/StatusBadge";
import { createInvoiceCustomer, fetchInvoiceCustomers } from "@/lib/services/invoiceCustomersApi";
import {
  invoicesApi,
  mapInvoiceToListRow,
  summarizeInvoices,
  type DraftPayload,
  type Invoice,
  type InvoiceMethod,
  type InvoicePayment,
  type InvoiceSummary,
  type UiInvoiceStatus,
} from "@/lib/services/invoices";

const STATUS_BADGE: Record<
  UiInvoiceStatus,
  { color: string; soft: string }
> = {
  draft: { color: "var(--muted2)", soft: "var(--surface2)" },
  pending: { color: "var(--amber, #b47700)", soft: "var(--amber-tint, #fbf2de)" },
  partially_paid: { color: "var(--amber, #b47700)", soft: "var(--amber-tint, #fbf2de)" },
  paid: { color: "var(--indigo-text, #3b2ed3)", soft: "var(--indigo-tint, #eeedfb)" },
  overdue: { color: "var(--red-text, #c42a2f)", soft: "var(--red-tint, #fcebec)" },
  cancelled: { color: "var(--muted2)", soft: "var(--surface2)" },
};

function MethodChips({ methods }: { methods: InvoiceMethod[] }) {
  const visible = methods.slice(0, 2);
  const extra = methods.length - visible.length;
  return (
    <span className="ep-invoices-methods">
      {visible.map((m) => (
        <span key={m} className="ep-invoices-rail-chip">
          {m === "mpesa" ? "M-Pesa" : m.toUpperCase()}
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
  return n.toLocaleString("en-US", { style: "currency", currency: currency || "USD" });
}

function InvoiceRowMenu({
  open,
  onToggle,
  onView,
  onShare,
  onPdf,
}: {
  open: boolean;
  onToggle: () => void;
  onView: () => void;
  onShare: () => void;
  onPdf: () => void;
}) {
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
            View invoice
          </button>
          <button type="button" onClick={onShare}>
            Share invoice…
          </button>
          <button type="button" onClick={onPdf}>
            Download PDF
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function InvoicesScreen() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [shareInvoice, setShareInvoice] = useState<Invoice | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);

  const listQuery = useQuery({
    queryKey: ["invoices", statusFilter, methodFilter],
    queryFn: () =>
      invoicesApi.list({
        status: statusFilter || undefined,
        payment_method: methodFilter || undefined,
        limit: 100,
      }),
  });

  const summaryQuery = useQuery({
    queryKey: ["invoices-summary"],
    queryFn: async (): Promise<InvoiceSummary> => {
      try {
        return await invoicesApi.summary();
      } catch {
        const list = await invoicesApi.list({ limit: 500 });
        return summarizeInvoices(list.items);
      }
    },
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
    queryFn: () => invoicesApi.payments(selectedId!),
    enabled: selectedId != null,
  });

  const rows = useMemo(() => {
    const items = listQuery.data?.items ?? [];
    const q = search.trim().toLowerCase();
    return items
      .map(mapInvoiceToListRow)
      .filter(
        (r) =>
          !q ||
          r.displayId.toLowerCase().includes(q) ||
          r.customer.toLowerCase().includes(q),
      );
  }, [listQuery.data, search]);

  const selected = detailQuery.data;
  const payments: InvoicePayment[] = paymentsQuery.data?.items ?? [];

  const summary =
    summaryQuery.data ??
    (listQuery.data?.items?.length ? summarizeInvoices(listQuery.data.items) : undefined);

  const summaryCurrency = summary?.currency || "USD";

  async function refreshAll() {
    await qc.invalidateQueries({ queryKey: ["invoices"] });
    await qc.invalidateQueries({ queryKey: ["invoices-summary"] });
    if (selectedId != null) {
      await qc.invalidateQueries({ queryKey: ["invoice", selectedId] });
      await qc.invalidateQueries({ queryKey: ["invoice-payments", selectedId] });
    }
  }

  async function downloadPdf(id: number) {
    const { blob, filename } = await invoicesApi.downloadPdf(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (selectedId != null && selected) {
    const payload: DraftPayload = selected.payload ?? { currency: "USD", line_items: [] };
    const currency = payload.currency || "USD";
    const expected = selected.expected_amount ?? payload.amount ?? "0";
    const received = selected.amount_received ?? "0";
    const row = mapInvoiceToListRow(selected);
    const badge = STATUS_BADGE[row.status];
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
            {Number(expected).toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
            <span className="ep-invoices-detail-ccy">{currency}</span>
          </p>
          <p className="ep-invoices-detail-meta">
            {payload.client_name}
            {payload.description ? ` · ${payload.description}` : ""}
          </p>
          <MethodChips methods={row.methods} />
          <div className="ep-invoices-detail-actions">
            <button type="button" className="ep-invoices-btn ep-invoices-btn--secondary" onClick={() => void downloadPdf(selected.id)}>
              Download PDF
            </button>
            <button type="button" className="ep-invoices-btn ep-invoices-btn--primary" onClick={() => setShareInvoice(selected)}>
              Share invoice
            </button>
          </div>
        </section>
        <section className="ep-panel ep-invoices-section">
          <h3 className="ep-invoices-section__title">Payment breakdown</h3>
          {payments.length === 0 ? (
            <p className="ep-invoices-muted">No payments recorded yet.</p>
          ) : (
            <>
              <p className="ep-mono ep-invoices-muted">
                {Number(received).toLocaleString("en-US", { minimumFractionDigits: 2 })} of{" "}
                {Number(expected).toLocaleString("en-US", { minimumFractionDigits: 2 })} {currency} received
              </p>
              {payments.map((p) => (
                <div key={p.id} className="ep-invoices-payment-row">
                  <span>{p.method.toUpperCase()}</span>
                  <span className="ep-mono">{Number(p.amount).toFixed(2)}</span>
                </div>
              ))}
              <button type="button" className="ep-invoices-btn ep-invoices-btn--ghost" onClick={() => setSettlementOpen((v) => !v)}>
                {settlementOpen ? "Hide settlement details" : "Settlement details"}
              </button>
              {settlementOpen
                ? payments.map((p) => (
                    <div key={`${p.id}-s`} className="ep-invoices-settlement-block">
                      {p.method === "usdc" ? `${p.source_chain ?? "Stellar"} → settled on Stellar` : p.method}
                    </div>
                  ))
                : null}
            </>
          )}
        </section>
        {shareInvoice ? <ShareInvoiceSheet invoice={shareInvoice} onClose={() => setShareInvoice(null)} /> : null}
      </div>
    );
  }

  const empty = !listQuery.isLoading && rows.length === 0;
  const statsLoading = listQuery.isLoading || (summaryQuery.isLoading && !summary);

  return (
    <div className="ep-invoices">
      <div className="ep-reports__stats ep-invoices__stats">
        {(
          [
            ["total_invoiced", "Total invoiced"],
            ["total_paid", "Paid"],
            ["total_pending", "Pending"],
            ["total_overdue", "Overdue"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="ep-reports__stat">
            <span className="ep-reports__stat-label">{label}</span>
            <span className="ep-reports__stat-value ep-mono">
              {formatStat(summary?.[key], summaryCurrency, statsLoading)}
            </span>
          </div>
        ))}
      </div>

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
              <option value="pending">Pending</option>
              <option value="partially_paid">Partially paid</option>
              <option value="paid">Paid</option>
              <option value="expired">Overdue</option>
              <option value="canceled">Cancelled</option>
            </select>
          </label>
          <label className="ep-statements__filter">
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} aria-label="Payment method">
              <option value="">All methods</option>
              <option value="usdc">USDC</option>
              <option value="usdt">USDT</option>
              <option value="mpesa">M-Pesa</option>
              <option value="bank">Bank</option>
            </select>
          </label>
        </div>
        <div className="ep-statements__toolbar-actions">
          <button type="button" className="ep-invoices-btn ep-invoices-btn--primary" onClick={() => setCreateOpen(true)}>
            + Create invoice
          </button>
        </div>
      </div>

      {empty ? (
        <section className="ep-panel ep-invoices-empty">
          <h3>Create your first invoice</h3>
          <p>
            Send one invoice and let customers pay with USDC (any network), USDT, M-Pesa, or bank transfer. Payment
            instructions live on the PDF — no hosted payment page.
          </p>
          <button type="button" className="ep-invoices-btn ep-invoices-btn--primary" onClick={() => setCreateOpen(true)}>
            Create invoice
          </button>
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
              return (
                <li key={row.id} className="ep-invoices-list__item">
                  <button type="button" className="ep-activity__row" onClick={() => setSelectedId(row.id)}>
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
                    open={menuId === row.id}
                    onToggle={() => setMenuId(menuId === row.id ? null : row.id)}
                    onView={() => setSelectedId(row.id)}
                    onShare={() => void invoicesApi.get(row.id).then(setShareInvoice)}
                    onPdf={() => void downloadPdf(row.id)}
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
    </div>
  );
}
