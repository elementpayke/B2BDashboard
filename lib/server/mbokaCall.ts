import { getMbokaApiBase } from "./env";

/** Direct, unauthenticated call to the backend — for public endpoints only
 * (signup, verify-email, forgot/reset password). Never attaches cookies. */
export async function callMboka(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${getMbokaApiBase()}${path}`, {
    ...init,
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
