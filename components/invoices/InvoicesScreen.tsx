"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import CreateInvoiceModal from "./CreateInvoiceModal";
import ShareInvoiceSheet from "./ShareInvoiceSheet";
import type { InvoiceCustomer } from "@/lib/services/invoiceCustomers";
import {
  invoicesApi,
  mapInvoiceToListRow,
  type DraftPayload,
  type Invoice,
  type InvoiceMethod,
  type InvoicePayment,
} from "@/lib/services/invoices";

type InvoicesScreenProps = {
  canWrite?: boolean;
};

async function fetchCustomers(): Promise<InvoiceCustomer[]> {
  const res = await fetch("/api/invoice-customers", { credentials: "same-origin" });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: { items: InvoiceCustomer[] } };
  return json.data?.items ?? [];
}

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

export default function InvoicesScreen({ canWrite = true }: InvoicesScreenProps) {
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
    queryFn: () => invoicesApi.summary(),
  });

  const customersQuery = useQuery({
    queryKey: ["invoice-customers"],
    queryFn: fetchCustomers,
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
    return (
      <div data-screen-label="Invoices" className="ep-invoices">
        <button type="button" className="ep-invoices-back" onClick={() => setSelectedId(null)}>
          ← Invoices
        </button>
        <p className="ep-invoices-subtitle">Payment status, breakdown, and reconciliation</p>
        <section className="ep-panel ep-invoices-detail-head">
          <div className="ep-invoices-detail-head__top">
            <span className="ep-mono ep-invoices-id">{selected.invoice_number.toUpperCase()}</span>
            <span className={`ep-invoices-status ep-invoices-status--${mapInvoiceToListRow(selected).status}`}>
              {mapInvoiceToListRow(selected).statusLabel}
            </span>
          </div>
          <p className="ep-mono ep-invoices-detail-amount">
            {Number(expected).toLocaleString("en-US", { minimumFractionDigits: 2 })}{" "}
            <span className="ep-invoices-detail-ccy">{currency}</span>
          </p>
          <p>
            {payload.client_name} · {payload.description}
          </p>
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
          <h4>Payment breakdown</h4>
          {payments.length === 0 ? (
            <p>No payments yet</p>
          ) : (
            <>
              <p className="ep-mono">
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

  const summary = summaryQuery.data;
  const empty = !listQuery.isLoading && rows.length === 0;

  return (
    <div data-screen-label="Invoices" className="ep-invoices">
      <header className="ep-invoices-page-head">
        <div>
          <h2 className="ep-invoices-title">Invoices</h2>
          <p className="ep-invoices-subtitle">Create and manage payment requests across every payment method</p>
        </div>
        {canWrite ? (
          <button type="button" className="ep-invoices-btn ep-invoices-btn--primary" onClick={() => setCreateOpen(true)}>
            + Create invoice
          </button>
        ) : null}
      </header>
      <div className="ep-invoices-stats">
        {(["total_invoiced", "total_paid", "total_pending", "total_overdue"] as const).map((key, i) => (
          <div key={key} className="ep-invoices-stat">
            <span className="ep-mono ep-invoices-stat__value">
              {summary
                ? Number(summary[key]).toLocaleString("en-US", {
                    style: "currency",
                    currency: summary.currency || "USD",
                  })
                : "—"}
            </span>
            <span className="ep-invoices-stat__label">
              {["Total invoiced", "Paid", "Pending", "Overdue"][i]}
            </span>
          </div>
        ))}
      </div>
      <div className="ep-invoices-toolbar">
        <input
          placeholder="Search invoice, customer, or ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="partially_paid">Partially paid</option>
          <option value="paid">Paid</option>
          <option value="expired">Overdue</option>
          <option value="canceled">Cancelled</option>
        </select>
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
          <option value="">All methods</option>
          <option value="usdc">USDC</option>
          <option value="usdt">USDT</option>
          <option value="mpesa">M-Pesa</option>
          <option value="bank">Bank</option>
        </select>
      </div>
      {empty ? (
        <section className="ep-panel ep-invoices-empty">
          <h3>Create your first invoice</h3>
          <p>
            Send customers one invoice and let them pay by USDC on any network, USDT, mobile money or bank transfer.
          </p>
          {canWrite ? (
            <button type="button" className="ep-invoices-btn ep-invoices-btn--primary" onClick={() => setCreateOpen(true)}>
              Create invoice
            </button>
          ) : null}
        </section>
      ) : (
        <section className="ep-panel ep-invoices-table-wrap">
          {rows.map((row) => (
            <div key={row.id} className="ep-invoices-table-row">
              <button type="button" className="ep-invoices-link ep-mono" onClick={() => setSelectedId(row.id)}>
                {row.displayId}
              </button>
              <span>{row.customer}</span>
              <span className="ep-mono">{row.amountLabel}</span>
              <MethodChips methods={row.methods} />
              <span className={`ep-invoices-status ep-invoices-status--${row.status}`}>{row.statusLabel}</span>
              <span>{row.dueLabel}</span>
              <div className="ep-invoices-row-menu">
                <button type="button" onClick={() => setMenuId(menuId === row.id ? null : row.id)}>
                  •••
                </button>
                {menuId === row.id ? (
                  <div className="ep-invoices-row-menu__pop">
                    <button type="button" onClick={() => setSelectedId(row.id)}>
                      View invoice
                    </button>
                    <button type="button" onClick={() => void invoicesApi.get(row.id).then(setShareInvoice)}>
                      Share invoice…
                    </button>
                    <button type="button" onClick={() => void downloadPdf(row.id)}>
                      Download PDF
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      )}
      {createOpen ? (
        <CreateInvoiceModal
          customers={customersQuery.data ?? []}
          onRefreshCustomers={() => void customersQuery.refetch()}
          onClose={() => setCreateOpen(false)}
          onCreated={() => void refreshAll()}
          canWrite={canWrite}
        />
      ) : null}
      {shareInvoice ? <ShareInvoiceSheet invoice={shareInvoice} onClose={() => setShareInvoice(null)} /> : null}
    </div>
  );
}
