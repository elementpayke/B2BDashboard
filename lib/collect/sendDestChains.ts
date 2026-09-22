/** Dest-chain chips for USDC Send (Stellar home → EVM or Stellar). No CCTP jargon. */

import { formatNetworkLabel } from "@/lib/services/entities";

/** Catalog aligned with Aggregator Collect allowlist + Stellar. */
export const USDC_SEND_DEST_NETWORKS = [
  { key: "base", label: "Base" },
  { key: "polygon", label: "Polygon" },
  { key: "ethereum", label: "Ethereum" },
  { key: "optimism", label: "Optimism" },
  { key: "arbitrum", label: "Arbitrum" },
  { key: "stellar", label: "Stellar" },
] as const;

export type UsdcSendDestNetworkKey = (typeof USDC_SEND_DEST_NETWORKS)[number]["key"];

/**
 * Map Mboka/Aggregator ``GET /v1/collect/cctp/supported-chains`` into lowercase
 * chain keys. Empty / unknown shapes → [].
 */
export function parseCollectSupportedChainKeys(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const raw =
    data.chains ??
    data.evm_chains ??
    data.supported_chains ??
    data.collect_chains ??
    (Array.isArray(data) ? data : null);
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    let key = "";
    if (typeof item === "string") {
      key = item.trim().toLowerCase();
    } else if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      key = String(row.network || row.chain || row.id || "")
        .trim()
        .toLowerCase();
    }
    if (!key || seen.has(key) || key === "stellar") continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * Dest chips: Aggregator-supported EVM keys (when present) ∩ catalog, plus Stellar.
 * When supported list is empty (Collect off), use full catalog so Stellar→Stellar
 * and same UX still work; EVM preview fails closed upstream when the send flag is off.
 */
export function buildUsdcSendDestChains(opts?: {
  supportedChainKeys?: string[] | null;
}): Array<{ key: string; label: string }> {
  const supported = (opts?.supportedChainKeys || [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  const catalog: Array<{ key: string; label: string }> = USDC_SEND_DEST_NETWORKS.map(
    (n) => ({
      key: n.key,
      label: n.label,
    }),
  );
  if (supported.length === 0) {
    return catalog;
  }
  const allow = new Set(supported);
  const evm: Array<{ key: string; label: string }> = catalog.filter(
    (n) => n.key !== "stellar" && allow.has(n.key),
  );
  // If API returns unknown keys, surface them with formatted labels.
  for (const key of supported) {
    if (key === "stellar") continue;
    if (evm.some((n) => n.key === key)) continue;
    evm.push({ key, label: formatNetworkLabel(key) });
  }
  return [...evm, { key: "stellar", label: "Stellar" }];
}
