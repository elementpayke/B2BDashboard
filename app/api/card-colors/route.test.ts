import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const store = vi.hoisted(() => ({
  getCardColors: vi.fn(),
  setCardColor: vi.fn(),
}));
vi.mock("@/lib/server/cardColorsStore", () => store);
vi.mock("@/lib/server/session", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireSessionBusiness: vi.fn(async () => ({ businessId: 9 })),
    jsonSuccess: (data: unknown) => NextResponse.json({ status: "success", data }),
    jsonError: (status: number, message: string) =>
      NextResponse.json({ status: "error", message, data: null }, { status }),
  };
});

import { GET, PUT } from "./route";

const ORIGIN = "http://localhost:3000";

function put(body: unknown, origin = ORIGIN) {
  return new NextRequest(`${ORIGIN}/api/card-colors`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", origin },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("/api/card-colors", () => {
  beforeEach(() => {
    store.getCardColors.mockReset().mockResolvedValue({ card_a: "mint" });
    store.setCardColor
      .mockReset()
      .mockImplementation(async (_b: number, id: string, color: string) => ({
        ok: true,
        colors: { [id]: color },
      }));
  });

  it("GET returns the business's colour map", async () => {
    const res = await GET(new NextRequest(`${ORIGIN}/api/card-colors`));
    expect(await res.json()).toMatchObject({ data: { colors: { card_a: "mint" } } });
    expect(store.getCardColors).toHaveBeenCalledWith(9);
  });

  it("PUT saves a palette key for the session's business", async () => {
    const res = await PUT(put({ cardId: "card_a", color: "plum" }));
    expect(res.status).toBe(200);
    expect(store.setCardColor).toHaveBeenCalledWith(9, "card_a", "plum");
  });

  it.each([
    [{ cardId: "card_a", color: "neon" }, /palette/],
    [{ cardId: "", color: "plum" }, /cardId/],
    [{ cardId: "../etc/passwd", color: "plum" }, /cardId/],
    [{ cardId: "x".repeat(129), color: "plum" }, /cardId/],
    [{ color: "plum" }, /cardId/],
    ["{not json", /JSON/],
  ])("PUT rejects %j", async (body, message) => {
    const res = await PUT(put(body));
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(message);
    expect(store.setCardColor).not.toHaveBeenCalled();
  });

  it("PUT refuses cross-origin writes", async () => {
    const res = await PUT(put({ cardId: "card_a", color: "plum" }, "https://evil.example"));
    expect(res.status).toBe(403);
    expect(store.setCardColor).not.toHaveBeenCalled();
  });
});
