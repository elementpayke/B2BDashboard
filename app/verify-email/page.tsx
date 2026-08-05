"use client";

import { useState, Suspense } from "react";
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

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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

  if (done) {
    return (
      <div style={authPageStyle}>
        <div style={authCardStyle}>
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: "20px", fontWeight: 800 }}>
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

  return (
    <div style={authPageStyle}>
      <form style={authCardStyle} onSubmit={onSubmit}>
        <h1 style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: "20px", fontWeight: 800 }}>
          Verify your email
        </h1>
        <p style={{ margin: 0, fontSize: "13px", color: "#4C4A66" }}>
          Enter the verification code we sent to your email.
        </p>

        {error ? <div style={authErrorStyle}>{error}</div> : null}

        <div>
          <span style={authLabelStyle}>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={authInputStyle}
          />
        </div>
        <div>
          <span style={authLabelStyle}>Verification code</span>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={authInputStyle}
            placeholder="123456"
          />
        </div>
        <button type="submit" style={authButtonStyle} disabled={submitting}>
          {submitting ? "Verifying…" : "Verify"}
        </button>
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
