import type { NextRequest } from "next/server";
import { getMbokaApiBase } from "./env";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./cookies";
import { refreshTokens, isDownstreamAuthFailure } from "./mbokaProxy";
import { MBOKA_FETCH_TIMEOUT_MS } from "./mbokaCall";

type MbokaEnvelope<T> = {
  status?: "success" | "error";
  message?: string;
  data?: T | null;
};

export type MbokaAuthedFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; sessionExpired: boolean };

async function fetchWithToken(
  backendPathWithQuery: string,
  accessToken: string | null,
): Promise<Response> {
  const headers = new Headers({ Accept: "application/json" });
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return fetch(`${getMbokaApiBase()}${backendPathWithQuery}`, {
    method: "GET",
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(MBOKA_FETCH_TIMEOUT_MS),
  });
}

/**
 * Cookie-authenticated GET to Mboka for server routes (SSE watch stream).
 * Refreshes once on a session 401, mirroring lib/server/mbokaProxy.ts.
 */
export async function fetchMbokaAuthedJson<T>(
  request: NextRequest,
  backendPathWithQuery: string,
): Promise<MbokaAuthedFetchResult<T>> {
  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value ?? null;

  let upstream = await fetchWithToken(backendPathWithQuery, accessToken);
  let body = upstream.status === 401 ? await upstream.arrayBuffer() : null;

  if (
    upstream.status === 401 &&
    body !== null &&
    !isDownstreamAuthFailure(body) &&
    refreshToken
  ) {
    const refreshed = await refreshTokens(refreshToken);
    if (refreshed) {
      accessToken = refreshed.access_token;
      upstream = await fetchWithToken(backendPathWithQuery, accessToken);
      body = upstream.status === 401 ? await upstream.arrayBuffer() : null;
    }
  }

  if (!upstream.ok) {
    const message =
      body !== null
        ? parseEnvelopeMessage(body) ?? upstream.statusText
        : upstream.statusText;
    const sessionExpired =
      upstream.status === 401 &&
      (body === null || !isDownstreamAuthFailure(body));
    return { ok: false, status: upstream.status, message, sessionExpired };
  }

  const json = (await upstream.json()) as MbokaEnvelope<T>;
  if (json.status !== "success" || json.data == null) {
    return {
      ok: false,
      status: upstream.status,
      message: json.message ?? "Upstream request failed",
      sessionExpired: false,
    };
  }
  return { ok: true, data: json.data };
}

function parseEnvelopeMessage(body: ArrayBuffer): string | null {
  try {
    const json = JSON.parse(new TextDecoder().decode(body)) as MbokaEnvelope<unknown>;
    return typeof json.message === "string" ? json.message : null;
  } catch {
    return null;
  }
}
