"use client";
import React from "react";

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

const METHOD_ICONS: Record<FundChooserOption, React.ReactNode> = {
  stablecoin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c0-1 1-1.6 2.5-1.6s2.5.7 2.5 1.7-1 1.5-2.5 1.5-2.5.6-2.5 1.6 1 1.7 2.5 1.7 2.5-.6 2.5-1.6" />
    </>
  ),
  bank: (
    <path d="M3 21h18M4 10h16M5 10l7-6 7 6M6 10v11M18 10v11M10 10v11M14 10v11" />
  ),
  african: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
};

/**
 * Fund path picker for fiat deposit accounts — same one-tap chooser as Send.
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
  const options: {
    key: FundChooserOption;
    label: string;
    desc: string;
    disabled?: boolean;
    disabledReason?: string;
  }[] = [
    {
      key: "stablecoin",
      label: "Stablecoin",
      desc: "Fund via a USDC deposit address",
      disabled: stablecoinDisabled,
      disabledReason: stablecoinDisabledReason,
    },
    {
      key: "bank",
      label: "Bank transfer",
      desc: isStablecoinAccount
        ? `Pay from a local bank. Credits ${currency}${networkLabel ? ` on ${networkLabel}` : ""}.`
        : `Send ${currency} to this account's IBAN / bank details`,
    },
    {
      key: "african",
      label: "African mobile money / bank",
      desc: isStablecoinAccount
        ? `Pay with mobile money or bank. Credits ${currency}${networkLabel ? ` on ${networkLabel}` : ""}.`
        : `Local fiat → USDC, then try auto-convert to ${currency}`,
      disabled: africanDisabled,
      disabledReason: africanDisabledReason,
    },
  ];

  return (
    <div className="ep-fund-chooser">
      <p className="ep-fund-chooser__intro">How would you like to fund this account?</p>
      <p className="ep-fund-chooser__sub">
        <strong>{accountName}</strong> · {currency}
      </p>

      <div className="ep-money-stack">
        {options.map((m) => (
          <button
            key={m.key}
            type="button"
            className="ep-send-method"
            disabled={m.disabled}
            title={m.disabled ? m.disabledReason : undefined}
            onClick={() => {
              if (m.disabled) return;
              onContinue(m.key);
            }}
          >
            <span className="ep-send-method__icon" aria-hidden>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {METHOD_ICONS[m.key]}
              </svg>
            </span>
            <span className="ep-send-method__text">
              <span className="ep-send-method__label">
                {m.label}
                {m.key === "african" ? (
                  <span className="ep-fund-chooser__badge">Best effort</span>
                ) : null}
              </span>
              <span className="ep-send-method__desc">
                {m.disabled && m.disabledReason ? m.disabledReason : m.desc}
              </span>
            </span>
            {!m.disabled ? (
              <span className="ep-send-method__chevron" aria-hidden>
                ›
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <button type="button" className="ep-btn-secondary" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
