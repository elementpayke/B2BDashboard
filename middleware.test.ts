import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { ACCESS_COOKIE } from "@/lib/server/cookies";

describe("middleware", () => {
  it("redirects an unauthenticated request to /dashboard to /login, preserving the intended destination", () => {
    const req = new NextRequest("http://localhost:3000/dashboard/transactions");
    const res = middleware(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard/transactions");
  });

  it("lets an authenticated request (session cookie present) through", () => {
    const req = new NextRequest("http://localhost:3000/dashboard", {
      headers: { cookie: `${ACCESS_COOKIE}=some-token` },
    });
    const res = middleware(req);
    // NextResponse.next() carries this internal header marker rather than a redirect status.
    expect(res.headers.get("location")).toBeNull();
  });
});
