import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { originsMatch, rejectCrossOrigin } from "./sameOrigin";

describe("originsMatch", () => {
  it("equates localhost and 127.0.0.1 on the same port", () => {
    expect(originsMatch("http://127.0.0.1:3000", "http://localhost:3000")).toBe(true);
    expect(originsMatch("http://localhost:3000", "http://127.0.0.1:3000")).toBe(true);
  });

  it("rejects different ports or hosts", () => {
    expect(originsMatch("http://127.0.0.1:3000", "http://localhost:3001")).toBe(false);
    expect(originsMatch("http://localhost:3000", "https://evil.example")).toBe(false);
  });
});

describe("rejectCrossOrigin", () => {
  it("allows GET without Origin", () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", { method: "GET" });
    expect(rejectCrossOrigin(req)).toBeNull();
  });

  it("allows same-origin POST", () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });
    expect(rejectCrossOrigin(req)).toBeNull();
  });

  it("allows loopback 127.0.0.1 Origin against localhost nextUrl", () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { origin: "http://127.0.0.1:3000" },
    });
    expect(rejectCrossOrigin(req)).toBeNull();
  });

  it("rejects cross-origin POST", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    const res = rejectCrossOrigin(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("allows POST without Origin (non-browser)", () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login", { method: "POST" });
    expect(rejectCrossOrigin(req)).toBeNull();
  });
});
