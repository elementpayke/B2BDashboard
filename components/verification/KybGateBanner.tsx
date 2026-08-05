"use client";

import React from "react";

export type KybGateBannerProps = {
  verificationStatus?: string;
  onStartVerification?: () => void;
  /** When true, show a CTA to open the KYB wizard. */
  showAction?: boolean;
};

export default function KybGateBanner(p: KybGateBannerProps) {
  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
        padding: "12px 14px",
        borderRadius: "14px",
        background: "var(--amber-tint)",
        border: "1px solid var(--border)",
        color: "var(--amber)",
      }}
    >
      <span
        style={{
          fontSize: "11px",
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          padding: "4px 10px",
          borderRadius: "999px",
          background: "var(--amber)",
          color: "#fff",
        }}
      >
        Verification required
      </span>
      <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--ink)", flex: "1", minWidth: "200px" }}>
        Complete business verification before moving money
        {p.verificationStatus ? ` — current status: ${p.verificationStatus}.` : "."}
      </span>
      {p.showAction && p.onStartVerification ? (
        <button
          type="button"
          onClick={p.onStartVerification}
          style={{
            padding: "8px 14px",
            borderRadius: "999px",
            border: "none",
            background: "var(--indigo)",
            color: "var(--indigo-on)",
            fontFamily: "'Space Grotesk',sans-serif",
            fontSize: "12px",
            fontWeight: "700",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Start verification
        </button>
      ) : null}
    </div>
  );
}
