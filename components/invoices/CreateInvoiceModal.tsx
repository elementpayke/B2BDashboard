"use client";

import { useEffect, useMemo, useState } from "react";
import type { InvoiceCustomer } from "@/lib/services/invoiceCustomers";
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
  onClose: () => void;
  onCreated: (invoice: Invoice) => void;
  canWrite: boolean;
};

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

const SETTLEMENT_OPTIONS: { value: SettlementPreference; title: string; detail: string }[] = [
  {
    value: "asset",
    title: "Keep in the asset paid",
    detail: "Fiat lands in its own currency. USDC from any network lands as USDC on Stellar",
  },
  {
    value: "stellar_usdc",
    title: "Convert everything to USDC on Stellar",
    detail: "Settled to your USDC Account on Stellar",
  },
  { value: "USD", title: "Convert everything to USD", detail: "Settled to your US Dollar account" },
  { value: "KES", title: "Convert everything to KES", detail: "Settled to your Kenyan Shilling account" },
  { value: "EUR", title: "Convert everything to EUR", detail: "Settled to your Euro account" },
];

export default function CreateInvoiceModal({
  customers,
  onRefreshCustomers,
  onClose,
  onCreated,
  canWrite,
}: CreateInvoiceModalProps) {
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
  const [methods, setMethods] = useState<InvoiceMethod[]>(["usdc"]);
  const [settlement, setSettlement] = useState<SettlementPreference>("asset");
  const [allowPartial, setAllowPartial] = useState(false);
  const [emailOnCreate, setEmailOnCreate] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    void invoicesApi.nextId().then((r) => setInvoiceNumberHint(r.next_invoice_number.toUpperCase()));
  }, []);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const total = useMemo(() => {
    return items.reduce((s, i) => s + i.qty * Number(i.unit_price || 0), 0);
  }, [items]);

  const step1Valid = Boolean(selectedCustomer && items.length > 0);
  const step2Valid = methods.length > 0;

  function toggleMethod(m: InvoiceMethod) {
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function saveNewCustomer() {
    const res = await fetch("/api/invoice-customers", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, email: newEmail, country: newCountry || null }),
    });
    if (!res.ok) {
      const j = (await res.json()) as { message?: string };
      throw new Error(j.message || "Could not save customer");
    }
    const j = (await res.json()) as { data: InvoiceCustomer };
    onRefreshCustomers();
    setCustomerId(j.data.id);
    setShowNewCustomer(false);
  }

  async function submit() {
    if (!canWrite || !selectedCustomer) return;
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

  if (success) {
    const n = success.payload.methods?.length ?? methods.length;
    return (
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
              {selectedCustomer?.name} can pay with {n} payment methods. We emailed them the invoice PDF with
              payment details.
            </p>
            <button type="button" className="ep-invoices-btn ep-invoices-btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
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
          Step {step} · {step === 1 ? "Details" : step === 2 ? "Payment methods" : "Review and send"}
        </p>

        {step === 1 ? (
          <div className="ep-invoices-form">
            <label>
              <span className="ep-invoices-field-label">Customer</span>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="ep-invoices-inline-actions">
              <button type="button" className="ep-invoices-btn ep-invoices-btn--ghost" onClick={() => setShowNewCustomer(true)}>
                + Add customer
              </button>
            </div>
            {showNewCustomer ? (
              <div className="ep-invoices-new-customer">
                <p className="ep-invoices-field-label">New customer</p>
                <input placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                <input placeholder="Country (optional)" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} />
                <button
                  type="button"
                  className="ep-invoices-btn ep-invoices-btn--primary"
                  disabled={!newName.trim() || !newEmail.trim()}
                  onClick={() => void saveNewCustomer().catch((err) => setError(String(err)))}
                >
                  Save customer
                </button>
              </div>
            ) : null}
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
            <label>
              <span className="ep-invoices-field-label">Due date</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <label>
              <span className="ep-invoices-field-label">Description</span>
              <input placeholder="What is this invoice for?" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="ep-invoices-line-items">
              <input placeholder="Item name" value={lineName} onChange={(e) => setLineName(e.target.value)} />
              <input placeholder="Description (optional)" value={lineDetail} onChange={(e) => setLineDetail(e.target.value)} />
              <input placeholder="Qty" value={lineQty} onChange={(e) => setLineQty(e.target.value)} />
              <input placeholder="Unit price" value={lineUnit} onChange={(e) => setLineUnit(e.target.value)} />
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
              {items.map((it, idx) => (
                <div key={idx} className="ep-invoices-line-row ep-mono">
                  {it.name} · {it.qty} × {it.unit_price}
                </div>
              ))}
            </div>
            <div className="ep-invoices-total-bar ep-mono">
              Total {formatInvoiceAmount(total, currency)}
            </div>
            <button
              type="button"
              className="ep-invoices-btn ep-invoices-btn--primary"
              disabled={!step1Valid}
              onClick={() => setStep(2)}
            >
              {step1Valid ? "Continue to payment methods" : "Add a customer and one line item"}
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="ep-invoices-form">
            <p className="ep-invoices-muted">
              Your customer sees every method you enable on the invoice and picks one. USDC from any network settles on
              Stellar.
            </p>
            {(Object.keys(METHOD_META) as InvoiceMethod[]).map((m) => (
              <label key={m} className={`ep-invoices-method-card${methods.includes(m) ? " ep-invoices-method-card--on" : ""}`}>
                <input type="checkbox" checked={methods.includes(m)} onChange={() => toggleMethod(m)} />
                <span>
                  <strong>{METHOD_META[m].label}</strong>
                  <span className="ep-invoices-muted">
                    {METHOD_META[m].kind} · {METHOD_META[m].detail}
                  </span>
                </span>
              </label>
            ))}
            {!step2Valid ? (
              <p className="ep-invoices-error" role="alert">
                Select at least one payment method so your customer has a way to pay.
              </p>
            ) : null}
            <p className="ep-invoices-field-label">Settlement preference</p>
            {SETTLEMENT_OPTIONS.map((opt) => (
              <label key={opt.value} className="ep-invoices-settlement-card">
                <input
                  type="radio"
                  name="settlement"
                  checked={settlement === opt.value}
                  onChange={() => setSettlement(opt.value)}
                />
                <span>
                  <strong>{opt.title}</strong>
                  <span className="ep-invoices-muted">{opt.detail}</span>
                </span>
              </label>
            ))}
            <label className="ep-invoices-check">
              <input type="checkbox" checked={allowPartial} onChange={(e) => setAllowPartial(e.target.checked)} />
              Allow partial payments — Customer can pay across several methods
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
              <button type="button" className="ep-invoices-btn ep-invoices-btn--primary" disabled={!step2Valid} onClick={() => setStep(3)}>
                Review invoice
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="ep-invoices-form">
            <p>This is what {selectedCustomer?.name} will see on the invoice.</p>
            <div className="ep-invoices-preview-card">
              <p className="ep-invoices-preview-card__brand">MBOKA</p>
              <p className="ep-mono">Invoice {invoiceNumberHint}</p>
              <p className="ep-mono ep-invoices-preview-card__amount">{formatInvoiceAmount(total, currency)}</p>
              <p>{selectedCustomer?.name}</p>
              <p>{description}</p>
              <p className="ep-invoices-field-label">Ways to pay</p>
              {methods.map((m) => (
                <div key={m} className="ep-invoices-preview-pay-row">
                  <span>{METHOD_META[m].label}</span>
                  <span className="ep-invoices-muted">{METHOD_META[m].detail}</span>
                </div>
              ))}
              <p>Due {dueDate || "—"}</p>
            </div>
            <p>Payment methods {methods.length} enabled</p>
            <p>Settles to {SETTLEMENT_OPTIONS.find((o) => o.value === settlement)?.title}</p>
            <div className="ep-invoices-modal-actions">
              <button type="button" className="ep-invoices-btn ep-invoices-btn--ghost" onClick={() => setStep(2)}>
                ← Back
              </button>
              <button
                type="button"
                className="ep-invoices-btn ep-invoices-btn--primary"
                disabled={!canWrite || busy}
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
    </div>
  );
}
