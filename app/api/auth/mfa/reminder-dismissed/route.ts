import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/server/mbokaProxy";

/** Empty body. Normal authenticated-session proxy, same pattern as any
 * other Mboka-backed route. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyRequest(request, "/api/auth/mfa/reminder-dismissed");
}
