"use client";

import { useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  authLinkHitStyle,
  authFooterStyle,
  authHintStyle,
  authFieldRowStyle,
} from "@/components/auth/authStyles";

/** Only same-origin relative paths; blocks open redirects via `//…` or absolute URLs. */
function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
    return "The request took too long. Please try again.";
  }
  if (err instanceof TypeError) {
    return "Unable to reach the server. Check your connection and try again.";
  }
  return "Unable to sign in. Check your email and password, then try again.";
}

export function LoginFormFallback() {
  return (
    <div style={authPageStyle}>
      <div style={authCardStyle} aria-busy="true" aria-label="Loading sign in">
        <AuthChrome />
        <div style={authFieldRowStyle}>
          <span style={authLabelStyle}>Work email</span>
          <div style={{ ...authInputStyle, opacity: 0.55 }} aria-hidden />
        </div>
        <div style={authFieldRowStyle}>
          <span style={authLabelStyle}>Password</span>
          <div style={{ ...authInputStyle, opacity: 0.55 }} aria-hidden />
        </div>
        <button type="button" style={{ ...authButtonStyle, ...authButtonDisabledStyle }} disabled>
          Sign in
        </button>
      </div>
    </div>
  );
}

function AuthChrome() {
  return (
    <header>
      <div style={authBrandRowStyle}>
        <span style={authBrandMarkStyle} aria-hidden>
          E
        </span>
        ElementPay
      </div>
      <h1 style={authTitleStyle}>Sign in to your business</h1>
      <p style={authSubtitleStyle}>Access your ElementPay dashboard with your work email.</p>
    </header>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorId = useId();
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
      setError(loginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = error
    ? { ...authInputStyle, ...authInputInvalidStyle }
    : authInputStyle;
  const submitStyle = submitting
    ? { ...authButtonStyle, ...authButtonDisabledStyle }
    : authButtonStyle;

  return (
    <div style={authPageStyle}>
      <form
        style={authCardStyle}
        onSubmit={onSubmit}
        noValidate={false}
        aria-busy={submitting}
      >
        <AuthChrome />

        {error ? (
          <div id={errorId} role="alert" style={authErrorStyle}>
            {error}
          </div>
        ) : null}

        <div style={authFieldRowStyle}>
          <label htmlFor="login-email" style={authLabelStyle}>
            Work email
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            style={inputStyle}
            placeholder="name@company.com"
            disabled={submitting}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>

        <div style={authFieldRowStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <label htmlFor="login-password" style={{ ...authLabelStyle, margin: 0 }}>
              Password
            </label>
            <a href="/forgot-password" style={{ ...authLinkHitStyle, minHeight: "auto", padding: "4px 0", fontSize: "12.5px" }}>
              Forgot password?
            </a>
          </div>
          <input
            id="login-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            style={inputStyle}
            placeholder="Enter your password"
            disabled={submitting}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>

        <button type="submit" style={submitStyle} disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        {submitting ? (
          <p role="status" aria-live="polite" style={authHintStyle}>
            Verifying your credentials…
          </p>
        ) : null}

        <p style={{ ...authFooterStyle, margin: 0 }}>
          Don&apos;t have an account?{" "}
          <a href="/signup" style={authLinkHitStyle}>
            Sign up
          </a>
        </p>
      </form>
    </div>
  );
}
