import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  clearVerifyHandoff,
  readVerifyHandoff,
  stashVerifyEmail,
  takeQueryVerifyParams,
} from "./verifyHandoff";

describe("verifyHandoff", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stashes and reads email", () => {
    stashVerifyEmail("  ops@acme.com ");
    expect(readVerifyHandoff()).toEqual({ email: "ops@acme.com", code: "" });
  });

  it("takes query params into sessionStorage", () => {
    const result = takeQueryVerifyParams(
      new URLSearchParams("email=ops%40acme.com&code=ABC123"),
    );
    expect(result.stripped).toBe(true);
    expect(result.email).toBe("ops@acme.com");
    expect(result.code).toBe("ABC123");
    expect(readVerifyHandoff()).toEqual({
      email: "ops@acme.com",
      code: "ABC123",
    });
  });

  it("clears handoff", () => {
    stashVerifyEmail("a@b.com");
    clearVerifyHandoff();
    expect(readVerifyHandoff()).toEqual({ email: "", code: "" });
  });
});
