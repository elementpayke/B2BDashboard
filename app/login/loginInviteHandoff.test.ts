import { describe, expect, it } from "vitest";
import { safeNextPath } from "./LoginForm";

describe("login invite handoff", () => {
  it("keeps invite accept next paths", () => {
    expect(safeNextPath("/team/accept?token=abc")).toBe("/team/accept?token=abc");
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
  });

  it("rejects open redirects", () => {
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });

  it("builds invite login URLs with email prefill", () => {
    const email = "mrbivvon@gmail.com";
    const next = "/team/accept?token=abc";
    const href = `/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;
    expect(href).toContain("email=mrbivvon%40gmail.com");
    expect(href).toContain("next=%2Fteam%2Faccept%3Ftoken%3Dabc");
  });
});
