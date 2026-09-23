export type CollectEventTime = {
  sourceTxHash: string;
  createdAt: string;
};

type TimedRow = {
  source?: string | null;
  source_tx_hash?: string | null;
  created_at: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

/** Pull `source_tx_hash` + `created_at` from the collect transfers payload. */
export function collectEventTimesFromPayload(raw: unknown): CollectEventTime[] {
  const obj = asRecord(raw);
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(obj?.transfers)
      ? obj.transfers
      : Array.isArray(obj?.items)
        ? obj.items
        : [];
  const times: CollectEventTime[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const sourceTxHash = text(record.source_tx_hash ?? record.sourceTxHash).toLowerCase();
    const createdAt = text(record.created_at ?? record.createdAt);
    if (!sourceTxHash || !createdAt) continue;
    times.push({ sourceTxHash, createdAt });
  }
  return times;
}

/**
 * Replace a Collect row's sync clock with the worker's event time, matched
 * on the Base source transaction. Other rows stay as they are.
 */
export function applyCollectEventTimes<T extends TimedRow>(
  items: T[],
  transfers: CollectEventTime[],
): T[] {
  if (!transfers.length || !items.length) return items;
  const byHash = new Map(transfers.map((row) => [row.sourceTxHash, row.createdAt]));
  return items.map((item) => {
    if (String(item.source ?? "").trim().toLowerCase() !== "cctp_transfer") return item;
    const hash = String(item.source_tx_hash ?? "").trim().toLowerCase();
    const createdAt = hash ? byHash.get(hash) : undefined;
    if (!createdAt || createdAt === item.created_at) return item;
    return { ...item, created_at: createdAt };
  });
}
