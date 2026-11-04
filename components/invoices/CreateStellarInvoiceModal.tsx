"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { buildStellarDraftPayload, invoicesApi } from "@/lib/services/invoices";

export type CreateStellarInvoiceModalProps = {
  onClose: () => void;
  onCreated: (invoiceId: number) => void;
};

export default function CreateStellarInvoiceModal({
  onClose,
  onCreated,
}: CreateStellarInvoiceModalProps) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const draft = await invoicesApi.createDraft(
        clientName.trim() || null,
        buildStellarDraftPayload({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim() || undefined,
          amountUsdc: amount,
          description: description.trim() || undefined,
          reference: reference.trim() || undefined,
        }),
      );
      return invoicesApi.issue(draft.id, "none");
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["invoices-page"] });
      onCreated(invoice.id);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Couldn't create the invoice.");
    },
  });

  const amountValid = Number(amount) > 0;
  const canSubmit = clientName.trim().length > 0 && amountValid && !mutation.isPending;

  return (
    <div className="ep-money-flow">
      <p className="ep-money-hint">
        We'll generate a Stellar USDC receiving address and payment memo — your customer pays
        with any Stellar wallet and the invoice settles automatically once the payment is verified
        on-chain.
      </p>

      <div className="ep-money-field">
        <label className="ep-money-label" htmlFor="invoice-client-name">
          Customer name
        </label>
        <input
          id="invoice-client-name"
          className="ep-money-input"
          value={clientName}
          onChange={(event) => setClientName(event.target.value)}
          placeholder="Acme Traders Ltd"
        />
      </div>

      <div className="ep-money-field">
        <label className="ep-money-label" htmlFor="invoice-client-email">
          Customer email (optional)
        </label>
        <input
          id="invoice-client-email"
          className="ep-money-input"
          type="email"
          value={clientEmail}
          onChange={(event) => setClientEmail(event.target.value)}
          placeholder="billing@acmetraders.com"
        />
      </div>

      <div className="ep-money-field">
        <label className="ep-money-label" htmlFor="invoice-amount">
          Amount (USDC)
        </label>
        <input
          id="invoice-amount"
          className="ep-money-input ep-money-input--amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="ep-money-field">
        <label className="ep-money-label" htmlFor="invoice-description">
          Description (optional)
        </label>
        <input
          id="invoice-description"
          className="ep-money-input"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Consulting services — October"
        />
      </div>

      <div className="ep-money-field">
        <label className="ep-money-label" htmlFor="invoice-reference">
          Reference (optional)
        </label>
        <input
          id="invoice-reference"
          className="ep-money-input"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="PO-10294"
        />
      </div>

      {error ? (
        <p className="ep-money-hint" role="alert" style={{ color: "var(--red)" }}>
          {error}
        </p>
      ) : null}

      <div className="ep-money-tabs" role="group" aria-label="Actions">
        <button type="button" className="ep-txn-pager__btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="ep-txn-pager__btn ep-txn-pager__btn--primary"
          disabled={!canSubmit}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Creating…" : "Create invoice"}
        </button>
      </div>
    </div>
  );
}
