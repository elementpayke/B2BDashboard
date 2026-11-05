"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { InvoiceCustomer } from "@/lib/services/invoiceCustomers";
import { invoiceBrandingApi } from "@/lib/services/invoiceBranding";
import InvoicePreviewCard from "./InvoicePreviewCard";
import {
  buildCreatePayloadFromWizard,
  formatInvoiceAmount,
  invoicesApi,
  type Invoice,
  type InvoiceMethod,
  type SettlementPreference,
} from "@/lib/services/invoices";

type CreateInvoiceModalProps = {
  customers: InvoiceCustomer[];
  onRefreshCustomers: () => void;
  onSaveCustomer: (input: { name: string; email: string; country?: string | null }) => Promise<InvoiceCustomer>;
  onClose: () => void;
  onCreated: (invoice: Invoice) => void;
};

// Only the Stellar USDC rail is wired up today. The other entries stay here,
// unused, so turning M-Pesa/bank/USDT back on later is a one-line change
// rather than reconstructing this metadata from scratch.
const METHOD_META: Record<
  InvoiceMethod,
  { label: string; detail: string; kind: string }
> = {
  usdc: {
    kind: "Stablecoin",
    label: "USDC",
    detail: "Any network · settles on Stellar",
  },
  usdt: {
    kind: "Stablecoin",
    label: "USDT",
    detail: "Ethereum, Polygon, Tron",
  },
  mpesa: {
    kind: "Mobile money",
    label: "M-Pesa",
    detail: "Kenya · Safaricom",
  },
  bank: {
    kind: "Local bank rails",
    label: "Bank transfer",
    detail: "Pesalink, SEPA, ACH, Faster Payments",
  },
};

const INVOICE_METHODS: InvoiceMethod[] = ["usdc"];
const INVOICE_SETTLEMENT: SettlementPreference = "stellar_usdc";

export default function CreateInvoiceModal({
  customers,
  onRefreshCustomers,
  onSaveCustomer,
  onClose,
  onCreated,
}: CreateInvoiceModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Invoice | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [invoiceNumberHint, setInvoiceNumberHint] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [lineName, setLineName] = useState("");
  const [lineDetail, setLineDetail] = useState("");
  const [lineQty, setLineQty] = useState("1");
  const [lineUnit, setLineUnit] = useState("");
  const [items, setItems] = useState<{ name: string; detail?: string; qty: number; unit_price: string }[]>([]);
  const methods = INVOICE_METHODS;
  const settlement = INVOICE_SETTLEMENT;
  const [allowPartial, setAllowPartial] = useState(false);
  const [emailOnCreate, setEmailOnCreate] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    void invoicesApi.nextId().then((r) => setInvoiceNumberHint(r.next_invoice_number.toUpperCase()));
  }, []);

  const brandingQuery = useQuery({
    queryKey: ["invoice-branding"],
    queryFn: () => invoiceBrandingApi.get(),
    retry: false,
  });

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const total = useMemo(() => {
    return items.reduce((s, i) => s + i.qty * Number(i.unit_price || 0), 0);
  }, [items]);

  const step1Valid = Boolean(selectedCustomer && items.length > 0);

  async function saveNewCustomer() {
    const created = await onSaveCustomer({
      name: newName.trim(),
      email: newEmail.trim(),
      country: newCountry.trim() || null,
    });
    onRefreshCustomers();
    setCustomerId(created.id);
    setShowNewCustomer(false);
    setNewName("");
    setNewEmail("");
    setNewCountry("");
  }

  async function submit() {
    if (!selectedCustomer) return;
    setBusy(true);
    setError(null);
    try {
      const payload = buildCreatePayloadFromWizard({
        clientName: selectedCustomer.name,
        clientEmail: selectedCustomer.email,
        currency,
        description,
        dueDate,
        lineItems: items,
        methods,
        settlement,
        allowPartial,
        emailOnCreate,
        note,
      });
      const draft = await invoicesApi.createDraft(description || null, payload, dueDate || null);
      const issued = await invoicesApi.issue(draft.id, emailOnCreate ? "email" : "none");
      setSuccess(issued);
      onCreated(issued);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create invoice");
    } finally {
      setBusy(false);
    }
  }

  function modalRoot(content: ReactNode) {
    if (!mounted) return null;
    return createPortal(content, document.body);
  }

  if (success) {
    return modalRoot(
      <div className="ep-invoices-modal-overlay" onClick={onClose} role="presentation">
        <div className="ep-invoices-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
          <div className="ep-invoices-success">
            <div className="ep-invoices-success__icon" aria-hidden>
              ✓
            </div>
            <h3>{success.invoice_number.toUpperCase()} is live</h3>
            <p className="ep-mono ep-invoices-success__amount">
              {formatInvoiceAmount(success.payload.amount || total, currency)}
            </p>
            <p>
              {selectedCustomer?.name} can pay in USDC on Stellar. We emailed them the invoice PDF with payment
              details.
            </p>
            <button type="button" className="ep-invoices-btn ep-invoices-btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>,
    );
  }

  return modalRoot(
    <div className="ep-invoices-modal-overlay" onClick={onClose} role="presentation">
      <div className="ep-invoices-modal ep-invoices-create" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="ep-invoices-modal__head">
          <h3>Create invoice</h3>
          <button type="button" className="ep-invoices-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="ep-invoices-steps" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span key={n} className={`ep-invoices-steps__seg${step >= n ? " ep-invoices-steps__seg--done" : ""}`} />
          ))}
        </div>
        <p className="ep-invoices-step-label">
          Step {step} · {step === 1 ? "Details" : step === 2 ? "Settlement" : "Review and send"}
        </p>

        {step === 1 ? (
          <div className="ep-invoices-form">
            <section className="ep-invoices-compose">
              <h4 className="ep-invoices-compose__title">Customer</h4>
              <label>
                <span className="ep-invoices-field-label">Bill to</span>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.email}
                    </option>
                  ))}
                </select>
              </label>
              {!showNewCustomer ? (
                <button type="button" className="ep-invoices-btn ep-invoices-btn--ghost" onClick={() => setShowNewCustomer(true)}>
                  + Add customer
                </button>
              ) : (
                <div className="ep-invoices-new-customer">
                  <div className="ep-invoices-form-row">
                    <input placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                    <input placeholder="Email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                  </div>
                  <input placeholder="Country (optional)" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} />
                  <div className="ep-invoices-inline-actions">
                    <button
                      type="button"
                      className="ep-invoices-btn ep-invoices-btn--primary"
                      disabled={!newName.trim() || !newEmail.trim()}
                      onClick={() =>
                        void saveNewCustomer().catch((err) =>
                          setError(err instanceof Error ? err.message : "Could not save customer"),
                        )
                      }
                    >
                      Save customer
                    </button>
                    <button type="button" className="ep-invoices-btn ep-invoices-btn--ghost" onClick={() => setShowNewCustomer(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
            <div className="ep-invoices-form-row">
              <label>
                <span className="ep-invoices-field-label">Currency</span>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="KES">KES</option>
                </select>
              </label>
              <label>
                <span className="ep-invoices-field-label">Invoice number</span>
                <input className="ep-mono" readOnly value={invoiceNumberHint} />
              </label>
            </div>
            <label>
              <span className="ep-invoices-field-label">Due date</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <label>
              <span className="ep-invoices-field-label">Description</span>
              <input placeholder="What is this invoice for?" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <section className="ep-invoices-compose">
              <h4 className="ep-invoices-compose__title">Line items</h4>
              {items.length > 0 ? (
                <table className="ep-invoices-items-table ep-mono">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx}>
                        <td>
                          {it.name}
                          {it.detail ? <span className="ep-invoices-muted"> — {it.detail}</span> : null}
                        </td>
                        <td>{it.qty}</td>
                        <td>{it.unit_price}</td>
                        <td>
                          <button type="button" className="ep-invoices-btn ep-invoices-btn--ghost" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              <div className="ep-invoices-line-items">
                <input placeholder="Item name" value={lineName} onChange={(e) => setLineName(e.target.value)} />
                <input placeholder="Description (optional)" value={lineDetail} onChange={(e) => setLineDetail(e.target.value)} />
                <div className="ep-invoices-form-row ep-invoices-form-row--compact">
                  <input placeholder="Qty" inputMode="decimal" value={lineQty} onChange={(e) => setLineQty(e.target.value)} />
                  <input placeholder="Unit price" inputMode="decimal" value={lineUnit} onChange={(e) => setLineUnit(e.target.value)} />
                </div>
                <button
                  type="button"
                  className="ep-invoices-btn ep-invoices-btn--dashed"
                  onClick={() => {
                    if (!lineName.trim() || !lineUnit.trim()) return;
                    setItems((prev) => [
                      ...prev,
                      {
                        name: lineName.trim(),
                        detail: lineDetail.trim() || undefined,
                        qty: Number(lineQty) || 1,
                        unit_price: lineUnit.trim(),
                      },
                    ]);
                    setLineName("");
                    setLineDetail("");
                    setLineQty("1");
                    setLineUnit("");
                  }}
                >
                  + Add item
                </button>
              </div>
            </section>
            <div className="ep-invoices-total-bar ep-mono">
              Total {formatInvoiceAmount(total, currency)}
            </div>
            <button
              type="button"
              className="ep-invoices-btn ep-invoices-btn--primary"
              disabled={!step1Valid}
              onClick={() => setStep(2)}
            >
              {step1Valid ? "Continue to settlement" : "Add a customer and one line item"}
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="ep-invoices-form">
            <div className="ep-invoices-rail-banner">
              <strong>Stellar · USDC</strong>
              <span className="ep-invoices-muted">
                Every invoice settles in USDC on Stellar for now. M-Pesa, bank transfer, and USDT are on the roadmap —
                turning them on won&apos;t require re-creating invoices you send today.
              </span>
            </div>
            <label className="ep-invoices-check">
              <input type="checkbox" checked={allowPartial} onChange={(e) => setAllowPartial(e.target.checked)} />
              Allow partial payments — Customer can pay across several transactions
            </label>
            <label className="ep-invoices-check">
              <input type="checkbox" checked={emailOnCreate} onChange={(e) => setEmailOnCreate(e.target.checked)} />
              Email the invoice — Send the invoice PDF on creation
            </label>
            <label>
              <span className="ep-invoices-field-label">Note to customer</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </label>
            <div className="ep-invoices-modal-actions">
              <button type="button" className="ep-invoices-btn ep-invoices-btn--ghost" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button type="button" className="ep-invoices-btn ep-invoices-btn--primary" onClick={() => setStep(3)}>
                Review invoice
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="ep-invoices-form">
            <p>This is what {selectedCustomer?.name} will see on the invoice.</p>
            <InvoicePreviewCard
              branding={brandingQuery.data}
              invoiceNumber={invoiceNumberHint}
              amount={total}
              currency={currency}
              customerName={selectedCustomer?.name}
              description={description}
              dueDate={dueDate}
            />
            <p>Settles to your USDC account on Stellar</p>
            <div className="ep-invoices-modal-actions">
              <button type="button" className="ep-invoices-btn ep-invoices-btn--ghost" onClick={() => setStep(2)}>
                ← Back
              </button>
              <button
                type="button"
                className="ep-invoices-btn ep-invoices-btn--primary"
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? "Creating…" : "Create and send"}
              </button>
            </div>
          </div>
        ) : null}
        {error ? (
          <p className="ep-invoices-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>,
  );
}
