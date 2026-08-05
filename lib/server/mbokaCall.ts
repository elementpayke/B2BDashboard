import { getMbokaApiBase } from "./env";

/** Outbound backend calls must fail closed rather than hold a serverless
 * invocation until the platform kills it. */
export const MBOKA_FETCH_TIMEOUT_MS = 15_000;

/** Direct, unauthenticated call to the backend — for public endpoints only
 * (signup, verify-email, forgot/reset password). Never attaches cookies. */
export async function callMboka(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${getMbokaApiBase()}${path}`, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(MBOKA_FETCH_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
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
