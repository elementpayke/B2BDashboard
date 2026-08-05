import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server/cookies";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function loginRequest(email: string, password: string) {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

describe("POST /api/auth/login", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never returns access_token or refresh_token in the response body on success", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        status: "success",
        message: "ok",
        data: {
          access_token: "super-secret-access",
          refresh_token: "super-secret-refresh",
          token_type: "bearer",
          kyb_status: "approved",
          role: "admin",
          user_id: 1,
          business_id: 2,
          wallet_address: "0xabc",
        },
      }),
    );

    const res = await POST(loginRequest("owner@acme.com", "correct horse battery staple"));
    const body = await res.json();

    expect(JSON.stringify(body)).not.toContain("super-secret-access");
    expect(JSON.stringify(body)).not.toContain("super-secret-refresh");
    expect(body.data).toEqual({
      token_type: "bearer",
      kyb_status: "approved",
      role: "admin",
      user_id: 1,
      business_id: 2,
      wallet_address: "0xabc",
    });
  });

  it("sets both cookies as httpOnly on success", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        status: "success",
        message: "ok",
        data: {
          access_token: "at",
          refresh_token: "rt",
          token_type: "bearer",
          kyb_status: null,
          role: null,
          user_id: 1,
          business_id: null,
          wallet_address: null,
        },
      }),
    );

    const res = await POST(loginRequest("owner@acme.com", "correct horse battery staple"));
    const cookies = res.cookies.getAll();
    const access = cookies.find((c) => c.name === ACCESS_COOKIE);
    const refresh = cookies.find((c) => c.name === REFRESH_COOKIE);

    expect(access?.value).toBe("at");
    expect(access?.httpOnly).toBe(true);
    expect(access?.sameSite).toBe("lax");
    expect(refresh?.value).toBe("rt");
    expect(refresh?.httpOnly).toBe(true);
  });

  it("sets no cookies at all when the backend rejects the login", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { status: "error", message: "invalid credentials", data: null }),
    );

    const res = await POST(loginRequest("owner@acme.com", "wrong-password"));
    expect(res.status).toBe(401);
    expect(res.cookies.getAll()).toHaveLength(0);
    const body = await res.json();
    expect(body.data).toBeNull();
  });

  it("passes through the backend's error message verbatim (preserves wrong-password vs unknown-email indistinguishability)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { status: "error", message: "Invalid email or password", data: null }),
    );
    const res = await POST(loginRequest("nobody@acme.com", "whatever"));
    const body = await res.json();
    expect(body.message).toBe("Invalid email or password");
  });

  it("degrades gracefully (no crash, no cookies) if the upstream response isn't valid JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    const res = await POST(loginRequest("owner@acme.com", "whatever"));
    expect(res.status).toBe(502);
    expect(res.cookies.getAll()).toHaveLength(0);
  });
});
