import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/server/cookies";

// Next's Proxy convention (the old `middleware.ts`, renamed in Next 16).
//
// UX-level gate only — redirects an obviously-signed-out browser away from
// /dashboard before it even renders. The real enforcement is server-side:
// every /dashboard data call goes through the `/api/mboka` route handler,
// which forwards to the backend and gets a real 401 if the cookie is
// missing, expired, or invalid in some way this check can't see (it doesn't
// verify the JWT, just checks the cookie is present).
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(ACCESS_COOKIE);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
