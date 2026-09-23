/** Collect CCTP EVM deposit rails from Mboka deposit-instructions. */

import type { FundStablecoinRail } from "@/lib/services/entities";
import { formatNetworkLabel } from "@/lib/services/entities";
import { fundStablecoinRailSummary } from "@/lib/collect/fundCopy";

export type CollectEvmUsdcRow = {
  network?: string;
  chain?: string;
  address?: string;
  asset?: string;
  token_address?: string;
};

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isEvmDepositAddress(value: string): boolean {
  return EVM_ADDRESS_RE.test(value.trim());
}

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
    if (!network || !isEvmDepositAddress(address) || asset !== "USDC") {
      continue;
    }
    const networkLabel = formatNetworkLabel(network);
    out.push({
      id: `collect-cctp:${homeAccountId}:${network}:${address.toLowerCase()}`,
      currency: "USDC",
      network,
      networkLabel,
      walletAddress: address,
      chainDisclaimer: `Send only USDC on ${networkLabel}. Credits your USDC balance after processing.`,
      checkoutUrl: null,
    });
  }
  return out;
}

/** Prefer Collect EVM rails first, then Stellar home (dedupe by network+address). */
export function mergeFundStablecoinRails(
  preferredRails: FundStablecoinRail[],
  extraRails: FundStablecoinRail[],
): FundStablecoinRail[] {
  const railKey = (r: FundStablecoinRail) =>
    `${r.currency.trim().toUpperCase()}:${r.network.trim().toLowerCase()}:${(r.walletAddress || "").trim().toLowerCase()}`;
  const seen = new Set(preferredRails.map(railKey));
  const merged = [...preferredRails];
  for (const rail of extraRails) {
    const key = railKey(rail);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(rail);
  }
  return merged;
}

/**
 * Fund-account stablecoin modal rails for Collect:
 * CCTP EVM USDC → Stellar home, plus the Stellar USDC home address.
 * Blocks native EVM/USDT account wallets (those are separate balances, not Collect).
 */
export function buildCollectFundModalRails(opts: {
  accounts: Array<{
    id: string;
    currency: string;
    network: string;
    walletAddress?: string | null;
    chainDisclaimer?: string | null;
    checkoutUrl?: string | null;
    status?: string;
  }>;
  depositInstructions: unknown;
  isFundable: (account: {
    id: string;
    currency: string;
    network: string;
    walletAddress?: string | null;
    status?: string;
  }) => boolean;
  isStellarUsdc: (account: { currency: string; network: string }) => boolean;
}): FundStablecoinRail[] {
  const home = opts.accounts.find(
    (a) =>
      opts.isFundable(a) &&
      opts.isStellarUsdc({ currency: a.currency, network: a.network }),
  );
  const stellarRails: FundStablecoinRail[] = home?.walletAddress
    ? [
        {
          id: home.id,
          currency: home.currency,
          network: home.network,
          networkLabel: formatNetworkLabel(home.network),
          walletAddress: home.walletAddress.trim(),
          chainDisclaimer:
            home.chainDisclaimer ||
            `Send only USDC on Stellar. Credits your Stellar USDC home.`,
          checkoutUrl: home.checkoutUrl ?? null,
        },
      ]
    : [];
  const collectRails = home
    ? buildCollectEvmFundRails(opts.depositInstructions, {
        homeAccountId: String(home.id),
      })
    : [];
  const eurcRails = home ? stellarEurcFundRail(home, opts.depositInstructions) : [];
  // Collect EVM first, then Stellar USDC, then Stellar EURC (same G, separate asset).
  return mergeFundStablecoinRails([...collectRails, ...stellarRails], eurcRails);
}

/**
 * Deposit rails for the account the user is funding.
 * Stellar USDC (and fiat "deposit to a stablecoin") keep the Collect set:
 * USDC on Base, USDC on Stellar, EURC on Stellar.
 * Any other chain wallet gets only its own asset and address.
 */
export function fundRailsForAccount(opts: {
  selected: {
    id: string;
    currency: string;
    network: string;
    walletAddress?: string | null;
    chainDisclaimer?: string | null;
    checkoutUrl?: string | null;
    status?: string;
  } | null;
  accounts: Parameters<typeof buildCollectFundModalRails>[0]["accounts"];
  depositInstructions: unknown;
  isFundable: Parameters<typeof buildCollectFundModalRails>[0]["isFundable"];
  isStellarUsdc: Parameters<typeof buildCollectFundModalRails>[0]["isStellarUsdc"];
}): FundStablecoinRail[] {
  const selected = opts.selected;
  if (
    selected &&
    !opts.isStellarUsdc({ currency: selected.currency, network: selected.network })
  ) {
    if (!opts.isFundable(selected) || !selected.walletAddress?.trim()) return [];
    const networkLabel = formatNetworkLabel(selected.network);
    const currency = selected.currency.trim().toUpperCase();
    return [
      {
        id: selected.id,
        currency,
        network: selected.network,
        networkLabel,
        walletAddress: selected.walletAddress.trim(),
        chainDisclaimer:
          selected.chainDisclaimer ||
          `Send only ${currency} on ${networkLabel}. Funds sent on the wrong network may be lost.`,
        checkoutUrl: selected.checkoutUrl ?? null,
      },
    ];
  }
  return buildCollectFundModalRails(opts);
}

function stellarEurcFundRail(
  home: {
    id: string;
    network: string;
    walletAddress?: string | null;
  },
  depositInstructions: unknown,
): FundStablecoinRail[] {
  if (!depositInstructions || typeof depositInstructions !== "object") return [];
  const collect = (depositInstructions as Record<string, unknown>).collect;
  if (!collect || typeof collect !== "object") return [];
  const eurc = (collect as Record<string, unknown>).stellar_eurc;
  if (!eurc || typeof eurc !== "object") return [];
  const row = eurc as Record<string, unknown>;
  if (row.trustline_open !== true) return [];
  const address = String(row.address || home.walletAddress || "").trim();
  if (!address) return [];
  const networkLabel = formatNetworkLabel(home.network);
  return [
    {
      id: `${home.id}:eurc`,
      currency: "EURC",
      network: home.network,
      networkLabel,
      walletAddress: address,
      chainDisclaimer: fundStablecoinRailSummary({
        targetName: "USDC",
        currency: "EURC",
        networkLabel,
      }),
      checkoutUrl: null,
    },
  ];
}
