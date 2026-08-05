"use client";

import React from "react";
import StatusBadge from "./StatusBadge";

export type InvoiceItem = {
  id: string;
  client: string;
  amount: string;
  statusLabel: string;
  statusColor: string;
  statusSoft: string;
  onOpen?: () => void;
};

type Props = {
  items: InvoiceItem[];
  emptyLabel?: string;
};

export default function InvoiceList({
  items,
  emptyLabel = "No invoices yet",
}: Props) {
  return (
    <section className="ep-panel ep-activity">
      {items.length === 0 ? (
        <div className="ep-activity__empty">{emptyLabel}</div>
      ) : (
        <>
          <div className="ep-activity__table-head ep-invoice-head" aria-hidden>
            <span>Invoice</span>
            <span>Client</span>
            <span>Status</span>
            <span className="ep-align-end">Amount</span>
          </div>
          <ul className="ep-activity__list">
            {items.map((inv) => (
              <li key={inv.id}>
                <button
                  type="button"
                  className="ep-activity__row"
                  onClick={inv.onOpen}
                  disabled={!inv.onOpen}
                  aria-label={`Invoice ${inv.id}, ${inv.client}, ${inv.amount}, ${inv.statusLabel}`}
                >
                  <div className="ep-activity__card">
                    <div className="ep-activity__card-top">
                      <span className="ep-mono ep-activity__client">{inv.id}</span>
                      <span className="ep-mono ep-activity__amount">{inv.amount}</span>
                    </div>
                    <div className="ep-activity__card-bottom">
                      <span className="ep-activity__type">{inv.client}</span>
                      <StatusBadge
                        label={inv.statusLabel}
                        color={inv.statusColor}
                        soft={inv.statusSoft}
                        showDot={false}
                      />
                    </div>
                  </div>
                  <div className="ep-activity__desktop ep-invoice-row">
                    <span className="ep-mono" style={{ fontWeight: 600 }}>
                      {inv.id}
                    </span>
                    <span>{inv.client}</span>
                    <StatusBadge
                      label={inv.statusLabel}
                      color={inv.statusColor}
                      soft={inv.statusSoft}
                      showDot={false}
                    />
                    <span className="ep-mono ep-align-end" style={{ fontWeight: 600 }}>
                      {inv.amount}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
