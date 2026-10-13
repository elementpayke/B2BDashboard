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

**Status:** frontend-only. The backend does not verify or require the
signature yet — every signed request today is simply extra, currently-unused
headers riding along on top of the existing JWT-authenticated calls. No
behavior changes until the backend opts in to checking them. Until then,
this ships with zero risk of breaking anything: a request with a correct
signature behaves identically to one without, since nothing currently reads
these headers upstream.

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

## 2. What the backend needs to do

Nothing yet — this section is the spec for when the backend team is ready
to enforce it, not a request to implement immediately.

1. **Share the secret.** Mint a random, sufficiently long secret
   (32+ bytes, base64 or hex) and provision it as `MBOKA_PROXY_SHARED_SECRET`
   in both this app's environment (Vercel) and the Mboka backend's.
2. **Verify on every request** (or, as a rollout step, only on a subset —
   see open question 2): recompute the canonical string and HMAC exactly as
   in §1 using the *received* method, path+query, and raw request body
   bytes, and compare against `x-mboka-proxy-signature` using a
   constant-time comparison (not `==`/`string equality`, to avoid a timing
   side-channel — e.g. Python's `hmac.compare_digest`).
3. **Reject stale timestamps** — compare `x-mboka-proxy-timestamp` against
   the backend's own clock and reject anything outside a tolerance window
   (suggest 5 minutes, matching common webhook-signing conventions) to
   prevent replaying a captured request indefinitely. This is the piece
   that actually stops replay; the signature alone only proves origin at
   the time it was computed.
4. **Decide the rejection response** — likely 401 with a distinct message
   from a JWT failure, so this app's own 401-handling (session refresh,
   cookie clearing in `lib/server/mbokaProxy.ts`) doesn't misinterpret a
   signature rejection as "this user's session expired." See open question 3.
5. **Roll out gated, not flag-day.** Since this app sends the headers
   unconditionally whenever `MBOKA_PROXY_SHARED_SECRET` is set here, the
   backend can verify-but-not-reject first (log mismatches) to catch any
   canonicalization mismatch between the two implementations before
   flipping to hard rejection.

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
