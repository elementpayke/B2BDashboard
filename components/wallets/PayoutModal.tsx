"use client";

import React, { useEffect, useState } from "react";
import { payoutsApi, type PayoutMethod } from "@/lib/services/payouts";
import type { FinancialAccount } from "@/lib/services/entities";
import { ApiRequestError } from "@/lib/apiClient";

export type PayoutModalProps = {
  entityId: string;
  account: FinancialAccount;
  onDone: () => void;
  onCancel: () => void;
};

function normalizeMethods(raw: unknown): PayoutMethod[] {
  if (Array.isArray(raw)) return raw as PayoutMethod[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { methods?: unknown }).methods)) {
    return (raw as { methods: PayoutMethod[] }).methods;
  }
  return [];
}

export default function PayoutModal({ entityId, account, onDone, onCancel }: PayoutModalProps) {
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice] = useState(
    "External bank emails or statements may show partner-scheme branding (not Element).",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await payoutsApi.methods(entityId, account.id);
        if (cancelled) return;
        const list = normalizeMethods(raw);
        setMethods(list);
        const first = list[0];
        setMethodId(String(first?.id || first?.method || ""));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : "Payout methods unavailable for this account.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId, account.id]);

  const submit = async () => {
    setError("");
    if (!methodId || !amount.trim() || !destination.trim()) {
      setError("Method, amount, and destination are required.");
      return;
    }
    setBusy(true);
    try {
      const preview = await payoutsApi.preview(entityId, account.id, {
        method: methodId,
        amount: amount.trim(),
        currency: account.currency,
        destination: { account: destination.trim() },
      });
      await payoutsApi.confirm(entityId, account.id, {
        ...preview,
        method: methodId,
        amount: amount.trim(),
        currency: account.currency,
        destination: { account: destination.trim() },
        preview_token: preview.preview_token,
      });
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Payout failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ep-payout">
      <p className="ep-fund-chooser__intro">
        Pay out from {account.currency} · {account.id}
      </p>
      <p className="ep-muted" role="note">
        {notice}
      </p>
      {loading ? <p className="ep-muted">Loading payout methods…</p> : null}
      <label className="ep-field">
        <span>Method</span>
        <select
          value={methodId}
          onChange={(e) => setMethodId(e.target.value)}
          disabled={busy || loading || methods.length === 0}
        >
          {methods.length === 0 ? (
            <option value="">No methods available</option>
          ) : (
            methods.map((m, idx) => {
              const id = String(m.id || m.method || idx);
              const label = String(m.label || m.method || m.id || "Method");
              return (
                <option key={id} value={id}>
                  {label}
                </option>
              );
            })
          )}
        </select>
      </label>
      <label className="ep-field">
        <span>Destination (email / account)</span>
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          disabled={busy}
          autoComplete="off"
        />
      </label>
      <label className="ep-field">
        <span>Amount</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy}
          placeholder="0.00"
        />
      </label>
      {error ? <p className="ep-error" role="alert">{error}</p> : null}
      <div className="ep-modal-actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={busy || loading || !methodId}>
          {busy ? "Submitting…" : "Confirm payout"}
        </button>
      </div>
    </div>
  );
}
