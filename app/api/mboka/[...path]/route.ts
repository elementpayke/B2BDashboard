import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/server/mbokaProxy";

// Server-to-server routes (HMAC-signature verified by the backend, not
// JWT-authenticated) must never be reachable through this user-facing,
// cookie-authenticated proxy.
const BLOCKED_PREFIXES = ["webhooks"];

function backendPathWithQuery(request: NextRequest, path: string[]): string | null {
  if (path.some((segment) => BLOCKED_PREFIXES.includes(segment))) {
    return null;
  }
  const search = request.nextUrl.search;
  return `/api/${path.join("/")}${search}`;
}

async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await params;
  const target = backendPathWithQuery(request, path);
  if (!target) {
    return NextResponse.json(
      { status: "error", message: "Not found", data: null },
      { status: 404 },
    );
  }
  return proxyRequest(request, target);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
