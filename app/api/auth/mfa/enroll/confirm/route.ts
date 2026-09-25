import { NextRequest, NextResponse } from "next/server";
import { callMboka } from "@/lib/server/mbokaCall";
import { ACCESS_COOKIE, MFA_SETUP_COOKIE, setSessionCookies, clearMfaCookies } from "@/lib/server/cookies";

type EnrollConfirmData = {
  backup_codes?: string[];
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  kyb_status?: string | null;
  role?: string | null;
  user_id?: number;
  business_id?: number | null;
  wallet_address?: string | null;
  business_name?: string | null;
  permissions?: string[];
};

type Envelope = {
  status: "success" | "error";
  message: string;
  data: EnrollConfirmData | null;
};

/**
 * Confirms TOTP enrollment. Auth mirrors enroll/start: the setup cookie if
 * mid-forced-setup, else the normal access-token cookie for voluntary
 * enrollment via settings.
 *
 * On the setup-token path, the backend also completes the deferred login by
 * returning a real token pair alongside the backup codes — those tokens are
 * cookie-only, same rule as everywhere else in this app. The backup codes
 * themselves are NOT treated like a token: they're meant to be shown to the
 * user exactly once, so returning them in the JSON body here is intentional.
 *
 * Note: unlike the other authenticated MFA routes, the voluntary
 * (access-token) path here does not retry on a 401 via refresh — this is a
 * quick follow-up call to enroll/start, so an access token expiring in that
 * exact window is an edge case. Flagged in the PR as worth confirming against
 * the real backend.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const setupToken = request.cookies.get(MFA_SETUP_COOKIE)?.value ?? null;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const usingSetupToken = !!setupToken;
  const token = setupToken ?? accessToken;

  if (!token) {
    return NextResponse.json(
      { status: "error", message: "Authentication required", data: null },
      { status: 401 },
    );
  }

  const body = await request.text();
  const upstream = await callMboka("/api/auth/mfa/enroll/confirm", {
    method: "POST",
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  let json: Envelope;
  try {
    json = (await upstream.json()) as Envelope;
  } catch {
    return NextResponse.json(
      { status: "error", message: `Upstream returned ${upstream.status}`, data: null },
      { status: upstream.status || 502 },
    );
  }

  if (!upstream.ok || json.status !== "success" || !json.data) {
    return NextResponse.json(json, { status: upstream.status });
  }

  const { access_token, refresh_token, ...rest } = json.data;

  const res = NextResponse.json(
    { status: json.status, message: json.message, data: rest },
    { status: upstream.status },
  );

  if (usingSetupToken && access_token && refresh_token) {
    setSessionCookies(res, { access_token, refresh_token });
    clearMfaCookies(res);
  }

  return res;
}
