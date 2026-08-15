"use client";
import React, { useState } from "react";
import {
  describeMemoRequirement,
  STELLAR_ASSET,
  STELLAR_NETWORK,
  type StellarManagedAccount,
} from "@/lib/services/stellarSimulation";

/**
 * "Receive from external wallet" — the advanced route.
 *
 * Deliberately not a headline action: it is reached from Fund / More deposit
 * options, because handing out a raw address and a mandatory memo is the most
 * error-prone way to move money into the account. The memo warning is
 * prominent for exactly that reason — a transfer without it cannot be matched
 * automatically and has to be reconciled by hand.
 */

type CopyField = "address" | "memo" | null;

export type ReceiveExternalWalletModalProps = {
  account: StellarManagedAccount;
  onClose: () => void;
};

export default function ReceiveExternalWalletModal({
  account,
  onClose,
}: ReceiveExternalWalletModalProps) {
  const [copied, setCopied] = useState<CopyField>(null);

  const copy = (field: Exclude<CopyField, null>, value: string) => async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied((c) => (c === field ? null : c)), 1600);
    } catch {
      /* Clipboard unavailable — the value is selectable in the field. */
    }
  };

  return (
    <div className="ep-money-stack">
      <div className="ep-money-banner ep-money-banner--warn" role="note">
        {describeMemoRequirement(account.depositMemo)}
      </div>

      <div className="ep-money-field">
        <span className="ep-money-label">Receiving address</span>
        <div className="ep-money-copy-row">
          <span className="ep-money-copy-row__value ep-mono" title={account.receivingAddress}>
            {account.receivingAddress}
          </span>
          <button
            type="button"
            className="ep-money-copy-btn"
            onClick={copy("address", account.receivingAddress)}
          >
            {copied === "address" ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="ep-money-field">
        <span className="ep-money-label">Payment reference (required)</span>
        <div className="ep-money-copy-row">
          <span className="ep-money-copy-row__value ep-mono">{account.depositMemo}</span>
          <button
            type="button"
            className="ep-money-copy-btn"
            onClick={copy("memo", account.depositMemo)}
          >
            {copied === "memo" ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="ep-money-review">
        <div className="ep-money-review__row">
          <span className="ep-money-review__k">Asset</span>
          <span className="ep-money-review__v">{STELLAR_ASSET}</span>
        </div>
        <div className="ep-money-review__row">
          <span className="ep-money-review__k">Network</span>
          <span className="ep-money-review__v">{STELLAR_NETWORK}</span>
        </div>
        <div className="ep-money-review__row">
          <span className="ep-money-review__k">Destination</span>
          <span className="ep-money-review__v">Mboka {account.name}</span>
        </div>
      </div>

      <p className="ep-money-hint">
        {`Only send ${STELLAR_ASSET} on ${STELLAR_NETWORK} to this address. Other assets or networks can't be recovered.`}
      </p>

      <button type="button" className="ep-btn-secondary" onClick={onClose}>
        Done
      </button>
    </div>
  );
}
