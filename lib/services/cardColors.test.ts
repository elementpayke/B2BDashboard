import { describe, expect, it } from "vitest";
import {
  CARD_COLORS,
  cardColor,
  cardShadow,
  isCardColorKey,
  nextCardColor,
  resolveCardColors,
} from "./cardColors";

const keys = CARD_COLORS.map((c) => c.key);

describe("CARD_COLORS", () => {
  it("is the twelve-colour spec palette in spec order", () => {
    expect(keys).toEqual([
      "indigo", "marigold", "ink", "lavender", "coral", "mint",
      "cobalt", "bone", "orchid", "sky", "lift", "plum",
    ]);
    expect(cardColor("indigo")).toMatchObject({ bg: "#3B2ED3", ink: "#FFFFFF" });
    expect(cardColor("bone")).toMatchObject({ bg: "#F6F4EF", ink: "#131126" });
  });

  it("falls back to Mboka Indigo for unknown keys", () => {
    expect(cardColor("nope").key).toBe("indigo");
    expect(cardColor(null).key).toBe("indigo");
    expect(isCardColorKey("plum")).toBe(true);
    expect(isCardColorKey("PLUM")).toBe(false);
    expect(isCardColorKey(undefined)).toBe(false);
  });

  it("derives the shadow from bg at B3 alpha", () => {
    expect(cardShadow(cardColor("coral"))).toBe(
      "0 24px 44px -24px #FF6A55B3, inset 0 1px 0 rgba(255,255,255,.25)",
    );
  });
});

describe("nextCardColor", () => {
  it("gives the first palette colour no card uses", () => {
    expect(nextCardColor([])).toBe("indigo");
    expect(nextCardColor([{ color: "indigo" }])).toBe("marigold");
    expect(nextCardColor([{ color: "marigold" }, { color: "indigo" }])).toBe("ink");
    expect(nextCardColor([{ color: "marigold" }])).toBe("indigo");
  });

  it("once all twelve are used, picks randomly but never the newest card's colour", () => {
    const all = keys.map((color) => ({ color })); // newest first, so newest = indigo
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const pick = nextCardColor(all, () => i / 50);
      expect(pick).not.toBe("indigo");
      seen.add(pick);
    }
    expect(seen.size).toBe(11);
    // random() returning just under 1 stays in range
    expect(keys).toContain(nextCardColor(all, () => 0.9999999));
  });
});

describe("resolveCardColors", () => {
  const card = (id: string, day: number) => ({
    id,
    created_at: `2026-10-${String(day).padStart(2, "0")}T00:00:00Z`,
  });

  it("assigns unsaved cards oldest-first in palette order", () => {
    const cards = [card("c3", 3), card("c1", 1), card("c2", 2)]; // API order: newest first
    expect(resolveCardColors(cards, {})).toEqual({ c1: "indigo", c2: "marigold", c3: "ink" });
  });

  it("keeps saved colours and never duplicates them on unsaved cards", () => {
    const cards = [card("c1", 1), card("c2", 2), card("c3", 3)];
    expect(resolveCardColors(cards, { c3: "indigo", c1: "coral" })).toEqual({
      c1: "coral",
      c2: "marigold",
      c3: "indigo",
    });
  });

  it("ignores saved keys that aren't in the palette", () => {
    expect(resolveCardColors([card("c1", 1)], { c1: "neon" })).toEqual({ c1: "indigo" });
  });

  it("is stable across calls once the palette overflows", () => {
    const cards = Array.from({ length: 15 }, (_, i) => card(`c${i}`, i + 1));
    const a = resolveCardColors(cards, {});
    const b = resolveCardColors([...cards].reverse(), {});
    expect(a).toEqual(b);
    expect(new Set(Object.values(a).slice(0, 12)).size).toBe(12);
    // Overflow cards never repeat the colour of the card issued just before.
    for (let i = 12; i < 15; i += 1) {
      expect(a[`c${i}`]).not.toBe(a[`c${i - 1}`]);
    }
  });
});
