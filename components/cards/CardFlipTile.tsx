"use client";

import type { CSSProperties } from "react";
import { formatCardPan, formatMaskedPan } from "@/lib/services/cards";
import { cardShadow, DEFAULT_CARD_COLOR, type CardColor } from "@/lib/services/cardColors";

/** Mboka mark (44×44). Inherits the card's ink via currentColor. */
export function CardMbokaMark({ size = "1.7em" }: { size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" aria-hidden focusable="false">
      <path d="M17.8 17.8H35.1V35.1H17.8Z" fill="currentColor" fillOpacity="0.45" />
      <path d="M8.9 8.9H26.3V17.8L20.1 26.3H8.9Z" fill="currentColor" />
    </svg>
  );
}

/** Card background graphic: absolute inset 0, 12% opacity, ink coloured. */
function CardBackdrop() {
  return (
    <>
      <span className="ep-card-face__sheen" aria-hidden />
      <svg
        className="ep-card-face__backdrop"
        viewBox="0 0 160 101"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        focusable="false"
      >
        <path d="M97 45H173V121H97Z" fill="currentColor" fillOpacity="0.45" />
        <path d="M58 6H134V44.9L107 82H58Z" fill="currentColor" />
      </svg>
    </>
  );
}

function CardFrontContent({
  label,
  last4,
  badge,
}: {
  label: string;
  last4: string;
  badge?: string;
}) {
  return (
    <>
      <CardBackdrop />
      <span className="ep-card-face__brandline">
        <CardMbokaMark />
        MBOKA
      </span>
      {badge ? <span className="ep-card-face__status">{badge}</span> : null}
      <span className="ep-card-face__identity">
        <span className="ep-card-face__label" title={label}>
          {label}
        </span>
        <span className="ep-card-face__last4">•••• {last4 || "····"}</span>
      </span>
    </>
  );
}

/**
 * Static front face for previews (e.g. the create-card modal): same plastic,
 * no flip, no buttons.
 */
export function CardPreview({
  label,
  last4 = "",
  color = DEFAULT_CARD_COLOR,
}: {
  label: string;
  last4?: string;
  color?: CardColor;
}) {
  return (
    <div className="ep-card-preview" role="img" aria-label={`Card preview: ${label}, ${color.name}`}>
      <div
        className="ep-card-face"
        style={{ background: color.bg, color: color.ink, boxShadow: cardShadow(color) }}
      >
        <CardFrontContent label={label} last4={last4} />
      </div>
    </div>
  );
}

/** "09/2029" → "09/29"; already-short values pass through. */
export function shortExpiry(expiry: string | null | undefined): string | null {
  const [mm, yy] = String(expiry || "").split("/");
  if (!mm || !yy) return null;
  return `${mm.padStart(2, "0").slice(-2)}/${yy.slice(-2)}`;
}

type Props = {
  cardId: string;
  label: string;
  color?: CardColor;
  /** "active" | "frozen" | "failed" */
  status: string;
  statusLabel: string;
  last4: string;
  expiry: string | null;
  flipped: boolean;
  onFlip: () => void;
  secrets: { number: string; cvv: string } | null;
  secretsBusy: boolean;
  secretsError?: string;
  /** Field key of the last successful copy — announced to screen readers only. */
  copiedField?: string;
  onCopy: (fieldKey: string, value: string) => () => void;
  actionDisabled?: boolean;
  actionDisabledReason?: string;
};

/**
 * Virtual card (Cards design spec §1–3). Tap the front to flip and reveal;
 * tap the back to flip home. On the back, each value is a bare button that
 * copies itself (spaces stripped) without flipping the card.
 */
export default function CardFlipTile({
  cardId,
  label,
  color = DEFAULT_CARD_COLOR,
  status,
  statusLabel,
  last4,
  expiry,
  flipped,
  onFlip,
  secrets,
  secretsBusy,
  secretsError,
  copiedField = "",
  onCopy,
  actionDisabled,
  actionDisabledReason,
}: Props) {
  const revealed = Boolean(secrets?.number && secrets?.cvv);
  const expiryShort = shortExpiry(expiry);
  const frozen = status === "frozen";
  const flipLocked = Boolean(actionDisabled) || frozen;
  const faceStyle = {
    background: color.bg,
    color: color.ink,
    boxShadow: cardShadow(color),
  } as CSSProperties;

  const value = (field: string, text: string, fieldLabel: string, copyText?: string) => {
    const key = `card:${cardId}:${field}`;
    if (!revealed || copyText === undefined) {
      return (
        <span className="ep-card-face__value" title={field === "num" ? secretsError || undefined : undefined}>
          {text}
        </span>
      );
    }
    return (
      <button
        type="button"
        className="ep-card-face__value ep-card-face__value--copy"
        data-copied={copiedField === key ? "true" : "false"}
        title={`Copy ${fieldLabel}`}
        onClick={(e) => {
          // The back face flips the card home on click; a copy must not.
          e.stopPropagation();
          onCopy(key, copyText.replace(/\s+/g, ""))();
        }}
        aria-label={`Copy ${fieldLabel}`}
      >
        {text}
      </button>
    );
  };

  const panText = revealed
    ? formatCardPan(secrets!.number)
    : secretsError
      ? "Couldn't load"
      : secretsBusy
        ? "Loading…"
        : formatMaskedPan(last4);
  const copiedLabel = copiedField.startsWith(`card:${cardId}:`)
    ? { num: "Card number", exp: "Expiry", cvv: "CVV" }[copiedField.split(":").pop() || ""]
    : undefined;

  return (
    <div className="ep-card-flip" data-unavailable={actionDisabled ? "true" : undefined}>
      <div className="ep-card-flip__inner" data-flipped={flipped ? "true" : "false"}>
        <button
          type="button"
          className="ep-card-flip__face ep-card-flip__face--front ep-card-face"
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
          <CardFrontContent
            label={label}
            last4={last4}
            badge={!frozen && status !== "active" ? statusLabel : undefined}
          />
          {frozen ? (
            <span className="ep-card-face__frozen">
              <span className="ep-card-face__frozen-pill">{statusLabel || "Frozen"}</span>
            </span>
          ) : null}
        </button>

        <div
          className="ep-card-flip__face ep-card-flip__face--back ep-card-face"
          style={faceStyle}
          onClick={flipped ? onFlip : undefined}
          aria-hidden={!flipped}
          // Keep back-face controls out of the tab order while the card is face-up.
          inert={!flipped ? true : undefined}
        >
          <CardBackdrop />
          {/* Visible confirmation: a copy that shows nothing reads as broken. */}
          <span className="ep-card-face__copied" data-show={copiedLabel ? "true" : "false"} aria-hidden>
            {copiedLabel ? `${copiedLabel} copied` : ""}
          </span>
          <div className="ep-card-face__details">
            <div className="ep-card-face__field">
              <span className="ep-card-face__field-label">Card number</span>
              {value("num", panText, "card number", revealed ? secrets!.number : undefined)}
            </div>
            <div className="ep-card-face__field-row">
              <div className="ep-card-face__field">
                <span className="ep-card-face__field-label">Expires</span>
                {value("exp", revealed && expiryShort ? expiryShort : "••/••", "expiry", revealed && expiryShort ? expiryShort : undefined)}
              </div>
              <div className="ep-card-face__field">
                <span className="ep-card-face__field-label">CVV</span>
                {value("cvv", revealed ? secrets!.cvv : "•••", "CVV", revealed ? secrets!.cvv : undefined)}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="ep-sr-only" role="status" aria-live="polite">
        {copiedLabel ? `${copiedLabel} copied` : ""}
      </p>
      {secretsError ? (
        <p className="ep-sr-only" role="alert">
          {secretsError}
        </p>
      ) : null}
    </div>
  );
}
