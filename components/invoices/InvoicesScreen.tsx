"use client";

import React from "react";
import InvoiceList, { type InvoiceItem } from "@/components/ui/InvoiceList";
import { useInvoicesPage } from "@/lib/hooks/useInvoicesPage";
import type { Invoice, InvoiceStatus } from "@/lib/services/invoices";
import { describeInvoiceStatus } from "@/lib/services/invoiceStatus";

const STATUS_FILTERS: { key: InvoiceStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "partially_paid", label: "Partially Paid" },
  { key: "paid", label: "Paid" },
  { key: "expired", label: "Expired" },
  { key: "failed", label: "Failed" },
];

const NETWORK_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All networks" },
  { key: "stellar", label: "Stellar (USDC)" },
];

function formatInvoiceAmount(inv: Invoice): string {
  const amount = inv.expected_amount;
  const asset = inv.asset_code || "USDC";
  if (amount == null) return "—";
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${amount} ${asset}`;
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${asset}`;
}

function formatInvoiceMeta(inv: Invoice): string {
  const created = inv.created_at ? new Date(inv.created_at).toLocaleDateString() : null;
  const network = inv.network ? inv.network[0].toUpperCase() + inv.network.slice(1) : null;
  return [created, network].filter(Boolean).join(" · ");
}

export type InvoicesScreenProps = {
  onOpenInvoice: (invoiceId: number) => void;
  onCreateInvoice: () => void;
};

export default function InvoicesScreen({ onOpenInvoice, onCreateInvoice }: InvoicesScreenProps) {
  const [status, setStatus] = React.useState<InvoiceStatus | "all">("all");
  const [network, setNetwork] = React.useState<string>("all");
  const [dateRange, setDateRange] = React.useState<"all" | "7d" | "30d">("all");

  const page = useInvoicesPage(status, network);

  const items: Invoice[] = React.useMemo(() => {
    if (dateRange === "all") return page.items;
    const cutoff = Date.now() - (dateRange === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000;
    return page.items.filter((inv) => {
      if (!inv.created_at) return true;
      return new Date(inv.created_at).getTime() >= cutoff;
    });
  }, [page.items, dateRange]);

  const listItems: InvoiceItem[] = items.map((inv) => {
    const descriptor = describeInvoiceStatus(inv.status);
    return {
      id: inv.invoice_number,
      client: (inv.payload?.client_name as string) || "—",
      amount: formatInvoiceAmount(inv),
      statusLabel: descriptor.label,
      statusColor: descriptor.color,
      statusSoft: descriptor.soft,
      meta: formatInvoiceMeta(inv),
      onOpen: () => onOpenInvoice(inv.id),
    };
  });

  const emptyLabel = page.isLoading
    ? "Loading…"
    : page.isError
      ? "Couldn't load invoices"
      : "No invoices match this filter";

  return (
    <div className="ep-txn-screen" data-screen-label="Invoices">
      <div className="ep-txn-toolbar">
        <button type="button" className="ep-txn-pager__btn ep-txn-pager__btn--primary" onClick={onCreateInvoice}>
          + New invoice
        </button>
        <div className="ep-txn-advanced-desktop">
          <div className="ep-txn-advanced-fields">
            <label>
              <span>Network</span>
              <select value={network} onChange={(event) => setNetwork(event.target.value)}>
                {NETWORK_FILTERS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Date</span>
              <select
                value={dateRange}
                onChange={(event) => setDateRange(event.target.value as "all" | "7d" | "30d")}
              >
                <option value="all">Any time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="ep-txn-filters" role="group" aria-label="Filter invoices by status">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatus(f.key)}
            className={`ep-txn-filter${status === f.key ? " ep-txn-filter--active" : ""}`}
            aria-pressed={status === f.key}
          >
            {f.label}
          </button>
        ))}
      </div>

      <InvoiceList items={listItems} emptyLabel={emptyLabel} />

      {page.total > 0 || page.hasPrev ? (
        <nav className="ep-txn-pager" aria-label="Invoice pages">
          <span className="ep-txn-pager__meta" aria-live="polite">
            Page {page.pageNumber} of {page.pageCount}
            {page.total > 0 ? ` · ${page.total} total` : ""}
            {page.isFetching ? <span className="ep-txn-pager__updating"> · Updating…</span> : null}
          </span>
          <div className="ep-txn-pager__actions">
            <button
              type="button"
              onClick={page.prevPage}
              disabled={!page.hasPrev}
              className="ep-txn-pager__btn"
              aria-label="Previous page"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={page.nextPage}
              disabled={!page.hasNext}
              className={`ep-txn-pager__btn${page.hasNext ? " ep-txn-pager__btn--primary" : ""}`}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
