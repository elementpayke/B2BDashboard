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
  // Always re-home redirects onto the configured API base. Upstream may emit
  // an absolute Location (sometimes with the wrong scheme after a proxy),
  // which previously produced ERR_SSL_PACKET_LENGTH_TOO_LONG against plain
  // HTTP uvicorn. Path + query from Location is enough.
  //
  // Assign onto a URL built from the base rather than re-parsing the path as
  // a relative reference: a Location whose path begins with `//` (e.g.
  // `https://upstream//evil.example/x`) parses as protocol-relative, which
  // would send the request — carrying the Authorization header — to that host.
  const resolved = new URL(location, getMbokaApiBase());
  const redirectUrl = new URL(getMbokaApiBase());
  redirectUrl.pathname = resolved.pathname;
  redirectUrl.search = resolved.search;
  // Manual again, so one hop is all we follow. A further redirect is returned
  // to the caller as-is instead of being chased off-origin.
  return fetch(redirectUrl, {
    method: request.method,
    headers,
    body: bodyBuffer ? bodyBuffer.slice(0) : null,
    redirect: "manual",
    signal: AbortSignal.timeout(MBOKA_FETCH_TIMEOUT_MS),
  });
}

/**
 * Proxies an incoming Next.js request to the Mboka backend, injecting the
 * Authorization header from the httpOnly access-token cookie (never from
 * anything the client sent), and transparently refreshing+retrying once on
 * a 401 before giving up.
 */
function upstreamUnavailableResponse(err: unknown): NextResponse {
  const cause = err instanceof Error ? err.cause : undefined;
  const code =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code?: unknown }).code ?? "")
      : err instanceof Error
        ? err.name
        : "";
  const timedOut =
    code === "TimeoutError" ||
    (err instanceof Error && /timeout|aborted/i.test(err.message));
  return NextResponse.json(
    {
      status: "error",
      message: timedOut
        ? "Upstream request timed out. Please try again."
        : "Upstream request failed. Please try again.",
      data: null,
    },
    { status: timedOut ? 504 : 502 },
  );
}

export async function proxyRequest(
  request: NextRequest,
  backendPathWithQuery: string,
): Promise<NextResponse> {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value ?? null;

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const bodyBuffer = hasBody ? await request.arrayBuffer() : null;

  let upstream: Response;
  let upstreamBody: ArrayBuffer;
  try {
    upstream = await doFetch(request, backendPathWithQuery, accessToken, bodyBuffer);
    upstreamBody = await upstream.arrayBuffer();
  } catch (err) {
    return upstreamUnavailableResponse(err);
  }

  // A 401 the backend is only relaying from *its* upstream aggregator says
  // nothing about this user's session — refreshing or clearing cookies over
  // it would log a perfectly good session out (see isDownstreamAuthFailure).
  if (upstream.status === 401 && !isDownstreamAuthFailure(upstreamBody)) {
    // Refresh whenever a refresh cookie is present — including the common case
    // where the shorter-lived access cookie has already expired and the browser
    // stopped sending it.
    if (refreshToken) {
      const refreshed = await refreshTokens(refreshToken);
      if (!refreshed) {
        const res = toNextResponse(upstream, upstreamBody);
        clearSessionCookies(res);
        return res;
      }
      let retryBody: ArrayBuffer;
      try {
        upstream = await doFetch(request, backendPathWithQuery, refreshed.access_token, bodyBuffer);
        retryBody = await upstream.arrayBuffer();
      } catch (err) {
        return upstreamUnavailableResponse(err);
      }
      const res = toNextResponse(upstream, retryBody);
      if (upstream.status === 401 && !isDownstreamAuthFailure(retryBody)) {
        // Refresh reported success but the new token still isn't accepted —
        // treat the session as broken rather than persisting a token that
        // doesn't actually work.
        clearSessionCookies(res);
      } else {
        setSessionCookies(res, refreshed);
      }
      return res;
    }

    if (accessToken) {
      const res = toNextResponse(upstream, upstreamBody);
      clearSessionCookies(res);
      return res;
    }
  }

  return toNextResponse(upstream, upstreamBody);
}

/**
 * True when a 401 body is the backend relaying a *downstream* auth failure
 * (its aggregator/partner credentials) rather than rejecting this user.
 *
 * The two are structurally distinct in the backend's envelope:
 *
 *   session   → {"status":"error","message":"Invalid JWT token: …","data":null}
 *   downstream→ {"status":"error","message":"Aggregator returned 401 for …",
 *                "data":{"upstream":{…,"message":"Invalid or revoked API key"}}}
 *
 * Only the first should end the session. Conflating them meant a dead partner
 * API key logged every user out the moment the dashboard loaded, because
 * /v1/supported/catalog and friends 401 on every page load.
 */
export function isDownstreamAuthFailure(body: ArrayBuffer): boolean {
  if (body.byteLength === 0) return false;
  try {
    const json = JSON.parse(new TextDecoder().decode(body)) as {
      data?: unknown;
    };
    const data = json?.data;
    return (
      typeof data === "object" &&
      data !== null &&
      Object.prototype.hasOwnProperty.call(data, "upstream")
    );
  } catch {
    // Not a JSON envelope — can't prove it's downstream, so treat it as a
    // session failure (the safe direction: log out rather than hang on).
    return false;
  }
}

/** Body is passed in rather than read here — the caller has already consumed
 *  the stream to classify a 401, and it can only be read once. */
function toNextResponse(upstream: Response, bodyBuffer: ArrayBuffer): NextResponse {
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
