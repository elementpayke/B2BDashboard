import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/server/mbokaProxy";

/** Body: `{ password, code }`. Normal authenticated-session proxy — same
 * pattern (and refresh-on-401 behavior) as any other Mboka-backed route. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyRequest(request, "/api/auth/mfa/disable");
}
