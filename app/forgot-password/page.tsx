"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function ForgotPasswordPage() {
  const router = useRouter();
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
      setError(err instanceof ApiRequestError ? err.message : "Unable to request a password reset.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={authPageStyle}>
        <div style={authCardStyle}>
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: "20px", fontWeight: 800 }}>
            Check your inbox
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#4C4A66" }}>
            If an account exists for this email address, we&apos;ve sent a password reset code.
          </p>
          <button
            style={authButtonStyle}
            onClick={() => router.push(`/reset-password?email=${encodeURIComponent(email)}`)}
          >
            Enter reset code
          </button>
          <div style={{ fontSize: "12.5px", color: "#4C4A66", textAlign: "center" }}>
            <a href="/login" style={{ color: "#3B2ED3", fontWeight: 700 }}>Back to sign in</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={authPageStyle}>
      <form style={authCardStyle} onSubmit={onSubmit}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: "20px", fontWeight: 800 }}>
            Reset your password
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#4C4A66" }}>
            Enter your work email and we&apos;ll send you a reset code.
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
            placeholder="name@company.com"
          />
        </div>
        <button type="submit" style={authButtonStyle} disabled={submitting}>
          {submitting ? "Sending…" : "Send reset code"}
        </button>
        <div style={{ fontSize: "12.5px", color: "#4C4A66", textAlign: "center" }}>
          Remember your password? <a href="/login" style={{ color: "#3B2ED3", fontWeight: 700 }}>Sign in</a>
        </div>
      </form>
    </div>
  );
}
