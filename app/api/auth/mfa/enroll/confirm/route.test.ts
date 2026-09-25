import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { ACCESS_COOKIE, REFRESH_COOKIE, MFA_SETUP_COOKIE } from "@/lib/server/cookies";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function confirmRequest(code: string, cookies: { setup?: string; access?: string } = {}) {
  const req = new NextRequest("http://localhost:3000/api/auth/mfa/enroll/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  if (cookies.setup) req.cookies.set(MFA_SETUP_COOKIE, cookies.setup);
  if (cookies.access) req.cookies.set(ACCESS_COOKIE, cookies.access);
  return req;
}

describe("POST /api/auth/mfa/enroll/confirm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects with 401 and calls no upstream when neither the setup nor access cookie is present", async () => {
    const res = await POST(confirmRequest("123456"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("setup-token path: sets session cookies and clears the setup cookie when tokens are returned, and returns backup codes in the body", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        status: "success",
        message: "ok",
        data: {
          backup_codes: ["aaaa-bbbb", "cccc-dddd"],
          access_token: "super-secret-access",
          refresh_token: "super-secret-refresh",
          token_type: "bearer",
          role: "admin",
          user_id: 1,
          business_id: 2,
        },
      }),
    );

    const res = await POST(confirmRequest("123456", { setup: "setup-tok" }));
    const body = await res.json();

    expect(JSON.stringify(body)).not.toContain("super-secret-access");
    expect(JSON.stringify(body)).not.toContain("super-secret-refresh");
    // Backup codes ARE intentionally returned in the body — shown once, not a session token.
    expect(body.data.backup_codes).toEqual(["aaaa-bbbb", "cccc-dddd"]);

    const cookies = res.cookies.getAll();
    const access = cookies.find((c) => c.name === ACCESS_COOKIE);
    const refresh = cookies.find((c) => c.name === REFRESH_COOKIE);
    const setup = cookies.find((c) => c.name === MFA_SETUP_COOKIE);

    expect(access?.value).toBe("super-secret-access");
    expect(access?.httpOnly).toBe(true);
    expect(refresh?.value).toBe("super-secret-refresh");
    expect(setup?.value).toBe(""); // cleared

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Bearer setup-tok");
  });

  it("voluntary (access-token) path: does not set session cookies when the backend returns backup codes only", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        status: "success",
        message: "ok",
        data: {
          backup_codes: ["aaaa-bbbb", "cccc-dddd"],
        },
      }),
    );

    const res = await POST(confirmRequest("123456", { access: "access-tok" }));
    const body = await res.json();

    expect(body.data.backup_codes).toEqual(["aaaa-bbbb", "cccc-dddd"]);

    const cookies = res.cookies.getAll();
    expect(cookies.find((c) => c.name === ACCESS_COOKIE)).toBeUndefined();
    expect(cookies.find((c) => c.name === REFRESH_COOKIE)).toBeUndefined();
    expect(cookies.find((c) => c.name === MFA_SETUP_COOKIE)).toBeUndefined();

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Bearer access-tok");
  });

  it("prefers the setup cookie over the access cookie when both are present", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { status: "success", message: "ok", data: { backup_codes: [] } }),
    );

    await POST(confirmRequest("123456", { setup: "setup-tok", access: "access-tok" }));

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Bearer setup-tok");
  });

  it("does not set session cookies when the code is rejected", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { status: "error", message: "Invalid code", data: null }),
    );

    const res = await POST(confirmRequest("000000", { setup: "setup-tok" }));
    expect(res.status).toBe(401);
    const cookies = res.cookies.getAll();
    expect(cookies.find((c) => c.name === ACCESS_COOKIE)).toBeUndefined();
  });
});
