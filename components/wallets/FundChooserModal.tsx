"use client";
import React, { useEffect, useState } from "react";

export type FundChooserOption = "bank" | "stablecoin" | "african";

export type FundChooserModalProps = {
  currency: string;
  accountName: string;
  onContinue: (option: FundChooserOption) => void;
  onCancel: () => void;
  africanDisabled?: boolean;
  africanDisabledReason?: string;
  stablecoinDisabled?: boolean;
  stablecoinDisabledReason?: string;
  /** When true, bank/mobile options top up this USDC wallet instead of an IBAN. */
  isStablecoinAccount?: boolean;
  networkLabel?: string;
};

function firstEnabledOption(stablecoinDisabled: boolean): FundChooserOption {
  if (!stablecoinDisabled) return "stablecoin";
  // Bank transfer is always available for fiat deposit accounts.
  return "bank";
}

/**
 * Fund path picker for fiat deposit accounts.
 * Bank transfer + Stablecoin address = partner Ready paths.
 * African OnRamp → convert = best-effort.
 */
export default function FundChooserModal({
  currency,
  accountName,
  onContinue,
  onCancel,
  africanDisabled = false,
  africanDisabledReason,
  stablecoinDisabled = false,
  stablecoinDisabledReason,
  isStablecoinAccount = false,
  networkLabel,
}: FundChooserModalProps) {
  const [selected, setSelected] = useState<FundChooserOption>(() =>
    firstEnabledOption(stablecoinDisabled),
  );

  useEffect(() => {
    const disabled =
      (selected === "stablecoin" && stablecoinDisabled) ||
      (selected === "african" && africanDisabled);
    if (disabled) {
      setSelected(firstEnabledOption(stablecoinDisabled));
    }
  }, [selected, stablecoinDisabled, africanDisabled]);

  const canContinue =
    (selected === "bank") ||
    (selected === "stablecoin" && !stablecoinDisabled) ||
    (selected === "african" && !africanDisabled);

  return (
    <div className="ep-fund-chooser">
      <p className="ep-fund-chooser__intro">How would you like to fund your account?</p>
      <p className="ep-fund-chooser__sub">
        <strong>{accountName}</strong> · {currency}
      </p>

      <div className="ep-fund-chooser__list" role="radiogroup" aria-label="Funding method">
        <button
          type="button"
          role="radio"
          aria-checked={selected === "stablecoin"}
          className="ep-fund-chooser__option"
          data-selected={selected === "stablecoin" ? "true" : "false"}
          data-disabled={stablecoinDisabled ? "true" : "false"}
          disabled={stablecoinDisabled}
          onClick={() => setSelected("stablecoin")}
        >
          <span className="ep-fund-chooser__option-title">Stablecoin</span>
          <span className="ep-fund-chooser__option-body">Fund via stablecoin</span>
          {stablecoinDisabled && stablecoinDisabledReason ? (
            <span className="ep-fund-chooser__option-warn">{stablecoinDisabledReason}</span>
          ) : null}
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={selected === "bank"}
          className="ep-fund-chooser__option"
          data-selected={selected === "bank" ? "true" : "false"}
          onClick={() => setSelected("bank")}
        >
          <span className="ep-fund-chooser__option-title">Bank transfer</span>
          <span className="ep-fund-chooser__option-body">
            {isStablecoinAccount
              ? `Pay from a local bank. Credits ${currency}${networkLabel ? ` on ${networkLabel}` : ""}.`
              : `Send ${currency} to this account's IBAN / bank details`}
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={selected === "african"}
          className="ep-fund-chooser__option"
          data-selected={selected === "african" ? "true" : "false"}
          data-disabled={africanDisabled ? "true" : "false"}
          disabled={africanDisabled}
          onClick={() => setSelected("african")}
        >
          <span className="ep-fund-chooser__option-title">
            African mobile money / bank
            <span className="ep-fund-chooser__badge">Best effort</span>
          </span>
          <span className="ep-fund-chooser__option-body">
            {isStablecoinAccount
              ? `Pay with mobile money or bank. Credits ${currency}${networkLabel ? ` on ${networkLabel}` : ""}.`
              : `Local fiat → USDC, then try auto-convert to ${currency}`}
          </span>
          {africanDisabled && africanDisabledReason ? (
            <span className="ep-fund-chooser__option-warn">{africanDisabledReason}</span>
          ) : null}
        </button>
      </div>

      <div className="ep-fund-chooser__footer">
        <button type="button" className="ep-fund-sc__btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="ep-fund-sc__btn-primary"
          disabled={!canContinue}
          onClick={() => onContinue(selected)}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
