"use client";
import React, { useEffect, useState } from "react";

export type CloseAccountAction = "block" | "delete";

export type CloseAccountModalProps = {
  accountName: string;
  currency: string;
  networkLabel: string;
  alreadyClosed?: boolean;
  onCancel: () => void;
  onContinue: (action: CloseAccountAction) => Promise<void> | void;
};

export default function CloseAccountModal({
  accountName,
  currency,
  networkLabel,
  alreadyClosed = false,
  onCancel,
  onContinue,
}: CloseAccountModalProps) {
  const [selected, setSelected] = useState<CloseAccountAction>(() =>
    alreadyClosed ? "delete" : "block",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (alreadyClosed && selected === "block") setSelected("delete");
  }, [alreadyClosed, selected]);

  const submit = async () => {
    if (busy) return;
    if (selected === "block" && alreadyClosed) return;
    setBusy(true);
    setError("");
    try {
      await onContinue(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't close this account.");
      setBusy(false);
    }
  };

  return (
    <div className="ep-fund-chooser">
      <p className="ep-fund-chooser__intro">How do you want to close this wallet?</p>
      <p className="ep-fund-chooser__sub">
        <strong>{accountName}</strong> · {currency}
        {networkLabel ? ` · ${networkLabel}` : ""}
      </p>

      <div className="ep-fund-chooser__list" role="radiogroup" aria-label="Close account method">
        <button
          type="button"
          role="radio"
          aria-checked={selected === "block"}
          className="ep-fund-chooser__option"
          data-selected={selected === "block" ? "true" : "false"}
          data-disabled={alreadyClosed ? "true" : "false"}
          disabled={alreadyClosed || busy}
          onClick={() => setSelected("block")}
        >
          <span className="ep-fund-chooser__option-title">Block wallet</span>
          <span className="ep-fund-chooser__option-body">
            Stop send and receive. The account stays on your list as Closed, and
            this network cannot be opened again.
          </span>
          {alreadyClosed ? (
            <span className="ep-fund-chooser__option-warn">This account is already closed.</span>
          ) : null}
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={selected === "delete"}
          className="ep-fund-chooser__option"
          data-selected={selected === "delete" ? "true" : "false"}
          disabled={busy}
          onClick={() => setSelected("delete")}
        >
          <span className="ep-fund-chooser__option-title">
            Delete wallet
            <span className="ep-fund-chooser__badge">Removes rail</span>
          </span>
          <span className="ep-fund-chooser__option-body">
            Remove this wallet from your accounts. You can open a new {currency}{" "}
            account on this network afterwards.
          </span>
          <span className="ep-fund-chooser__option-warn">
            Existing deposit addresses stop working. Move funds out first.
          </span>
        </button>
      </div>

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
          disabled={busy || (selected === "block" && alreadyClosed)}
          onClick={() => void submit()}
        >
          {busy ? "Working…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
