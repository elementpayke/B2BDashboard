const STELLAR_NETWORK_KEYS = new Set(["STELLAR", "STELLAR_PUBLIC", "STELLAR_TESTNET"]);

/**
 * Allowlisted non-USDC assets that can be opened on Stellar for demo / staged
 * rollout flows. Deposits on these rails still settle as USDC.
 */
export const STELLAR_STABLE_ALLOWLIST = ["USDT", "EURC"] as const;

export const SHOW_STELLAR_LIQUIDITY_PANEL = true;

/**
 * Default-on for the SCF demo branch. Flip to false to keep the old waitlist
 * panel without deleting the wizard.
 */
export const STELLAR_BULK_PAYOUTS_ENABLED = true;

export function isStellarNetworkKey(network: string | null | undefined): boolean {
  return STELLAR_NETWORK_KEYS.has((network || "").trim().toUpperCase());
}

export function isAllowlistedStellarStable(currency: string | null | undefined): boolean {
  const code = (currency || "").trim().toUpperCase();
  return STELLAR_STABLE_ALLOWLIST.includes(
    code as (typeof STELLAR_STABLE_ALLOWLIST)[number],
  );
}

export function settlesAsUsdcOnStellar(
  currency: string | null | undefined,
  network: string | null | undefined,
): boolean {
  const code = (currency || "").trim().toUpperCase();
  return code !== "USDC" && isStellarNetworkKey(network) && isAllowlistedStellarStable(code);
}
