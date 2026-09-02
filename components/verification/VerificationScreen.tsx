"use client";

import React from "react";
import type { KybStatus } from "@/lib/services/kyb";
import {
  canOpenKybWizard,
  describeKybStatusDetail,
  isKybApproved,
  isKybInReview,
  kybStatusPresentation,
} from "@/lib/services/kyb";

export type VerificationScreenProps = {
  status: string | null | undefined;
  loading?: boolean;
  onStartKyb?: () => void;
  /** CTA when the wizard can be opened. */
  actionLabel?: string;
  /** From KYB profile when status is rejected / needs more info. */
  reviewerNotes?: string | null;
  /** Optional submitted-at / reviewed-at ISO strings for context. */
  submittedAt?: string | null;
  reviewedAt?: string | null;
};

const ctaStyle: React.CSSProperties = {
  marginTop: "18px",
  padding: "13px 18px",
  minHeight: "48px",
  borderRadius: "14px",
  border: "none",
  background: "var(--indigo)",
  color: "var(--indigo-on)",
  fontFamily: "'Space Grotesk',sans-serif",
  fontSize: "13.5px",
  fontWeight: 700,
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function VerificationScreen(p: VerificationScreenProps) {
  const status = (p.status || "pending") as KybStatus;
  const presentation = kybStatusPresentation(p.loading ? undefined : status);
  const notes = p.reviewerNotes?.trim() || null;
  const detail = describeKybStatusDetail(p.loading ? undefined : status, notes);
  const canSubmit = !p.loading && canOpenKybWizard(status);
  const passed = !p.loading && isKybApproved(status);
  const inReview = !p.loading && isKybInReview(status);
  const submittedWhen = formatWhen(p.submittedAt);
  const reviewedWhen = formatWhen(p.reviewedAt);

  const checklist = [
    "Business profile & registered address",
    "Beneficial owner (UBO) details",
    "Required compliance documents",
  ];

  return (
    <div
      data-screen-label="Verification"
      style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "640px" }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "13.5px",
          lineHeight: 1.5,
          color: "var(--muted)",
        }}
      >
        Submit business verification once. Compliance reviews your case and returns a clear
        result — verified, in review, or action needed. Deposit accounts and money movement
        unlock only after you pass.
      </p>

      <article
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "20px",
          padding: "22px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
        aria-labelledby="kyb-status-title"
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: "11px",
                color: "var(--indigo-text)",
                letterSpacing: "0.1em",
              }}
            >
              BUSINESS VERIFICATION
            </div>
            <h3
              id="kyb-status-title"
              style={{
                margin: "6px 0 0",
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--ink)",
                lineHeight: 1.3,
              }}
            >
              {presentation.headline}
            </h3>
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              padding: "5px 11px",
              borderRadius: "999px",
              background: presentation.soft,
              color: presentation.color,
              lineHeight: 1.3,
            }}
            aria-label={`Status: ${presentation.label}`}
          >
            {p.loading ? "Loading…" : presentation.label}
          </span>
        </div>

        <p style={{ margin: 0, fontSize: "13.5px", lineHeight: 1.5, color: "var(--muted)" }}>
          {detail}
        </p>

        {notes && (status === "rejected" || status === "expired") ? (
          <div
            role="status"
            style={{
              padding: "12px 14px",
              borderRadius: "14px",
              background: "var(--red-tint)",
              border: "1px solid color-mix(in srgb, var(--red) 28%, var(--border))",
              fontSize: "13px",
              lineHeight: 1.45,
              color: "var(--red)",
              fontWeight: 600,
            }}
          >
            What compliance needs: {notes}
          </div>
        ) : null}

        {passed ? (
          <div
            role="status"
            style={{
              padding: "12px 14px",
              borderRadius: "14px",
              background: "var(--indigo-tint)",
              border: "1px solid color-mix(in srgb, var(--indigo) 28%, var(--border))",
              fontSize: "13px",
              lineHeight: 1.45,
              color: "var(--indigo-text)",
              fontWeight: 600,
            }}
          >
            Your business passed verification. You can open deposit accounts and send money.
            {reviewedWhen ? ` Reviewed ${reviewedWhen}.` : ""}
          </div>
        ) : null}

        {inReview ? (
          <div
            role="status"
            style={{
              padding: "12px 14px",
              borderRadius: "14px",
              background: "var(--amber-tint)",
              border: "1px solid color-mix(in srgb, var(--amber) 28%, var(--border))",
              fontSize: "13px",
              lineHeight: 1.45,
              color: "var(--amber)",
              fontWeight: 600,
            }}
          >
            Your submission is with compliance. You can’t edit or resubmit until they respond.
            {submittedWhen ? ` Submitted ${submittedWhen}.` : ""} Usually 1–2 business days.
          </div>
        ) : null}

        {!p.loading && !passed && !inReview ? (
          <ul
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              fontSize: "12.5px",
              color: "var(--muted)",
              margin: 0,
              padding: 0,
              listStyle: "none",
            }}
          >
            {checklist.map((r) => (
              <li key={r} style={{ display: "flex", gap: "8px", alignItems: "flex-start", lineHeight: 1.4 }}>
                <span aria-hidden style={{ color: "var(--indigo-text)", fontWeight: 700 }}>
                  ✓
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {canSubmit && p.onStartKyb ? (
          <button type="button" onClick={p.onStartKyb} style={ctaStyle}>
            {p.actionLabel ||
              (status === "rejected" || status === "expired"
                ? "Fix and resubmit"
                : "Start verification")}
          </button>
        ) : null}

        {!p.loading && inReview ? (
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)", lineHeight: 1.45 }}>
            We’ll update this page when compliance finishes. No further action is needed right now.
          </p>
        ) : null}
      </article>
    </div>
  );
}
