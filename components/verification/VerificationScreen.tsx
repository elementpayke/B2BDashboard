"use client";

import React from "react";

export type VerificationTier = {
  num: string;
  title: string;
  reqs: string[];
  limit: string;
  statusLabel: string;
  statusColor: string;
  statusSoft: string;
  locked: boolean;
  /** Tier 2 KYB — show start/continue when the wizard can be opened. */
  showKybAction?: boolean;
  kybActionLabel?: string;
};

export type VerificationScreenProps = {
  tiers: VerificationTier[];
  onUpgradeTier3: () => void;
  onStartKyb?: () => void;
};

export default function VerificationScreen(p: VerificationScreenProps) {
  return (
    <div data-screen-label="Verification" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div className="ep-grid-3">
        {(p.tiers || []).map((t, i) => (
          <div
            key={i}
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: "20px",
              padding: "22px",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                fontSize: "11px",
                fontWeight: "700",
                padding: "4px 11px",
                borderRadius: "999px",
                background: t.statusSoft,
                color: t.statusColor,
              }}
            >
              {t.statusLabel}
            </span>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: "11px", color: "var(--indigo-text)", letterSpacing: "0.1em" }}>
              {t.num}
            </div>
            <h3 style={{ margin: "5px 0 8px", fontFamily: "'Space Grotesk',sans-serif", fontSize: "16px" }}>{t.title}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "7px", fontSize: "12.5px", color: "var(--muted)", margin: "10px 0 14px" }}>
              {(t.reqs || []).map((r, j) => (
                <div key={j}>✓ {r}</div>
              ))}
            </div>
            <div
              style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: "12px",
                color: "var(--muted)",
                padding: "9px 13px",
                borderRadius: "12px",
                background: "var(--surface2)",
              }}
            >
              {t.limit}
            </div>
            {t.showKybAction && p.onStartKyb ? (
              <button
                type="button"
                onClick={p.onStartKyb}
                style={{
                  width: "100%",
                  marginTop: "14px",
                  padding: "12px",
                  borderRadius: "14px",
                  border: "none",
                  background: "var(--indigo)",
                  color: "var(--indigo-on)",
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                {t.kybActionLabel || "Start verification"}
              </button>
            ) : null}
            {t.locked ? (
              <button
                type="button"
                onClick={p.onUpgradeTier3}
                style={{
                  width: "100%",
                  marginTop: "14px",
                  padding: "12px",
                  borderRadius: "14px",
                  border: "none",
                  background: "var(--indigo)",
                  color: "var(--indigo-on)",
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                }}
              >
                Upgrade to Tier 3
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
