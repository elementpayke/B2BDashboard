"use client";

import React, { useEffect, useState } from "react";
import TotpQr from "./TotpQr";
import { mfaApi } from "@/lib/services/mfa";
import { ApiRequestError } from "@/lib/apiClient";

export type TotpEnrollmentProps = {
  /** Called once the user has confirmed their code and acknowledged saving
   * the backup codes. Enrollment (and, for the mandatory-setup path, the
   * deferred login) is already complete server-side by this point. */
  onComplete: () => void;
  /** Omit to make this step non-skippable (mandatory post-login setup). */
  onCancel?: () => void;
  title?: string;
  /** Copy shown above the QR — override for voluntary vs mandatory context. */
  intro?: string;
};

type Step = "loading" | "scan" | "backup-codes" | "error";

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "440px",
  background: "var(--panel, #ffffff)",
  border: "1px solid var(--border, rgba(19,17,38,0.08))",
  borderRadius: "20px",
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  boxSizing: "border-box",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "'Space Grotesk',sans-serif",
  fontSize: "19px",
  fontWeight: 800,
  color: "var(--ink, #131126)",
  letterSpacing: "-0.01em",
};

const bodyTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "13.5px",
  color: "var(--muted, #4c4a66)",
  lineHeight: 1.5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  minHeight: "48px",
  borderRadius: "12px",
  border: "1.5px solid var(--border, rgba(19,17,38,0.14))",
  background: "var(--panel, #ffffff)",
  color: "var(--ink, #131126)",
  fontSize: "18px",
  letterSpacing: "0.08em",
  textAlign: "center",
  outline: "none",
  boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "13px",
  minHeight: "48px",
  borderRadius: "13px",
  border: "none",
  background: "var(--indigo, #3b2ed3)",
  color: "var(--indigo-on, #fff)",
  fontFamily: "'Space Grotesk',sans-serif",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "11px",
  minHeight: "44px",
  borderRadius: "13px",
  border: "1.5px solid var(--border, rgba(19,17,38,0.14))",
  background: "transparent",
  color: "var(--ink, #131126)",
  fontFamily: "'Space Grotesk',sans-serif",
  fontSize: "13.5px",
  fontWeight: 700,
  cursor: "pointer",
};

const errorTextStyle: React.CSSProperties = {
  margin: 0,
  padding: "10px 12px",
  borderRadius: "10px",
  background: "var(--red-tint, #fcebec)",
  color: "var(--red, #c81e24)",
  fontSize: "13px",
  fontWeight: 600,
  lineHeight: 1.45,
};

export default function TotpEnrollment({ onComplete, onCancel, title, intro }: TotpEnrollmentProps) {
  const [step, setStep] = useState<Step>("loading");
  const [attempt, setAttempt] = useState(0);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStep("loading");
    setStartError(null);
    mfaApi
      .enrollStart()
      .then((res) => {
        if (cancelled) return;
        setSecret(res.secret_base32);
        setOtpauthUri(res.otpauth_uri);
        setStep("scan");
      })
      .catch((err) => {
        if (cancelled) return;
        setStartError(
          err instanceof ApiRequestError
            ? err.message
            : "Couldn't start enrollment. Please try again.",
        );
        setStep("error");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setConfirmError(null);
    setConfirming(true);
    try {
      const result = await mfaApi.enrollConfirm(code.trim());
      setBackupCodes(result.backup_codes || []);
      setStep("backup-codes");
    } catch (err) {
      setConfirmError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't confirm that code. Check the time on your device and try again.",
      );
    } finally {
      setConfirming(false);
    }
  }

  async function copyBackupCodes() {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — user can still select and copy manually.
    }
  }

  function downloadBackupCodes() {
    const text = [
      "Mboka — two-factor authentication backup codes",
      "Each code can be used once if you lose access to your authenticator app.",
      "Keep this file somewhere safe. It will not be shown again.",
      "",
      ...backupCodes,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mboka-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  if (step === "loading") {
    return (
      <div style={cardStyle} aria-busy="true">
        <h2 style={titleStyle}>{title || "Set up two-factor authentication"}</h2>
        <p style={bodyTextStyle}>Preparing your setup key…</p>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div style={cardStyle}>
        <h2 style={titleStyle}>{title || "Set up two-factor authentication"}</h2>
        <p role="alert" style={errorTextStyle}>
          {startError}
        </p>
        <button type="button" style={primaryButtonStyle} onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
        {onCancel ? (
          <button type="button" style={secondaryButtonStyle} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    );
  }

  if (step === "scan") {
    return (
      <div style={cardStyle}>
        <h2 style={titleStyle}>{title || "Set up two-factor authentication"}</h2>
        <p style={bodyTextStyle}>
          {intro ||
            "Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code it shows."}
        </p>
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
          {otpauthUri ? <TotpQr otpauthUri={otpauthUri} /> : null}
        </div>
        {secret ? (
          <div>
            <p style={{ ...bodyTextStyle, marginBottom: "6px", fontWeight: 700 }}>
              Can&apos;t scan? Enter this key manually:
            </p>
            <code
              style={{
                display: "block",
                padding: "10px 12px",
                borderRadius: "10px",
                background: "var(--surface2, rgba(19,17,38,0.045))",
                color: "var(--ink, #131126)",
                fontSize: "13.5px",
                letterSpacing: "0.05em",
                wordBreak: "break-all",
              }}
            >
              {secret}
            </code>
          </div>
        ) : null}
        <form onSubmit={submitCode} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <label htmlFor="totp-enroll-code" style={{ ...bodyTextStyle, fontWeight: 700 }}>
            6-digit code
          </label>
          <input
            id="totp-enroll-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/[^0-9]/g, ""));
              if (confirmError) setConfirmError(null);
            }}
            placeholder="000000"
            style={inputStyle}
            disabled={confirming}
            aria-invalid={confirmError ? true : undefined}
          />
          {confirmError ? (
            <p role="alert" style={errorTextStyle}>
              {confirmError}
            </p>
          ) : null}
          <button
            type="submit"
            style={{ ...primaryButtonStyle, opacity: confirming || code.length < 6 ? 0.65 : 1 }}
            disabled={confirming || code.length < 6}
          >
            {confirming ? "Confirming…" : "Confirm and continue"}
          </button>
          {onCancel ? (
            <button type="button" style={secondaryButtonStyle} onClick={onCancel} disabled={confirming}>
              Cancel
            </button>
          ) : null}
        </form>
      </div>
    );
  }

  // step === "backup-codes"
  return (
    <div style={cardStyle}>
      <h2 style={titleStyle}>Save your backup codes</h2>
      <p style={bodyTextStyle}>
        Two-factor authentication is now on. These backup codes are shown{" "}
        <strong>once, right now</strong> — each can be used in place of your authenticator app if
        you lose access to it. Store them somewhere safe; we can&apos;t show them to you again.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "8px",
          padding: "14px",
          borderRadius: "12px",
          background: "var(--surface2, rgba(19,17,38,0.045))",
        }}
      >
        {backupCodes.map((c) => (
          <code
            key={c}
            style={{
              fontSize: "13.5px",
              letterSpacing: "0.04em",
              color: "var(--ink, #131126)",
              textAlign: "center",
            }}
          >
            {c}
          </code>
        ))}
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button type="button" style={{ ...secondaryButtonStyle, flex: 1 }} onClick={copyBackupCodes}>
          {copied ? "Copied!" : "Copy codes"}
        </button>
        <button type="button" style={{ ...secondaryButtonStyle, flex: 1 }} onClick={downloadBackupCodes}>
          Download as text file
        </button>
      </div>
      <label style={{ display: "flex", alignItems: "flex-start", gap: "8px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          style={{ marginTop: "3px" }}
        />
        <span style={{ ...bodyTextStyle, fontWeight: 600 }}>
          I&apos;ve saved these backup codes somewhere safe.
        </span>
      </label>
      <button
        type="button"
        style={{ ...primaryButtonStyle, opacity: acknowledged ? 1 : 0.55 }}
        disabled={!acknowledged}
        onClick={onComplete}
      >
        Done
      </button>
    </div>
  );
}
