import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "mboka_at";
export const REFRESH_COOKIE = "mboka_rt";

// Short-lived tokens for the two-step (challenge / setup) MFA flows. Neither
// is a session token — each is scoped server-side to exactly one purpose
// (verify a TOTP code, or complete enrollment) — so they get their own
// cookies rather than reusing ACCESS_COOKIE.
export const MFA_CHALLENGE_COOKIE = "mboka_mfa_challenge";
export const MFA_SETUP_COOKIE = "mboka_mfa_setup";

const ACCESS_MAX_AGE_SECONDS = 900; // mirrors backend ACCESS_TOKEN_TTL_SECONDS
const REFRESH_MAX_AGE_SECONDS = 2_592_000; // mirrors backend REFRESH_TOKEN_TTL_SECONDS
const MFA_CHALLENGE_MAX_AGE_SECONDS = 300; // 5 minutes — long enough to type a TOTP code
const MFA_SETUP_MAX_AGE_SECONDS = 1_800; // 30 minutes — enough to scan a QR + confirm

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

export function setMfaChallengeCookie(res: NextResponse, token: string): void {
  res.cookies.set(MFA_CHALLENGE_COOKIE, token, {
    ...baseCookieOptions(),
    maxAge: MFA_CHALLENGE_MAX_AGE_SECONDS,
  });
}

export function setMfaSetupCookie(res: NextResponse, token: string): void {
  res.cookies.set(MFA_SETUP_COOKIE, token, {
    ...baseCookieOptions(),
    maxAge: MFA_SETUP_MAX_AGE_SECONDS,
  });
}

export function clearMfaCookies(res: NextResponse): void {
  res.cookies.set(MFA_CHALLENGE_COOKIE, "", { ...baseCookieOptions(), maxAge: 0 });
  res.cookies.set(MFA_SETUP_COOKIE, "", { ...baseCookieOptions(), maxAge: 0 });
}
