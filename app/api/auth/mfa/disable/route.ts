import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/server/cookies";
import { proxyWithBearerToken } from "@/lib/server/mbokaProxy";

/**
 * Body: `{ password, code }`. Deliberately NOT the generic `proxyRequest` —
 * a wrong password/code here is a fully-formed 401 from this endpoint's own
 * business logic (`UnauthorizedError("Invalid credentials.")`), and it's a
 * bare `{status:"error","data":null}` envelope, structurally identical to a
 * session-expiry 401. `proxyRequest`'s refresh-and-clear-session heuristic
 * can't tell the two apart, so a wrong password on this form was refreshing
 * the token, retrying, failing again the same way, and clearing the user's
 * session cookies — logging them out of the whole dashboard instead of
 * showing an inline "wrong password" error. Forwarding with the current
 * access-token cookie directly sidesteps that: any 401 just passes through.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? "";
  return proxyWithBearerToken(request, "/api/auth/mfa/disable", accessToken);
}
