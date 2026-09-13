"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/lib/services/auth";
import { ApiRequestError } from "@/lib/apiClient";
import {
  clearVerifyHandoff,
  readVerifyHandoff,
  stashVerifyEmail,
  takeHashVerifyParams,
  takeQueryVerifyParams,
} from "@/lib/auth/verifyHandoff";
import {
  authPageStyle,
  authCardStyle,
  authLabelStyle,
  authInputStyle,
  authButtonStyle,
  authErrorStyle,
  authSuccessStyle,
} from "@/components/auth/authStyles";
import AuthBrand from "@/components/brand/AuthBrand";

/** Matches backend EMAIL_VERIFICATION_COOLDOWN_SECONDS (default 60s). */
const RESEND_COOLDOWN_SECONDS = 60;

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoTried = useRef(false);
  const handoff = readVerifyHandoff();
  const [email, setEmail] = useState(handoff.email);
  const [code, setCode] = useState(handoff.code);
  const [handoffReady, setHandoffReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    // Prefer fragment handoff (BFF GET redirect); fall back to legacy query.
    const fromHash = takeHashVerifyParams();
    const fromQuery = takeQueryVerifyParams(searchParams);

    let nextEmail = "";
    let nextCode = "";
    if (fromHash.stripped) {
      nextEmail = fromHash.email;
      nextCode = fromHash.code;
    } else if (fromQuery.stripped) {
      nextEmail = fromQuery.email;
      nextCode = fromQuery.code;
    } else {
      nextEmail = fromQuery.email || fromHash.email;
      nextCode = fromQuery.code || fromHash.code;
    }

    if (fromHash.stripped || fromQuery.stripped) {
      if (nextEmail) setEmail(nextEmail);
      setCode(nextCode);
    } else {
      if (nextEmail) setEmail(nextEmail);
      if (nextCode) setCode(nextCode);
    }
    if (fromQuery.stripped) {
      router.replace("/verify-email", { scroll: false });
    }
    setHandoffReady(true);
  }, [searchParams, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function verify(nextEmail: string, nextCode: string) {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await authApi.verifyEmail(nextEmail.trim(), nextCode.trim());
      clearVerifyHandoff();
      stashVerifyEmail(nextEmail.trim());
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Verification failed.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    // Wait until query/hash import runs so a new deep link is not overwritten
    // by a one-shot auto-verify of stale sessionStorage values.
    if (!handoffReady || autoTried.current) return;
    const e = email.trim();
    const c = code.trim();
    if (!e || !c) return;
    autoTried.current = true;
    void verify(e, c);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep-link verify
  }, [handoffReady, email, code]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await verify(email, code);
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
      setInfo(
        "If an account needs verification for that email, a code was sent. Check inbox and spam.",
      );
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Unable to resend the code.");
    } finally {
      setResending(false);
    }
  }

  if (done) {
    const loginHref = email.trim()
      ? `/login?email=${encodeURIComponent(email.trim())}`
      : "/login";
    return (
      <div style={authPageStyle}>
        <div style={authCardStyle}>
          <AuthBrand />
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: "20px", fontWeight: 800 }}>
            Email verified
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#4C4A66" }}>You can now sign in.</p>
          <button style={authButtonStyle} onClick={() => router.push(loginHref)}>
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
        <AuthBrand />
        <div>
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: "20px", fontWeight: 800 }}>
            Verify your email
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#4C4A66" }}>
            Enter the verification code from your inbox. If you don&apos;t see it, use Resend below.
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

function VerifyFallback() {
  return (
    <div style={authPageStyle}>
      <div style={authCardStyle} aria-busy="true" aria-label="Loading verification">
        <AuthBrand />
        <p style={{ margin: 0, fontSize: "13px", color: "#4C4A66" }}>Loading…</p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyEmailForm />
    </Suspense>
  );
}
