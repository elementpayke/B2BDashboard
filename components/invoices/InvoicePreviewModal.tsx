"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { invoiceBrandingApi } from "@/lib/services/invoiceBranding";
import InvoicePreviewCard from "./InvoicePreviewCard";
import { lineItemsTotal as computeLineItemsTotal, type DraftPayload, type Invoice, type LineItem } from "@/lib/services/invoices";

type InvoicePreviewModalProps = {
  invoice: Invoice;
  onClose: () => void;
  onShare?: () => void;
};

export default function InvoicePreviewModal({ invoice, onClose, onShare }: InvoicePreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const brandingQuery = useQuery({
    queryKey: ["invoice-branding"],
    queryFn: () => invoiceBrandingApi.get(),
    retry: false,
  });

  if (!mounted) return null;

  const payload: DraftPayload = invoice.payload ?? { currency: "USD", line_items: [] };
  const amount =
    invoice.expected_amount ?? payload.amount ?? computeLineItemsTotal(payload.line_items as LineItem[]);

  return createPortal(
    <div className="ep-invoices-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="ep-invoices-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ep-preview-invoice-title"
      >
        <div className="ep-invoices-modal__head">
          <h3 id="ep-preview-invoice-title">Invoice preview</h3>
          <button type="button" className="ep-invoices-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="ep-invoices-muted">
          This is what {payload.client_name || "your customer"} sees on the invoice.
        </p>
        <InvoicePreviewCard
          branding={brandingQuery.data}
          invoiceNumber={invoice.invoice_number}
          amount={amount}
          currency={payload.currency || "USD"}
          customerName={payload.client_name}
          description={payload.description}
          dueDate={payload.due_date || invoice.due_date}
        />
        <div className="ep-invoices-modal-actions">
          <button type="button" className="ep-invoices-btn ep-invoices-btn--ghost" onClick={onClose}>
            Close
          </button>
          {onShare ? (
            <button type="button" className="ep-invoices-btn ep-invoices-btn--primary" onClick={onShare}>
              Share invoice
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
