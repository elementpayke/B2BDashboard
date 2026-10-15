// Server-only. Verifies a Cloudflare Turnstile token against Cloudflare's
// siteverify endpoint before a login attempt is allowed to proceed.
import { getTurnstileSecretKey } from "./env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 10_000;

type SiteverifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

/**
 * Returns true when the token is valid, or when no `TURNSTILE_SECRET_KEY`
 * is configured (local/dev environments without Cloudflare keys).
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteip?: string | null,
): Promise<boolean> {
  const secretKey = getTurnstileSecretKey();
  if (!secretKey) return true;
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
