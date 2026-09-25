import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { ACCESS_COOKIE, REFRESH_COOKIE, MFA_CHALLENGE_COOKIE } from "@/lib/server/cookies";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function verifyRequest(code: string, challengeCookie?: string) {
  const req = new NextRequest("http://localhost:3000/api/auth/mfa/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  if (challengeCookie) {
    req.cookies.set(MFA_CHALLENGE_COOKIE, challengeCookie);
  }
  return req;
}

describe("POST /api/auth/mfa/verify", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects with 401 and calls no upstream when there is no challenge cookie", async () => {
    const res = await POST(verifyRequest("123456"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.cookies.getAll()).toHaveLength(0);
  });

  it("forwards the challenge cookie as a bearer token, never as the client-visible auth", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        status: "success",
        message: "ok",
        data: {
          access_token: "at",
          refresh_token: "rt",
          token_type: "bearer",
          kyb_status: "approved",
          role: "admin",
          user_id: 1,
          business_id: 2,
          wallet_address: "0xabc",
        },
      }),
    );

    await POST(verifyRequest("123456", "challenge-tok"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init.headers as HeadersInit);
    expect(headers.get("Authorization")).toBe("Bearer challenge-tok");
  });

  it("on success: sets real session cookies, clears the challenge cookie, and never leaks tokens into the body", async () => {
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

    const res = await POST(verifyRequest("123456", "challenge-tok"));
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

    const cookies = res.cookies.getAll();
    const access = cookies.find((c) => c.name === ACCESS_COOKIE);
    const refresh = cookies.find((c) => c.name === REFRESH_COOKIE);
    const challenge = cookies.find((c) => c.name === MFA_CHALLENGE_COOKIE);

    expect(access?.value).toBe("super-secret-access");
    expect(access?.httpOnly).toBe(true);
    expect(refresh?.value).toBe("super-secret-refresh");
    expect(refresh?.httpOnly).toBe(true);
    // Cleared cookies are re-set with an empty value and maxAge 0.
    expect(challenge?.value).toBe("");
  });

  it("does not set session cookies when the code is rejected", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { status: "error", message: "Invalid code", data: null }),
    );

    const res = await POST(verifyRequest("000000", "challenge-tok"));
    expect(res.status).toBe(401);
    const cookies = res.cookies.getAll();
    expect(cookies.find((c) => c.name === ACCESS_COOKIE)).toBeUndefined();
    expect(cookies.find((c) => c.name === REFRESH_COOKIE)).toBeUndefined();
  });
});
