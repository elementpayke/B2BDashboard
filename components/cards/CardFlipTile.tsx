"use client";

import { formatCardPan, formatMaskedPan, type CardBrand } from "@/lib/services/cards";
import CardBrandMark from "@/components/cards/CardBrandMark";

function IconMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M2.5 11.5c2.2-1.8 4.2-2.7 6.5-2.7 2.3 0 4.3.9 6.5 2.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4 8.2c1.7-1.4 3.2-2.1 5-2.1s3.3.7 5 2.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M5.8 5c1.1-.9 2.1-1.3 3.2-1.3s2.1.4 3.2 1.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

type Props = {
  cardId: string;
  label: string;
  bg: string;
  filter?: string;
  status: string;
  statusLabel: string;
  balance: string;
  last4: string;
  expiry: string | null;
  brand: CardBrand;
  cardholderLabel: string;
  flipped: boolean;
  onFlip: () => void;
  secrets: { number: string; cvv: string } | null;
  secretsBusy: boolean;
  secretsError?: string;
  copiedField: string;
  onCopy: (fieldKey: string, value: string) => () => void;
  actionDisabled?: boolean;
  actionDisabledReason?: string;
};

export default function CardFlipTile({
  cardId,
  label,
  bg,
  filter,
  status,
  statusLabel,
  balance,
  last4,
  expiry,
  brand,
  cardholderLabel,
  flipped,
  onFlip,
  secrets,
  secretsBusy,
  secretsError,
  copiedField,
  onCopy,
  actionDisabled,
  actionDisabledReason,
}: Props) {
  const revealed = Boolean(secrets?.number && secrets?.cvv);
  const last4Short = last4 ? `···· ${last4}` : "···· ····";
  const panMasked = formatMaskedPan(last4);
  const faceStyle = { background: bg, filter };
  const frozen = status === "frozen";
  const flipLocked = Boolean(actionDisabled) || frozen;
  const panSlotText = secretsError ? "Couldn't load" : secretsBusy ? "Loading…" : panMasked;

  const copyable = (
    field: string,
    value: string,
    label: string,
    opts?: { formatPan?: boolean; title?: string },
  ) => {
    if (!revealed) {
      return (
        <span className="ep-card-face__secret" aria-label={label} title={opts?.title}>
          {value}
        </span>
      );
    }
    const copied = copiedField === field;
    const display = opts?.formatPan ? formatCardPan(value) : value;
    const copyValue = opts?.formatPan ? value.replace(/\s+/g, "") : value;
    return (
      <button
        type="button"
        className="ep-card-face__secret ep-card-face__secret--copy"
        data-copied={copied ? "true" : "false"}
        onClick={(e) => {
          e.stopPropagation();
          onCopy(field, copyValue)();
        }}
        aria-label={copied ? `${label} copied` : `Copy ${label}`}
        title={copied ? "Copied" : "Click to copy"}
      >
        {display}
        <span className="ep-card-face__copied" aria-hidden>
          Copied
        </span>
      </button>
    );
  };

  return (
    <div className="ep-card-flip">
      <div className="ep-card-flip__inner" data-flipped={flipped ? "true" : "false"}>
        <button
          type="button"
          className="ep-card-flip__face ep-card-flip__face--front ep-card-face ep-card-face--brand"
          style={faceStyle}
          onClick={onFlip}
          disabled={flipLocked}
          aria-pressed={flipped}
          aria-label={flipped ? "Hide card details" : "Show card details"}
          title={
            actionDisabled
              ? actionDisabledReason
              : frozen
                ? "Unfreeze this card to view its details"
                : undefined
          }
        >
          <div className="ep-card-face__top">
            <span className="ep-card-face__name">
              <IconMark />
              {label}
            </span>
            <span className="ep-card-face__status" data-frozen={status !== "active" ? "true" : "false"}>
              {statusLabel}
            </span>
          </div>
          <div className="ep-card-face__avail">
            <span className="ep-card-face__avail-label">Available</span>
            <span className="ep-card-face__avail-amount">{balance}</span>
          </div>
          <div className="ep-card-face__footer">
            <span className="ep-card-face__last4">{last4Short}</span>
            <CardBrandMark brand={brand} className="ep-card-face__scheme" />
          </div>
        </button>

        <div
          className="ep-card-flip__face ep-card-flip__face--back ep-card-face ep-card-face--brand"
          style={faceStyle}
          aria-hidden={!flipped}
          // Keep back-face controls out of the tab order while the card is face-up.
          inert={!flipped ? true : undefined}
        >
          <div className="ep-card-face__top">
            <span className="ep-card-face__kind">
              VIRTUAL
              {frozen ? (
                <span className="ep-card-face__kind-chip" data-frozen="true">
                  {statusLabel}
                </span>
              ) : null}
            </span>
            <CardBrandMark brand={brand} className="ep-card-face__scheme" />
          </div>

          <div className="ep-card-face__pan-wrap">
            {revealed
              ? copyable(`card:${cardId}:num`, secrets!.number, "Card number", {
                  formatPan: true,
                })
              : copyable(`card:${cardId}:num`, panSlotText, "Card number", {
                  title: secretsError || undefined,
                })}
          </div>

          <div className="ep-card-face__bottom">
            <div className="ep-card-face__meta">
              <div className="ep-card-face__meta-col">
                <span className="ep-card-face__meta-label">EXP</span>
                {revealed && expiry
                  ? copyable(`card:${cardId}:exp`, expiry, "Expiry")
                  : copyable(`card:${cardId}:exp`, "../..", "Expiry")}
              </div>
              <div className="ep-card-face__meta-col">
                <span className="ep-card-face__meta-label">CVV</span>
                {revealed
                  ? copyable(`card:${cardId}:cvv`, secrets!.cvv, "CVV")
                  : copyable(`card:${cardId}:cvv`, "...", "CVV")}
              </div>
            </div>
            <span className="ep-card-face__brand">{cardholderLabel}</span>
          </div>
        </div>
      </div>
      {/* Announced for assistive tech without affecting the tile's box height — the
          card face itself shows "Couldn't load" in the PAN slot (see panSlotText). */}
      {secretsError ? (
        <p className="ep-sr-only" role="alert">
          {secretsError}
        </p>
      ) : null}
    </div>
  );
}
