"use client";
import React from "react";

export type AccountDetailRow = {
  label: string;
  value: string;
  copyValue?: string;
};

export type AccountDetailSection = {
  title: string;
  rows: AccountDetailRow[];
};

export type AccountDetailModalProps = {
  acctDetail: {
    currency: string;
    name: string;
    /** Legal / beneficiary account holder when available */
    beneficiary?: string | null;
    rows: AccountDetailRow[];
    sections?: AccountDetailSection[];
    instructions?: string | null;
    /** e.g. "Fiat" or "Stablecoin · Base" */
    railLabel?: string;
    showConvert?: boolean;
    /** Client-side bank letter download (fiat coordinates). */
    showDownloadLetter?: boolean;
  } | null;
  /** details = coords; fund = same coords with bank-transfer guidance */
  intent?: "details" | "fund";
  copiedField: string;
  copyField: (fieldKey: string, value: string) => () => void;
  openModalSwapFromAcct?: () => void;
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

function defaultSections(rows: AccountDetailRow[]): AccountDetailSection[] {
  if (!rows.length) return [];
  const bankKeys = /^(iban|bic|swift|bank|account name)/i;
  const settleKeys = /^(settles|settlement|reference|asset|network|account id|status)/i;
  const bank: AccountDetailRow[] = [];
  const settle: AccountDetailRow[] = [];
  const other: AccountDetailRow[] = [];
  for (const row of rows) {
    if (bankKeys.test(row.label)) bank.push(row);
    else if (settleKeys.test(row.label)) settle.push(row);
    else other.push(row);
  }
  const sections: AccountDetailSection[] = [];
  if (bank.length) sections.push({ title: "Bank details", rows: bank });
  if (settle.length) sections.push({ title: "Settlement", rows: settle });
  if (other.length) sections.push({ title: "Details", rows: other });
  return sections.length ? sections : [{ title: "Details", rows }];
}

function downloadBankLetter(acctDetail: NonNullable<AccountDetailModalProps["acctDetail"]>) {
  const beneficiary = acctDetail.beneficiary || acctDetail.name;
  const lines = [
    "ElementPay — Bank letter",
    "========================",
    "",
    `Account: ${acctDetail.name}`,
    `Rail: ${acctDetail.railLabel ?? acctDetail.currency}`,
    `Beneficiary: ${beneficiary}`,
    "",
  ];
  for (const row of acctDetail.rows) {
    lines.push(`${row.label}: ${formatSensitiveValue(row.label, row.value)}`);
  }
  lines.push("", "Generated from your ElementPay dashboard for recipient verification.");
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `elementpay-${acctDetail.currency.toLowerCase()}-bank-letter.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function DetailRow({
  row,
  copiedField,
  copyField,
}: {
  row: AccountDetailRow;
  copiedField: string;
  copyField: (fieldKey: string, value: string) => () => void;
}) {
  const copied = copiedField === row.label;
  const display = formatSensitiveValue(row.label, row.value);
  const isIban = /iban/i.test(row.label);
  return (
    <div className="ep-wallets-detail__row">
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
          {copied ? "Copied" : "Copy"}
        </button>
      ) : null}
    </div>
  );
}

export default function AccountDetailModal({
  acctDetail,
  intent = "details",
  copiedField,
  copyField,
  openModalSwapFromAcct,
}: AccountDetailModalProps) {
  if (!acctDetail) return null;

  const sections =
    acctDetail.sections?.length ? acctDetail.sections : defaultSections(acctDetail.rows);
  const beneficiary = acctDetail.beneficiary || acctDetail.name;
  const showLetter = acctDetail.showDownloadLetter === true && acctDetail.rows.length > 0;
  const isFund = intent === "fund";

  return (
    <div className="ep-wallets-detail">
      {isFund ? (
        <div className="ep-wallets-detail__fund-hint" role="note">
          <div className="ep-wallets-detail__fund-hint-title">
            Transfer {acctDetail.currency} to these bank details
          </div>
          <p className="ep-wallets-detail__fund-hint-body">
            Send a bank transfer in <strong>{acctDetail.currency}</strong> using the beneficiary
            and coordinates below. Funds credit when the inbound payment settles
            {acctDetail.instructions ? ` — ${acctDetail.instructions}` : "."} This is not the
            African momo/bank OnRamp top-up flow.
          </p>
        </div>
      ) : null}

      <div className="ep-wallets-detail__section">
        <div className="ep-wallets-detail__section-title">Beneficiary details</div>
        <div className="ep-wallets-detail__beneficiary">
          <span className="ep-wallets-detail__label">Name</span>
          <span className="ep-wallets-detail__beneficiary-name">{beneficiary}</span>
        </div>
      </div>

      {acctDetail.rows.length ? (
        sections.map((sec) => (
          <div key={sec.title} className="ep-wallets-detail__section">
            <div className="ep-wallets-detail__section-title">{sec.title}</div>
            <div className="ep-wallets-detail__rows" aria-label={sec.title}>
              {sec.rows.map((row) => (
                <DetailRow
                  key={row.label}
                  row={row}
                  copiedField={copiedField}
                  copyField={copyField}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="ep-wallets-detail__pending" role="status">
          <div className="ep-wallets-detail__pending-title">Coordinates pending</div>
          <div className="ep-wallets-detail__pending-body">
            {acctDetail.instructions ||
              "Deposit coordinates are being provisioned for this account. You will be able to copy IBAN and bank details here once they are ready."}
          </div>
        </div>
      )}

      {showLetter ? (
        <button
          type="button"
          onClick={() => downloadBankLetter(acctDetail)}
          className="ep-wallets-detail__letter"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Download bank letter
        </button>
      ) : null}

      {acctDetail.showConvert === true && openModalSwapFromAcct ? (
        <button
          type="button"
          onClick={openModalSwapFromAcct}
          className="ep-wallets-detail__convert"
        >
          Convert balance
        </button>
      ) : null}
    </div>
  );
}
