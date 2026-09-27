import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server/cookies";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function disableRequest(cookies: { access?: string; refresh?: string } = {}) {
  const req = new NextRequest("http://localhost:3000/api/auth/mfa/disable", {
    method: "POST",
    body: JSON.stringify({ password: "wrong-password", code: "123456" }),
  });
  if (cookies.access) req.cookies.set(ACCESS_COOKIE, cookies.access);
  if (cookies.refresh) req.cookies.set(REFRESH_COOKIE, cookies.refresh);
  return req;
}

describe("POST /api/auth/mfa/disable", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Regression: the backend's wrong-password error for this endpoint
  // (`UnauthorizedError("Invalid credentials.")`) is a bare 401 with
  // `data: null` — structurally identical to a session-expiry 401. Routing
  // this through the generic session-aware proxy burned a token refresh,
  // retried, failed the same way again, and cleared the session cookies —
  // logging the user out of the whole dashboard instead of showing an
  // inline "wrong password" error on the disable-2FA form.
  it("passes a wrong-password 401 straight through without refreshing or clearing session cookies", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { status: "error", message: "Invalid credentials.", data: null }),
    );

    const res = await POST(disableRequest({ access: "good-access", refresh: "good-refresh" }));

    expect(fetchMock).toHaveBeenCalledTimes(1); // no refresh call, no retry
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ status: "error", message: "Invalid credentials.", data: null });
    expect(res.cookies.get(ACCESS_COOKIE)).toBeUndefined();
    expect(res.cookies.get(REFRESH_COOKIE)).toBeUndefined();
  });

  it("forwards the access cookie as the bearer token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { status: "success", message: "MFA disabled.", data: {} }),
    );

    await POST(disableRequest({ access: "good-access" }));

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Bearer good-access");
  });

  it("sends no Authorization header when there is no access cookie, rather than crashing", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { status: "error", message: "not authenticated", data: null }),
    );

    const res = await POST(disableRequest());

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("Authorization")).toBeNull();
    expect(res.status).toBe(401);
  });
});
