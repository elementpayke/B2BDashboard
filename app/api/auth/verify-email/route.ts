import { NextRequest, NextResponse } from "next/server";
import { callMboka, passthroughJson } from "@/lib/server/mbokaCall";
import { rejectCrossOrigin } from "@/lib/server/sameOrigin";

/**
 * GET: Mboka verification emails historically pointed at this API URL.
 * Redirect into the dashboard verify UI. Credentials go in the URL fragment
 * (not the query string) so they are not logged with the /verify-email request.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const email = (request.nextUrl.searchParams.get("email") || "").trim();
  const code = (request.nextUrl.searchParams.get("code") || "").trim();
  const dest = new URL("/verify-email", request.url);
  if (email || code) {
    const hash = new URLSearchParams();
    if (email) hash.set("email", email);
    if (code) hash.set("code", code);
    dest.hash = hash.toString();
  }
  return NextResponse.redirect(dest);
}

export async function POST(request: NextRequest): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const body = await request.text();
  const upstream = await callMboka("/api/auth/verify-email", { method: "POST", body });
  return passthroughJson(upstream);
}
