/** Collect CCTP EVM deposit rails from Mboka deposit-instructions. */

import type { FundStablecoinRail } from "@/lib/services/entities";
import { formatNetworkLabel } from "@/lib/services/entities";

export type CollectEvmUsdcRow = {
  network?: string;
  chain?: string;
  address?: string;
  asset?: string;
  token_address?: string;
};

/**
 * Map Aggregator/Mboka ``collect.evm_usdc[]`` into Fund modal rails.
 * Additive only — does not invent addresses.
 */
export function buildCollectEvmFundRails(
  depositInstructions: unknown,
  opts: { homeAccountId: string },
): FundStablecoinRail[] {
  const { homeAccountId } = opts;
  if (!depositInstructions || typeof depositInstructions !== "object") return [];
  const root = depositInstructions as Record<string, unknown>;
  const collect = root.collect;
  const list =
    collect && typeof collect === "object"
      ? (collect as Record<string, unknown>).evm_usdc
      : root.element_evm_usdc_chains;
  if (!Array.isArray(list)) return [];

  const out: FundStablecoinRail[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as CollectEvmUsdcRow;
    const network = String(row.network || row.chain || "").trim().toLowerCase();
    const address = String(row.address || "").trim();
    const asset = String(row.asset || "USDC").trim().toUpperCase();
    if (!network || !address.startsWith("0x") || address.length < 42 || asset !== "USDC") {
      continue;
    }
    const networkLabel = formatNetworkLabel(network);
    out.push({
      id: `collect-cctp:${homeAccountId}:${network}:${address.toLowerCase()}`,
      currency: "USDC",
      network,
      networkLabel,
      walletAddress: address,
      chainDisclaimer: `Send only USDC on ${networkLabel}. Credits Stellar USDC after CCTP processing.`,
      checkoutUrl: null,
    });
  }
  return out;
}

/** Prefer account rails, then Collect EVM rails (dedupe by network+address). */
export function mergeFundStablecoinRails(
  accountRails: FundStablecoinRail[],
  collectRails: FundStablecoinRail[],
): FundStablecoinRail[] {
  const seen = new Set(
    accountRails.map(
      (r) => `${r.network.trim().toLowerCase()}:${(r.walletAddress || "").trim().toLowerCase()}`,
    ),
  );
  const merged = [...accountRails];
  for (const rail of collectRails) {
    const key = `${rail.network.trim().toLowerCase()}:${(rail.walletAddress || "").trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(rail);
  }
  return merged;
}
