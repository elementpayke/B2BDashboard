"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/services/auth";
import { ApiRequestError } from "@/lib/apiClient";
import {
  passwordRequirements,
  passwordsMatch,
  validatePassword,
} from "@/lib/auth/passwordPolicy";
import {
  authPageStyle,
  authCardStyle,
  authLabelStyle,
  authInputStyle,
  authButtonStyle,
  authErrorStyle,
} from "@/components/auth/authStyles";

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requirements = passwordRequirements(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
      await authApi.signup(businessName, email, password);
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Unable to create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={authPageStyle}>
      <form style={authCardStyle} onSubmit={onSubmit}>
        <h1 style={{ margin: 0, fontFamily: "Geist,'Space Grotesk',sans-serif", fontSize: "20px", fontWeight: 800 }}>
          Create your business account
        </h1>

        {error ? <div style={authErrorStyle}>{error}</div> : null}

        <div>
          <label htmlFor="business-name" style={authLabelStyle}>Business name</label>
          <input
            id="business-name"
            required
            minLength={2}
            autoComplete="organization"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            style={authInputStyle}
            placeholder="Acme Ltd"
          />
        </div>
        <div>
          <label htmlFor="email" style={authLabelStyle}>Work email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={authInputStyle}
            placeholder="name@company.com"
          />
        </div>
        <div>
          <label htmlFor="password" style={authLabelStyle}>Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={authInputStyle}
            placeholder="Create a strong password"
          />
          <ul
            style={{
              listStyle: "none",
              margin: "8px 0 0",
              padding: 0,
              display: "grid",
              gap: "4px",
            }}
            aria-live="polite"
          >
            {requirements.map((req) => (
              <li
                key={req.id}
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: req.met ? "#1B7A3D" : "#8B89A6",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span aria-hidden="true">{req.met ? "✓" : "○"}</span>
                {req.label}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <label htmlFor="confirm-password" style={authLabelStyle}>Confirm password</label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={authInputStyle}
            placeholder="Re-enter your password"
          />
        </div>
        <button type="submit" style={authButtonStyle} disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
        <div style={{ fontSize: "12.5px", color: "#4C4A66", textAlign: "center" }}>
          Already have an account? <a href="/login" style={{ color: "#3B2ED3", fontWeight: 700 }}>Sign in</a>
        </div>
      </form>
    </div>
  );
}
