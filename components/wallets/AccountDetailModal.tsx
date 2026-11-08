"use client";
import React, { useMemo, useState } from "react";
import { openBrandedDocument } from "@/lib/documents/brandedDocument";
import { MBOKA_LETTERHEAD } from "@/lib/documents/letterhead";

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
    status?: string;
    /** Legal / beneficiary account holder from the API — never a currency label. */
    beneficiary?: string | null;
    rows: AccountDetailRow[];
    sections?: AccountDetailSection[];
    instructions?: string | null;
    /** e.g. "Fiat" or "Stablecoin · Base" */
    railLabel?: string;
    showConvert?: boolean;
    /** Client-side bank letter download (fiat coordinates). */
    showDownloadLetter?: boolean;
    deposit_reference_required?: boolean;
    deposit_disclaimer?: string | null;
    /** Deposit-account id — set only for fiat/bank accounts. Drives the
     * Activity section; omitted entirely for stablecoin accounts, which
     * have no `/v1/iban/accounts/{id}/activity` equivalent. */
    accountId?: string | null;
  } | null;
  /** details = coords; fund = same coords with bank-transfer guidance */
  intent?: "details" | "fund";
  copiedField: string;
  copyField: (fieldKey: string, value: string) => () => void;
  openModalSwapFromAcct?: () => void;
  /**
   * Queries Nuvion live via Mboka's sync endpoint and reconciles the stored
   * copy if stale. The caller owns re-fetching/updating `acctDetail` on
   * success — this modal only tracks its own busy/error state around the
   * call. Button is gated on `acctDetail.accountId` and `status === "active"`
   * so it never appears before both the account exists and this prop is wired.
   */
  onRefreshAccount?: (accountId: string) => Promise<void>;
};

/** Display-only IBAN grouping — copy still uses the raw `copyValue`. */
export function formatSensitiveValue(label: string, value: string): string {
  const clean = value.replace(/\s+/g, "");
  const isIban = /iban/i.test(label) && /^[A-Z]{2}\d{2}/i.test(clean) && clean.length >= 15;
  if (isIban) {
    return clean.replace(/(.{4})/g, "$1 ").trim().toUpperCase();
  }
  return value;
}

/**
 * Fallback classifier for callers that pass raw `rows` without `sections`
 * (e.g. tests, or any future caller that hasn't adopted
 * `buildDepositAccountDetailSections`). Vocabulary mirrors that function's
 * `BANK_ROW_LABEL_RE` in `lib/services/depositAccounts.ts` — keep both in
 * sync when a new rail field/label is added.
 */
function defaultSections(rows: AccountDetailRow[]): AccountDetailSection[] {
  if (!rows.length) return [];
  const bankKeys =
    /^(iban|bic|swift|bank|account name|account number|routing number|sort code|institution number|transit number|bank code|clabe)/i;
  const mbokaKeys = /^mboka/i;
  const settleKeys = /^(settles|settlement|reference|asset|network|account id|status)/i;
  const bank: AccountDetailRow[] = [];
  const mboka: AccountDetailRow[] = [];
  const settle: AccountDetailRow[] = [];
  const other: AccountDetailRow[] = [];
  for (const row of rows) {
    if (bankKeys.test(row.label)) bank.push(row);
    else if (mbokaKeys.test(row.label)) mboka.push(row);
    else if (settleKeys.test(row.label)) settle.push(row);
    else other.push(row);
  }
  const sections: AccountDetailSection[] = [];
  if (bank.length) sections.push({ title: "Bank details", rows: bank });
  if (mboka.length) sections.push({ title: "Mboka transfer", rows: mboka });
  if (settle.length) sections.push({ title: "Settlement", rows: settle });
  if (other.length) sections.push({ title: "Details", rows: other });
  return sections.length ? sections : [{ title: "Details", rows }];
}

/**
 * The modal uses short UI-style section titles ("Domestic transfer
 * (ACH/wire)"). The printed letter reads as a formal document, so it uses
 * the fuller "Instructions For ..." phrasing instead — letter-only, so the
 * on-screen modal copy is untouched.
 */
const LETTER_SECTION_TITLES: Record<string, string> = {
  "domestic transfer (ach/wire)": "Instructions For Domestic Transfer",
  "domestic transfer": "Instructions For Domestic Transfer",
  "international wire": "Instructions For International Transfer",
};

function letterSectionTitle(title: string): string {
  return LETTER_SECTION_TITLES[title.trim().toLowerCase()] ?? title;
}

function downloadBankLetter(acctDetail: NonNullable<AccountDetailModalProps["acctDetail"]>) {
  const beneficiary = acctDetail.beneficiary?.trim() || null;
  const beneficiaryName = beneficiary || acctDetail.name;
  const dateLine = new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date());

  // Mirror modal bank-rail sections only — Mboka transfer (the internal
  // reference number) stays on the modal. "settlement" is kept here as
  // defense-in-depth for the defaultSections() fallback path (raw rows
  // without sections, e.g. a caller that hasn't adopted
  // buildDepositAccountDetailSections, which no longer emits it at all).
  const EXCLUDED_LETTER_SECTIONS = new Set(["settlement", "mboka transfer"]);
  const coordinateSections = (
    acctDetail.sections?.length ? acctDetail.sections : defaultSections(acctDetail.rows)
  )
    .filter((sec) => !EXCLUDED_LETTER_SECTIONS.has(sec.title.trim().toLowerCase()))
    .map((sec) => {
      // Account name already duplicates the beneficiary named in the intro — drop it here.
      const rows = sec.rows.filter(
        (row) =>
          !beneficiary || row.label.toLowerCase() !== "account name" || row.value.trim() !== beneficiary,
      );
      const leadRows = [
        ...(beneficiary ? [{ label: "Account holder", value: beneficiary, mono: false }] : []),
        { label: "Account currency", value: acctDetail.currency, mono: false },
      ];
      return {
        title: letterSectionTitle(sec.title),
        rows: [
          ...leadRows,
          ...rows.map((row) => ({
            label: row.label,
            value: formatSensitiveValue(row.label, row.value),
            mono: true,
          })),
        ],
      };
    });

  openBrandedDocument(
    {
      fileTitle: `Mboka — ${acctDetail.currency} bank letter`,
      heading: "Proof of account details",
      dateLine,
      addressee: "To whom it may concern",
      intro: `This letter confirms that the following account details allow ${beneficiaryName} to receive ${acctDetail.currency} payments into their Mboka account.`,
      sections: coordinateSections,
      legalNote: `You may share this letter with any third party requesting proof of your account details as confirmation that it is authentic. For questions about this account, contact ${MBOKA_LETTERHEAD.email}.`,
      documentKind: "letter",
    },
    `mboka-${acctDetail.currency.toLowerCase()}-bank-letter`,
  );
}

const DOMESTIC_SECTION_RE = /^domestic transfer/i;
const INTERNATIONAL_SECTION_RE = /^international wire/i;
const BANK_DETAILS_SECTION_RE = /^bank details$/i;

/**
 * Same account's domestic and international coordinates were being stacked
 * one after another — the modal needed 2-3 screens of scroll for an account
 * that has both rails, while a sender only ever needs one rail's
 * instructions at a time. Mercury/Wise/Revolut Business solve this the same
 * way: a small local/SWIFT toggle, not two full coordinate blocks stacked.
 * `showDownloadLetter` output is unaffected — the letter still mirrors every
 * section regardless of which rail tab is active on screen.
 */
function findRailSectionIndices(sections: AccountDetailSection[]): {
  domestic: number;
  international: number;
  bankDetails: number;
} {
  return {
    domestic: sections.findIndex((sec) => DOMESTIC_SECTION_RE.test(sec.title)),
    international: sections.findIndex((sec) => INTERNATIONAL_SECTION_RE.test(sec.title)),
    bankDetails: sections.findIndex((sec) => BANK_DETAILS_SECTION_RE.test(sec.title)),
  };
}

function DetailField({
  label,
  value,
  copyValue,
  copiedField,
  copyField,
}: {
  label: string;
  value: string;
  copyValue?: string;
  copiedField: string;
  copyField: (fieldKey: string, value: string) => () => void;
}) {
  const copied = copiedField === label;
  const display = formatSensitiveValue(label, value);
  const isIban = /iban/i.test(label);
  const canCopy = Boolean(copyValue);
  return (
    <div className="ep-wallets-detail__row">
      <span className="ep-wallets-detail__label">{label}</span>
      <span
        className={
          isIban
            ? "ep-wallets-detail__value ep-wallets-detail__value--iban"
            : "ep-wallets-detail__value"
        }
      >
        {display}
      </span>
      {canCopy ? (
        <button
          type="button"
          onClick={copyField(label, copyValue as string)}
          className="ep-wallets-detail__copy"
          data-copied={copied ? "true" : "false"}
          aria-label={copied ? `${label} copied` : `Copy ${label}`}
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
  onRefreshAccount,
}: AccountDetailModalProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [activeRail, setActiveRail] = useState<"domestic" | "international">("domestic");

  if (!acctDetail) return null;

  async function handleRefresh() {
    const accountId = acctDetail?.accountId;
    if (!accountId || !onRefreshAccount || refreshing) return;
    setRefreshing(true);
    setRefreshError("");
    try {
      await onRefreshAccount(accountId);
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "Couldn't refresh this account.");
    } finally {
      setRefreshing(false);
    }
  }

  const beneficiary = acctDetail.beneficiary?.trim() || null;
  const bankRows = (
    acctDetail.sections?.length ? acctDetail.sections : defaultSections(acctDetail.rows)
  )
    .map((sec) =>
      beneficiary
        ? {
            ...sec,
            rows: sec.rows.filter(
              (row) => row.label.toLowerCase() !== "account name" || row.value.trim() !== beneficiary,
            ),
          }
        : sec,
    )
    .filter((sec) => sec.rows.length > 0);
  const railIndices = useMemo(() => findRailSectionIndices(bankRows), [bankRows]);
  const hasRailTabs = railIndices.domestic !== -1 && railIndices.international !== -1;
  // Bank name/address apply to every rail equally — fold them into whichever
  // rail tab is active instead of giving them their own header, so switching
  // tabs doesn't cost an extra section's worth of vertical space.
  const mergeBankDetails = hasRailTabs && railIndices.bankDetails !== -1;
  const showLetter = acctDetail.showDownloadLetter === true && acctDetail.rows.length > 0;
  const isFund = intent === "fund";
  const depositUnavailable =
    acctDetail.status === "deposit_unavailable" || acctDetail.status === "unavailable";

  return (
    <div className="ep-wallets-detail">
      {isFund && !depositUnavailable ? (
        <div className="ep-wallets-detail__fund-hint" role="note">
          <div className="ep-wallets-detail__fund-hint-title">
            Transfer {acctDetail.currency} to these bank details
          </div>
          <p className="ep-wallets-detail__fund-hint-body">
            Send a bank transfer in <strong>{acctDetail.currency}</strong>
            {beneficiary ? (
              <>
                {" "}
                to <strong>{beneficiary}</strong>
              </>
            ) : null}{" "}
            using the coordinates below. Funds credit when the inbound payment settles
            {acctDetail.instructions ? ` — ${acctDetail.instructions}` : "."} This is not the
            African momo/bank OnRamp top-up flow.
          </p>
        </div>
      ) : null}

      {acctDetail.deposit_disclaimer ? (
        <div className="ep-wallets-detail__fund-hint" role="note">
          <div className="ep-wallets-detail__fund-hint-title">Payment reference required</div>
          <p className="ep-wallets-detail__fund-hint-body">{acctDetail.deposit_disclaimer}</p>
        </div>
      ) : null}

      {depositUnavailable ? (
        <div className="ep-wallets-detail__pending" role="status">
          <div className="ep-wallets-detail__pending-title">Deposit unavailable</div>
          <div className="ep-wallets-detail__pending-body">
            {acctDetail.instructions ||
              "IBAN / bank coordinates are not available for this rail. Use Interac or open banking from Fund account when offered for this currency."}
          </div>
        </div>
      ) : beneficiary ? (
        <div className="ep-wallets-detail__section">
          <div className="ep-wallets-detail__section-title">Beneficiary</div>
          <DetailField
            label="Name"
            value={beneficiary}
            copyValue={beneficiary}
            copiedField={copiedField}
            copyField={copyField}
          />
        </div>
      ) : null}

      {depositUnavailable ? null : acctDetail.rows.length ? (
        bankRows.map((sec, idx) => {
          // Merged into the tab block rendered at the domestic index below.
          if (hasRailTabs && idx === railIndices.international) return null;
          if (mergeBankDetails && idx === railIndices.bankDetails) return null;

          if (hasRailTabs && idx === railIndices.domestic) {
            const railSections = [bankRows[railIndices.domestic], bankRows[railIndices.international]];
            const activeSection = activeRail === "domestic" ? railSections[0] : railSections[1];
            const activeRows = mergeBankDetails
              ? [...activeSection.rows, ...bankRows[railIndices.bankDetails].rows]
              : activeSection.rows;
            return (
              <div key="rail-tabs" className="ep-wallets-detail__section">
                <div className="ep-wallets-detail__rail-tabs" role="tablist" aria-label="Transfer rail">
                  {railSections.map((railSec, railIdx) => {
                    const rail = railIdx === 0 ? "domestic" : "international";
                    return (
                      <button
                        key={rail}
                        type="button"
                        role="tab"
                        aria-selected={activeRail === rail}
                        data-active={activeRail === rail ? "true" : "false"}
                        className="ep-wallets-detail__rail-tab"
                        onClick={() => setActiveRail(rail)}
                      >
                        {railSec.title}
                      </button>
                    );
                  })}
                </div>
                <div className="ep-wallets-detail__rows" aria-label={activeSection.title}>
                  {activeRows.map((row) => (
                    <DetailField
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      copyValue={row.copyValue}
                      copiedField={copiedField}
                      copyField={copyField}
                    />
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={sec.title} className="ep-wallets-detail__section">
              <div className="ep-wallets-detail__section-title">{sec.title}</div>
              <div className="ep-wallets-detail__rows" aria-label={sec.title}>
                {sec.rows.map((row) => (
                  <DetailField
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    copyValue={row.copyValue}
                    copiedField={copiedField}
                    copyField={copyField}
                  />
                ))}
              </div>
            </div>
          );
        })
      ) : (
        <div className="ep-wallets-detail__pending" role="status">
          <div className="ep-wallets-detail__pending-title">Coordinates pending</div>
          <div className="ep-wallets-detail__pending-body">
            {acctDetail.instructions ||
              "Deposit coordinates are being provisioned for this account. You will be able to copy IBAN and bank details here once they are ready."}
          </div>
        </div>
      )}

      {(() => {
        const canDownloadLetter = showLetter && !depositUnavailable;
        const canRefresh = Boolean(
          acctDetail.accountId && acctDetail.status === "active" && onRefreshAccount,
        );
        const letterButton = canDownloadLetter ? (
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
        ) : null;
        const refreshButton = canRefresh ? (
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="ep-wallets-detail__letter"
          >
            {refreshing ? "Refreshing…" : "Refresh details"}
          </button>
        ) : null;

        if (canDownloadLetter && canRefresh) {
          return (
            <>
              <div className="ep-wallets-detail__actions">
                {letterButton}
                {refreshButton}
              </div>
              {refreshError ? (
                <p className="ep-wallets-detail__pending-body" role="alert">
                  {refreshError}
                </p>
              ) : null}
            </>
          );
        }
        return (
          <>
            {letterButton}
            {refreshButton}
            {canRefresh && refreshError ? (
              <p className="ep-wallets-detail__pending-body" role="alert">
                {refreshError}
              </p>
            ) : null}
          </>
        );
      })()}

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
