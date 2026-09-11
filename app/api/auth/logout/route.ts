import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookies, REFRESH_COOKIE } from "@/lib/server/cookies";
import { callMboka } from "@/lib/server/mbokaCall";
import { getMbokaApiBase } from "@/lib/server/env";

/** Token-bearing outbound calls must not ride cleartext or open redirects. */
export function assertTokenSafeMbokaBase(base: string): void {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new Error("Invalid MBOKA_API_BASE_URL");
  }
  const host = url.hostname.toLowerCase();
  const isLoopback = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (url.protocol === "https:") return;
  if (url.protocol === "http:" && isLoopback) return;
  throw new Error("MBOKA_API_BASE_URL must use https for token-bearing requests");
}

/**
 * Best-effort revoke of the refresh jti on Mboka, then always clear local
 * cookies. Upstream failure must not trap the user in a broken session.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      assertTokenSafeMbokaBase(getMbokaApiBase());
      await callMboka("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
        redirect: "error",
      });
    } catch {
      // Ignore — cookie clear below is the guaranteed local logout.
    }
  }

  const res = NextResponse.json({ status: "success", message: "Logged out", data: null });
  clearSessionCookies(res);
  return res;
}
