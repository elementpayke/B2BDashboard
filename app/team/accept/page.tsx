"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiRequestError, isSessionExpiredError } from "@/lib/apiClient";
import { authApi } from "@/lib/services/auth";
import { teamApi } from "@/lib/services/team";
import {
  authButtonStyle,
  authCardStyle,
  authErrorStyle,
  authPageStyle,
  authSuccessStyle,
} from "@/components/auth/authStyles";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") || "").trim();

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ businessId: number; role: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token || token.length < 16) {
        setError("This invite link is missing a valid token.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await authApi.me();
        const result = await teamApi.acceptInvite(token);
        if (!cancelled) {
          setDone({ businessId: result.business_id, role: result.role });
        }
      } catch (err) {
        if (cancelled) return;
        if (isSessionExpiredError(err)) {
          setNeedsLogin(true);
          setError(
            "Sign in with the invited email (use the temporary password from your invite email if this is your first login), then open this link again.",
          );
        } else if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError("Could not accept this invite.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (done) {
    return (
      <div style={authPageStyle}>
        <div style={authCardStyle}>
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: "20px", fontWeight: 800 }}>
            Invite accepted
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#4C4A66", ...authSuccessStyle }}>
            You joined business #{done.businessId} as {done.role}.
          </p>
          <button style={authButtonStyle} type="button" onClick={() => router.push("/dashboard")}>
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={authPageStyle}>
      <div style={authCardStyle}>
        <h1 style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: "20px", fontWeight: 800 }}>
          Accept team invite
        </h1>
        {busy ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#4C4A66" }}>Confirming your invite…</p>
        ) : null}
        {error ? <p style={authErrorStyle}>{error}</p> : null}
        {needsLogin ? (
          <button
            style={authButtonStyle}
            type="button"
            onClick={() =>
              router.push(`/login?next=${encodeURIComponent(`/team/accept?token=${token}`)}`)
            }
          >
            Sign in to continue
          </button>
        ) : null}
        {!busy && !needsLogin && error ? (
          <button style={authButtonStyle} type="button" onClick={() => router.push("/dashboard")}>
            Back to dashboard
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function TeamAcceptPage() {
  return (
    <Suspense
      fallback={
        <div style={authPageStyle}>
          <div style={authCardStyle}>
            <p style={{ margin: 0, fontSize: "13px", color: "#4C4A66" }}>Loading invite…</p>
          </div>
        </div>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
