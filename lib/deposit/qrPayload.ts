import { parseStellarAmount } from "@/lib/stellar/amount";
import { isStellarUsdcRail, resolveStellarNetwork } from "@/lib/stellar/network";

/**
 * Payload encoded in the deposit QR.
 * Stellar USDC uses SEP-0007 so wallets can prefill destination, asset, and amount.
 * Other rails encode the raw address.
 */
export function buildDepositQrValue(opts: {
  address: string;
  currency: string;
  network: string;
  amount?: string;
}): string {
  const address = opts.address.trim();
  if (!isStellarUsdcRail(opts)) return address;

  const config = resolveStellarNetwork(opts.network);
  const params = new URLSearchParams();
  params.set("destination", address);
  params.set("asset_code", "USDC");
  params.set("asset_issuer", config.usdcIssuer);
  if (config.isTestnet) {
    params.set("network_passphrase", config.networkPassphrase);
  }
  const parsed = parseStellarAmount(opts.amount ?? "");
  if (parsed.ok) params.set("amount", parsed.amount);
  return `web+stellar:pay?${params.toString()}`;
}
