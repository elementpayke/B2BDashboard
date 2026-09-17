import { apiEnvelope } from "@/lib/apiClient";

export type StellarLiquidityPair = {
  id: string;
  base: string;
  quote: string;
  pair: string;
  bid: string | null;
  ask: string | null;
};

export type StellarLiquiditySnapshot = {
  refreshed_at: string | null;
  pairs: StellarLiquidityPair[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text || null;
}

function extractRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.map(asRecord).filter((row): row is Record<string, unknown> => row !== null);
  }
  const obj = asRecord(raw);
  if (!obj) return [];
  for (const key of ["pairs", "items", "data"] as const) {
    const nested = obj[key];
    if (Array.isArray(nested)) {
      return nested.map(asRecord).filter((row): row is Record<string, unknown> => row !== null);
    }
  }
  return [];
}

function normalizePair(row: Record<string, unknown>, index: number): StellarLiquidityPair | null {
  const base = asText(row.base ?? row.base_asset ?? row.from_asset ?? row.source_asset);
  const quote = asText(row.quote ?? row.quote_asset ?? row.to_asset ?? row.destination_asset);
  const pairLabel = asText(row.pair ?? row.symbol);
  const resolvedBase = base || pairLabel?.split("/")[0]?.trim() || null;
  const resolvedQuote = quote || pairLabel?.split("/")[1]?.trim() || null;
  if (!resolvedBase || !resolvedQuote) return null;
  return {
    id: asText(row.id) || pairLabel || `${resolvedBase}-${resolvedQuote}-${index}`,
    base: resolvedBase.toUpperCase(),
    quote: resolvedQuote.toUpperCase(),
    pair: `${resolvedBase.toUpperCase()}/${resolvedQuote.toUpperCase()}`,
    bid: asText(row.bid ?? row.best_bid ?? row.buy),
    ask: asText(row.ask ?? row.best_ask ?? row.sell),
  };
}

export function normalizeStellarLiquidity(raw: unknown): StellarLiquiditySnapshot {
  const obj = asRecord(raw);
  const rows = extractRows(raw);
  return {
    refreshed_at: asText(obj?.refreshed_at ?? obj?.refreshedAt ?? obj?.updated_at),
    pairs: rows
      .map((row, index) => normalizePair(row, index))
      .filter((pair): pair is StellarLiquidityPair => pair !== null),
  };
}

export const liquidityApi = {
  async stellar(): Promise<StellarLiquiditySnapshot> {
    const raw = await apiEnvelope<unknown>("GET", "/v1/liquidity/stellar");
    return normalizeStellarLiquidity(raw);
  },
};
