import { NextRequest, NextResponse } from "next/server";
import { callMboka, passthroughJson } from "@/lib/server/mbokaCall";
import { rejectCrossOrigin } from "@/lib/server/sameOrigin";

/**
 * GET: Mboka verification emails historically pointed at this API URL.
 * Redirect into the dashboard verify UI so the link completes in-browser.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const email = (request.nextUrl.searchParams.get("email") || "").trim();
  const code = (request.nextUrl.searchParams.get("code") || "").trim();
  const dest = new URL("/verify-email", request.url);
  if (email) dest.searchParams.set("email", email);
  if (code) dest.searchParams.set("code", code);
  return NextResponse.redirect(dest);
}

export async function POST(request: NextRequest): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const body = await request.text();
  const upstream = await callMboka("/api/auth/verify-email", { method: "POST", body });
  return passthroughJson(upstream);
}
