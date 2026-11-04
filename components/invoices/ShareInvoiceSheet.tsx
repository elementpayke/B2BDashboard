"use client";

import { shareMessage, invoicesApi, type Invoice } from "@/lib/services/invoices";

type ShareInvoiceSheetProps = {
  invoice: Invoice;
  onClose: () => void;
};

const CHANNELS = [
  { id: "whatsapp", label: "WhatsApp", href: (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}` },
  { id: "telegram", label: "Telegram", href: (text: string) => `https://t.me/share/url?text=${encodeURIComponent(text)}` },
  { id: "email", label: "Email", href: (text: string) => `mailto:?subject=${encodeURIComponent("Invoice")}&body=${encodeURIComponent(text)}` },
  { id: "sms", label: "SMS", href: (text: string) => `sms:?body=${encodeURIComponent(text)}` },
  {
    id: "slack",
    label: "Slack",
    href: (text: string) => `https://slack.com/intl/en-gb/help/articles/201330736-Share-links#share-a-link`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    href: (text: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("about:blank")}&summary=${encodeURIComponent(text)}`,
  },
] as const;

export default function ShareInvoiceSheet({ invoice, onClose }: ShareInvoiceSheetProps) {
  const message = shareMessage(invoice);
  const title = `Share ${invoice.invoice_number.toUpperCase()}`;

  async function getPdf() {
    const { blob, filename } = await invoicesApi.downloadPdf(invoice.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ep-invoices-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="ep-invoices-modal ep-invoices-share"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ep-share-invoice-title"
      >
        <div className="ep-invoices-modal__head">
          <h3 id="ep-share-invoice-title">{title}</h3>
          <button type="button" className="ep-invoices-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="ep-invoices-share__info">
          Payment details are on the invoice PDF. Attach it when you send.
        </p>
        <button type="button" className="ep-invoices-btn ep-invoices-btn--secondary" onClick={() => void getPdf()}>
          Get PDF
        </button>
        <p className="ep-invoices-share__via-label">Send via</p>
        <div className="ep-invoices-share__grid">
          {CHANNELS.map((ch) => (
            <a
              key={ch.id}
              className="ep-invoices-share__channel"
              href={ch.href(message)}
              target="_blank"
              rel="noreferrer"
            >
              {ch.label}
            </a>
          ))}
        </div>
        <button type="button" className="ep-invoices-btn ep-invoices-btn--ghost" onClick={() => void getPdf()}>
          Open printable invoice
        </button>
      </div>
    </div>
  );
}
