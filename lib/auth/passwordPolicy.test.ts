import { describe, expect, it } from "vitest";
import { passwordsMatch, validatePassword } from "./passwordPolicy";

describe("validatePassword", () => {
  it("accepts a strong password", () => {
    expect(validatePassword("TestPass123!@#x")).toBeNull();
  });

  it("rejects short passwords", () => {
    expect(validatePassword("Aa1!short")).toMatch(/12 characters/);
  });

  it("rejects passwords missing a required class", () => {
    expect(validatePassword("testpass123!@#")).toMatch(/uppercase/);
    expect(validatePassword("TESTPASS123!@#")).toMatch(/lowercase/);
    expect(validatePassword("TestPassword!@#")).toMatch(/digit/);
    expect(validatePassword("TestPass12345x")).toMatch(/symbol/);
  });

  it("rejects whitespace", () => {
    expect(validatePassword("Test Pass123!")).toMatch(/whitespace/);
  });
});

describe("passwordsMatch", () => {
  it("requires an exact match", () => {
    expect(passwordsMatch("a", "a")).toBeNull();
    expect(passwordsMatch("a", "b")).toMatch(/do not match/);
  });
});
