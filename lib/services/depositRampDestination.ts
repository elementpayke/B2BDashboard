import {
  isFundableStablecoinAccount,
  networksCompatible,
  toAssetNetwork,
  toPartnerNetwork,
  toUiNetworkKey,
  type FinancialAccount,
} from "@/lib/services/entities";
import { AFRICAN_FUND_FIAT_CURRENCIES } from "@/lib/services/fundOrchestration";

export type OnRampAsset = {
  currency: string;
  network: string;
};

export type OnRampDestination = {
  accountId: string | null;
  walletAddress: string;
  asset: OnRampAsset;
};

export type ResolveOnRampDestinationInput = {
  accounts: FinancialAccount[];
  /** Leftover UI chain key (`base` / `polygon` / `stellar`). */
  depositNetworkKey: string;
  /** UI asset key (`usdc` / `usdt`). Defaults to USDC. */
  depositAsset?: string | null;
  /** Account detail → Fund: pin this rail, never a leftover Polygon USDT. */
  selectedAccountId?: string | null;
  /** African path: fiat (EUR/USD/GBP) or the stablecoin being funded. */
  fundAfricanTargetCurrency?: string | null;
  /** Dashboard summary treasury — never used without a matching account asset. */
  summaryWallet?: string | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assetCurrency(depositAsset: string | null | undefined): string {
  const raw = (depositAsset || "usdc").trim().toUpperCase();
  return raw || "USDC";
}

function networksEqual(accountNetwork: string, networkKey: string): boolean {
  return networksCompatible(accountNetwork, networkKey);
}

function isStellarNetworkKey(networkKey: string): boolean {
  return toPartnerNetwork(networkKey) === "Stellar";
}

/** Stellar USDC is live; Stellar USDT is not offered. Ethereum/Solana stay listed for receive/top-up. */
export function stablecoinNetworksForAsset<T extends { key: string }>(
  networks: readonly T[],
  asset: string | null | undefined,
): T[] {
  const currency = assetCurrency(asset);
  if (currency === "USDT") {
    return networks.filter((n) => !isStellarNetworkKey(n.key));
  }
  return [...networks];
}

export type StablecoinPickerDestination = {
  address: string | null;
  emptyMessage: string;
  /**
   * When true, Receive / Top-up may offer Create Account for this rail
   * (Base / Polygon / Stellar USDC with no listed account yet).
   */
  offerCreate: boolean;
  /** Partner network code for pre-filling Create Account (`STELLAR`, …). */
  createNetwork?: string | null;
};

function isCreatableUsdcNetwork(networkKey: string): boolean {
  const partner = toPartnerNetwork(networkKey);
  return partner === "Base" || partner === "Polygon" || partner === "Stellar";
}

/**
 * Address shown on Receive / Top-up stablecoin pickers.
 * Stellar always uses a ready entity USDC wallet (G…) — never the EVM treasury.
 */
export function resolveStablecoinPickerDestination(input: {
  accounts: FinancialAccount[];
  asset: string | null | undefined;
  networkKey: string;
  treasuryWallet?: string | null;
}): StablecoinPickerDestination {
  const currency = assetCurrency(input.asset);
  const stellar = isStellarNetworkKey(input.networkKey);
  const accounts = input.accounts ?? [];
  const createNetwork = toPartnerNetwork(input.networkKey)?.toUpperCase() ?? null;
  const canCreate =
    currency === "USDC" && isCreatableUsdcNetwork(input.networkKey);

  if (stellar && currency !== "USDC") {
    return {
      address: null,
      emptyMessage: "USDT is not available on Stellar. Choose USDC or another network.",
      offerCreate: false,
    };
  }

  const listedOnRail = accounts.find(
    (a) =>
      a.assetType.toLowerCase() === "stablecoin" &&
      a.currency.trim().toUpperCase() === currency &&
      networksEqual(a.network, input.networkKey),
  );
  const match = accounts.find(
    (a) =>
      isFundableStablecoinAccount(a) &&
      a.currency.trim().toUpperCase() === currency &&
      networksEqual(a.network, input.networkKey),
  );
  const matchedAddress = clean(match?.walletAddress);

  if (stellar) {
    if (matchedAddress) {
      return { address: matchedAddress, emptyMessage: "", offerCreate: false };
    }
    if (listedOnRail) {
      return {
        address: null,
        emptyMessage:
          "Your Stellar USDC account is still opening. Come back when it is active with a deposit address.",
        offerCreate: false,
      };
    }
    return {
      address: null,
      emptyMessage: "No Stellar USDC wallet yet. Create one to get a deposit address.",
      offerCreate: true,
      createNetwork,
    };
  }

  if (matchedAddress) {
    return { address: matchedAddress, emptyMessage: "", offerCreate: false };
  }

  const treasury = clean(input.treasuryWallet);
  // Summary treasury is the EVM deposit address — never treat a G… key as Base/Polygon.
  if (treasury && !treasury.startsWith("G")) {
    return { address: treasury, emptyMessage: "", offerCreate: false };
  }

  if (listedOnRail) {
    return {
      address: null,
      emptyMessage:
        "Your wallet on this network is still opening. Come back when it is active with a deposit address.",
      offerCreate: false,
    };
  }

  return {
    address: null,
    emptyMessage: canCreate
      ? `No ${currency} wallet on this network yet. Create one to get a deposit address.`
      : "Receive address unavailable. Open a ready wallet on this network or try again later.",
    offerCreate: canCreate,
    createNetwork: canCreate ? createNetwork : null,
  };
}

function destinationFrom(account: FinancialAccount): OnRampDestination | null {
  const walletAddress = clean(account.walletAddress);
  if (!walletAddress) return null;
  const network = toAssetNetwork(account.network);
  if (!network) return null;
  return {
    accountId: account.id,
    walletAddress,
    asset: {
      currency: account.currency.trim().toUpperCase(),
      network,
    },
  };
}

/**
 * Prefer the currently selected wallet when it already matches the rail;
 * otherwise the first ready wallet on that asset/network.
 */
export function pickFundableWalletForRail(opts: {
  accounts: FinancialAccount[];
  networkKey: string;
  currency: string | null | undefined;
  preferredAccountId?: string | null;
}): FinancialAccount | null {
  const wantCurrency = assetCurrency(opts.currency);
  const fundable = (opts.accounts ?? []).filter(
    (account) =>
      isFundableStablecoinAccount(account) &&
      account.currency.trim().toUpperCase() === wantCurrency &&
      networksEqual(account.network, opts.networkKey),
  );
  if (fundable.length === 0) return null;
  const preferredId = clean(opts.preferredAccountId);
  if (preferredId) {
    const preferred = fundable.find((account) => account.id === preferredId);
    if (preferred) return preferred;
  }
  return fundable[0] ?? null;
}

function isAfricanFiat(currency: string | null | undefined): boolean {
  const fiat = (currency || "").trim().toUpperCase();
  return (AFRICAN_FUND_FIAT_CURRENCIES as readonly string[]).includes(fiat);
}

/**
 * Pick wallet + asset for an OnRamp quote.
 *
 * The aggregator defaults omitted `asset` to USDT on Polygon — this helper
 * always returns both together, or null.
 */
export function resolveOnRampDestination(
  input: ResolveOnRampDestinationInput,
): OnRampDestination | null {
  const accounts = input.accounts ?? [];
  const selectedId = clean(input.selectedAccountId);

  if (selectedId) {
    const selected = accounts.find((a) => a.id === selectedId);
    if (selected && isFundableStablecoinAccount(selected)) {
      return destinationFrom(selected);
    }
    return null;
  }

  const wantCurrency = assetCurrency(input.depositAsset);
  const onNetwork = accounts.filter(
    (a) => isFundableStablecoinAccount(a) && networksEqual(a.network, input.depositNetworkKey),
  );
  const exact = onNetwork.find((a) => a.currency.trim().toUpperCase() === wantCurrency);
  if (exact) return destinationFrom(exact);

  // Stellar has no shared EVM treasury — do not fall through to Base/Polygon USDC.
  if (isStellarNetworkKey(input.depositNetworkKey)) {
    return null;
  }

  if (isAfricanFiat(input.fundAfricanTargetCurrency)) {
    const usdc =
      accounts.find(
        (a) =>
          isFundableStablecoinAccount(a) && a.currency.trim().toUpperCase() === "USDC",
      ) ?? null;
    if (usdc) return destinationFrom(usdc);
  }

  const anyWanted = accounts.find(
    (a) =>
      isFundableStablecoinAccount(a) && a.currency.trim().toUpperCase() === wantCurrency,
  );
  if (anyWanted) return destinationFrom(anyWanted);

  const summary = clean(input.summaryWallet);
  if (summary) {
    const matched = accounts.find(
      (a) => isFundableStablecoinAccount(a) && clean(a.walletAddress) === summary,
    );
    if (matched) return destinationFrom(matched);
  }

  return null;
}

export function describeMissingOnRampDestination(input: {
  selectedAccountId?: string | null;
  summaryFailed: boolean;
}): string {
  if (clean(input.selectedAccountId)) {
    return "This selected wallet is not ready to receive yet. Wait until it is active with a deposit address.";
  }
  if (input.summaryFailed) {
    return "We couldn't load your account details just now, so this payment can't be priced. Try again in a moment.";
  }
  return "No ready stablecoin deposit wallet matches this fund. Choose a ready wallet above, or open one under Accounts and wait until it is active.";
}

export type AfricanFundOpenIntent = {
  fundAfricanTargetCurrency: string;
  fundTargetAccountId: string | null;
  depositNetwork: string;
  depositAsset: string;
};

/**
 * State patch when opening African OnRamp from the account Fund chooser.
 * Stablecoin wallets pin that rail; fiat accounts still land on USDC then convert.
 */
export function resolveAfricanFundOpenIntent(input: {
  selectedKind: "fiat" | "stablecoin";
  selectedFiatCurrency?: string | null;
  selectedStablecoin?: { id: string; currency: string; network: string } | null;
}): AfricanFundOpenIntent {
  if (input.selectedKind === "stablecoin" && input.selectedStablecoin) {
    const currency = input.selectedStablecoin.currency.trim().toUpperCase() || "USDC";
    return {
      fundAfricanTargetCurrency: currency,
      fundTargetAccountId: input.selectedStablecoin.id,
      depositNetwork: toUiNetworkKey(input.selectedStablecoin.network) || "base",
      depositAsset: currency.toLowerCase(),
    };
  }
  const fiat = (input.selectedFiatCurrency || "EUR").trim().toUpperCase() || "EUR";
  return {
    fundAfricanTargetCurrency: fiat,
    fundTargetAccountId: null,
    depositNetwork: "base",
    depositAsset: "usdc",
  };
}
