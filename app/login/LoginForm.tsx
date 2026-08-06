"use client";

import { useState } from "react";
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

/** Only same-origin relative paths; blocks open redirects via `//…` or absolute URLs. */
function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

export function LoginFormFallback() {
  return (
    <div style={authPageStyle}>
      <div style={authCardStyle}>
        <AuthChrome />
        <div>
          <span style={authLabelStyle}>Email</span>
          <div style={{ ...authInputStyle, opacity: 0.55 }} aria-hidden />
        </div>
        <div>
          <span style={authLabelStyle}>Password</span>
          <div style={{ ...authInputStyle, opacity: 0.55 }} aria-hidden />
        </div>
        <button type="button" style={{ ...authButtonStyle, opacity: 0.7 }} disabled>
          Sign in
        </button>
      </div>
    </div>
  );
}

function AuthChrome() {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontFamily: "'Space Grotesk',sans-serif",
          fontWeight: 700,
          fontSize: "16px",
          marginBottom: "6px",
        }}
      >
        <span
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "10px",
            background: "#3B2ED3",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'DM Mono',monospace",
            fontSize: "14px",
          }}
        >
          E
        </span>
        ElementPay
      </div>
      <h1 style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: "20px", fontWeight: 800 }}>
        Sign in to your business
      </h1>
    </div>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authApi.login(email, password);
      const next = safeNextPath(searchParams.get("next"));
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={authPageStyle}>
      <form style={authCardStyle} onSubmit={onSubmit}>
        <AuthChrome />

        {error ? <div style={authErrorStyle}>{error}</div> : null}

        <div>
          <span style={authLabelStyle}>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={authInputStyle}
            placeholder="name@company.com"
          />
        </div>
        <div>
          <span style={authLabelStyle}>Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={authInputStyle}
            placeholder="••••••••••••"
          />
        </div>
        <div style={{ fontSize: "12.5px", textAlign: "right", marginTop: "-8px" }}>
          <a href="/forgot-password" style={{ color: "#3B2ED3", fontWeight: 700 }}>Forgot password?</a>
        </div>
        <button type="submit" style={authButtonStyle} disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <div style={{ fontSize: "12.5px", color: "#4C4A66", textAlign: "center" }}>
          Don&apos;t have an account? <a href="/signup" style={{ color: "#3B2ED3", fontWeight: 700 }}>Sign up</a>
        </div>
      </form>
    </div>
  );
}
