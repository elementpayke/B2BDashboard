/**
 * Same-origin guard for mutating auth BFF routes.
 * Browser fetch/XHR always send Origin; reject cross-site POSTs.
 *
 * Local loopback: browsers often use `http://127.0.0.1:3000` while Next's
 * `request.nextUrl.origin` resolves to `http://localhost:3000` (or the reverse).
 * Treat those as the same origin so login isn't a false 403.
 */
import { NextRequest } from "next/server";

function canonicalizeOrigin(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname === "127.0.0.1" ? "localhost" : url.hostname;
    const port = url.port ? `:${url.port}` : "";
    return `${url.protocol}//${host}${port}`;
  } catch {
    return null;
  }
}

export function originsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const ca = canonicalizeOrigin(a);
  const cb = canonicalizeOrigin(b);
  return ca !== null && cb !== null && ca === cb;
}

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
  if (!originsMatch(origin, expected)) {
    return Response.json(
      { status: "error", message: "Forbidden", data: null },
      { status: 403 },
    );
  }
  return null;
}
