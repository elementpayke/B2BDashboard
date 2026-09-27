"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import TotpEnrollment from "@/components/auth/TotpEnrollment";
import AuthBrand from "@/components/brand/AuthBrand";
import { authPageStyle, authTitleStyle, authSubtitleStyle } from "@/components/auth/authStyles";

/**
 * Mandatory enrollment landing page — reached after a login response with
 * `mfa.status === "setup_required"` (2FA required per the cutover policy,
 * account not yet enrolled). No skip path: the MFA setup cookie set by
 * /api/auth/login is the only credential available here, and it only
 * unlocks enroll/start + enroll/confirm — there is no session yet, so
 * nothing else in the dashboard is reachable until this completes.
 */
export default function MfaSetupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  function onComplete() {
    // enroll/confirm already set real session cookies server-side (the
    // setup token completed the deferred login). Drop any stale auth-me
    // cache and let the dashboard shell fetch fresh.
    queryClient.removeQueries({ queryKey: ["auth-me"] });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div style={authPageStyle}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
        <header style={{ textAlign: "center" }}>
          <AuthBrand />
          <h1 style={authTitleStyle}>Two-factor authentication required</h1>
          <p style={authSubtitleStyle}>
            Your organization requires two-factor authentication on all accounts. Finish setup
            below to continue to your dashboard.
          </p>
        </header>
        <TotpEnrollment onComplete={onComplete} />
      </div>
    </div>
  );
}
