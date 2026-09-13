/**
 * Same-origin guard for mutating auth BFF routes.
 * Browser fetch/XHR always send Origin; reject cross-site POSTs.
 */
import { NextRequest } from "next/server";

export function rejectCrossOrigin(request: NextRequest): Response | null {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return null;
  }
  const origin = request.headers.get("origin");
  if (!origin) {
    // Non-browser clients / same-site navigations without Origin — allow.
    // Cross-site form POSTs from other origins always include Origin.
    return null;
  }
  let expected: string;
  try {
    expected = request.nextUrl.origin;
  } catch {
    return null;
  }
  if (origin !== expected) {
    return Response.json(
      { status: "error", message: "Forbidden", data: null },
      { status: 403 },
    );
  }
  return null;
}
