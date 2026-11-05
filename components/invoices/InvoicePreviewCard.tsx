"use client";

import type { InvoiceBranding } from "@/lib/services/invoiceBranding";
import { formatInvoiceAmount } from "@/lib/services/invoices";

type InvoicePreviewCardProps = {
  branding?: InvoiceBranding | null;
  invoiceNumber: string;
  amount: number | string;
  currency: string;
  customerName?: string | null;
  description?: string | null;
  dueDate?: string | null;
};

/** The same branded card a customer sees — on the invoice PDF and (soon) at
 * any hosted payment link. Shared by the create wizard's review step and the
 * "Preview invoice" action on an already-issued invoice, so both stay in
 * sync with whatever logo/company details are on file. */
export default function InvoicePreviewCard({
  branding,
  invoiceNumber,
  amount,
  currency,
  customerName,
  description,
  dueDate,
}: InvoicePreviewCardProps) {
  const issuerName = branding?.issuer_name?.trim() || "MBOKA";
  const addressLines = branding?.address_lines ?? [];

  return (
    <div className="ep-invoices-preview-card">
      <div className="ep-invoices-preview-card__issuer">
        {branding?.logo_data_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logo_data_url}
            alt={`${issuerName} logo`}
            className="ep-invoices-preview-card__logo"
          />
        ) : null}
        <div className="ep-invoices-preview-card__issuer-text">
          <p className="ep-invoices-preview-card__brand">{issuerName.toUpperCase()}</p>
          {addressLines.map((line, i) => (
            <p key={i} className="ep-invoices-muted ep-invoices-preview-card__address-line">
              {line}
            </p>
          ))}
        </div>
      </div>
      <p className="ep-mono">Invoice {invoiceNumber.toUpperCase()}</p>
      <p className="ep-mono ep-invoices-preview-card__amount">{formatInvoiceAmount(amount, currency)}</p>
      {customerName ? <p>{customerName}</p> : null}
      {description ? <p>{description}</p> : null}
      <p className="ep-invoices-field-label">Ways to pay</p>
      <div className="ep-invoices-preview-pay-row">
        <span>USDC</span>
        <span className="ep-invoices-muted">Any network · settles on Stellar</span>
      </div>
      <p>Due {dueDate || "—"}</p>
    </div>
  );
}
