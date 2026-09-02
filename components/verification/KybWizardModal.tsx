"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  REVENUE_RANGE_OPTIONS,
  BUSINESS_TYPE_OPTIONS,
  EMPLOYEE_RANGE_OPTIONS,
  SOURCE_OF_FUNDS_OPTIONS,
  KYB_MAX_UBOS,
  KYB_MIN_UBO_OWNERSHIP,
  type KybWizardProfileDraft,
} from "@/lib/services/kyb";
import type { DocumentUploadState, KybWizardStep } from "@/lib/hooks/useKybWizard";
import CountrySelect from "@/components/ui/CountrySelect";

const fieldLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "700",
  color: "var(--muted2)",
  textTransform: "uppercase",
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  marginTop: "6px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1.5px solid var(--input-border)",
  background: "var(--input-bg)",
  outline: "none",
  fontSize: "13.5px",
  color: "var(--ink)",
  boxSizing: "border-box",
};

const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export type KybWizardModalProps = {
  step: KybWizardStep;
  stepDots: { on: boolean; label?: string }[];
  stepLabels?: string[];
  draft: KybWizardProfileDraft;
  patchDraft: (patch: Partial<KybWizardProfileDraft>) => void;
  patchAssociate: (index: number, patch: Partial<KybWizardProfileDraft["associates"][0]>) => void;
  setUboCount?: (count: number) => void;
  error: string;
  busy: boolean;
  docRows: DocumentUploadState[];
  setDocumentFile: (index: number, file: File | null) => void;
  uploadDocumentRow: (index: number, fileOverride?: File | null) => void | Promise<boolean>;
  openDocument?: (index: number, mode: "view" | "download") => void | Promise<void>;
  replaceDocumentRow?: (index: number) => void | Promise<boolean>;
  docsComplete: boolean;
  docsUploading?: boolean;
  submitted: boolean;
  submitOutcome?: "submitted" | "approved" | "rejected";
  nextStep: () => void;
  backStep: () => void;
  closeModal: () => void;
};

function SelectField(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <span style={fieldLabel}>{p.label}</span>
      <select value={p.value} onChange={(e) => p.onChange(e.target.value)} style={fieldInput}>
        <option value="">{p.placeholder || "Select…"}</option>
        {p.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextField(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  hint?: string;
}) {
  return (
    <div>
      <span style={fieldLabel}>{p.label}</span>
      <input
        type={p.type || "text"}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        placeholder={p.placeholder}
        inputMode={p.inputMode}
        autoComplete={p.autoComplete}
        min={p.min}
        max={p.max}
        step={p.step}
        style={fieldInput}
      />
      {p.hint ? (
        <div style={{ marginTop: "4px", fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>{p.hint}</div>
      ) : null}
    </div>
  );
}

function maxAdultDob(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

function DocumentDropRow(p: {
  row: DocumentUploadState;
  index: number;
  disabled: boolean;
  onPick: (index: number, file: File | null) => void;
  onRetry: (index: number) => void;
  onView?: (index: number) => void;
  onDownload?: (index: number) => void;
  onReplace?: (index: number) => void | Promise<boolean>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const row = p.row;

  const takeFile = useCallback(
    (file: File | null | undefined) => {
      if (!file || p.disabled || row.uploading) return;
      p.onPick(p.index, file);
    },
    [p, row.uploading],
  );

  const handleReplace = useCallback(async () => {
    if (!p.onReplace || replacing) return;
    setReplacing(true);
    try {
      const ok = await p.onReplace(p.index);
      if (ok !== false) {
        inputRef.current?.click();
      }
    } finally {
      setReplacing(false);
    }
  }, [p, replacing]);

  const statusColor = row.submitted
    ? "var(--indigo-text)"
    : row.error
      ? "var(--red)"
      : "var(--muted)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        padding: "14px",
        borderRadius: "16px",
        background: "var(--surface2)",
        border: dragOver ? "1.5px dashed var(--indigo)" : "1.5px solid transparent",
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (!row.submitted && !row.uploading) setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!row.submitted && !row.uploading) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (row.submitted || row.uploading) return;
        takeFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <b style={{ fontSize: "13.5px" }}>{row.label}</b>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "999px",
                background: row.category === "shareholder" ? "var(--amber-tint)" : "var(--indigo-tint)",
                color: row.category === "shareholder" ? "var(--amber)" : "var(--indigo-text)",
              }}
            >
              {row.category === "shareholder" ? "Officer / UBO" : "Business"}
            </span>
          </div>
          <div style={{ marginTop: "4px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.4 }}>
            {row.helpText || row.description}
          </div>
          <div style={{ marginTop: "6px", fontSize: "11px", fontWeight: 700, color: statusColor }}>
            {row.uploading
              ? "Uploading…"
              : row.submitted
                ? "Uploaded ✓"
                : row.file
                  ? `Selected · ${row.file.name}`
                  : dragOver
                    ? "Drop to upload"
                    : "Required"}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: "none" }}
        onChange={(e) => {
          takeFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {!row.submitted ? (
        <button
          type="button"
          disabled={row.uploading || p.disabled}
          onClick={() => inputRef.current?.click()}
          style={{
            width: "100%",
            padding: "18px 14px",
            borderRadius: "14px",
            border: "1.5px dashed var(--border)",
            background: dragOver ? "var(--indigo-tint)" : "var(--surface)",
            color: "var(--ink)",
            fontSize: "12.5px",
            fontWeight: 700,
            cursor: row.uploading ? "wait" : "pointer",
            textAlign: "center",
            lineHeight: 1.45,
          }}
        >
          {row.uploading
            ? "Uploading…"
            : "Drag & drop PDF, JPEG, or PNG here\nor click to choose a file (max 10 MB)"}
        </button>
      ) : (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {row.uploadedDocId && row.downloadable && p.onView ? (
            <button
              type="button"
              onClick={() => p.onView?.(p.index)}
              style={{
                padding: "8px 14px",
                borderRadius: "999px",
                border: "1.5px solid var(--border)",
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              View
            </button>
          ) : null}
          {row.uploadedDocId && row.downloadable && p.onDownload ? (
            <button
              type="button"
              onClick={() => p.onDownload?.(p.index)}
              style={{
                padding: "8px 14px",
                borderRadius: "999px",
                border: "1.5px solid var(--border)",
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Download
            </button>
          ) : null}
          {p.onReplace ? (
            <button
              type="button"
              disabled={replacing || p.disabled}
              onClick={() => void handleReplace()}
              style={{
                padding: "8px 14px",
                borderRadius: "999px",
                border: "none",
                background: "var(--indigo-tint)",
                color: "var(--indigo-text)",
                fontSize: "11.5px",
                fontWeight: 700,
                cursor: replacing ? "wait" : "pointer",
              }}
            >
              {replacing ? "Preparing…" : "Replace"}
            </button>
          ) : null}
        </div>
      )}

      {!row.submitted && row.file && !row.uploading ? (
        <button
          type="button"
          onClick={() => p.onRetry(p.index)}
          style={{
            alignSelf: "flex-start",
            padding: "6px 13px",
            borderRadius: "999px",
            border: "1.5px solid var(--border)",
            background: "var(--surface)",
            color: "var(--ink)",
            fontSize: "11px",
            fontWeight: "700",
            cursor: "pointer",
          }}
        >
          Retry upload
        </button>
      ) : null}

      {row.error ? (
        <div style={{ fontSize: "11px", color: "var(--red)", fontWeight: 600 }}>{row.error}</div>
      ) : null}
    </div>
  );
}

export default function KybWizardModal(p: KybWizardModalProps) {
  const doneCount = (p.docRows || []).filter((r) => r.submitted).length;
  const totalCount = (p.docRows || []).length;
  const businessRows = (p.docRows || [])
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.category === "business");
  const officerRows = (p.docRows || [])
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.category === "shareholder");

  if (p.submitted) {
    const outcome = p.submitOutcome || "submitted";
    const title =
      outcome === "approved"
        ? "Verified"
        : outcome === "rejected"
          ? "Action needed"
          : "In review";
    const body =
      outcome === "approved"
        ? "Your business is verified. Deposit accounts and payouts are unlocked."
        : outcome === "rejected"
          ? "Compliance needs changes before you can continue. Close this and use Fix and resubmit from Verification."
          : "Compliance usually takes 1–2 business days. Deposit accounts unlock once KYB is approved.";
    const iconBg =
      outcome === "approved"
        ? "var(--indigo-tint)"
        : outcome === "rejected"
          ? "var(--red-tint)"
          : "var(--indigo-tint)";
    const iconColor =
      outcome === "rejected" ? "var(--red)" : "var(--indigo-text)";

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "12px 0 6px", textAlign: "center" }}>
        <span style={{ width: "48px", height: "48px", borderRadius: "50%", background: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>
          {outcome === "rejected" ? "!" : "✓"}
        </span>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "14.5px", fontWeight: "700" }}>{title}</span>
        <span style={{ fontSize: "12.5px", color: "var(--muted)" }}>{body}</span>
        {(p.docRows || []).some((r) => r.uploadedDocId && r.downloadable) ? (
          <div style={{ width: "100%", marginTop: "8px", textAlign: "left", display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted2)", textTransform: "uppercase" }}>
              Your submitted documents
            </span>
            {(p.docRows || []).map((row, i) =>
              row.uploadedDocId && row.downloadable ? (
                <div
                  key={row.requirementType + i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    background: "var(--surface2)",
                  }}
                >
                  <span style={{ fontSize: "12.5px", fontWeight: 600 }}>{row.label}</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => void p.openDocument?.(i, "view")}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "999px",
                        border: "1.5px solid var(--border)",
                        background: "var(--surface)",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => void p.openDocument?.(i, "download")}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "999px",
                        border: "none",
                        background: "var(--indigo-tint)",
                        color: "var(--indigo-text)",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Download
                    </button>
                  </div>
                </div>
              ) : null,
            )}
          </div>
        ) : null}
        <button type="button" onClick={p.closeModal} style={{ marginTop: "6px", padding: "10px 20px", borderRadius: "999px", border: "none", background: "var(--surface2)", color: "var(--ink)", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}>
          Done
        </button>
      </div>
    );
  }

  const ownershipSum = (p.draft.associates || []).reduce(
    (sum, a) => sum + (Number(a.ownershipPercentage) || 0),
    0,
  );
  const showRemainderNote = ownershipSum > 0 && ownershipSum < 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {(p.stepDots || []).map((d, i) => (
            <span key={i} style={{ height: "4px", flex: "1", borderRadius: "999px", background: d.on ? "var(--indigo)" : "var(--surface3)" }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "4px" }}>
          {(p.stepLabels ?? p.stepDots.map((d) => d.label ?? "").filter(Boolean)).map((label, i) => (
            <span
              key={`${label}-${i}`}
              style={{
                flex: 1,
                fontSize: "10px",
                fontWeight: 700,
                textAlign: "center",
                color: i + 1 <= p.step ? "var(--indigo-text)" : "var(--muted)",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {p.step === 1 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--muted)" }}>Step 1 · Business details</span>
          <TextField label="Legal name" value={p.draft.legalName} onChange={(v) => p.patchDraft({ legalName: v })} placeholder="Mboka Ltd" autoComplete="organization" />
          <TextField label="Registration number" value={p.draft.registrationNumber} onChange={(v) => p.patchDraft({ registrationNumber: v })} placeholder="BN123456" />
          <CountrySelect
            label="Country of incorporation"
            value={p.draft.country}
            onChange={(code) => p.patchDraft({ country: code })}
            required
          />
          <TextField
            label="Incorporation date"
            value={p.draft.incorporationDate}
            onChange={(v) => p.patchDraft({ incorporationDate: v })}
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            min="1900-01-01"
            hint="Required for compliance review"
          />
          {p.draft.country.trim().toUpperCase() === "US" ? (
            <TextField
              label="Tax ID (EIN)"
              value={p.draft.taxId}
              onChange={(v) => p.patchDraft({ taxId: v })}
              placeholder="12-3456789"
              hint="Required for US-incorporated businesses"
            />
          ) : (
            <TextField
              label="Tax ID"
              value={p.draft.taxId}
              onChange={(v) => p.patchDraft({ taxId: v })}
              placeholder="Optional"
              hint="Optional — include if your corridor requires it"
            />
          )}
          <SelectField label="Business type" value={p.draft.businessType} onChange={(v) => p.patchDraft({ businessType: v as KybWizardProfileDraft["businessType"] })} options={BUSINESS_TYPE_OPTIONS} />
          <TextField label="Industry" value={p.draft.industry} onChange={(v) => p.patchDraft({ industry: v })} placeholder="Fintech" />
          <TextField label="Website" value={p.draft.website} onChange={(v) => p.patchDraft({ website: v })} placeholder="https://yourcompany.com" type="url" hint="Required — must start with https://" />
          <SelectField label="Employees" value={p.draft.estimatedEmployees} onChange={(v) => p.patchDraft({ estimatedEmployees: v as KybWizardProfileDraft["estimatedEmployees"] })} options={EMPLOYEE_RANGE_OPTIONS} />
          <SelectField label="Annual revenue" value={p.draft.annualRevenueRange} onChange={(v) => p.patchDraft({ annualRevenueRange: v as KybWizardProfileDraft["annualRevenueRange"] })} options={REVENUE_RANGE_OPTIONS} />
          <SelectField label="Source of funds" value={p.draft.sourceOfFunds} onChange={(v) => p.patchDraft({ sourceOfFunds: v as KybWizardProfileDraft["sourceOfFunds"] })} options={SOURCE_OF_FUNDS_OPTIONS} />
        </div>
      ) : null}

      {p.step === 2 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--muted)" }}>
            Step 2 · Beneficial owners & registered address
          </span>

          <div
            style={{
              padding: "14px",
              borderRadius: "14px",
              background: "var(--surface2)",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--ink)" }}>
              Beneficial owners (UBOs)
            </span>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.45 }}>
              List everyone who owns {KYB_MIN_UBO_OWNERSHIP}% or more. We’ll collect full details for
              each person. The first owner is your primary contact for officer ID documents.
            </p>
            <SelectField
              label="How many people own 25% or more?"
              value={String(p.draft.associates.length || 1)}
              onChange={(v) => p.setUboCount?.(Number(v) || 1)}
              options={Array.from({ length: KYB_MAX_UBOS }, (_, i) => ({
                value: String(i + 1),
                label: i === 0 ? "1 beneficial owner" : `${i + 1} beneficial owners`,
              }))}
              placeholder="Select…"
            />
          </div>

          {(p.draft.associates || []).map((associate, index) => (
            <div
              key={associate.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                padding: "14px",
                borderRadius: "16px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12.5px", fontWeight: 700 }}>
                  Owner {index + 1}
                  {index === 0 ? " · primary contact" : ""}
                </span>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {index === 0 ? (
                    <>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", background: "var(--indigo-tint)", color: "var(--indigo-text)" }}>
                        Representative
                      </span>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px", background: "var(--indigo-tint)", color: "var(--indigo-text)" }}>
                        Director
                      </span>
                    </>
                  ) : null}
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--indigo-text)" }}>
                    {KYB_MIN_UBO_OWNERSHIP}%+ ownership
                  </span>
                </div>
              </div>
              {index === 0 ? (
                <p style={{ margin: 0, fontSize: "11.5px", color: "var(--muted)", lineHeight: 1.4 }}>
                  Officer ID and proof of address uploads apply to this person.
                </p>
              ) : null}
              <TextField
                label="First name"
                value={associate.firstName}
                onChange={(v) => p.patchAssociate(index, { firstName: v })}
                autoComplete="given-name"
              />
              <TextField
                label="Last name"
                value={associate.lastName}
                onChange={(v) => p.patchAssociate(index, { lastName: v })}
                autoComplete="family-name"
              />
              <TextField
                label="Date of birth"
                value={associate.dateOfBirth}
                onChange={(v) => p.patchAssociate(index, { dateOfBirth: v })}
                type="date"
                max={maxAdultDob()}
                min="1900-01-01"
                hint="Must be 18+"
              />
              <TextField
                label="Email"
                value={associate.email}
                onChange={(v) => p.patchAssociate(index, { email: v })}
                type="email"
                autoComplete="email"
              />
              <TextField
                label="Phone"
                value={associate.phoneNumber}
                onChange={(v) => p.patchAssociate(index, { phoneNumber: v.replace(/[^\d+]/g, "") })}
                placeholder="+254700000000"
                inputMode="tel"
                autoComplete="tel"
                hint="International format with country code"
              />
              <TextField
                label="Ownership %"
                value={associate.ownershipPercentage}
                onChange={(v) => p.patchAssociate(index, { ownershipPercentage: v })}
                type="number"
                min={KYB_MIN_UBO_OWNERSHIP}
                max={100}
                step={1}
                inputMode="numeric"
                hint={`Minimum ${KYB_MIN_UBO_OWNERSHIP}% for a UBO. All owners together ≤ 100%.`}
              />
              <CountrySelect
                label="Tax residence country"
                value={associate.country}
                onChange={(code) => p.patchAssociate(index, { country: code })}
                required
              />
              <TextField
                label="Residential street"
                value={associate.street}
                onChange={(v) => p.patchAssociate(index, { street: v })}
                autoComplete="street-address"
              />
              <TextField
                label="Residential street line 2"
                value={associate.street2}
                onChange={(v) => p.patchAssociate(index, { street2: v })}
              />
              <TextField
                label="Residential city"
                value={associate.city}
                onChange={(v) => p.patchAssociate(index, { city: v })}
                autoComplete="address-level2"
              />
              <TextField
                label="Residential post code"
                value={associate.postCode}
                onChange={(v) => p.patchAssociate(index, { postCode: v })}
                autoComplete="postal-code"
              />
              <TextField
                label="Residential state / county"
                value={associate.state}
                onChange={(v) => p.patchAssociate(index, { state: v })}
                autoComplete="address-level1"
              />
            </div>
          ))}

          {showRemainderNote ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <TextField
                label={`Who holds the remaining ${100 - ownershipSum}%?`}
                value={p.draft.ownershipRemainderNote}
                onChange={(v) => p.patchDraft({ ownershipRemainderNote: v })}
                placeholder="e.g. minority shareholders under 25%, a trust, or a corporate parent"
                hint="Required when listed UBOs total less than 100%"
              />
            </div>
          ) : null}

          <div
            style={{
              marginTop: "4px",
              padding: "14px",
              borderRadius: "14px",
              background: "var(--surface2)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--ink)" }}>
              Registered business address
            </span>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.45 }}>
              The company’s official registered address (not a personal home address).
            </p>
            <TextField label="Street" value={p.draft.street} onChange={(v) => p.patchDraft({ street: v })} autoComplete="street-address" />
            <TextField label="Street line 2" value={p.draft.street2} onChange={(v) => p.patchDraft({ street2: v })} />
            <TextField label="City" value={p.draft.city} onChange={(v) => p.patchDraft({ city: v })} placeholder="Nairobi" autoComplete="address-level2" />
            <TextField label="Post code" value={p.draft.postCode} onChange={(v) => p.patchDraft({ postCode: v })} autoComplete="postal-code" />
            <TextField label="State / county" value={p.draft.state} onChange={(v) => p.patchDraft({ state: v })} placeholder="Nairobi County" autoComplete="address-level1" />
            <CountrySelect
              label="Address country"
              value={p.draft.addressCountry}
              onChange={(code) => p.patchDraft({ addressCountry: code })}
              required
            />
          </div>
        </div>
      ) : null}

      {p.step === 3 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--muted)" }}>Step 3 · Upload documents</span>
            {totalCount > 0 ? (
              <span style={{ fontSize: "12px", fontWeight: 700, color: p.docsComplete ? "var(--indigo-text)" : "var(--muted)" }}>
                {doneCount} / {totalCount} complete
              </span>
            ) : null}
          </div>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.45 }}>
            All documents below are required. Officer ID and proof of address should be for{" "}
            <b style={{ color: "var(--ink)" }}>Owner 1 (primary contact)</b>
            {p.draft.associates[0]
              ? ` — ${[p.draft.associates[0].firstName, p.draft.associates[0].lastName].filter(Boolean).join(" ") || "first beneficial owner"}`
              : ""}
            . Drag a file onto a card or click to choose — uploads start automatically.
          </p>

          {businessRows.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Business documents
              </span>
              {businessRows.map(({ row, index }) => (
                <DocumentDropRow
                  key={row.requirementType + index}
                  row={row}
                  index={index}
                  disabled={p.busy}
                  onPick={p.setDocumentFile}
                  onRetry={(i) => void p.uploadDocumentRow(i, p.docRows[i]?.file)}
                  onView={(i) => void p.openDocument?.(i, "view")}
                  onDownload={(i) => void p.openDocument?.(i, "download")}
                  onReplace={p.replaceDocumentRow}
                />
              ))}
            </div>
          ) : null}

          {officerRows.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Officer / beneficial owner
              </span>
              {officerRows.map(({ row, index }) => (
                <DocumentDropRow
                  key={row.requirementType + index}
                  row={row}
                  index={index}
                  disabled={p.busy}
                  onPick={p.setDocumentFile}
                  onRetry={(i) => void p.uploadDocumentRow(i, p.docRows[i]?.file)}
                  onView={(i) => void p.openDocument?.(i, "view")}
                  onDownload={(i) => void p.openDocument?.(i, "download")}
                  onReplace={p.replaceDocumentRow}
                />
              ))}
            </div>
          ) : null}

          {!p.docRows.length ? (
            <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Loading document checklist…</p>
          ) : null}
        </div>
      ) : null}

      {p.step === 4 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--muted)" }}>Step 4 · Submit for review</span>
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted)" }}>
            Your business profile, address, beneficial owners, and documents will be sent to compliance for review.
          </p>
          <div style={{ padding: "12px 14px", borderRadius: "12px", background: "var(--indigo-tint)", color: "var(--indigo-text)", fontSize: "12px", fontWeight: 600 }}>
            {p.docsComplete
              ? `All ${totalCount} required documents are uploaded.`
              : "Complete document uploads on the previous step first."}
          </div>
          {p.docsComplete ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(p.docRows || []).map((row, i) => (
                <div
                  key={row.requirementType + i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "12px",
                    background: "var(--surface2)",
                    fontSize: "12.5px",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{row.label}</span>
                  {row.uploadedDocId && row.downloadable ? (
                    <button
                      type="button"
                      onClick={() => void p.openDocument?.(i, "view")}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "999px",
                        border: "1.5px solid var(--border)",
                        background: "var(--surface)",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      View
                    </button>
                  ) : (
                    <span style={{ color: "var(--indigo-text)", fontWeight: 700 }}>Ready</span>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          <label
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "flex-start",
              padding: "12px 14px",
              borderRadius: "12px",
              background: "var(--surface2)",
              cursor: "pointer",
              fontSize: "12.5px",
              lineHeight: 1.45,
              color: "var(--ink)",
            }}
          >
            <input
              type="checkbox"
              checked={!!p.draft.attestedAccurate}
              onChange={(e) => p.patchDraft({ attestedAccurate: e.target.checked })}
              style={{ marginTop: "2px" }}
            />
            <span>
              I confirm the information and documents provided are accurate and complete to the best of my knowledge.
            </span>
          </label>
        </div>
      ) : null}

      {p.error ? (
        <div style={{ padding: "10px 12px", borderRadius: "12px", background: "var(--red-tint)", color: "var(--red)", fontSize: "11.5px", fontWeight: 600 }}>
          {p.error}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: "8px" }}>
        {p.step > 1 ? (
          <button type="button" onClick={p.backStep} disabled={p.busy} style={{ flex: 1, padding: "13px", borderRadius: "14px", border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: "pointer" }}>
            Back
          </button>
        ) : null}
        <button
          type="button"
          onClick={p.nextStep}
          disabled={
            p.busy ||
            !!p.docsUploading ||
            (p.step === 4 && (!p.docsComplete || !p.draft.attestedAccurate))
          }
          style={{ flex: 2, padding: "13px", borderRadius: "14px", border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontSize: "13.5px", fontWeight: "700", cursor: p.busy || p.docsUploading ? "wait" : "pointer", opacity: p.busy || p.docsUploading ? 0.7 : 1 }}
        >
          {p.busy || p.docsUploading
            ? p.docsUploading
              ? "Uploading…"
              : "Saving…"
            : p.step === 4
              ? "Submit for review"
              : "Continue"}
        </button>
      </div>
    </div>
  );
}
