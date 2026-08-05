import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "mboka_at";
export const REFRESH_COOKIE = "mboka_rt";

const ACCESS_MAX_AGE_SECONDS = 900; // mirrors backend ACCESS_TOKEN_TTL_SECONDS
const REFRESH_MAX_AGE_SECONDS = 2_592_000; // mirrors backend REFRESH_TOKEN_TTL_SECONDS

function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setSessionCookies(
  res: NextResponse,
  tokens: { access_token: string; refresh_token: string },
): void {
  res.cookies.set(ACCESS_COOKIE, tokens.access_token, {
    ...baseCookieOptions(),
    maxAge: ACCESS_MAX_AGE_SECONDS,
  });
  res.cookies.set(REFRESH_COOKIE, tokens.refresh_token, {
    ...baseCookieOptions(),
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookies(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE, "", { ...baseCookieOptions(), maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...baseCookieOptions(), maxAge: 0 });
}
