import { NextRequest, NextResponse } from "next/server";
import { callMboka } from "@/lib/server/mbokaCall";
import { MFA_CHALLENGE_COOKIE, setSessionCookies, clearMfaCookies } from "@/lib/server/cookies";

function isTimeoutError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    ((err as { name: string }).name === "TimeoutError" ||
      (err as { name: string }).name === "AbortError")
  );
}

type VerifyData = {
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
  data: VerifyData | null;
};

/**
 * Completes login after a "challenge required" response — body is
 * `{ code }` (accepts a TOTP or a backup code). Auth is the short-lived
 * challenge cookie set by /api/auth/login, never a client-supplied header.
 * On success, sets the real session cookies and clears the challenge
 * cookie; the token pair never reaches the response body.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const challengeToken = request.cookies.get(MFA_CHALLENGE_COOKIE)?.value;
  if (!challengeToken) {
    return NextResponse.json(
      { status: "error", message: "MFA challenge expired. Please log in again.", data: null },
      { status: 401 },
    );
  }

  const body = await request.text();
  let upstream: Response;
  try {
    upstream = await callMboka("/api/auth/mfa/verify", {
      method: "POST",
      body,
      headers: { Authorization: `Bearer ${challengeToken}` },
    });
  } catch (err) {
    const timedOut = isTimeoutError(err);
    return NextResponse.json(
      {
        status: "error",
        message: timedOut
          ? "The request took too long. Please try again."
          : "Unable to verify the code right now.",
        data: null,
      },
      { status: timedOut ? 504 : 502 },
    );
  }

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

  if (!access_token || !refresh_token) {
    return NextResponse.json(
      { status: "error", message: "Malformed verify response from upstream", data: null },
      { status: 502 },
    );
  }

  const res = NextResponse.json(
    { status: json.status, message: json.message, data: rest },
    { status: upstream.status },
  );
  setSessionCookies(res, { access_token, refresh_token });
  clearMfaCookies(res);
  return res;
}
