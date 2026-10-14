"use client";

/**
 * Browser client for card colours (`/api/card-colors`).
 *
 * The server map is the source of truth. A localStorage copy keeps colours
 * steady when the BFF is unreachable and lets a pick show instantly; colours
 * are cosmetic, so a failed load falls back to that copy instead of erroring
 * the Cards screen.
 */

import { authEnvelope } from "@/lib/apiClient";
import { isCardColorKey, type CardColorKey } from "@/lib/services/cardColors";

const STORAGE_KEY = "ep.cardColors.v1";

export type CardColorMap = Record<string, CardColorKey>;

function sanitize(raw: unknown): CardColorMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: CardColorMap = {};
  for (const [id, key] of Object.entries(raw as Record<string, unknown>)) {
    if (isCardColorKey(key)) out[id] = key;
  }
  return out;
}

function readLocal(): CardColorMap {
  if (typeof window === "undefined") return {};
  try {
    return sanitize(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch {
    return {};
  }
}

function writeLocal(map: CardColorMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* private mode / quota — the server copy still holds */
  }
}

export async function listCardColors(): Promise<CardColorMap> {
  try {
    const data = await authEnvelope<{ colors?: unknown }>("GET", "/api/card-colors");
    // Local picks the server hasn't confirmed yet survive; server wins on conflict.
    const merged = { ...readLocal(), ...sanitize(data?.colors) };
    writeLocal(merged);
    return merged;
  } catch {
    return readLocal();
  }
}

/** Save a card's colour. Resolves with the full map; rejects if the server refused. */
export async function saveCardColor(cardId: string, color: CardColorKey): Promise<CardColorMap> {
  writeLocal({ ...readLocal(), [cardId]: color });
  const data = await authEnvelope<{ colors?: unknown }>("PUT", "/api/card-colors", {
    cardId,
    color,
  });
  const merged = { ...readLocal(), ...sanitize(data?.colors) };
  writeLocal(merged);
  return merged;
}
