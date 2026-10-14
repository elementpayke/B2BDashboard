import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Keep tests off the real `.data/` dev store.
vi.mock("node:fs", () => {
  const enoent = Object.assign(new Error("missing"), { code: "ENOENT" });
  return {
    promises: {
      readFile: vi.fn(async () => {
        throw enoent;
      }),
      writeFile: vi.fn(async () => undefined),
      rename: vi.fn(async () => undefined),
      mkdir: vi.fn(async () => undefined),
    },
  };
});

import {
  __resetCardColorsStoreForTests,
  getCardColors,
  MAX_CARD_COLORS_PER_BUSINESS,
  setCardColor,
} from "./cardColorsStore";

describe("cardColorsStore (file backend)", () => {
  beforeEach(() => __resetCardColorsStoreForTests());

  it("saves and reads colours per business", async () => {
    await setCardColor(1, "card_a", "mint");
    await setCardColor(1, "card_b", "plum");
    await setCardColor(2, "card_a", "coral");
    expect(await getCardColors(1)).toEqual({ card_a: "mint", card_b: "plum" });
    expect(await getCardColors(2)).toEqual({ card_a: "coral" });
    expect(await getCardColors(3)).toEqual({});
  });

  it("overwrites a card's colour", async () => {
    await setCardColor(1, "card_a", "mint");
    const saved = await setCardColor(1, "card_a", "sky");
    expect(saved).toEqual({ ok: true, colors: { card_a: "sky" } });
  });

  it("caps how many cards one business can store, but still allows updates", async () => {
    for (let i = 0; i < MAX_CARD_COLORS_PER_BUSINESS; i += 1) {
      await setCardColor(7, `card_${i}`, "ink");
    }
    expect(await setCardColor(7, "card_new", "ink")).toMatchObject({ ok: false, status: 400 });
    expect(await setCardColor(7, "card_0", "bone")).toMatchObject({ ok: true });
  });
});

describe("cardColorsStore (KV backend)", () => {
  let kv: Record<string, string>;

  beforeEach(() => {
    kv = {};
    vi.stubEnv("KV_REST_API_URL", "https://kv.example/");
    vi.stubEnv("KV_REST_API_TOKEN", "t0ken");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const [, op, key] = new URL(url).pathname.split("/");
        const k = decodeURIComponent(key);
        if (op === "set") {
          kv[k] = String(init?.body);
          return new Response(JSON.stringify({ result: "OK" }));
        }
        return new Response(JSON.stringify({ result: kv[k] ?? null }));
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("round-trips through a per-business KV key", async () => {
    await setCardColor(42, "card_a", "orchid");
    expect(Object.keys(kv)).toEqual(["card-colors:biz:42"]);
    expect(await getCardColors(42)).toEqual({ card_a: "orchid" });
  });

  it("drops unknown colour keys read back from KV", async () => {
    kv["card-colors:biz:5"] = JSON.stringify({ a: "mint", b: "neon", c: 3 });
    expect(await getCardColors(5)).toEqual({ a: "mint" });
  });

  it("fails loudly when KV rejects a write", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(setCardColor(1, "card_a", "mint")).rejects.toThrow(/KV set failed/);
  });
});
