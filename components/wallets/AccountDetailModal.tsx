"use client";
import React from "react";
import StatusBadge from "@/components/ui/StatusBadge";

export type AccountDetailRow = {
  label: string;
  value: string;
  copyValue?: string;
};

export type AccountDetailModalProps = {
  acctDetail: {
    currency: string;
    name: string;
    flagUrl: string | null;
    statusLabel: string;
    statusColor: string;
    statusSoft: string;
    rows: AccountDetailRow[];
    instructions?: string | null;
  } | null;
  copiedField: string;
  copyField: (fieldKey: string, value: string) => () => void;
  openModalSwapFromAcct: () => void;
};

/** Display-only IBAN grouping — copy still uses the raw `copyValue`. */
function formatSensitiveValue(label: string, value: string): string {
  const clean = value.replace(/\s+/g, "");
  const isIban = /iban/i.test(label) || /^[A-Z]{2}\d{2}/i.test(clean);
  if (isIban && clean.length > 8) {
    return clean.replace(/(.{4})/g, "$1 ").trim().toUpperCase();
  }
  return value;
}

export default function AccountDetailModal({
  acctDetail,
  copiedField,
  copyField,
  openModalSwapFromAcct,
}: AccountDetailModalProps) {
  if (!acctDetail) return null;

  return (
    <div className="ep-wallets-detail">
      <div className="ep-wallets-detail__head">
        {acctDetail.flagUrl ? (
          <div
            className="ep-wallets-detail__flag"
            style={{ backgroundImage: `url(${acctDetail.flagUrl})` }}
            role="img"
            aria-label={`${acctDetail.currency} flag`}
          />
        ) : (
          <span className="ep-wallets-detail__flag-fallback" aria-hidden>
            {acctDetail.currency.slice(0, 1)}
          </span>
        )}
        <div className="ep-wallets-detail__name">{acctDetail.name}</div>
        <div className="ep-wallets-detail__code">{acctDetail.currency}</div>
        <StatusBadge
          label={acctDetail.statusLabel}
          color={acctDetail.statusColor}
          soft={acctDetail.statusSoft}
          size="md"
        />
      </div>

      {acctDetail.rows.length ? (
        <div className="ep-wallets-detail__rows" aria-label="Account coordinates">
          {acctDetail.rows.map((row) => {
            const copied = copiedField === row.label;
            const display = formatSensitiveValue(row.label, row.value);
            const isIban = /iban/i.test(row.label);
            return (
              <div key={row.label} className="ep-wallets-detail__row">
                <span className="ep-wallets-detail__label">{row.label}</span>
                <span
                  className={
                    isIban
                      ? "ep-wallets-detail__value ep-wallets-detail__value--iban"
                      : "ep-wallets-detail__value"
                  }
                >
                  {display}
                </span>
                {row.copyValue ? (
                  <button
                    type="button"
                    onClick={copyField(row.label, row.copyValue)}
                    className="ep-wallets-detail__copy"
                    data-copied={copied ? "true" : "false"}
                    aria-label={copied ? `${row.label} copied` : `Copy ${row.label}`}
                  >
                    <span aria-hidden>⧉</span>
                    {copied ? "Copied" : "Copy"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="ep-wallets-detail__pending" role="status">
          <div className="ep-wallets-detail__pending-title">Coordinates pending</div>
          <div className="ep-wallets-detail__pending-body">
            {acctDetail.instructions ||
              "Deposit coordinates are being provisioned for this account. You’ll be able to copy IBAN and bank details here once they’re ready."}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={openModalSwapFromAcct}
        className="ep-wallets-detail__convert"
      >
        Convert balance
      </button>
    </div>
  );
}
