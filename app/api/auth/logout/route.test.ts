import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, assertTokenSafeMbokaBase } from "./route";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server/cookies";

const fetchMock = vi.fn();

describe("assertTokenSafeMbokaBase", () => {
  it("allows https and loopback http", () => {
    expect(() => assertTokenSafeMbokaBase("https://api.mboka.example")).not.toThrow();
    expect(() => assertTokenSafeMbokaBase("http://localhost:8000")).not.toThrow();
    expect(() => assertTokenSafeMbokaBase("http://127.0.0.1:8000")).not.toThrow();
  });

  it("rejects cleartext non-loopback bases", () => {
    expect(() => assertTokenSafeMbokaBase("http://api.mboka.example")).toThrow(/https/);
    expect(() => assertTokenSafeMbokaBase("not-a-url")).toThrow(/Invalid/);
  });
});

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("MBOKA_API_BASE_URL", "https://mboka.test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function makeRequest(cookies: Record<string, string> = {}) {
    const header = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
    return new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: header ? { cookie: header } : undefined,
    });
  }

  it("revokes the refresh token upstream then clears both session cookies", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: "success" }), { status: 200 }));

    const res = await POST(
      makeRequest({ [ACCESS_COOKIE]: "access", [REFRESH_COOKIE]: "refresh-jti-token" }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://mboka.test/api/auth/logout");
    expect(init.redirect).toBe("error");
    expect(JSON.parse(String(init.body))).toEqual({ refresh_token: "refresh-jti-token" });

    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("");
    expect(res.cookies.get(ACCESS_COOKIE)?.maxAge).toBe(0);
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBe("");
    expect(res.cookies.get(REFRESH_COOKIE)?.maxAge).toBe(0);
  });

  it("skips upstream revoke on cleartext non-loopback base but still clears cookies", async () => {
    vi.stubEnv("MBOKA_API_BASE_URL", "http://insecure.example");

    const res = await POST(makeRequest({ [REFRESH_COOKIE]: "refresh-jti-token" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("");
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBe("");
  });

  it("still clears cookies when Mboka revoke fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("upstream down"));

    const res = await POST(makeRequest({ [REFRESH_COOKIE]: "stale-refresh" }));

    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("");
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBe("");
  });

  it("clears cookies even when no refresh cookie is present", async () => {
    const res = await POST(makeRequest({ [ACCESS_COOKIE]: "only-access" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBe("");
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBe("");
  });
});
