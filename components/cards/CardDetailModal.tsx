"use client";

import {
  formatCardExpiry,
  formatCardPan,
  formatMaskedPan,
  resolveCardBrand,
  type IssuedCard,
} from "@/lib/services/cards";
import CardBrandMark from "@/components/cards/CardBrandMark";
import type { BusinessAddress } from "@/lib/services/kyb";

export type CardBillingAddress = {
  line1: string;
  line2: string | null;
  copyText: string;
};

export function billingAddressFromKyb(
  address: BusinessAddress | null | undefined,
): CardBillingAddress | null {
  if (!address) return null;
  const street = String(address.street || "").trim();
  const city = String(address.city || "").trim();
  if (!street || !city) return null;
  const street2 = String(address.street2 || "").trim();
  const state = String(address.state || "").trim();
  const post = String(address.post_code || "").trim();
  const country = String(address.country || "").trim().toUpperCase();
  const cityLine = [city, state, post].filter(Boolean).join(", ");
  const line2 = [cityLine, country].filter(Boolean).join(" · ") || null;
  const copyText = [street, street2 || null, cityLine, country]
    .filter(Boolean)
    .join("\n");
  return {
    line1: street2 ? `${street}, ${street2}` : street,
    line2,
    copyText,
  };
}

function formatExpiryFace(
  month: string | null | undefined,
  year: string | null | undefined,
): string | null {
  const full = formatCardExpiry(month, year);
  if (!full) return null;
  const [mm, yy] = full.split("/");
  if (!mm || !yy) return full;
  return `${mm.padStart(2, "0").slice(-2)}/${yy.slice(-2)}`;
}

function IconEye({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10.5 10.5 0 0121 12c-.6 1-1.4 2-2.4 2.8M6.1 6.1C4.6 7.3 3.5 8.8 3 12c1.5 4.5 5.4 7 9 7 1.4 0 2.8-.3 4-.9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconSnowflake() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11M7 3.8l5 3.2 5-3.2M7 20.2l5-3.2 5 3.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M8 7l1 13h6l1-13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 15V5a2 2 0 012-2h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  card: IssuedCard;
  cardholderName: string;
  accountLabel: string;
  billing: CardBillingAddress | null;
  secrets: { number: string; cvv: string } | null;
  secretsBusy: boolean;
  secretsError: string;
  freezeBusy: boolean;
  freezeError: string;
  copiedField: string;
  onCopy: (fieldKey: string, value: string) => () => void;
  onToggleReveal: () => void;
  onToggleFreeze: () => void;
  onClose: () => void;
};

export default function CardDetailModal({
  card,
  cardholderName,
  accountLabel,
  billing,
  secrets,
  secretsBusy,
  secretsError,
  freezeBusy,
  freezeError,
  copiedField,
  onCopy,
  onToggleReveal,
  onToggleFreeze,
  onClose,
}: Props) {
  const revealed = Boolean(secrets?.number && secrets?.cvv);
  const last4 = card.last_four || "";
  const panMasked = formatMaskedPan(last4).replace(/•/g, ".");
  const expFace = formatExpiryFace(
    card.expiration_month,
    card.expiration_year,
  );
  const isFrozen = (card.status || "").toLowerCase() === "frozen";
  const cardholderLabel = cardholderName || "—";
  const scheme = resolveCardBrand({
    brand: card.brand,
    number: secrets?.number || card.number,
  });

  const copyable = (
    field: string,
    value: string,
    label: string,
    opts?: { formatPan?: boolean },
  ) => {
    if (!revealed) {
      return (
        <span className="ep-card-face__secret" aria-label={label}>
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
        onClick={onCopy(field, copyValue)}
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
    <div className="ep-cards__modal ep-cards__modal--detail">
      <div className="ep-card-face">
        <div className="ep-card-face__top">
          <span className="ep-card-face__kind">
            VIRTUAL
            <span className="ep-card-face__kind-chip">Virtual</span>
          </span>
          <CardBrandMark brand={scheme} className="ep-card-face__scheme" />
        </div>

        <div className="ep-card-face__pan-wrap">
          {revealed
            ? copyable("card:number", secrets!.number, "Card number", {
                formatPan: true,
              })
            : copyable("card:number", panMasked, "Card number")}
        </div>

        <div className="ep-card-face__bottom">
          <div className="ep-card-face__meta">
            <div className="ep-card-face__meta-col">
              <span className="ep-card-face__meta-label">EXP</span>
              {revealed && expFace
                ? copyable("card:exp", expFace, "Expiry")
                : copyable("card:exp", "../..", "Expiry")}
            </div>
            <div className="ep-card-face__meta-col">
              <span className="ep-card-face__meta-label">CVV</span>
              {revealed
                ? copyable("card:cvv", secrets!.cvv, "CVV")
                : copyable("card:cvv", "...", "CVV")}
            </div>
          </div>
          <span className="ep-card-face__brand">{cardholderLabel}</span>
        </div>
      </div>

      <div className="ep-card-face__actions" role="group" aria-label="Card actions">
        <button
          type="button"
          className="ep-card-face__action"
          data-active={revealed ? "true" : "false"}
          onClick={onToggleReveal}
          disabled={secretsBusy}
          aria-pressed={revealed}
          aria-label={revealed ? "Hide card details" : "Show card details"}
          title={revealed ? "Hide" : "Show details"}
        >
          <IconEye open={revealed} />
        </button>
        <button
          type="button"
          className="ep-card-face__action"
          data-active={isFrozen ? "true" : "false"}
          onClick={onToggleFreeze}
          disabled={freezeBusy}
          aria-pressed={isFrozen}
          aria-label={isFrozen ? "Unfreeze card" : "Freeze card"}
          title={isFrozen ? "Unfreeze" : "Freeze"}
        >
          <IconSnowflake />
        </button>
        <button
          type="button"
          className="ep-card-face__action"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          <IconTrash />
        </button>
      </div>

      {secretsError ? (
        <div className="ep-cards__note" role="alert" style={{ color: "var(--red)" }}>
          {secretsError}
        </div>
      ) : null}
      {freezeError ? (
        <div className="ep-cards__note" role="alert" style={{ color: "var(--red)" }}>
          {freezeError}
        </div>
      ) : null}

      <div className="ep-card-meta">
        <div className="ep-card-meta__row">
          <span>Cardholder</span>
          <b>{cardholderLabel}</b>
        </div>
        <div className="ep-card-meta__row">
          <span>Account</span>
          <b>{accountLabel || "—"}</b>
        </div>
      </div>

      {billing ? (
        <div className="ep-card-billing">
          <div className="ep-card-billing__head">
            <span>Billing Address</span>
            <button
              type="button"
              className="ep-card-billing__copy"
              data-copied={copiedField === "card:billing" ? "true" : "false"}
              onClick={onCopy("card:billing", billing.copyText)}
              aria-label={
                copiedField === "card:billing"
                  ? "Billing address copied"
                  : "Copy billing address"
              }
            >
              <IconCopy />
            </button>
          </div>
          <p className="ep-card-billing__lines">
            {billing.line1}
            {billing.line2 ? (
              <>
                <br />
                {billing.line2}
              </>
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
