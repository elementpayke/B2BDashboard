/**
 * Virtual card colour palette and assignment (Cards design spec §4–5).
 *
 * Each card stores a palette `key`. The surface is `bg`, and every piece of
 * text, the Mboka mark and the background graphic use `ink`. Frozen cards keep
 * their palette — the frozen overlay sits on top instead.
 *
 * Persistence lives in `app/api/card-colors` (server) and
 * `lib/clients/cardColorsApi.ts` (browser).
 */

export type CardColor = {
  key: string;
  name: string;
  bg: string;
  ink: string;
};

export const CARD_COLORS: readonly CardColor[] = [
  { key: "indigo", name: "Mboka Indigo", bg: "#3B2ED3", ink: "#FFFFFF" },
  { key: "marigold", name: "Marigold", bg: "#FFB224", ink: "#131126" },
  { key: "ink", name: "Ink", bg: "#131126", ink: "#FFFFFF" },
  { key: "lavender", name: "Lavender", bg: "#9590E6", ink: "#131126" },
  { key: "coral", name: "Coral", bg: "#FF6A55", ink: "#131126" },
  { key: "mint", name: "Mint", bg: "#5ED6B4", ink: "#131126" },
  { key: "cobalt", name: "Cobalt", bg: "#2457E6", ink: "#FFFFFF" },
  { key: "bone", name: "Bone", bg: "#F6F4EF", ink: "#131126" },
  { key: "orchid", name: "Orchid", bg: "#A94BD9", ink: "#FFFFFF" },
  { key: "sky", name: "Sky", bg: "#63B3FF", ink: "#131126" },
  { key: "lift", name: "Indigo Lift", bg: "#7C6FFF", ink: "#131126" },
  { key: "plum", name: "Plum", bg: "#4A1D6E", ink: "#FFFFFF" },
];

export type CardColorKey = (typeof CARD_COLORS)[number]["key"];

export const DEFAULT_CARD_COLOR: CardColor = CARD_COLORS[0];

const BY_KEY = new Map(CARD_COLORS.map((c) => [c.key, c]));

export function isCardColorKey(value: unknown): value is CardColorKey {
  return typeof value === "string" && BY_KEY.has(value);
}

export function cardColor(key: string | null | undefined): CardColor {
  return (key && BY_KEY.get(key)) || DEFAULT_CARD_COLOR;
}

/** Card shadow: `bg` at B3 (70%) alpha, plus the top-edge highlight. */
export function cardShadow(color: CardColor): string {
  return `0 24px 44px -24px ${color.bg}B3, inset 0 1px 0 rgba(255,255,255,.25)`;
}

/**
 * Colour for a newly issued card. `cards` is newest first.
 *
 * The first palette colour no existing card uses; once all twelve are taken,
 * a random colour that differs from the most recent card's.
 */
export function nextCardColor(
  cards: ReadonlyArray<{ color?: string | null }>,
  random: () => number = Math.random,
): CardColorKey {
  const used = new Set(cards.map((c) => c.color));
  const fresh = CARD_COLORS.find((c) => !used.has(c.key));
  if (fresh) return fresh.key;
  const last = cards[0]?.color;
  const pool = CARD_COLORS.filter((c) => c.key !== last);
  return pool[Math.floor(random() * pool.length) % pool.length].key;
}

/** Stable [0, 1) from a string, so fallback picks don't change across renders. */
function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * Resolve a colour key for every card.
 *
 * Stored keys win. Cards without one (issued before colours existed, or whose
 * save failed) are filled oldest-first with the same rule a new card gets, so
 * a business's first twelve cards never share a colour. The overflow pick is
 * seeded by card id, not `Math.random`, so it is stable across reloads without
 * having to be written back.
 */
export function resolveCardColors(
  cards: ReadonlyArray<{ id: string; created_at?: string | null }>,
  stored: Readonly<Record<string, string>>,
): Record<string, CardColorKey> {
  const out: Record<string, CardColorKey> = {};
  const oldestFirst = [...cards].sort((a, b) =>
    String(a.created_at || "").localeCompare(String(b.created_at || "")),
  );
  const assigned: { color: string }[] = []; // newest first
  for (const card of oldestFirst) {
    const saved = stored[card.id];
    if (isCardColorKey(saved)) {
      out[card.id] = saved;
    }
  }
  for (const card of oldestFirst) {
    const key =
      out[card.id] ??
      nextCardColor(
        // Stored colours count as used even when that card is newer, so a
        // fallback never duplicates a colour someone deliberately picked.
        [...assigned, ...Object.values(out).map((color) => ({ color }))],
        () => seededUnit(card.id),
      );
    out[card.id] = key;
    assigned.unshift({ color: key });
  }
  return out;
}
