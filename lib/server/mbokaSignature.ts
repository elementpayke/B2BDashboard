// Server-only. Signs every outbound request this app's server makes to the
// Mboka backend, so a bare JWT — even one leaked or replayed outside this
// app — isn't enough to call the backend directly; the request must also
// carry a valid signature that only this app's server can produce. Mirrors
// the HMAC pattern Nuvion itself uses for its own webhooks
// (x-nuvion-event-signature: HMAC_SHA256(secret, "{timestamp}.{payload}")).
//
// Absent in environments without a shared secret configured — every
// function below degrades to "don't sign" rather than failing closed, the
// same fallback-when-absent pattern used for Turnstile and the deposit
// account eligibility gate. The backend enforcing/rejecting unsigned or
// stale requests is separate, backend-side work (see
// docs/mboka-proxy-signing-contract.md).

import { createHash, createHmac } from "node:crypto";

export const MBOKA_SIGNATURE_TIMESTAMP_HEADER = "x-mboka-proxy-timestamp";
export const MBOKA_SIGNATURE_HEADER = "x-mboka-proxy-signature";

function getProxySharedSecret(): string | null {
  return process.env.MBOKA_PROXY_SHARED_SECRET || null;
}

/**
 * Hex SHA-256 of the raw request body bytes — not the body text itself.
 * Binary-safe (multipart uploads proxy through the same route as JSON
 * bodies) and trivial for any backend language to reproduce, unlike
 * signing over a lossily UTF-8-decoded byte string.
 */
export function hashRequestBody(
  body: ArrayBuffer | Uint8Array | string | null | undefined,
): string {
  if (!body) return createHash("sha256").update(Buffer.alloc(0)).digest("hex");
  const buf =
    typeof body === "string"
      ? Buffer.from(body, "utf8")
      : body instanceof Uint8Array
        ? Buffer.from(body)
        : Buffer.from(new Uint8Array(body));
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * HMAC-SHA256 over `{timestamp}.{method}.{pathWithQuery}.{bodyHash}`, hex
 * encoded. `pathWithQuery` must include the querystring used for the actual
 * outbound fetch, and `bodyHash` must be `hashRequestBody`'s output — not
 * the raw body — so the backend can verify without re-deriving a lossy
 * decode of the body itself.
 */
export function signMbokaRequest(
  secret: string,
  method: string,
  pathWithQuery: string,
  bodyHash: string,
  timestamp: string,
): string {
  const payload = `${timestamp}.${method.toUpperCase()}.${pathWithQuery}.${bodyHash}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Headers to attach to an outbound Mboka request, or `null` when no shared
 * secret is configured.
 */
export function buildMbokaSignatureHeaders(
  method: string,
  pathWithQuery: string,
  body: ArrayBuffer | Uint8Array | string | null | undefined,
): Record<string, string> | null {
  const secret = getProxySharedSecret();
  if (!secret) return null;
  const timestamp = String(Date.now());
  const bodyHash = hashRequestBody(body);
  const signature = signMbokaRequest(secret, method, pathWithQuery, bodyHash, timestamp);
  return {
    [MBOKA_SIGNATURE_TIMESTAMP_HEADER]: timestamp,
    [MBOKA_SIGNATURE_HEADER]: signature,
  };
}
