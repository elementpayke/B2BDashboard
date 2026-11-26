/**
 * Thin pure helpers for the Deposit / Receive modal UI.
 */

export type DepositDestinationInput = {
  depositGroup: string;
  depositAsset: string;
  depositNetworkLabel: string;
  countryName: string;
  /** Brand-neutral rail label, or a selected mobile-money operator (e.g. "M-Pesa"). */
  channelLabel: string;
};

export type CorridorRail = {
  type: string;
  label: string;
  options: string[];
};

export type CorridorCountry = {
  name: string;
  code: string;
  rails: CorridorRail[];
};

export type PinnedProvider = {
  name: string;
  index: number;
  pinned: boolean;
};

/** Show bank search when a country has more than this many banks. */
export const BANK_SEARCH_THRESHOLD = 6;

/** Summary line shown on deposit steps 2–3 for the chosen corridor. */
export function buildDepositDestinationSummary(input: DepositDestinationInput): string {
  if (input.depositGroup === "crypto") {
    return `${input.depositAsset.toUpperCase()} · ${input.depositNetworkLabel}`;
  }
  return `${input.countryName} · ${input.channelLabel}`;
}

export function buildDepositStepDots(depositStep: number, total = 3): { on: boolean }[] {
  return Array.from({ length: total }, (_, i) => ({ on: i + 1 <= depositStep }));
}

export function countryRailsLabel(country: Pick<CorridorCountry, "rails">): string {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const rail of country.rails) {
    const label = rail.type === "mobile" ? "Mobile money" : "Bank transfer";
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels.join(" · ");
}

export function countrySearchHaystack(
  country: CorridorCountry,
  extraProviderNames: string[] = [],
): string {
  return [
    country.name,
    country.code,
    ...country.rails.flatMap((rail) => rail.options),
    ...extraProviderNames,
  ].join(" ");
}

export function countryMatchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}

/**
 * Keep a selected bank visible and first when a search would otherwise hide it.
 * Only the filtered-out case is labelled "Currently selected".
 */
export function filterProvidersWithPinnedSelection(
  providers: string[],
  search: string,
  selectedIdx: number,
): PinnedProvider[] {
  const q = search.trim().toLowerCase();
  const matches = providers
    .map((name, index) => ({ name, index, pinned: false }))
    .filter((item) => !q || item.name.toLowerCase().includes(q));

  if (selectedIdx < 0 || selectedIdx >= providers.length) return matches;

  const selectedName = providers[selectedIdx];
  const selectedMatches = !q || selectedName.toLowerCase().includes(q);
  const rest = matches.filter((item) => item.index !== selectedIdx);

  if (selectedMatches) {
    return [{ name: selectedName, index: selectedIdx, pinned: false }, ...rest];
  }

  return [{ name: selectedName, index: selectedIdx, pinned: true }, ...rest];
}

export function indexOfProviderName(options: string[], selectedName: string): number {
  const needle = selectedName.trim().toLowerCase();
  if (!needle) return -1;
  return options.findIndex((name) => name.trim().toLowerCase() === needle);
}

/** Keep a selected provider in the list when catalog data replaces/reorders names. */
export function ensureSelectedProvider(options: string[], selectedName: string): string[] {
  if (indexOfProviderName(options, selectedName) >= 0 || !selectedName.trim()) return options;
  return [selectedName, ...options];
}

/** Quote the provider the user picked, not whichever name now sits at that index. */
export function resolveQuotedProviderName(options: string[], selectedName: string): string {
  const idx = indexOfProviderName(options, selectedName);
  if (idx >= 0) return options[idx];
  return selectedName.trim() || options[0] || "";
}

/**
 * Country OnRamp rails require `source.networkId` from `/v1/supported/catalog`.
 * Fail closed when the catalog settled without a match — same as Send.
 */
export function depositRailBlockedByMissingNetworkId(input: {
  depositGroup: string;
  networkId: string | undefined;
  catalogSettled: boolean;
}): boolean {
  if (input.depositGroup !== "country") return false;
  if (!input.catalogSettled) return false;
  return !input.networkId;
}

export type FundFromAccountTarget =
  | { kind: "wallet"; id: string; asset: string; network: string }
  | { kind: "interac"; id: string }
  | { kind: "fiat"; id: string };

/**
 * Fund pressed inside an account: which Add money path opens with that
 * account already chosen. Stablecoin wallets go to the method step; CAD
 * accounts with an entity use Interac; every other fiat account shows its own
 * bank details.
 */
export function fundFromAccountTarget(input: {
  stablecoin: { id?: string | null; currency: string; network?: string | null } | null;
  fiat: { id?: string | number | null; currency: string; entity_id?: string | null } | null;
}): FundFromAccountTarget | null {
  const { stablecoin, fiat } = input;
  if (stablecoin?.id) {
    return {
      kind: "wallet",
      id: stablecoin.id,
      asset: stablecoin.currency.trim().toLowerCase(),
      network: stablecoin.network || "",
    };
  }
  const fiatId = fiat?.id == null ? "" : String(fiat.id).trim();
  if (!fiat || !fiatId) return null;
  const isCad = fiat.currency.trim().toUpperCase() === "CAD";
  if (isCad && String(fiat.entity_id || "").trim()) return { kind: "interac", id: fiatId };
  return { kind: "fiat", id: fiatId };
}

/** Where open banking was opened from inside Add money, so Back can return there. */
export type OpenBankingReturn = { fiatId: string; locked: boolean };

/** State patch for Back on the open banking request screen. */
export function openBankingBackPatch(ret: OpenBankingReturn | null):
  | { modal: "fundChooser" }
  | { modal: "deposit"; fundFiatLockedId: string | null; depositResumeFiatId: string | null; openBankingReturn: null } {
  if (!ret) return { modal: "fundChooser" };
  return {
    modal: "deposit",
    fundFiatLockedId: ret.locked ? ret.fiatId : null,
    depositResumeFiatId: ret.locked ? null : ret.fiatId,
    openBankingReturn: null,
  };
}
