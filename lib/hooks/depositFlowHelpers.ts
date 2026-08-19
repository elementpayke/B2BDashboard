/**
 * Thin pure helpers for the Deposit / Receive modal UI.
 */

export type DepositDestinationInput = {
  depositGroup: string;
  depositAsset: string;
  depositNetworkLabel: string;
  countryName: string;
  providerName: string;
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
  return `${input.countryName} · ${input.providerName}`;
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
