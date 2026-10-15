import { getMbokaApiBase } from "./env";
import { buildMbokaSignatureHeaders } from "./mbokaSignature";

/** Outbound backend calls must fail closed rather than hold a serverless
 * invocation until the platform kills it. */
/** Aggregator-backed corridors (quotes, IBAN list) often need longer than a
 * tight serverless default — keep fail-closed, but allow sandbox latency. */
export const MBOKA_FETCH_TIMEOUT_MS = 30_000;

/** Direct, unauthenticated call to the backend — for public endpoints only
 * (signup, verify-email, resend-verification, forgot/reset password). Never attaches cookies. */
export async function callMboka(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const body = typeof init.body === "string" ? init.body : null;
  return fetch(`${getMbokaApiBase()}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(MBOKA_FETCH_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      ...(buildMbokaSignatureHeaders(method, path, body) ?? {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

export async function passthroughJson(upstream: Response): Promise<Response> {
  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
