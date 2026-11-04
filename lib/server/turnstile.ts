// Server-only. Verifies a Cloudflare Turnstile token against Cloudflare's
// siteverify endpoint before a login attempt is allowed to proceed.
import { getTurnstileSecretKey } from "./env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 10_000;

type SiteverifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

/** Production, or any deploy that shows the widget, must have a real secret. */
export function turnstileEnforced(): boolean {
  if (process.env.VERCEL_ENV === "production") return true;
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

/**
 * Returns true when the token is valid.
 * Local dev with neither a site key nor `VERCEL_ENV=production` stays open
 * so login works without Cloudflare keys. Everywhere else a missing secret
 * or a missing token is a reject.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteip?: string | null,
): Promise<boolean> {
  const secretKey = getTurnstileSecretKey();
  if (!secretKey) return !turnstileEnforced();
  if (!token) return false;

  const body = new URLSearchParams({ secret: secretKey, response: token });
  if (remoteip) body.set("remoteip", remoteip);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as SiteverifyResponse;
    return json.success === true;
  } catch {
    return false;
  }
}
