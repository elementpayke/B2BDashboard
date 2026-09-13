import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/server/mbokaCall", () => ({
  callMboka: vi.fn(),
  passthroughJson: vi.fn(),
}));

describe("GET /api/auth/verify-email", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("redirects to /verify-email with email and code query params", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest(
      "http://localhost:3000/api/auth/verify-email?email=ops%40acme.com&code=123456",
    );
    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/verify-email");
    expect(location.searchParams.get("email")).toBe("ops@acme.com");
    expect(location.searchParams.get("code")).toBe("123456");
  });

  it("redirects without params when query is empty", async () => {
    const { GET } = await import("./route");
    const req = new NextRequest("http://localhost:3000/api/auth/verify-email");
    const res = await GET(req);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/verify-email");
    expect(location.search).toBe("");
  });
});
