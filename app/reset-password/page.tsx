"use client";

import { Suspense, useEffect, useState } from "react";
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
} from "@/components/auth/authStyles";
import {
  clearResetHandoff,
  readResetHandoff,
  takeQueryResetParams,
} from "@/lib/auth/resetHandoff";
import { passwordsMatch, validatePassword } from "@/lib/auth/passwordPolicy";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reset, setReset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  // Prefer sessionStorage handoff. If Mboka email links still arrive with
  // ?email=&code=, migrate into sessionStorage and strip the query immediately
  // so credentials do not linger in history / Referer.
  useEffect(() => {
    const fromQuery = takeQueryResetParams(searchParams);
    if (fromQuery.stripped) {
      router.replace("/reset-password");
    }
    const handoff = readResetHandoff();
    setEmail(fromQuery.email || handoff.email);
    setToken(fromQuery.code || handoff.code);
    setReady(true);
  }, [router, searchParams]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const policyError = validatePassword(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    const matchError = passwordsMatch(password, confirmPassword);
    if (matchError) {
      setError(matchError);
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword(email, token, password);
      clearResetHandoff();
      setReset(true);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Unable to reset your password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return null;
  }

  if (reset) {
    return (
      <div style={authPageStyle}>
        <div style={authCardStyle}>
          <h1 style={{ margin: 0, fontFamily: "'Geist',sans-serif", fontSize: "20px", fontWeight: 800 }}>
            Password reset
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#4C4A66" }}>
            Your password has been updated. You can now sign in with your new password.
          </p>
          <button style={authButtonStyle} onClick={() => router.push("/login")}>
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={authPageStyle}>
      <form style={authCardStyle} onSubmit={onSubmit}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "'Geist',sans-serif", fontSize: "20px", fontWeight: 800 }}>
            Choose a new password
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#4C4A66" }}>
            Use the reset code from your email to set a new password.
          </p>
        </div>

        {error ? <div style={authErrorStyle}>{error}</div> : null}

        <div>
          <label htmlFor="email" style={authLabelStyle}>Work email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            style={authInputStyle}
          />
        </div>
        <div>
          <label htmlFor="reset-code" style={authLabelStyle}>Reset code</label>
          <input
            id="reset-code"
            required
            autoComplete="one-time-code"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            style={authInputStyle}
            placeholder="12345678"
          />
        </div>
        <div>
          <label htmlFor="new-password" style={authLabelStyle}>New password</label>
          <input
            id="new-password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={authInputStyle}
            placeholder="At least 12 characters"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" style={authLabelStyle}>Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            style={authInputStyle}
            placeholder="Repeat your new password"
          />
        </div>
        <button type="submit" style={authButtonStyle} disabled={submitting}>
          {submitting ? "Resetting…" : "Reset password"}
        </button>
        <div style={{ fontSize: "12.5px", color: "#4C4A66", textAlign: "center" }}>
          <a href="/login" style={{ color: "#3B2ED3", fontWeight: 700 }}>Back to sign in</a>
        </div>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
