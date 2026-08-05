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

export default function SignupPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
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
        <h1 style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: "20px", fontWeight: 800 }}>
          Create your business account
        </h1>

        {error ? <div style={authErrorStyle}>{error}</div> : null}

        <div>
          <span style={authLabelStyle}>Business name</span>
          <input
            required
            minLength={2}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            style={authInputStyle}
            placeholder="Acme Ltd"
          />
        </div>
        <div>
          <span style={authLabelStyle}>Work email</span>
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
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={authInputStyle}
            placeholder="At least 12 characters"
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
