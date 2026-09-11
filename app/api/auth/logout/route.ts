import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookies, REFRESH_COOKIE } from "@/lib/server/cookies";
import { callMboka } from "@/lib/server/mbokaCall";

/**
 * Best-effort revoke of the refresh jti on Mboka, then always clear local
 * cookies. Upstream failure must not trap the user in a broken session.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      await callMboka("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Ignore — cookie clear below is the guaranteed local logout.
    }
  }

  const res = NextResponse.json({ status: "success", message: "Logged out", data: null });
  clearSessionCookies(res);
  return res;
}
