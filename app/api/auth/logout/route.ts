import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/lib/server/cookies";

// The backend has no session/refresh-token revocation endpoint (pure
// stateless JWT) — logging out is purely a matter of dropping our cookies.
// This must always succeed, even if something else about the request state
// is odd, since it's the user's only way out of a broken session.
export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ status: "success", message: "Logged out", data: null });
  clearSessionCookies(res);
  return res;
}
