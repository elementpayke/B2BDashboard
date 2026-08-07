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

const ctaStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "14px",
  padding: "12px 14px",
  minHeight: "48px",
  borderRadius: "14px",
  border: "none",
  background: "var(--indigo)",
  color: "var(--indigo-on)",
  fontFamily: "'Space Grotesk',sans-serif",
  fontSize: "13px",
  fontWeight: 700,
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

function canShowTier3Upgrade(t: VerificationTier): boolean {
  // `locked` is overloaded in data — only offer upgrade when Tier 2 is cleared.
  if (!t.locked) return false;
  if (t.statusLabel === "Requires Tier 2" || t.statusLabel === "…" || t.statusLabel === "Loading…") {
    return false;
  }
  return true;
}

export default function VerificationScreen(p: VerificationScreenProps) {
  return (
    <div
      data-screen-label="Verification"
      style={{ display: "flex", flexDirection: "column", gap: "16px" }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "13.5px",
          lineHeight: 1.5,
          color: "var(--muted)",
          maxWidth: "56ch",
        }}
      >
        Complete each tier to raise your send limits. Start with business verification (Tier 2)
        before requesting institutional access.
      </p>

      <div className="ep-grid-3" role="list" aria-label="Verification tiers">
        {(p.tiers || []).map((t) => {
          const showUpgrade = canShowTier3Upgrade(t);
          const gated =
            t.locked &&
            (t.statusLabel === "Requires Tier 2" || t.statusLabel === "Locked");

          return (
            <article
              key={t.num}
              role="listitem"
              aria-labelledby={`tier-title-${t.num}`}
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: "20px",
                padding: "22px",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                opacity: gated && t.statusLabel === "Requires Tier 2" ? 0.88 : 1,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "18px",
                  right: "18px",
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "5px 11px",
                  borderRadius: "999px",
                  background: t.statusSoft,
                  color: t.statusColor,
                  maxWidth: "46%",
                  textAlign: "center",
                  lineHeight: 1.3,
                }}
                aria-label={`Status: ${t.statusLabel}`}
              >
                {t.statusLabel}
              </span>

              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: "11px",
                  color: "var(--indigo-text)",
                  letterSpacing: "0.1em",
                  paddingRight: "42%",
                }}
              >
                {t.num}
              </div>
              <h3
                id={`tier-title-${t.num}`}
                style={{
                  margin: "6px 0 0",
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "var(--ink)",
                  paddingRight: "42%",
                  lineHeight: 1.3,
                }}
              >
                {t.title}
              </h3>

              <ul
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  fontSize: "12.5px",
                  color: "var(--muted)",
                  margin: "14px 0",
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {(t.reqs || []).map((r) => (
                  <li
                    key={r}
                    style={{ display: "flex", gap: "8px", alignItems: "flex-start", lineHeight: 1.4 }}
                  >
                    <span aria-hidden style={{ color: "var(--indigo-text)", fontWeight: 700 }}>
                      ✓
                    </span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>

              <div
                style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: "12px",
                  color: "var(--muted)",
                  padding: "10px 13px",
                  borderRadius: "12px",
                  background: "var(--surface2)",
                  marginTop: "auto",
                }}
              >
                {t.limit}
              </div>

              {t.showKybAction && p.onStartKyb ? (
                <button type="button" onClick={p.onStartKyb} style={ctaStyle}>
                  {t.kybActionLabel || "Start verification"}
                </button>
              ) : null}

              {showUpgrade ? (
                <button type="button" onClick={p.onUpgradeTier3} style={ctaStyle}>
                  Request Tier 3 upgrade
                </button>
              ) : null}

              {t.locked && t.statusLabel === "Requires Tier 2" ? (
                <p
                  style={{
                    margin: "14px 0 0",
                    fontSize: "12px",
                    lineHeight: 1.45,
                    color: "var(--muted)",
                  }}
                >
                  Finish Tier 2 verification to unlock this upgrade path.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
