/** Fund rail copy — simple deposit messaging (no bridge jargon). */

export function isCollectCctpRail(input: {
  railId?: string | null;
  chainDisclaimer?: string | null;
}): boolean {
  return String(input.railId || "").startsWith("collect-cctp:");
}

export function fundStablecoinRailSummary(input: {
  targetName: string;
  currency: string;
  networkLabel: string;
  railId?: string | null;
  chainDisclaimer?: string | null;
}): string {
  const asset = (input.currency || "").trim().toUpperCase();
  const network = (input.networkLabel || "").trim();
  if (asset === "USDC") {
    return `Deposit USDC on ${network}. Credits your USDC balance after processing.`;
  }
  if (asset === "EURC") {
    return `Deposit EURC on ${network}. Converts to USDC via Aquarius.`;
  }
  if (asset === "USDT") {
    return `Deposit USDT on ${network}. Credits your USDT balance.`;
  }
  return `Deposit ${asset || "asset"} on ${network || "selected network"}.`;
}

export function isEvmEurcRail(currency: string, network: string): boolean {
  const asset = (currency || "").trim().toUpperCase();
  const net = (network || "").trim().toUpperCase();
  if (asset !== "EURC") return false;
  return net.includes("BASE") || net.includes("POLYGON") || net.includes("ETHEREUM")
    || net.includes("ARBITRUM") || net.includes("OPTIMISM");
}
