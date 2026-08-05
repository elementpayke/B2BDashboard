import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/server/mbokaProxy";

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyRequest(request, "/api/auth/me");
}
