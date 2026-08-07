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
  /** Optional secondary cue (due date, issued date, etc.) */
  meta?: string;
};

type Props = {
  items: InvoiceItem[];
  emptyLabel?: string;
  title?: string;
};

export default function InvoiceList({
  items,
  emptyLabel = "No invoices yet",
  title = "Invoices",
}: Props) {
  return (
    <section className="ep-panel ep-activity ep-invoice" aria-label={title}>
      {items.length === 0 ? (
        <div className="ep-activity__empty ep-invoice__empty">{emptyLabel}</div>
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
                  className="ep-activity__row ep-invoice-row-btn"
                  onClick={inv.onOpen}
                  disabled={!inv.onOpen}
                  aria-label={`Invoice ${inv.id}, ${inv.client}, ${inv.amount}, ${inv.statusLabel}`}
                >
                  <div className="ep-activity__card">
                    <div className="ep-activity__card-top">
                      <div className="ep-activity__party-text">
                        <span className="ep-mono ep-activity__client ep-invoice__id">
                          {inv.id}
                        </span>
                        {inv.meta ? (
                          <span className="ep-activity__meta">{inv.meta}</span>
                        ) : null}
                      </div>
                      <span className="ep-mono ep-activity__amount ep-invoice__amount">
                        {inv.amount}
                      </span>
                    </div>
                    <div className="ep-activity__card-bottom">
                      <span className="ep-activity__type ep-invoice__client">
                        {inv.client}
                      </span>
                      <StatusBadge
                        label={inv.statusLabel}
                        color={inv.statusColor}
                        soft={inv.statusSoft}
                      />
                    </div>
                  </div>
                  <div className="ep-activity__desktop ep-invoice-row">
                    <div className="ep-activity__party-text">
                      <span className="ep-mono ep-invoice__id">{inv.id}</span>
                      {inv.meta ? (
                        <span className="ep-activity__meta">{inv.meta}</span>
                      ) : null}
                    </div>
                    <span className="ep-invoice__client">{inv.client}</span>
                    <StatusBadge
                      label={inv.statusLabel}
                      color={inv.statusColor}
                      soft={inv.statusSoft}
                    />
                    <span className="ep-mono ep-align-end ep-invoice__amount">
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
