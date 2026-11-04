# Backend contract — signed requests from the dashboard's Mboka proxy

This is a frontend-only change, shipped ahead of any backend enforcement.
Mirrors the format of `docs/nuvion-bank-accounts-contract.md` — read
`docs/api-contract.md` first for the proxy/auth architecture this sits on
top of.

**Why:** the Mboka backend API is reachable directly over the internet, not
only through this dashboard's `/api/mboka/[...path]` proxy. A JWT alone —
leaked, logged, or replayed outside this app — is currently sufficient to
call the backend from anywhere. This closes that gap with defense in depth:
every outbound request this app's server makes to Mboka now carries an
HMAC signature computed with a secret only this app's server and the
backend know. A bare JWT is no longer enough on its own once the backend
enforces it; the request must also prove it came from this app's server.

**Status:** the dashboard signs whenever `MBOKA_PROXY_SHARED_SECRET` is
set. Mboka checks the signature only when `MBOKA_PROXY_SIGNATURE_REQUIRED=true`,
and only on money writes (sends, conversions, book transfers, orders,
payouts). Reads stay on the JWT. With the flag unset, a signed request and
an unsigned request behave the same. If the flag is true and this app has
no secret, the proxy returns 503 and does not send the request.

## 1. What's signed, and how

Every outbound HTTP request this app's server makes to the Mboka backend —
covering all four call sites in this repo (`lib/server/mbokaProxy.ts`'s
`doFetch` used by the generic authenticated proxy and
`proxyWithBearerToken`; its `refreshTokens`; `lib/server/mbokaCall.ts`'s
`callMboka`, used for public unauthenticated endpoints; and
`lib/server/session.ts`'s `fetchAuthMe`) — carries two new headers:

```
x-mboka-proxy-timestamp: <unix epoch milliseconds, as a string>
x-mboka-proxy-signature: <hex HMAC-SHA256, 64 chars>
```

Signature computation (see `lib/server/mbokaSignature.ts`):

```
body_hash = hex(SHA256(raw_request_body_bytes))   // SHA256 of empty bytes when there's no body
canonical = "{timestamp}.{METHOD}.{path_with_query}.{body_hash}"
signature = hex(HMAC_SHA256(shared_secret, canonical))
```

- `METHOD` is uppercased (`GET`, `POST`, ...).
- `path_with_query` is exactly the path-plus-querystring used for the
  outbound fetch (e.g. `/api/v1/iban/accounts?limit=20&offset=0`) — not the
  original incoming Next.js request path, in case those ever differ.
- `body_hash` is a hash of the **raw bytes**, not a UTF-8-decoded string —
  this is deliberate so binary/multipart bodies (e.g. KYB document uploads,
  which proxy through the same route as JSON bodies) sign correctly without
  a lossy decode step. Any backend language can reproduce this with a plain
  SHA-256 over the raw body bytes it received.
- The shared secret lives in `MBOKA_PROXY_SHARED_SECRET` (server-only env
  var, never exposed to the browser — same pattern as
  `TURNSTILE_SECRET_KEY`).

When `MBOKA_PROXY_SHARED_SECRET` is unset (true for every environment
today), no signature headers are sent at all — this is the same
fallback-when-absent pattern used throughout the Turnstile and bank-account
eligibility work, so there's no forced rollout timeline on the frontend side
either.

## 2. What the backend does

Mboka verifies money writes when `MBOKA_PROXY_SIGNATURE_REQUIRED=true`.
The default is false, so current deploys keep working.

1. **Share the secret.** Mint a random secret of at least 32 bytes and set
   `MBOKA_PROXY_SHARED_SECRET` on this app first, then on Mboka. The
   dashboard starts sending the headers. Mboka still accepts unsigned
   requests until the flag below is set.
2. **Verify** with `hmac.compare_digest` over the canonical string in §1.
   The timestamp window is ±60 seconds. A replay of the same signature is
   stored in Redis when `REDIS_URL` is set, and in memory otherwise.
3. **Reject** a missing, stale, wrong, or replayed signature with HTTP 403
   and message `Proxy signature rejected.` That is not a 401, so this app
   does not refresh or clear the session cookies.
4. **Fail closed on a short secret.** If the flag is true and Mboka's
   secret is shorter than 32 bytes, those money writes return 503. The
   process still starts. This app returns 503 from the proxy in the same
   situation instead of sending an unsigned request.
5. **Turn the flag on last.** Set `MBOKA_PROXY_SIGNATURE_REQUIRED=true` on
   Mboka only after both sides have the same secret. Reads are not covered
   by this first set.

## Open questions for backend team

1. **Secret provisioning and rotation.** Who owns minting/rotating
   `MBOKA_PROXY_SHARED_SECRET`, and how does a rotation avoid a window where
   one side has the new secret and the other doesn't? (A simple answer:
   accept either of two secrets — current and previous — for a short
   overlap window during rotation.)
2. **Enforce on every route, or a subset first?** This app signs
   unconditionally once the env var is set — there's no per-route opt-out on
   the frontend side. The backend could still choose to verify-and-reject
   only on sensitive routes first (auth, payouts, account mutation) and
   expand coverage over time; that's a backend-side rollout decision, not
   something the frontend needs to know about in advance.
3. **Exact rejection status/body for a signature failure**, and whether it
   needs to be distinguishable from a JWT-expiry 401 so this app's proxy
   doesn't try to refresh tokens or clear session cookies in response to
   what's actually a signature problem (see `isDownstreamAuthFailure`-style
   handling already in `lib/server/mbokaProxy.ts` for a precedent on
   distinguishing different classes of 401).
4. **Timestamp tolerance window** — 5 minutes suggested above, but this is
   the backend's call based on expected clock drift between Vercel's
   infrastructure and wherever Mboka runs.
5. **Does the aggregator (`element-pay-aggregator`) need this too**, or is
   it entirely internal to Mboka's own backend-to-backend calls, out of
   scope for a signature whose purpose is specifically "did this request
   come from the dashboard's own server"? Likely out of scope, but worth an
   explicit confirmation since that repo already has its own HMAC
   conventions (per the Nuvion webhook contract) that shouldn't be confused
   with this one.
