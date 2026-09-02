"use client";

// Mirrors mobile-app/lib/api.ts's envelope-unwrapping contract, but talks to
// our own same-origin `/api/mboka/...` proxy instead of the backend directly.
// Tokens never touch this layer — they live in httpOnly cookies handled
// entirely server-side by the proxy (including refresh-on-401).

export class ApiRequestError extends Error {
  readonly status: number;
  /** Optional envelope `data` from Mboka (field hints, expected dial code, …). */
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown = null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.data = data;
  }
}

export class SessionExpiredError extends Error {
  readonly sessionExpired = true as const;

  constructor() {
    super("Session expired");
    this.name = "SessionExpiredError";
  }
}

export function isSessionExpiredError(error: unknown): boolean {
  return (
    error instanceof SessionExpiredError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { sessionExpired?: boolean }).sessionExpired === true)
  );
}

/**
 * A 401 the backend is only relaying from its own upstream aggregator (a dead
 * partner API key, say) is not this user's session going bad. Those envelopes
 * carry `data.upstream`; genuine session failures carry `data: null`. Treating
 * both as session loss logged users out on sight, because endpoints like
 * /v1/supported/catalog 401 on every dashboard load when the partner key is
 * revoked. Mirrors `isDownstreamAuthFailure` in lib/server/mbokaProxy.ts,
 * which likewise stops the proxy clearing the session cookies.
 */
function isDownstreamAuthFailure(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    Object.prototype.hasOwnProperty.call(data, "upstream")
  );
}

function isAuthFailure(status: number, message?: string, data?: unknown): boolean {
  if (isDownstreamAuthFailure(data)) return false;
  if (status === 401) return true;
  const text = message?.trim() ?? "";
  if (!text) return false;
  return /invalid jwt|invalid token|session expired|not authenticated|authentication required/i.test(
    text,
  );
}

let sessionLostHandler: (() => void) | null = null;

export function setSessionLostHandler(fn: (() => void) | null): void {
  sessionLostHandler = fn;
}

type MbokaEnvelope<T> = {
  status: "success" | "error";
  message: string;
  data: T | null;
};

const MBOKA_PREFIX = "/api/mboka";

/** Low-level fetch. Cookies ride along automatically (same-origin), no
 * Authorization header is ever set from client code. */
async function rawFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  return fetch(url, {
    ...init,
    headers,
    credentials: "same-origin",
  });
}

export type RequestOptions = {
  /** Extra request headers, e.g. `Idempotency-Key` on a mutating call.
   * `lib/server/mbokaProxy.ts` only strips auth/hop-by-hop headers, so a
   * custom header set here rides through to the backend untouched. */
  headers?: Record<string, string>;
};

async function envelopeFromResponse<T>(res: Response): Promise<T> {
  let json: MbokaEnvelope<T>;
  try {
    json = (await res.json()) as MbokaEnvelope<T>;
  } catch {
    if (res.status === 401) {
      sessionLostHandler?.();
      throw new SessionExpiredError();
    }
    throw new ApiRequestError(`HTTP ${res.status}`, res.status);
  }

  if (!res.ok || json.status !== "success") {
    const message = json.message ?? `Request failed (${res.status})`;
    if (isAuthFailure(res.status, message, json.data)) {
      sessionLostHandler?.();
      throw new SessionExpiredError();
    }
    throw new ApiRequestError(message, res.status, json.data ?? null);
  }

  // Successful envelopes may intentionally return `data: null` (e.g. DELETE).
  // Only reject when the `data` field is missing entirely.
  if (!Object.prototype.hasOwnProperty.call(json, "data") || json.data === undefined) {
    throw new ApiRequestError(json.message ?? `Request failed (${res.status})`, res.status);
  }

  return json.data as T;
}

/** For endpoints proxied through /api/mboka/... (everything backed by the
 * Mboka backend's authenticated, cookie-derived session). */
export async function apiEnvelope<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const res = await rawFetch(`${MBOKA_PREFIX}${path}`, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: options?.headers,
  });
  return envelopeFromResponse<T>(res);
}

/** For multipart uploads proxied through /api/mboka/... (e.g. KYB documents).
 * Deliberately does not go through `rawFetch` — a `FormData` body needs the
 * browser to set its own `Content-Type: multipart/form-data; boundary=...`
 * header, which `rawFetch`'s hardcoded `application/json` would break. */
export async function apiUpload<T>(method: string, path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${MBOKA_PREFIX}${path}`, {
    method,
    body: formData,
    credentials: "same-origin",
  });
  return envelopeFromResponse<T>(res);
}

/** Binary download (e.g. KYB document content) through the Mboka proxy. */
export async function apiDownloadBlob(path: string): Promise<{ blob: Blob; filename: string | null }> {
  const res = await fetch(`${MBOKA_PREFIX}${path}`, {
    method: "GET",
    credentials: "same-origin",
  });
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const json = (await res.json()) as { message?: string };
      if (json?.message) message = json.message;
    } catch {
      // non-JSON error body
    }
    throw new ApiRequestError(message, res.status);
  }
  const disposition = res.headers.get("content-disposition") || "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? null;
  const blob = await res.blob();
  return { blob, filename };
}

/** For our own dedicated auth routes (/api/auth/...), which aren't behind
 * the generic proxy since they need to intercept tokens rather than pass
 * them through. */
export async function authEnvelope<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await rawFetch(path, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return envelopeFromResponse<T>(res);
}

export const mbokaApi = {
  get: <T>(path: string) => apiEnvelope<T>("GET", path),
  post: <T>(path: string, body?: unknown) => apiEnvelope<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => apiEnvelope<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => apiEnvelope<T>("PATCH", path, body),
  delete: <T>(path: string) => apiEnvelope<T>("DELETE", path),
};
