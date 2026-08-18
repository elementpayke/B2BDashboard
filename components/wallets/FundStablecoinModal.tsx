"use client";
import React, { useEffect, useState } from "react";
import type { FundStablecoinRail } from "@/lib/services/entities";

export type FundStablecoinModalProps = {
  /** Fiat account being funded (context label). */
  targetCurrency: string;
  targetName: string;
  /** Ready rails from backend — asset/network/address driven by API. */
  rails: FundStablecoinRail[];
  onBack: () => void;
};

/**
 * Stablecoin fund flow driven by API-returned rails.
 * Step 1: pick rail + optional amount → Step 2: deposit address and/or checkout URL.
 */
export default function FundStablecoinModal({
  targetCurrency,
  targetName,
  rails,
  onBack,
}: FundStablecoinModalProps) {
  const [step, setStep] = useState<"amount" | "address">("amount");
  const [selectedId, setSelectedId] = useState(rails[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (!rails.some((r) => r.id === selectedId)) {
      setSelectedId(rails[0]?.id ?? "");
    }
  }, [rails, selectedId]);

  const selected = rails.find((r) => r.id === selectedId) ?? rails[0] ?? null;
  const hasRail = Boolean(selected?.walletAddress || selected?.checkoutUrl);

  const continueFromAmount = () => {
    if (!hasRail) return;
    setStep("address");
  };

  const copyText = async (value: string, which: "address" | "url") => {
    setCopyError(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      if (which === "address") {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } else {
        setCopiedUrl(true);
        window.setTimeout(() => setCopiedUrl(false), 1800);
      }
    } catch {
      setCopyError("Couldn't copy. Select the value and copy it manually.");
    }
  };

  if (step === "amount") {
    return (
      <div className="ep-fund-sc ep-money-flow">
        <button type="button" className="ep-fund-sc__back" onClick={onBack}>
          ← Back
        </button>

        {rails.length > 0 ? (
          <div className="ep-fund-sc__rails" role="radiogroup" aria-label="Stablecoin rail">
            {rails.map((rail) => (
              <button
                key={rail.id}
                type="button"
                role="radio"
                aria-checked={selected?.id === rail.id}
                className="ep-fund-sc__rail"
                data-selected={selected?.id === rail.id ? "true" : "false"}
                onClick={() => setSelectedId(rail.id)}
              >
                <span className="ep-fund-sc__rail-asset">{rail.currency}</span>
                <span className="ep-fund-sc__rail-net">{rail.networkLabel}</span>
                {rail.checkoutUrl ? (
                  <span className="ep-fund-sc__rail-tag">Checkout</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="ep-fund-sc__warn" role="status">
            No ready stablecoin deposit rails yet. Open a stablecoin account and wait until it is
            active with a deposit address.
          </div>
        )}

        <div className="ep-fund-sc__amount-block">
          <p className="ep-fund-sc__currency-row">
            To {targetName}
            {selected ? ` via ${selected.currency} on ${selected.networkLabel}` : ""}
          </p>
          <label className="ep-fund-sc__amount-label" htmlFor="fund-sc-amount">
            Amount (optional)
          </label>
          <div className="ep-fund-sc__amount-input-wrap">
            <span className="ep-fund-sc__amount-prefix" aria-hidden>
              {selected?.currency ?? "—"}
            </span>
            <input
              id="fund-sc-amount"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="ep-fund-sc__amount-input"
              aria-label={`${selected?.currency ?? "Amount"} amount`}
            />
          </div>
          <p className="ep-fund-sc__hint">
            Amount is for your reference only. Send the matching asset on the selected network.
            Small dust amounts may not credit.
          </p>
        </div>

        <div className="ep-fund-sc__footer">
          <button type="button" className="ep-fund-sc__btn-secondary" onClick={onBack}>
            Cancel
          </button>
          <button
            type="button"
            className="ep-fund-sc__btn-primary"
            onClick={continueFromAmount}
            disabled={!hasRail}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="ep-fund-sc ep-money-flow">
        <button type="button" className="ep-fund-sc__back" onClick={onBack}>
          ← Back
        </button>
        <div className="ep-fund-sc__warn">No rail selected.</div>
      </div>
    );
  }

  const hasCheckout = Boolean(selected.checkoutUrl);

  return (
    <div className="ep-fund-sc ep-money-flow">
      <button type="button" className="ep-fund-sc__back" onClick={() => setStep("amount")}>
        ← Back
      </button>
      <div className="ep-fund-sc__success-icon" aria-hidden>
        ✓
      </div>
      <div className="ep-fund-sc__title">
        {hasCheckout ? "Payment initiated" : "Deposit address ready"}
      </div>
      <p className="ep-fund-sc__body">
        {hasCheckout
          ? "Complete funding with the checkout link below, or send on-chain to the deposit address when shown."
          : `Send ${selected.currency}${amount ? ` (about ${amount} ${selected.currency})` : ""} on `}
        {!hasCheckout ? (
          <>
            <strong>{selected.networkLabel}</strong> to the address below.
          </>
        ) : null}
      </p>

      <div className="ep-fund-sc__meta">
        {selected.currency} · {selected.networkLabel}
      </div>

      {hasCheckout ? (
        <div className="ep-fund-sc__url-row">
          <code className="ep-fund-sc__url ep-mono" title={selected.checkoutUrl!}>
            {selected.checkoutUrl}
          </code>
          <button
            type="button"
            className="ep-fund-sc__copy"
            onClick={() => copyText(selected.checkoutUrl!, "url")}
            aria-label={copiedUrl ? "Checkout URL copied" : "Copy checkout URL"}
          >
            {copiedUrl ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}

      {selected.walletAddress ? (
        <div className="ep-fund-sc__url-row">
          <code className="ep-fund-sc__url ep-mono" title={selected.walletAddress}>
            {selected.walletAddress}
          </code>
          <button
            type="button"
            className="ep-fund-sc__copy"
            onClick={() => copyText(selected.walletAddress, "address")}
            aria-label={copied ? "Address copied" : "Copy deposit address"}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}

      {copyError ? (
        <div className="ep-fund-sc__warn" role="alert">
          {copyError}
        </div>
      ) : null}

      <p className="ep-fund-sc__disclaimer">{selected.chainDisclaimer}</p>

      <div className="ep-fund-sc__footer">
        {hasCheckout ? (
          <a
            className="ep-fund-sc__btn-primary"
            href={selected.checkoutUrl!}
            target="_blank"
            rel="noopener noreferrer"
          >
            Continue to checkout
          </a>
        ) : null}
        <button type="button" className="ep-fund-sc__btn-secondary" onClick={onBack}>
          Done
        </button>
      </div>
    </div>
  );
}
