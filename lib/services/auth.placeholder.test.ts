import { describe, it, expect } from "vitest";
import { authMePlaceholderFromLogin, type LoginResult } from "./auth";

describe("authMePlaceholderFromLogin", () => {
  const base: LoginResult = {
    token_type: "bearer",
    kyb_status: "approved",
    role: "admin",
    user_id: 7,
    business_id: 42,
    wallet_address: "0xabc",
  };

  it("seeds role, KYB, and business id for instant shell paint", () => {
    const me = authMePlaceholderFromLogin(base, "ops@acme.test");
    expect(me.user.id).toBe(7);
    expect(me.user.email).toBe("ops@acme.test");
    expect(me.business?.id).toBe(42);
    expect(me.business?.name).toBe("Your business");
    expect(me.role).toBe("admin");
    expect(me.kyb_summary?.profile?.kyb_status).toBe("approved");
    expect(me.business?.kyb_verified).toBe(true);
  });

  it("prefers business_name from login when Mboka provides it", () => {
    const me = authMePlaceholderFromLogin(
      { ...base, business_name: "Acme Ltd" },
      "ops@acme.test",
    );
    expect(me.business?.name).toBe("Acme Ltd");
  });

  it("omits business when login has no business_id", () => {
    const me = authMePlaceholderFromLogin(
      { ...base, business_id: null, kyb_status: null },
      "solo@test.com",
    );
    expect(me.business).toBeNull();
    expect(me.kyb_summary).toBeNull();
  });
});
