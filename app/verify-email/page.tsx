"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/lib/services/auth";
import { ApiRequestError } from "@/lib/apiClient";
import {
  authPageStyle,
  authCardStyle,
  authLabelStyle,
  authInputStyle,
  authButtonStyle,
  authErrorStyle,
  authSuccessStyle,
} from "@/components/auth/authStyles";

/** Matches backend EMAIL_VERIFICATION_COOLDOWN_SECONDS (default 60s). */
const RESEND_COOLDOWN_SECONDS = 60;

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await authApi.verifyEmail(email, code);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Verification failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Enter your email address to resend the code.");
      return;
    }
    setResending(true);
    try {
      await authApi.resendVerification(email.trim());
      setInfo("Verification code sent. Check your inbox and spam folder.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Unable to resend the code.");
    } finally {
      setResending(false);
    }
  }

  if (done) {
    return (
      <div style={authPageStyle}>
        <div style={authCardStyle}>
          <h1 style={{ margin: 0, fontFamily: "Geist,'Space Grotesk',sans-serif", fontSize: "20px", fontWeight: 800 }}>
            Email verified
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#4C4A66" }}>You can now sign in.</p>
          <button style={authButtonStyle} onClick={() => router.push("/login")}>
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  const resendDisabled = resending || cooldown > 0 || submitting;

  return (
    <div style={authPageStyle}>
      <form style={authCardStyle} onSubmit={onSubmit}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "Geist,'Space Grotesk',sans-serif", fontSize: "20px", fontWeight: 800 }}>
            Verify your email
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#4C4A66" }}>
            Enter the verification code we sent to your email.
          </p>
        </div>

        {error ? <div style={authErrorStyle}>{error}</div> : null}
        {info ? <div style={authSuccessStyle}>{info}</div> : null}

        <div>
          <label htmlFor="email" style={authLabelStyle}>Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={authInputStyle}
          />
        </div>
        <div>
          <label htmlFor="verification-code" style={authLabelStyle}>Verification code</label>
          <input
            id="verification-code"
            required
            autoComplete="one-time-code"
            inputMode="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={authInputStyle}
            placeholder="e.g. A3B7K9"
          />
        </div>
        <button type="submit" style={authButtonStyle} disabled={submitting}>
          {submitting ? "Verifying…" : "Verify"}
        </button>
        <div style={{ fontSize: "12.5px", color: "#4C4A66", textAlign: "center" }}>
          Didn&apos;t get the email?{" "}
          <button
            type="button"
            onClick={onResend}
            disabled={resendDisabled}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              color: resendDisabled ? "#8B89A6" : "#3B2ED3",
              fontWeight: 700,
              fontSize: "12.5px",
              fontFamily: "inherit",
              cursor: resendDisabled ? "not-allowed" : "pointer",
            }}
          >
            {resending
              ? "Sending…"
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend code"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
