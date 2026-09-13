import { describe, expect, it } from "vitest";
import { isUnverifiedEmailError, safeNextPath } from "./LoginForm";

describe("login invite handoff", () => {
  it("keeps invite accept next paths", () => {
    expect(safeNextPath("/team/accept?token=abc")).toBe("/team/accept?token=abc");
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("/dashboard/cards")).toBe("/dashboard/cards");
  });

  it("rejects open redirects and off-allowlist paths", () => {
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil")).toBe("/dashboard");
    expect(safeNextPath("/login")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });

  it("detects unverified email errors", () => {
    expect(isUnverifiedEmailError("Email address is not verified.")).toBe(true);
    expect(isUnverifiedEmailError("Invalid credentials")).toBe(false);
  });

  it("builds invite login URLs with email prefill", () => {
    const email = "mrbivvon@gmail.com";
    const next = "/team/accept?token=abc";
    const href = `/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;
    expect(href).toContain("email=mrbivvon%40gmail.com");
    expect(href).toContain("next=%2Fteam%2Faccept%3Ftoken%3Dabc");
  });
});
