import { describe, it, expect } from "vitest";
import { POST } from "./route";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/server/cookies";

describe("POST /api/auth/logout", () => {
  it("always clears both session cookies", async () => {
    const res = await POST();
    const cookies = res.cookies.getAll();
    const access = cookies.find((c) => c.name === ACCESS_COOKIE);
    const refresh = cookies.find((c) => c.name === REFRESH_COOKIE);

    expect(access?.value).toBe("");
    expect(access?.maxAge).toBe(0);
    expect(refresh?.value).toBe("");
    expect(refresh?.maxAge).toBe(0);
  });
});
