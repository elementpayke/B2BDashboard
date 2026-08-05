import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { proxyRequest } from "./mbokaProxy";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./cookies";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function makeRequest(opts: {
  method?: string;
  path?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  body?: string;
}) {
  const cookieHeader = Object.entries(opts.cookies ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(`http://localhost:3000${opts.path ?? "/v1/dashboard/summary"}`, {
    method: opts.method ?? "GET",
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...opts.headers,
    },
    body: opts.body,
  });
}

describe("proxyRequest", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never forwards a client-supplied Authorization or X-API-Key header — only the cookie-derived token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", message: "ok", data: {} }));

    const req = makeRequest({
      cookies: { [ACCESS_COOKIE]: "real-token" },
      headers: {
        Authorization: "Bearer attacker-supplied-token",
        "X-API-Key": "attacker-supplied-key",
      },
    });
    await proxyRequest(req, "/api/v1/dashboard/summary");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const sentHeaders = init.headers as Headers;
    expect(sentHeaders.get("authorization")).toBe("Bearer real-token");
    expect(sentHeaders.get("x-api-key")).toBeNull();
  });

  it("forwards no Authorization header at all when there is no session cookie (so the backend correctly 401s rather than the proxy silently succeeding)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { status: "error", message: "not authenticated", data: null }));

    const req = makeRequest({ headers: { Authorization: "Bearer attacker-supplied-token" } });
    const res = await proxyRequest(req, "/api/v1/dashboard/summary");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get("authorization")).toBeNull();
    expect(res.status).toBe(401);
  });

  it("on a 401 with both tokens present, refreshes exactly once and retries exactly once with the new token", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { status: "error", message: "invalid jwt", data: null })) // initial call
      .mockResolvedValueOnce(
        jsonResponse(200, {
          status: "success",
          message: "ok",
          data: { access_token: "new-access", refresh_token: "new-refresh" },
        }),
      ) // refresh call
      .mockResolvedValueOnce(jsonResponse(200, { status: "success", message: "ok", data: { totals: {} } })); // retried call

    const req = makeRequest({ cookies: { [ACCESS_COOKIE]: "old-access", [REFRESH_COOKIE]: "old-refresh" } });
    const res = await proxyRequest(req, "/api/v1/dashboard/summary");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain("/api/auth/refresh");
    const retryHeaders = fetchMock.mock.calls[2][1].headers as Headers;
    expect(retryHeaders.get("authorization")).toBe("Bearer new-access");
    expect(res.status).toBe(200);

    const newAccess = res.cookies.get(ACCESS_COOKIE);
    const newRefresh = res.cookies.get(REFRESH_COOKIE);
    expect(newAccess?.value).toBe("new-access");
    expect(newRefresh?.value).toBe("new-refresh");
  });

  it("does not loop: a 401 that persists after a successful-looking refresh clears cookies instead of retrying again", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { status: "error", message: "invalid jwt", data: null }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          status: "success",
          message: "ok",
          data: { access_token: "new-access", refresh_token: "new-refresh" },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(401, { status: "error", message: "invalid jwt", data: null })); // still 401

    const req = makeRequest({ cookies: { [ACCESS_COOKIE]: "old-access", [REFRESH_COOKIE]: "old-refresh" } });
    const res = await proxyRequest(req, "/api/v1/dashboard/summary");

    expect(fetchMock).toHaveBeenCalledTimes(3); // exactly one retry attempt, no further loop
    expect(res.status).toBe(401);
    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("");
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBe("");
  });

  it("clears cookies when the refresh call itself fails", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { status: "error", message: "invalid jwt", data: null }))
      .mockResolvedValueOnce(jsonResponse(400, { status: "error", message: "invalid refresh token", data: null }));

    const req = makeRequest({ cookies: { [ACCESS_COOKIE]: "old-access", [REFRESH_COOKIE]: "bad-refresh" } });
    const res = await proxyRequest(req, "/api/v1/dashboard/summary");

    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + refresh attempt, no retry since refresh failed
    expect(res.status).toBe(401);
    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("");
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBe("");
  });

  it("does not attempt a refresh loop when there is an access token but no refresh token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { status: "error", message: "invalid jwt", data: null }));

    const req = makeRequest({ cookies: { [ACCESS_COOKIE]: "old-access" } });
    const res = await proxyRequest(req, "/api/v1/dashboard/summary");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("");
  });

  it("follows a backend trailing-slash redirect on a POST without losing the request body (regression: undici detaches the ArrayBuffer body on an auto-followed redirect retry)", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 307,
          headers: { location: "http://localhost:8000/api/api-keys/" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(201, { status: "success", message: "created", data: { id: 1, key: "ep_live_..." } }),
      );

    const payload = JSON.stringify({ name: "My key", environment: "live" });
    const req = makeRequest({
      method: "POST",
      path: "/api/api-keys",
      cookies: { [ACCESS_COOKIE]: "token" },
      body: payload,
    });
    const res = await proxyRequest(req, "/api/api-keys");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBeInstanceOf(URL);
    expect(String(fetchMock.mock.calls[1][0])).toBe("http://localhost:8000/api/api-keys/");
    // The retried call must still carry a body (not an empty/detached one).
    const retriedBody = fetchMock.mock.calls[1][1].body as ArrayBuffer;
    expect(new TextDecoder().decode(retriedBody)).toBe(payload);
    expect(res.status).toBe(201);
  });

  it("round-trips a binary (non-JSON) response body unmodified, e.g. an invoice PDF", async () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
    fetchMock.mockResolvedValueOnce(
      new Response(bytes, { status: 200, headers: { "content-type": "application/pdf" } }),
    );

    const req = makeRequest({ cookies: { [ACCESS_COOKIE]: "token" }, path: "/v1/invoices/1/pdf" });
    const res = await proxyRequest(req, "/api/v1/invoices/1/pdf");

    const buf = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(buf)).toEqual(Array.from(bytes));
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });
});
