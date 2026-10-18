"use client";
import React, { useState } from "react";

export type CloseAccountModalProps = {
  accountName: string;
  currency: string;
  networkLabel: string;
  alreadyClosed?: boolean;
  onCancel: () => void;
  onContinue: () => Promise<void> | void;
};

export default function CloseAccountModal({
  accountName,
  currency,
  networkLabel,
  alreadyClosed = false,
  onCancel,
  onContinue,
}: CloseAccountModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy || alreadyClosed) return;
    setBusy(true);
    setError("");
    try {
      await onContinue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't close this account.");
      setBusy(false);
    }
  };

  return (
    <div className="ep-fund-chooser">
      <p className="ep-fund-chooser__intro">Close this account?</p>
      <p className="ep-fund-chooser__sub">
        <strong>{accountName}</strong> · {currency}
        {networkLabel ? ` · ${networkLabel}` : ""}
      </p>

      {alreadyClosed ? (
        <p className="ep-fund-chooser__option-warn">This account is already closed.</p>
      ) : (
        <>
          <p className="ep-fund-chooser__option-body">
            This removes it from your accounts. You can open a new {currency} account
            {networkLabel ? ` on ${networkLabel}` : ""} afterwards.
          </p>
          <p className="ep-fund-chooser__option-warn">
            Existing deposit addresses stop working, and the balance must be zero.
            Move funds out first.
          </p>
        </>
      )}

      {error ? (
        <p className="ep-fund-chooser__option-warn" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ep-fund-chooser__footer">
        <button
          type="button"
          className="ep-fund-sc__btn-secondary"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="ep-fund-sc__btn-primary"
          disabled={busy || alreadyClosed}
          onClick={() => void submit()}
        >
          {busy ? "Working…" : "Close account"}
        </button>
      </div>
    </div>
  );
}
