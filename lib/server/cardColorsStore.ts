/**
 * Server-only persistence for virtual card colours: one `{ cardId: colorKey }`
 * map per business.
 *
 * Backends (first match), same as `savedRecipientsStore`:
 * 1. Vercel KV REST (`KV_REST_API_URL` + `KV_REST_API_TOKEN`) — multi-instance
 * 2. Local JSON file at `.data/card-colors.json` (dev)
 *
 * Colours are cosmetic, so a failed write degrades to in-memory rather than
 * failing the request.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { isCardColorKey } from "@/lib/services/cardColors";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "card-colors.json");

/** Upper bound per business — far above any real card count. */
export const MAX_CARD_COLORS_PER_BUSINESS = 1000;

export type CardColorMap = Record<string, string>;

type StoreShape = { byBusinessId: Record<string, CardColorMap> };

let memory: StoreShape | null = null;
let writeChain: Promise<void> = Promise.resolve();

function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL?.trim() && process.env.KV_REST_API_TOKEN?.trim());
}

function kvKey(businessId: number): string {
  return `card-colors:biz:${businessId}`;
}

/** Drop anything that isn't a known palette key (old data, manual edits). */
function clean(map: unknown): CardColorMap {
  if (!map || typeof map !== "object" || Array.isArray(map)) return {};
  const out: CardColorMap = {};
  for (const [cardId, key] of Object.entries(map as Record<string, unknown>)) {
    if (isCardColorKey(key)) out[cardId] = key;
  }
  return out;
}

async function kvGet(businessId: number): Promise<CardColorMap> {
  const base = process.env.KV_REST_API_URL!.replace(/\/$/, "");
  const res = await fetch(`${base}/get/${encodeURIComponent(kvKey(businessId))}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return {};
  const json = (await res.json()) as { result?: string | null };
  if (!json.result) return {};
  try {
    return clean(JSON.parse(json.result));
  } catch {
    return {};
  }
}

async function kvSet(businessId: number, map: CardColorMap): Promise<void> {
  const base = process.env.KV_REST_API_URL!.replace(/\/$/, "");
  const res = await fetch(`${base}/set/${encodeURIComponent(kvKey(businessId))}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(map),
  });
  if (!res.ok) throw new Error(`KV set failed (${res.status})`);
}

async function ensureLoaded(): Promise<StoreShape> {
  if (memory) return memory;
  try {
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as StoreShape;
    memory = { byBusinessId: {} };
    for (const [biz, map] of Object.entries(parsed?.byBusinessId ?? {})) {
      memory.byBusinessId[biz] = clean(map);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[cardColorsStore] failed to read store, starting empty:", err);
    }
    memory = { byBusinessId: {} };
  }
  return memory;
}

async function persist(store: StoreShape): Promise<void> {
  writeChain = writeChain.then(
    async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const tmp = `${DATA_FILE}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
      await fs.rename(tmp, DATA_FILE);
    },
    () => undefined,
  );
  await writeChain;
}

export async function getCardColors(businessId: number): Promise<CardColorMap> {
  if (kvConfigured()) return kvGet(businessId);
  const store = await ensureLoaded();
  return { ...(store.byBusinessId[String(businessId)] ?? {}) };
}

export async function setCardColor(
  businessId: number,
  cardId: string,
  color: string,
): Promise<{ ok: true; colors: CardColorMap } | { ok: false; status: 400; message: string }> {
  const current = await getCardColors(businessId);
  if (
    !(cardId in current) &&
    Object.keys(current).length >= MAX_CARD_COLORS_PER_BUSINESS
  ) {
    return { ok: false, status: 400, message: "Too many card colours saved" };
  }
  const next = { ...current, [cardId]: color };

  if (kvConfigured()) {
    await kvSet(businessId, next);
    return { ok: true, colors: next };
  }
  const store = await ensureLoaded();
  store.byBusinessId[String(businessId)] = next;
  try {
    await persist(store);
  } catch (err) {
    console.warn("[cardColorsStore] persist failed (in-memory only):", err);
  }
  return { ok: true, colors: next };
}

/** Test helper — reset the in-memory store. */
export function __resetCardColorsStoreForTests(): void {
  memory = { byBusinessId: {} };
  writeChain = Promise.resolve();
}
