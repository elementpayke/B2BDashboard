"use client";

import React from "react";

export type KybGateBannerProps = {
  verificationStatus?: string;
  onStartVerification?: () => void;
  /** When true, show a CTA to open the KYB wizard. */
  showAction?: boolean;
};

export default function KybGateBanner(p: KybGateBannerProps) {
  const status = p.verificationStatus?.trim();

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
        background: "var(--amber-tint)",
        border: "1px solid color-mix(in srgb, var(--amber) 28%, var(--border))",
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
          background: "var(--amber)",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        Verification required
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
          Complete business verification before sending or receiving money.
        </p>
        {status ? (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "12px",
              fontWeight: 500,
              color: "var(--muted)",
              lineHeight: 1.4,
            }}
          >
            Current status: {status}
          </p>
        ) : null}
      </div>
      {p.showAction && p.onStartVerification ? (
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
          Start verification
        </button>
      ) : null}
    </div>
  );
}
