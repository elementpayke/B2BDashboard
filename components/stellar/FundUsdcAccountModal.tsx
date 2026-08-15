"use client";
import React, { useState } from "react";
import { STELLAR_ASSET } from "@/lib/services/stellarSimulation";

/**
 * "Fund USDC Account" — the chooser, plus the bank / mobile-money route.
 *
 * The local-payment route is the default path for most businesses and stays
 * entirely free of blockchain vocabulary: an amount, a familiar payment
 * method, instructions to pay, then a credited balance. That the funds settle
 * on Stellar is not this flow's concern.
 */

export type FundRoute = "local" | "wallet";

const LOCAL_METHODS = [
  { id: "mpesa", name: "M-Pesa", hint: "Kenya · instant" },
  { id: "bank-ke", name: "Bank transfer", hint: "Kenya · same day" },
  { id: "card", name: "Debit card", hint: "Visa / Mastercard" },
];

type LocalStage = "amount" | "instructions" | "pending" | "credited";

export type FundUsdcAccountModalProps = {
  accountName: string;
  onPickWalletRoute: () => void;
  onClose: () => void;
  onCredited?: () => void;
};

export default function FundUsdcAccountModal({
  accountName,
  onPickWalletRoute,
  onClose,
  onCredited,
}: FundUsdcAccountModalProps) {
  const [route, setRoute] = useState<FundRoute | null>(null);
  const [stage, setStage] = useState<LocalStage>("amount");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(LOCAL_METHODS[0].id);
  const [busy, setBusy] = useState(false);

  const methodName = LOCAL_METHODS.find((m) => m.id === method)?.name ?? "";
  const amountValid = Number((amount || "").replace(/[\s,]/g, "")) > 0;

  const advance = async (next: LocalStage) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    setBusy(false);
    setStage(next);
    if (next === "credited") onCredited?.();
  };

  if (route === null) {
    return (
      <div className="ep-money-stack">
        <p className="ep-money-hint">How would you like to add funds to your {accountName}?</p>
        <button type="button" className="ep-send-method" onClick={() => setRoute("local")}>
          <span className="ep-send-method__icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M4 10h16M5 10l7-6 7 6M6 10v11M18 10v11M10 10v11M14 10v11" />
            </svg>
          </span>
          <span className="ep-send-method__text">
            <span className="ep-send-method__label">Pay by bank or mobile money</span>
            <span className="ep-send-method__desc">
              Fund from a local account — M-Pesa, bank transfer or card
            </span>
          </span>
          <span className="ep-send-method__chevron" aria-hidden>›</span>
        </button>
        <button type="button" className="ep-send-method" onClick={onPickWalletRoute}>
          <span className="ep-send-method__icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
              <path d="M16.5 12.5h2" />
            </svg>
          </span>
          <span className="ep-send-method__text">
            <span className="ep-send-method__label">Deposit from external wallet</span>
            <span className="ep-send-method__desc">
              Transfer {STELLAR_ASSET} you already hold elsewhere
            </span>
          </span>
          <span className="ep-send-method__chevron" aria-hidden>›</span>
        </button>
      </div>
    );
  }

  return (
    <div className="ep-money-stack">
      <button
        type="button"
        className="ep-money-back-link"
        onClick={() => {
          setRoute(null);
          setStage("amount");
        }}
      >
        ← Change method
      </button>

      {stage === "amount" ? (
        <>
          <div className="ep-money-field">
            <label className="ep-money-label" htmlFor="fund-amount">
              Amount ({STELLAR_ASSET})
            </label>
            <input
              id="fund-amount"
              className="ep-money-input ep-money-input--amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
              autoComplete="off"
            />
          </div>
          <div className="ep-money-field">
            <span className="ep-money-label" id="fund-method-label">Payment method</span>
            <div className="ep-money-tabs ep-money-tabs--wrap" role="group" aria-labelledby="fund-method-label">
              {LOCAL_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="ep-money-network"
                  aria-pressed={method === m.id}
                  onClick={() => setMethod(m.id)}
                  style={{
                    borderColor: method === m.id ? "var(--indigo)" : "transparent",
                    background: method === m.id ? "var(--indigo-tint)" : "var(--surface2)",
                    color: method === m.id ? "var(--indigo-text)" : "var(--ink)",
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="ep-btn-primary"
            disabled={!amountValid || busy}
            aria-busy={busy || undefined}
            onClick={() => advance("instructions")}
          >
            {busy ? "Preparing…" : "Continue"}
          </button>
        </>
      ) : null}

      {stage === "instructions" ? (
        <>
          <span className="ep-money-step-label">Pay with {methodName}</span>
          <div className="ep-money-review">
            <div className="ep-money-review__row">
              <span className="ep-money-review__k">Amount</span>
              <span className="ep-money-review__v ep-money-review__v--mono">
                {amount} {STELLAR_ASSET}
              </span>
            </div>
            <div className="ep-money-review__row">
              <span className="ep-money-review__k">Paybill</span>
              <span className="ep-money-review__v ep-money-review__v--mono">400200</span>
            </div>
            <div className="ep-money-review__row">
              <span className="ep-money-review__k">Account number</span>
              <span className="ep-money-review__v ep-money-review__v--mono">MBOKA-4821</span>
            </div>
          </div>
          <p className="ep-money-hint">
            Complete the payment in {methodName}. We&apos;ll credit your account automatically once
            it clears.
          </p>
          <button
            type="button"
            className="ep-btn-primary"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => advance("pending")}
          >
            {busy ? "Submitting…" : "I've paid"}
          </button>
        </>
      ) : null}

      {stage === "pending" ? (
        <>
          <span className="ep-money-step-label">Waiting for confirmation</span>
          <div className="ep-money-banner ep-money-banner--info" role="status">
            We&apos;re confirming your {methodName} payment. This usually takes under a minute.
          </div>
          <button
            type="button"
            className="ep-btn-primary"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => advance("credited")}
          >
            {busy ? "Checking…" : "Check status"}
          </button>
        </>
      ) : null}

      {stage === "credited" ? (
        <div className="ep-money-success">
          <span className="ep-money-success__title">Funds credited</span>
          <span className="ep-money-success__body">
            {amount} {STELLAR_ASSET} is now available in your {accountName}.
          </span>
          <button type="button" className="ep-btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}
