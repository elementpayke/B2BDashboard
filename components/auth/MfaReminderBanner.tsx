"use client";

import React from "react";

export type MfaReminderBannerProps = {
  /** ISO timestamp of the 2FA cutover deadline, or null if none is set. */
  cutoverAt: string | null;
  onSetUp: () => void;
  onDismiss: () => void;
  dismissing?: boolean;
};

function daysUntil(iso: string): number | null {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Dismissible home-screen nudge shown when `/api/auth/me`'s
 * `mfa.should_remind` is true. Mirrors KybGateBanner's presentation —
 * self-contained, theme-var driven so it reads correctly in light and dark.
 * Cadence (whether to show at all, and how urgently) is entirely
 * server-computed; this component only renders what it's told.
 */
export default function MfaReminderBanner({
  cutoverAt,
  onSetUp,
  onDismiss,
  dismissing,
}: MfaReminderBannerProps) {
  const days = cutoverAt ? daysUntil(cutoverAt) : null;
  const urgent = days !== null && days <= 15;

  const tone = urgent
    ? {
        bg: "var(--red-tint, #fcebec)",
        border: "color-mix(in srgb, var(--red, #c81e24) 28%, var(--border, rgba(19,17,38,0.08)))",
        badgeBg: "var(--red, #c81e24)",
        badgeLabel: days !== null && days >= 0 ? `Required in ${days} day${days === 1 ? "" : "s"}` : "Action needed",
      }
    : {
        bg: "var(--amber-tint, #fdf3e0)",
        border: "color-mix(in srgb, var(--amber, #b5730a) 28%, var(--border, rgba(19,17,38,0.08)))",
        badgeBg: "var(--amber, #b5730a)",
        badgeLabel: "Recommended",
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
            color: "var(--ink, #131126)",
            lineHeight: 1.4,
          }}
        >
          Set up two-factor authentication.{" "}
          {urgent
            ? "It will soon be required to sign in to this account."
            : "Add an extra layer of protection to your business account."}
        </p>
      </div>
      <button
        type="button"
        onClick={onSetUp}
        style={{
          padding: "10px 16px",
          minHeight: "44px",
          borderRadius: "12px",
          border: "none",
          background: "var(--indigo, #3b2ed3)",
          color: "var(--indigo-on, #fff)",
          fontFamily: "'Space Grotesk',sans-serif",
          fontSize: "12.5px",
          fontWeight: 700,
          cursor: "pointer",
          flexShrink: 0,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        Set up 2FA
      </button>
      <button
        type="button"
        onClick={onDismiss}
        disabled={dismissing}
        aria-label="Dismiss two-factor authentication reminder"
        style={{
          padding: "10px",
          minHeight: "44px",
          minWidth: "44px",
          borderRadius: "12px",
          border: "none",
          background: "transparent",
          color: "var(--muted, #4c4a66)",
          fontSize: "16px",
          cursor: dismissing ? "not-allowed" : "pointer",
          flexShrink: 0,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        ✕
      </button>
    </div>
  );
}
