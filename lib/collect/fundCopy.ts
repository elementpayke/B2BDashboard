/** Honest Collect Fund copy — no fake CCTP / cross-rail promises. */

export function fundStablecoinRailSummary(input: {
  targetName: string;
  currency: string;
  networkLabel: string;
}): string {
  const asset = (input.currency || "").trim().toUpperCase();
  const network = (input.networkLabel || "").trim();
  if (asset === "USDC") {
    const net = network.toUpperCase();
    const isEvm =
      net.includes("BASE") ||
      net.includes("ETHEREUM") ||
      net.includes("POLYGON") ||
      net.includes("ARBITRUM") ||
      net.includes("OPTIMISM");
    if (isEvm) {
      return `Deposit USDC on ${network}. Credits your Stellar USDC after CCTP processing.`;
    }
    return `Deposit USDC on ${network}. Credits your USDC balance after processing.`;
  }
  if (asset === "EURC" || asset === "USDT") {
    return `Deposit ${asset} on ${network}. Converts to USDC via Aquarius.`;
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
