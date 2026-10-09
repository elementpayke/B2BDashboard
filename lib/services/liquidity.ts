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
  for (const key of ["pairs", "items", "data", "snapshots"] as const) {
    const nested = obj[key];
    if (Array.isArray(nested)) {
      return nested.map(asRecord).filter((row): row is Record<string, unknown> => row !== null);
    }
  }
  const provider = asRecord(obj.provider_data);
  if (provider) {
    for (const key of ["pairs", "items", "data", "snapshots"] as const) {
      const nested = provider[key];
      if (Array.isArray(nested)) {
        return nested
          .map(asRecord)
          .filter((row): row is Record<string, unknown> => row !== null);
      }
    }
  }
  return [];
}

function depthMid(depth: unknown): string | null {
  const obj = asRecord(depth);
  if (!obj) return null;
  return asText(obj.mid ?? obj.best_bid ?? obj.best_ask ?? obj.bid ?? obj.ask);
}

function normalizePair(row: Record<string, unknown>, index: number): StellarLiquidityPair | null {
  const base = asText(row.base ?? row.base_asset ?? row.from_asset ?? row.source_asset);
  const quote = asText(row.quote ?? row.quote_asset ?? row.to_asset ?? row.destination_asset);
  const pairLabel = asText(row.pair ?? row.symbol);
  const resolvedBase = base || pairLabel?.split("/")[0]?.trim() || null;
  const resolvedQuote = quote || pairLabel?.split("/")[1]?.trim() || null;
  if (!resolvedBase || !resolvedQuote) return null;
  const fromDepth = depthMid(row.depth ?? row.depth_json);
  return {
    id: asText(row.id) || pairLabel || `${resolvedBase}-${resolvedQuote}-${index}`,
    base: resolvedBase.toUpperCase(),
    quote: resolvedQuote.toUpperCase(),
    pair: `${resolvedBase.toUpperCase()}/${resolvedQuote.toUpperCase()}`,
    bid: asText(row.bid ?? row.best_bid ?? row.buy) || fromDepth,
    ask: asText(row.ask ?? row.best_ask ?? row.sell) || fromDepth,
  };
}

export function normalizeStellarLiquidity(raw: unknown): StellarLiquiditySnapshot {
  const obj = asRecord(raw);
  const provider = asRecord(obj?.provider_data);
  const rows = extractRows(raw);
  const refreshed =
    asText(obj?.refreshed_at ?? obj?.refreshedAt ?? obj?.updated_at) ||
    asText(rows[0]?.captured_at) ||
    asText(provider?.refreshed_at);
  return {
    refreshed_at: refreshed,
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
