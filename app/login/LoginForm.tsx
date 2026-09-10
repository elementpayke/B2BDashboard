"use client";

import { useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, authMePlaceholderFromLogin } from "@/lib/services/auth";
import { ApiRequestError } from "@/lib/apiClient";
import {
  authPageStyle,
  authCardStyle,
  authTitleStyle,
  authSubtitleStyle,
  authLabelStyle,
  authInputStyle,
  authInputErrorStyle,
  authButtonStateStyle,
  authErrorStyle,
  authLinkStyle,
  authTextButtonStyle,
  authFooterStyle,
  authHintStyle,
  authFieldRowStyle,
  AUTH_MUTED,
} from "@/components/auth/authStyles";
import AuthBrand from "@/components/brand/AuthBrand";

function IconEye({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10.5 10.5 0 0121 12c-.6 1-1.4 2-2.4 2.8M6.1 6.1C4.6 7.3 3.5 8.8 3 12c1.5 4.5 5.4 7 9 7 1.4 0 2.8-.3 4-.9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Only same-origin relative paths; blocks open redirects via `//…` or absolute URLs. */
export function safeNextPath(raw: string | null): string {
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
        <button type="button" style={authButtonStateStyle(true)} disabled>
          Sign in
        </button>
      </div>
    </div>
  );
}

function AuthChrome() {
  return (
    <header>
      <AuthBrand />
      <h1 style={authTitleStyle}>Sign in to your business</h1>
      <p style={authSubtitleStyle}>Access your Mboka dashboard with your work email.</p>
    </header>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const errorId = useId();
  const [email, setEmail] = useState(() => (searchParams.get("email") || "").trim());
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const login = await authApi.login(email, password);
      // Seed shell identity/KYB from login so Home doesn't wait on /me alone,
      // then invalidate so the real `/me` replaces the placeholder promptly.
      queryClient.setQueryData(["auth-me"], authMePlaceholderFromLogin(login, email));
      void queryClient.invalidateQueries({ queryKey: ["auth-me"] });
      const next = safeNextPath(searchParams.get("next"));
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(loginErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = error ? authInputErrorStyle : authInputStyle;

  return (
    <div style={authPageStyle}>
      <form style={authCardStyle} onSubmit={onSubmit} aria-busy={submitting}>
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
            <a href="/forgot-password" style={{ ...authTextButtonStyle, fontSize: "12.5px" }}>
              Forgot password?
            </a>
          </div>
          <div style={{ position: "relative", marginTop: "6px" }}>
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              style={{ ...inputStyle, marginTop: 0, paddingRight: "48px" }}
              placeholder="Enter your password"
              disabled={submitting}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              disabled={submitting}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              style={{
                position: "absolute",
                top: "50%",
                right: "6px",
                transform: "translateY(-50%)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                padding: 0,
                border: "none",
                borderRadius: "10px",
                background: "transparent",
                color: AUTH_MUTED,
                cursor: submitting ? "not-allowed" : "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <IconEye open={showPassword} />
            </button>
          </div>
        </div>

        <button type="submit" style={authButtonStateStyle(submitting)} disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        {submitting ? (
          <p role="status" aria-live="polite" style={authHintStyle}>
            Verifying your credentials…
          </p>
        ) : null}

        <p style={{ ...authFooterStyle, margin: 0 }}>
          Don&apos;t have an account?{" "}
          <a href="/signup" style={authLinkStyle}>
            Sign up
          </a>
        </p>
      </form>
    </div>
  );
}
