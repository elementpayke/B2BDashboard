"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/services/auth";
import { ApiRequestError } from "@/lib/apiClient";
import {
  authPageStyle,
  authCardStyle,
  authBrandRowStyle,
  authBrandMarkStyle,
  authTitleStyle,
  authSubtitleStyle,
  authLabelStyle,
  authInputStyle,
  authInputInvalidStyle,
  authButtonStyle,
  authButtonDisabledStyle,
  authErrorStyle,
  authSuccessStyle,
  authLinkHitStyle,
  authFooterStyle,
  authHintStyle,
  authFieldRowStyle,
} from "@/components/auth/authStyles";
import { stashResetEmail } from "@/lib/auth/resetHandoff";

function forgotPasswordErrorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return "The request took too long. Please try again.";
  }
  if (err instanceof TypeError) {
    return "Unable to reach the server. Check your connection and try again.";
  }
  return "Unable to request a password reset. Please try again.";
}

function AuthBrand() {
  return (
    <div style={authBrandRowStyle}>
      <span style={authBrandMarkStyle} aria-hidden>
        E
      </span>
      ElementPay
    </div>
  );
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(forgotPasswordErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={authPageStyle}>
        <div style={authCardStyle} role="status" aria-live="polite">
          <AuthBrand />
          <header>
            <h1 style={authTitleStyle}>Check your inbox</h1>
            <p style={authSubtitleStyle}>
              If an account exists for{" "}
              <span style={{ color: "#131126", fontWeight: 700 }}>{email.trim() || "this email"}</span>
              , we&apos;ve sent a password reset code. It may take a minute to arrive.
            </p>
          </header>

          <div style={authSuccessStyle}>
            Use the code from your email on the next screen. The code expires for your security.
          </div>

          <button
            type="button"
            style={authButtonStyle}
            onClick={() => {
              stashResetEmail(email);
              router.push("/reset-password");
            }}
          >
            Enter reset code
          </button>

          <p style={{ ...authFooterStyle, margin: 0 }}>
            <a href="/login" style={authLinkHitStyle}>
              Back to sign in
            </a>
          </p>
        </div>
      </div>
    );
  }

  const inputStyle = error
    ? { ...authInputStyle, ...authInputInvalidStyle }
    : authInputStyle;
  const submitStyle = submitting
    ? { ...authButtonStyle, ...authButtonDisabledStyle }
    : authButtonStyle;

  return (
    <div style={authPageStyle}>
      <form style={authCardStyle} onSubmit={onSubmit} aria-busy={submitting}>
        <header>
          <AuthBrand />
          <h1 style={authTitleStyle}>Reset your password</h1>
          <p style={authSubtitleStyle}>
            Enter your work email and we&apos;ll send a one-time reset code.
          </p>
        </header>

        {error ? (
          <div id={errorId} role="alert" style={authErrorStyle}>
            {error}
          </div>
        ) : null}

        <div style={authFieldRowStyle}>
          <label htmlFor="forgot-email" style={authLabelStyle}>
            Work email
          </label>
          <input
            id="forgot-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(null);
            }}
            style={inputStyle}
            placeholder="name@company.com"
            disabled={submitting}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>

        <button type="submit" style={submitStyle} disabled={submitting}>
          {submitting ? "Sending…" : "Send reset code"}
        </button>

        {submitting ? (
          <p role="status" aria-live="polite" style={authHintStyle}>
            This can take a few seconds…
          </p>
        ) : (
          <p style={authHintStyle}>We&apos;ll only send a code if an account matches this email.</p>
        )}

        <p style={{ ...authFooterStyle, margin: 0 }}>
          Remember your password?{" "}
          <a href="/login" style={authLinkHitStyle}>
            Sign in
          </a>
        </p>
      </form>
    </div>
  );
}
