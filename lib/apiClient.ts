"use client";

// Mirrors mobile-app/lib/api.ts's envelope-unwrapping contract, but talks to
// our own same-origin `/api/mboka/...` proxy instead of the backend directly.
// Tokens never touch this layer — they live in httpOnly cookies handled
// entirely server-side by the proxy (including refresh-on-401).

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
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

function isAuthFailure(status: number, message?: string): boolean {
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

  if (!res.ok || json.status !== "success" || json.data == null) {
    const message = json.message ?? `Request failed (${res.status})`;
    if (isAuthFailure(res.status, message)) {
      sessionLostHandler?.();
      throw new SessionExpiredError();
    }
    throw new ApiRequestError(message, res.status);
  }

  return json.data;
}

/** For endpoints proxied through /api/mboka/... (everything backed by the
 * Mboka backend's authenticated, cookie-derived session). */
export async function apiEnvelope<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await rawFetch(`${MBOKA_PREFIX}${path}`, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return envelopeFromResponse<T>(res);
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
