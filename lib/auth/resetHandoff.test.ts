import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  clearResetHandoff,
  readResetHandoff,
  stashResetEmail,
  takeQueryResetParams,
} from "./resetHandoff";

describe("resetHandoff", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stashes email without query params", () => {
    stashResetEmail(" ops@example.com ");
    expect(readResetHandoff().email).toBe("ops@example.com");
  });

  it("migrates query params into sessionStorage and flags strip", () => {
    const result = takeQueryResetParams({
      get: (key) => (key === "email" ? "a@b.com" : key === "code" ? "ABC12345" : null),
    });
    expect(result).toEqual({ email: "a@b.com", code: "ABC12345", stripped: true });
    expect(readResetHandoff()).toEqual({ email: "a@b.com", code: "ABC12345" });
  });

  it("clears handoff after reset", () => {
    stashResetEmail("a@b.com");
    takeQueryResetParams({ get: (k) => (k === "code" ? "X" : null) });
    clearResetHandoff();
    expect(readResetHandoff()).toEqual({ email: "", code: "" });
  });
});
