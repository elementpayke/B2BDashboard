/**
 * Resolve the authenticated business from session cookies for dashboard-owned
 * BFF routes (not proxied to Mboka). Mirrors refresh-on-401 behaviour from
 * `mbokaProxy` without forwarding the original request body.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  setSessionCookies,
} from "@/lib/server/cookies";
import { getMbokaApiBase } from "@/lib/server/env";
import { MBOKA_FETCH_TIMEOUT_MS } from "@/lib/server/mbokaCall";
import { refreshTokens } from "@/lib/server/mbokaProxy";

type AuthMeData = {
  business?: { id?: number } | null;
};

type Envelope = {
  status?: string;
  message?: string;
  data?: AuthMeData | null;
};

export type SessionBusiness = {
  businessId: number;
  /** Attach Set-Cookie when a refresh occurred so the client keeps working. */
  applySessionCookies?: (res: NextResponse) => void;
};

function errorEnvelope(
  status: number,
  message: string,
  apply?: (res: NextResponse) => void,
): NextResponse {
  const res = NextResponse.json(
    { status: "error", message, data: null },
    { status },
  );
  apply?.(res);
  return res;
}

async function fetchAuthMe(accessToken: string): Promise<{ status: number; json: Envelope | null }> {
  try {
    const upstream = await fetch(`${getMbokaApiBase()}/api/auth/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(MBOKA_FETCH_TIMEOUT_MS),
    });
    let json: Envelope | null = null;
    try {
      json = (await upstream.json()) as Envelope;
    } catch {
      json = null;
    }
    return { status: upstream.status, json };
  } catch {
    return { status: 502, json: null };
  }
}

/**
 * Returns the session business id, or a ready-to-return error NextResponse.
 */
export async function requireSessionBusiness(
  request: NextRequest,
): Promise<SessionBusiness | NextResponse> {
  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value ?? null;

  if (!accessToken && !refreshToken) {
    return errorEnvelope(401, "Authentication required");
  }

  let refreshedTokens: { access_token: string; refresh_token: string } | null = null;

  if (!accessToken && refreshToken) {
    refreshedTokens = await refreshTokens(refreshToken);
    if (!refreshedTokens) {
      return errorEnvelope(401, "Session expired", clearSessionCookies);
    }
    accessToken = refreshedTokens.access_token;
  }

  let result = await fetchAuthMe(accessToken!);

  if (result.status === 401 && refreshToken && !refreshedTokens) {
    refreshedTokens = await refreshTokens(refreshToken);
    if (!refreshedTokens) {
      return errorEnvelope(401, "Session expired", clearSessionCookies);
    }
    accessToken = refreshedTokens.access_token;
    result = await fetchAuthMe(accessToken);
  }

  if (result.status === 401) {
    return errorEnvelope(401, "Session expired", clearSessionCookies);
  }

  if (result.status >= 500 || !result.json) {
    return errorEnvelope(502, "Unable to verify session");
  }

  if (result.status !== 200 || result.json.status !== "success") {
    return errorEnvelope(
      result.status >= 400 && result.status < 600 ? result.status : 401,
      result.json.message ?? "Authentication required",
    );
  }

  const businessId = result.json.data?.business?.id;
  if (typeof businessId !== "number" || !Number.isFinite(businessId)) {
    return errorEnvelope(403, "No business on this session");
  }

  const tokens = refreshedTokens;
  return {
    businessId,
    applySessionCookies: tokens
      ? (res) => setSessionCookies(res, tokens)
      : undefined,
  };
}

export function jsonSuccess<T>(
  data: T,
  init?: { status?: number; message?: string; session?: SessionBusiness },
): NextResponse {
  const res = NextResponse.json(
    {
      status: "success",
      message: init?.message ?? "ok",
      data,
    },
    { status: init?.status ?? 200 },
  );
  init?.session?.applySessionCookies?.(res);
  return res;
}

export function jsonError(
  status: number,
  message: string,
  session?: SessionBusiness,
): NextResponse {
  const res = NextResponse.json(
    { status: "error", message, data: null },
    { status },
  );
  session?.applySessionCookies?.(res);
  return res;
}
