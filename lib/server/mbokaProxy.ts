import { NextRequest, NextResponse } from "next/server";
import { getMbokaApiBase } from "./env";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  setSessionCookies,
} from "./cookies";
import { MBOKA_FETCH_TIMEOUT_MS } from "./mbokaCall";

// Headers a client could use to try to impersonate a different session or
// bypass our cookie-derived auth. Stripped from every proxied request —
// the only source of truth for "who is calling" is the httpOnly cookie.
const STRIPPED_REQUEST_HEADERS = new Set([
  "authorization",
  "x-api-key",
  "cookie",
  "host",
  "content-length",
  "connection",
]);

// Never forward these from upstream: fetch may decompress the body while
// leaving a compressed content-length, and backend Set-Cookie must not leak
// onto the app origin (we manage session cookies ourselves).
const STRIPPED_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "transfer-encoding",
  "connection",
  "content-length",
  "set-cookie",
]);

function buildForwardHeaders(request: NextRequest, accessToken: string | null): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return headers;
}

export type RefreshResult = { access_token: string; refresh_token: string } | null;

export async function refreshTokens(refreshToken: string): Promise<RefreshResult> {
  try {
    const res = await fetch(`${getMbokaApiBase()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(MBOKA_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      status?: string;
      data?: { access_token?: string; refresh_token?: string };
    };
    const access = json.data?.access_token;
    const refresh = json.data?.refresh_token;
    if (!access || !refresh) return null;
    return { access_token: access, refresh_token: refresh };
  } catch {
    return null;
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function doFetch(
  request: NextRequest,
  backendPathWithQuery: string,
  accessToken: string | null,
  bodyBuffer: ArrayBuffer | null,
): Promise<Response> {
  const headers = buildForwardHeaders(request, accessToken);
  // `redirect: "manual"` + a single hand-rolled follow, rather than fetch's
  // default auto-follow: undici detaches the ArrayBuffer body while
  // retrying a redirected POST/PUT/PATCH internally, so a second automatic
  // attempt throws "Cannot perform ArrayBuffer.prototype.slice on a
  // detached ArrayBuffer". Re-issuing ourselves with a fresh slice avoids
  // it. This also transparently absorbs the backend's own
  // trailing-slash redirects (e.g. FastAPI's `/api-keys` -> `/api-keys/`),
  // which Next.js's own path normalization would otherwise strip before
  // our handler ever sees it.
  const first = await fetch(`${getMbokaApiBase()}${backendPathWithQuery}`, {
    method: request.method,
    headers,
    body: bodyBuffer,
    redirect: "manual",
    signal: AbortSignal.timeout(MBOKA_FETCH_TIMEOUT_MS),
  });
  if (!REDIRECT_STATUSES.has(first.status)) {
    return first;
  }
  const location = first.headers.get("location");
  if (!location) {
    return first;
  }
  const redirectUrl = new URL(location, getMbokaApiBase());
  return fetch(redirectUrl, {
    method: request.method,
    headers,
    body: bodyBuffer ? bodyBuffer.slice(0) : null,
    signal: AbortSignal.timeout(MBOKA_FETCH_TIMEOUT_MS),
  });
}

/**
 * Proxies an incoming Next.js request to the Mboka backend, injecting the
 * Authorization header from the httpOnly access-token cookie (never from
 * anything the client sent), and transparently refreshing+retrying once on
 * a 401 before giving up.
 */
export async function proxyRequest(
  request: NextRequest,
  backendPathWithQuery: string,
): Promise<NextResponse> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value ?? null;

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const bodyBuffer = hasBody ? await request.arrayBuffer() : null;

  let upstream = await doFetch(request, backendPathWithQuery, accessToken, bodyBuffer);

  // Refresh whenever a refresh cookie is present — including the common case
  // where the shorter-lived access cookie has already expired and the browser
  // stopped sending it.
  if (upstream.status === 401 && refreshToken) {
    const refreshed = await refreshTokens(refreshToken);
    if (!refreshed) {
      const res = await toNextResponse(upstream);
      clearSessionCookies(res);
      return res;
    }
    upstream = await doFetch(request, backendPathWithQuery, refreshed.access_token, bodyBuffer);
    const res = await toNextResponse(upstream);
    if (upstream.status === 401) {
      // Refresh reported success but the new token still isn't accepted —
      // treat the session as broken rather than persisting a token that
      // doesn't actually work.
      clearSessionCookies(res);
    } else {
      setSessionCookies(res, refreshed);
    }
    return res;
  }

  if (upstream.status === 401 && accessToken) {
    const res = await toNextResponse(upstream);
    clearSessionCookies(res);
    return res;
  }

  return toNextResponse(upstream);
}

async function toNextResponse(upstream: Response): Promise<NextResponse> {
  const bodyBuffer = await upstream.arrayBuffer();
  const res = new NextResponse(bodyBuffer, {
    status: upstream.status,
    statusText: upstream.statusText,
  });
  upstream.headers.forEach((value, key) => {
    if (STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      return;
    }
    res.headers.set(key, value);
  });
  return res;
}
