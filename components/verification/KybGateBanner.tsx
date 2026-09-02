"use client";

import React from "react";
import {
  canOpenKybWizard,
  describeKybStatus,
  describeKybStatusDetail,
  isKybApproved,
  isKybInReview,
  kybStatusPresentation,
} from "@/lib/services/kyb";

export type KybGateBannerProps = {
  verificationStatus?: string;
  onStartVerification?: () => void;
  /** When true, show a CTA to open the KYB wizard. */
  showAction?: boolean;
  /** CTA label — defaults to Continue when mid-flow / rejected. */
  actionLabel?: string;
  /** Shown when KYB was rejected — from profile.reviewer_notes. */
  reviewerNotes?: string | null;
};

export default function KybGateBanner(p: KybGateBannerProps) {
  const status = p.verificationStatus?.trim();
  const notes = p.reviewerNotes?.trim();
  const presentation = kybStatusPresentation(status);
  const detail = describeKybStatusDetail(status, notes);
  const approved = isKybApproved(status);
  const inReview = isKybInReview(status);
  const showCta = p.showAction && !!p.onStartVerification && canOpenKybWizard(status);

  if (approved) return null;

  const tone = inReview
    ? {
        bg: "var(--amber-tint)",
        border: "color-mix(in srgb, var(--amber) 28%, var(--border))",
        badgeBg: "var(--amber)",
        badgeLabel: "In review",
      }
    : status === "rejected" || status === "expired"
      ? {
          bg: "var(--red-tint)",
          border: "color-mix(in srgb, var(--red) 28%, var(--border))",
          badgeBg: "var(--red)",
          badgeLabel: describeKybStatus(status),
        }
      : {
          bg: "var(--amber-tint)",
          border: "color-mix(in srgb, var(--amber) 28%, var(--border))",
          badgeBg: "var(--amber)",
          badgeLabel: "Verification required",
        };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        padding: "14px 16px",
        borderRadius: "14px",
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        minHeight: "52px",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "5px 10px",
          borderRadius: "999px",
          background: tone.badgeBg,
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {tone.badgeLabel}
      </span>
      <div style={{ flex: "1", minWidth: "200px" }}>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--ink)",
            lineHeight: 1.4,
          }}
        >
          {presentation.headline}. {detail}
        </p>
        {notes && (status === "rejected" || status === "expired") ? (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--red)",
              lineHeight: 1.4,
            }}
          >
            What compliance needs: {notes}
          </p>
        ) : null}
      </div>
      {showCta ? (
        <button
          type="button"
          onClick={p.onStartVerification}
          style={{
            padding: "10px 16px",
            minHeight: "44px",
            borderRadius: "12px",
            border: "none",
            background: "var(--indigo)",
            color: "var(--indigo-on)",
            fontFamily: "'Space Grotesk',sans-serif",
            fontSize: "12.5px",
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {p.actionLabel ||
            (status === "rejected" || status === "expired"
              ? "Fix and resubmit"
              : "Start verification")}
        </button>
      ) : null}
    </div>
  );
}
