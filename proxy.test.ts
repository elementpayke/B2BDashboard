import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server/cookies";

describe("proxy", () => {
  it("redirects an unauthenticated request to /dashboard to /login, preserving the intended destination", () => {
    const req = new NextRequest("http://localhost:3000/dashboard/transactions");
    const res = proxy(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard/transactions");
  });

  it("lets an authenticated request (session cookie present) through", () => {
    const req = new NextRequest("http://localhost:3000/dashboard", {
      headers: { cookie: `${ACCESS_COOKIE}=some-token` },
    });
    const res = proxy(req);
    // NextResponse.next() carries this internal header marker rather than a redirect status.
    expect(res.headers.get("location")).toBeNull();
  });

  it("lets a refresh-only session through (access cookie expired)", () => {
    const req = new NextRequest("http://localhost:3000/dashboard", {
      headers: { cookie: `${REFRESH_COOKIE}=refresh-token` },
    });
    const res = proxy(req);
    expect(res.headers.get("location")).toBeNull();
  });
});
