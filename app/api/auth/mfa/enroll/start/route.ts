import { NextRequest, NextResponse } from "next/server";
import { MFA_SETUP_COOKIE } from "@/lib/server/cookies";
import { proxyRequest, proxyWithBearerToken } from "@/lib/server/mbokaProxy";

/**
 * Starts TOTP enrollment. Two callers share this route:
 *  - Mandatory setup (post-login, not yet enrolled): authenticated by the
 *    short-lived MFA setup cookie.
 *  - Voluntary enrollment from settings: authenticated by the normal
 *    session (access/refresh cookies), same as any other proxied route.
 * The response (`secret_base32`, `otpauth_uri`) carries no session tokens,
 * so a plain passthrough is safe here.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const setupToken = request.cookies.get(MFA_SETUP_COOKIE)?.value;
  if (setupToken) {
    return proxyWithBearerToken(request, "/api/auth/mfa/enroll/start", setupToken);
  }
  return proxyRequest(request, "/api/auth/mfa/enroll/start");
}
