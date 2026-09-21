"use client";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { FundStablecoinRail } from "@/lib/services/entities";
import { shouldOfferStellarWalletDeposit } from "@/lib/stellar/network";
import { fundStablecoinRailSummary, isEvmEurcRail } from "@/lib/collect/fundCopy";
import DepositAddressQr from "@/components/wallets/DepositAddressQr";

const StellarWalletDeposit = dynamic(() => import("@/components/wallets/StellarWalletDeposit"), {
  ssr: false,
});

export type FundStablecoinModalProps = {
  /** Fiat account being funded (context label). */
  targetCurrency: string;
  targetName: string;
  /** Ready rails from backend — asset/network/address driven by API. */
  rails: FundStablecoinRail[];
  onBack: () => void;
  /** Optional Collect deposit-instructions lookup failure (non-blocking). */
  collectRailsError?: string | null;
  onRetryCollectRails?: () => void;
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
  collectRailsError = null,
  onRetryCollectRails,
}: FundStablecoinModalProps) {
  const [step, setStep] = useState<"amount" | "address">("amount");
  const [selectedId, setSelectedId] = useState(rails[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const visibleRails = rails.filter((r) => !isEvmEurcRail(r.currency, r.network));

  useEffect(() => {
    if (!visibleRails.some((r) => r.id === selectedId)) {
      setSelectedId(visibleRails[0]?.id ?? "");
    }
  }, [visibleRails, selectedId]);

  const selected = visibleRails.find((r) => r.id === selectedId) ?? visibleRails[0] ?? null;
  const hasRail = Boolean(selected?.walletAddress);

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

        {collectRailsError ? (
          <div className="ep-fund-sc__warn" role="alert">
            <p>Couldn&apos;t load CCTP Collect deposit rails. Your other rails still work.</p>
            {onRetryCollectRails ? (
              <button type="button" className="ep-fund-sc__btn-secondary" onClick={onRetryCollectRails}>
                Retry Collect rails
              </button>
            ) : null}
            <p className="ep-fund-sc__hint">{collectRailsError}</p>
          </div>
        ) : null}

        {visibleRails.length > 0 ? (
          <div className="ep-fund-sc__rails" role="radiogroup" aria-label="Stablecoin rail">
            {visibleRails.map((rail) => (
              <button
                key={rail.id}
                type="button"
                role="radio"
                aria-checked={selected?.id === rail.id}
                className="ep-fund-sc__rail"
                data-selected={selected?.id === rail.id ? "true" : "false"}
                onClick={() => setSelectedId(rail.id)}
              >
                <span className="ep-pick-row__text">
                  <span className="ep-pick-row__title">{rail.currency}</span>
                  <span className="ep-pick-row__meta">{rail.networkLabel}</span>
                </span>
                {rail.walletAddress ? (
                  <span className="ep-fund-sc__rail-tag">Address</span>
                ) : null}
                {selected?.id === rail.id ? (
                  <span className="ep-pick-row__check" aria-hidden>✓</span>
                ) : (
                  <span className="ep-pick-row__chev" aria-hidden>›</span>
                )}
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
            {selected
              ? fundStablecoinRailSummary({
                  targetName,
                  currency: selected.currency,
                  networkLabel: selected.networkLabel,
                  railId: selected.id,
                  chainDisclaimer: selected.chainDisclaimer,
                })
              : `Fund ${targetName}`}
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

  const hasCheckout = false;

  return (
    <div className="ep-fund-sc ep-money-flow">
      <button type="button" className="ep-fund-sc__back" onClick={() => setStep("amount")}>
        ← Back
      </button>
      <div className="ep-fund-sc__success-icon" aria-hidden>
        ✓
      </div>
      <div className="ep-fund-sc__title">Deposit address ready</div>
      <p className="ep-fund-sc__body">
        Send {selected.currency}
        {amount ? ` (about ${amount} ${selected.currency})` : ""} on{" "}
        <strong>{selected.networkLabel}</strong> to the address below.
      </p>

      <div className="ep-fund-sc__meta">
        {selected.currency} · {selected.networkLabel}
      </div>

      {selected.walletAddress ? (
        <>
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
          <DepositAddressQr
            address={selected.walletAddress}
            currency={selected.currency}
            network={selected.network}
            networkLabel={selected.networkLabel}
            amount={amount}
          />
        </>
      ) : (
        <div className="ep-fund-sc__warn" role="status">
          No on-chain deposit address yet. Wait until this rail is active.
        </div>
      )}

      {copyError ? (
        <div className="ep-fund-sc__warn" role="alert">
          {copyError}
        </div>
      ) : null}

      {selected.walletAddress &&
      shouldOfferStellarWalletDeposit({
        network: selected.network,
        currency: selected.currency,
        destination: selected.walletAddress,
      }) ? (
        <StellarWalletDeposit
          destination={selected.walletAddress}
          network={selected.network}
          suggestedAmount={amount}
        />
      ) : null}

      <p className="ep-fund-sc__disclaimer">{selected.chainDisclaimer}</p>

      <div className="ep-fund-sc__footer">
        <button type="button" className="ep-fund-sc__btn-secondary" onClick={() => setStep("amount")}>
          Back
        </button>
      </div>
    </div>
  );
}
