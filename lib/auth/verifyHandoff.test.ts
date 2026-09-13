import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  clearVerifyHandoff,
  readVerifyHandoff,
  stashVerifyEmail,
  takeHashVerifyParams,
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

  it("stashes email and clears any prior code", () => {
    store.set("ep_verify_code", "OLDCODE");
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

  it("email-only query clears a prior code", () => {
    store.set("ep_verify_email", "old@acme.com");
    store.set("ep_verify_code", "OLDCODE");
    const result = takeQueryVerifyParams(new URLSearchParams("email=new%40acme.com"));
    expect(result).toEqual({ email: "new@acme.com", code: "", stripped: true });
    expect(readVerifyHandoff()).toEqual({ email: "new@acme.com", code: "" });
  });

  it("returns query values and strips even without sessionStorage", () => {
    vi.stubGlobal("sessionStorage", undefined);
    const result = takeQueryVerifyParams(
      new URLSearchParams("email=ops%40acme.com&code=ABC123"),
    );
    expect(result).toEqual({
      email: "ops@acme.com",
      code: "ABC123",
      stripped: true,
    });
  });

  it("takes hash params and clears the fragment", () => {
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: {
        hash: "#email=ops%40acme.com&code=HASH99",
        pathname: "/verify-email",
        search: "",
      },
      history: { replaceState },
    });
    const result = takeHashVerifyParams();
    expect(result).toEqual({
      email: "ops@acme.com",
      code: "HASH99",
      stripped: true,
    });
    expect(replaceState).toHaveBeenCalledWith(null, "", "/verify-email");
    expect(readVerifyHandoff()).toEqual({
      email: "ops@acme.com",
      code: "HASH99",
    });
  });

  it("clears handoff", () => {
    stashVerifyEmail("a@b.com");
    clearVerifyHandoff();
    expect(readVerifyHandoff()).toEqual({ email: "", code: "" });
  });
});
