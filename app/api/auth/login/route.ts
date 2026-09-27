import { NextRequest, NextResponse } from "next/server";
import { callMboka } from "@/lib/server/mbokaCall";
import {
  setSessionCookies,
  setMfaChallengeCookie,
  setMfaSetupCookie,
} from "@/lib/server/cookies";
import { rejectCrossOrigin } from "@/lib/server/sameOrigin";

type MfaState = { status: "required" | "setup_required" } | null;

type LoginBusinessData = {
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
  // Present only on the two "deferred login" shapes below — never alongside
  // access_token/refresh_token.
  mfa_challenge_token?: string;
  mfa_setup_token?: string;
  mfa?: MfaState;
};

type Envelope = {
  status: "success" | "error";
  message: string;
  data: LoginBusinessData | null;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked as NextResponse;

  const body = await request.text();
  const upstream = await callMboka("/api/auth/businesses/login", {
    method: "POST",
    body,
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

  const data = json.data;

  // Challenge required: account already has 2FA enrolled. No access/refresh
  // tokens exist yet — only a short-lived challenge token, which must never
  // reach the response body (same rule as the real tokens below).
  if (data.mfa?.status === "required" && data.mfa_challenge_token) {
    const res = NextResponse.json(
      { status: json.status, message: json.message, data: { mfa: { status: "required" } } },
      { status: upstream.status },
    );
    setMfaChallengeCookie(res, data.mfa_challenge_token);
    return res;
  }

  // Setup required: 2FA is mandatory per the cutover policy but this account
  // hasn't enrolled yet. Same rule — the setup token is cookie-only.
  if (data.mfa?.status === "setup_required" && data.mfa_setup_token) {
    const res = NextResponse.json(
      {
        status: json.status,
        message: json.message,
        data: { mfa: { status: "setup_required" } },
      },
      { status: upstream.status },
    );
    setMfaSetupCookie(res, data.mfa_setup_token);
    return res;
  }

  // Normal login. Strip every token-shaped field before it can reach the
  // response body — access/refresh tokens live in cookies only.
  const { access_token, refresh_token, mfa_challenge_token, mfa_setup_token, mfa, ...rest } = data;

  if (!access_token || !refresh_token) {
    return NextResponse.json(
      { status: "error", message: "Malformed login response from upstream", data: null },
      { status: 502 },
    );
  }

  const res = NextResponse.json(
    { status: json.status, message: json.message, data: rest },
    { status: upstream.status },
  );
  setSessionCookies(res, { access_token, refresh_token });
  return res;
}
