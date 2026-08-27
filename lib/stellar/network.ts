import { toPartnerNetwork } from "@/lib/services/entities";

/** Circle USDC on Stellar public. */
export const STELLAR_USDC_ISSUER_PUBLIC =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

/** Circle USDC on Stellar testnet (Centre/Circle). */
export const STELLAR_USDC_ISSUER_TESTNET =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export const STELLAR_PUBLIC_PASSPHRASE =
  "Public Global Stellar Network ; September 2015";
export const STELLAR_TESTNET_PASSPHRASE =
  "Test SDF Network ; September 2015";

export type StellarNetworkConfig = {
  isTestnet: boolean;
  networkPassphrase: string;
  horizonUrl: string;
  usdcIssuer: string;
};

export function isStellarNetwork(network: string | null | undefined): boolean {
  return toPartnerNetwork(network || "") === "Stellar";
}

export function isStellarUsdcRail(opts: {
  network: string;
  currency: string;
}): boolean {
  return isStellarNetwork(opts.network) && opts.currency.trim().toUpperCase() === "USDC";
}

export function resolveStellarNetwork(network: string | null | undefined): StellarNetworkConfig {
  const key = (network || "").trim().toLowerCase();
  const isPublic = key.includes("public") || key.includes("mainnet") || key.includes("pubnet");
  if (isPublic) {
    return {
      isTestnet: false,
      networkPassphrase: STELLAR_PUBLIC_PASSPHRASE,
      horizonUrl: "https://horizon.stellar.org",
      usdcIssuer: STELLAR_USDC_ISSUER_PUBLIC,
    };
  }
  return {
    isTestnet: true,
    networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
    horizonUrl: "https://horizon-testnet.stellar.org",
    usdcIssuer: STELLAR_USDC_ISSUER_TESTNET,
  };
}

export function truncateStellarAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-6)}`;
}
