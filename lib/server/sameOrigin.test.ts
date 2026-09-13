import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { rejectCrossOrigin } from "./sameOrigin";

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
