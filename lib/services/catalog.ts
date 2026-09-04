import { apiEnvelope } from "@/lib/apiClient";
import { dialCodeForIso } from "@/lib/data/dialCodes";

/**
 * `GET /v1/supported/catalog` is a raw, cacheable pass-through of the
 * aggregator's partner catalog (see Mboka-Backend
 * `app/docs/responses/supported_responses.py` and
 * `app/controllers/supported.py`). The shapes below mirror the mobile app's
 * already-shipped `lib/types/supported.ts`/`lib/services/supported.ts`,
 * which is the source of truth for what the aggregator actually returns
 * (the backend's own OpenAPI sample only documents the `onramp` +
 * `international_bank` sections, but the live catalog also has `offramp`).
 */

/** Send / Deposit corridor rail derived from an enabled catalog payment method. */
export type CatalogCorridorRail = {
  type: "mobile" | "bank";
  label: string;
  /** Enabled provider display names from the catalog (never a static standby list). */
  options: string[];
  field: string;
  placeholder: string;
  arrival: string;
};

/** Country corridor for Send (offramp) / Deposit (onramp) pickers. */
export type CatalogCorridorCountry = {
  code: string;
  name: string;
  /** Lowercase ISO 3166-1 alpha-2 for flags / dial lookup. */
  iso: string;
  dialCode?: string;
  rails: CatalogCorridorRail[];
};
export type CatalogProvider = {
  code: string;
  name: string;
  enabled: boolean;
  id?: string;
};

export type CatalogPaymentMethod = {
  enabled: boolean;
  label: string;
  quote_type: string;
  providers: CatalogProvider[];
};

export type CatalogCountry = {
  country_code: string;
  country_name: string;
  currency: string;
  enabled: boolean;
  payment_methods: Record<string, CatalogPaymentMethod>;
};

export type CatalogInternationalCurrency = {
  currency: string;
  label: string;
  onramp: boolean;
  offramp: boolean;
  payment_methods: Record<string, CatalogPaymentMethod>;
};

export type SupportedCatalogData = {
  disclaimer?: string;
  onramp?: { countries: Record<string, CatalogCountry> };
  offramp?: { countries: Record<string, CatalogCountry> };
  international_bank?: { currencies: Record<string, CatalogInternationalCurrency> };
};

export type CatalogFilterParams = {
  provider?: string;
  country?: string;
  fiat_currency?: string;
};

function catalogPath(params?: CatalogFilterParams): string {
  const query = new URLSearchParams();
  if (params?.provider) query.set("provider", params.provider);
  if (params?.country) query.set("country", params.country);
  if (params?.fiat_currency) query.set("fiat_currency", params.fiat_currency);
  const qs = query.toString();
  return `/v1/supported/catalog${qs ? `?${qs}` : ""}`;
}

export const catalogApi = {
  get: (params?: CatalogFilterParams) =>
    apiEnvelope<SupportedCatalogData>("GET", catalogPath(params)),
};

/**
 * Fiat codes from enabled catalog corridors — onramp/offramp countries plus
 * international_bank currencies that support onramp or offramp. No invented
 * codes: only what `GET /v1/supported/catalog` actually returns.
 */
export function supportedCurrenciesFromCatalog(
  data: SupportedCatalogData | null | undefined,
): string[] {
  if (!data) return [];
  const codes = new Set<string>();

  const addCountries = (countries: Record<string, CatalogCountry> | undefined) => {
    for (const country of Object.values(countries ?? {})) {
      if (!country?.enabled) continue;
      const code = country.currency?.trim().toUpperCase();
      if (code) codes.add(code);
    }
  };

  addCountries(data.onramp?.countries);
  addCountries(data.offramp?.countries);

  for (const intl of Object.values(data.international_bank?.currencies ?? {})) {
    if (!intl || (!intl.onramp && !intl.offramp)) continue;
    const code = (intl.currency || "").trim().toUpperCase();
    if (code) codes.add(code);
  }

  return Array.from(codes);
}

/**
 * Send-modal rail `type` ("mobile" | "bank") -> the aggregator catalog's
 * `payment_methods[key].quote_type`. Mirrors mobile app's
 * `accountTypeForQuoteType` (inverted) so a "mobile" rail always resolves
 * to the catalog's `mobile_money` payment method rather than guessing.
 */
export const RAIL_TYPE_TO_QUOTE_TYPE: Record<string, string> = {
  mobile: "mobile_money",
  bank: "bank",
};

const QUOTE_TYPE_TO_RAIL: Record<
  string,
  { type: "mobile" | "bank"; field: string; placeholder: string; arrival: string }
> = {
  mobile_money: {
    type: "mobile",
    field: "Recipient phone number",
    placeholder: "07xx xxx xxx",
    arrival: "Arrives in seconds",
  },
  bank: {
    type: "bank",
    field: "Recipient account number",
    placeholder: "Account number",
    arrival: "Arrives within minutes",
  },
};

/** Flag / dial ISO for international_bank currency rows that are not countries. */
const INTL_CURRENCY_ISO: Record<string, string> = {
  EUR: "eu",
  USD: "us",
  GBP: "gb",
};

function findMethodByQuoteType(
  methods: Record<string, CatalogPaymentMethod> | undefined,
  quoteType: string,
): CatalogPaymentMethod | undefined {
  return Object.values(methods ?? {}).find((m) => m.quote_type === quoteType);
}

function enabledProviders(method: CatalogPaymentMethod | undefined): CatalogProvider[] {
  if (!method?.enabled) return [];
  return method.providers.filter((p) => p.enabled);
}

function railsFromPaymentMethods(
  methods: Record<string, CatalogPaymentMethod> | undefined,
): CatalogCorridorRail[] {
  const rails: CatalogCorridorRail[] = [];
  const seen = new Set<string>();
  for (const method of Object.values(methods ?? {})) {
    const meta = QUOTE_TYPE_TO_RAIL[method.quote_type];
    if (!meta || seen.has(meta.type)) continue;
    const providers = enabledProviders(method);
    if (providers.length === 0) continue;
    seen.add(meta.type);
    rails.push({
      type: meta.type,
      label: method.label?.trim() || (meta.type === "mobile" ? "Mobile money" : "Bank transfer"),
      options: providers.map((p) => p.name),
      field: meta.field,
      placeholder: meta.placeholder,
      arrival: meta.arrival,
    });
  }
  // Prefer mobile before bank when both exist (matches prior UX).
  rails.sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === "mobile" ? -1 : 1;
  });
  return rails;
}

function corridorFromCatalogCountry(country: CatalogCountry): CatalogCorridorCountry | null {
  if (!country?.enabled) return null;
  const iso = (country.country_code || "").trim().toUpperCase();
  if (!iso || iso === "XX") return null;
  const rails = railsFromPaymentMethods(country.payment_methods);
  if (rails.length === 0) return null;
  const currency = (country.currency || "").trim().toUpperCase();
  if (!currency) return null;
  return {
    code: currency,
    name: country.country_name?.trim() || iso,
    iso: iso.toLowerCase(),
    dialCode: dialCodeForIso(iso),
    rails,
  };
}

function corridorFromInternationalCurrency(
  intl: CatalogInternationalCurrency,
  ramp: "onramp" | "offramp",
): CatalogCorridorCountry | null {
  if (!intl || !intl[ramp]) return null;
  const currency = (intl.currency || "").trim().toUpperCase();
  if (!currency) return null;
  const rails = railsFromPaymentMethods(intl.payment_methods);
  if (rails.length === 0) return null;
  const iso = (INTL_CURRENCY_ISO[currency] || currency.slice(0, 2)).toLowerCase();
  return {
    code: currency,
    name: intl.label?.trim() || currency,
    iso,
    dialCode: dialCodeForIso(iso),
    rails,
  };
}

function mergeCorridors(
  countries: Record<string, CatalogCountry> | undefined,
  intl: Record<string, CatalogInternationalCurrency> | undefined,
  ramp: "onramp" | "offramp",
): CatalogCorridorCountry[] {
  const byCurrency = new Map<string, CatalogCorridorCountry>();
  const out: CatalogCorridorCountry[] = [];

  for (const country of Object.values(countries ?? {})) {
    const corridor = corridorFromCatalogCountry(country);
    if (!corridor) continue;
    out.push(corridor);
    byCurrency.set(corridor.code, corridor);
  }

  for (const entry of Object.values(intl ?? {})) {
    if (byCurrency.has((entry.currency || "").trim().toUpperCase())) continue;
    const corridor = corridorFromInternationalCurrency(entry, ramp);
    if (!corridor) continue;
    out.push(corridor);
    byCurrency.set(corridor.code, corridor);
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * Enabled OffRamp countries + rails from the live catalog. Empty while the
 * catalog is missing/failed — never invents standby corridors.
 */
export function offRampCountriesFromCatalog(
  data: SupportedCatalogData | null | undefined,
): CatalogCorridorCountry[] {
  if (!data) return [];
  return mergeCorridors(data.offramp?.countries, data.international_bank?.currencies, "offramp");
}

/**
 * Enabled OnRamp countries + rails from the live catalog.
 */
export function onRampCountriesFromCatalog(
  data: SupportedCatalogData | null | undefined,
): CatalogCorridorCountry[] {
  if (!data) return [];
  return mergeCorridors(data.onramp?.countries, data.international_bank?.currencies, "onramp");
}

/**
 * Real, enabled OffRamp providers the catalog offers for a given
 * country + rail type, so the Send modal's provider picker can carry a
 * real aggregator `networkId`. Looks up `data.offramp.countries[countryIso]`
 * first, falling back to `data.international_bank.currencies[currency]`.
 *
 * Returns `null` when the catalog has no matching corridor.
 */
export function offRampProvidersForRail(
  data: SupportedCatalogData | null | undefined,
  countryIso: string,
  railType: string,
  currency?: string,
): CatalogProvider[] | null {
  const quoteType = RAIL_TYPE_TO_QUOTE_TYPE[railType];
  if (!quoteType || !data) return null;

  const country = data.offramp?.countries?.[countryIso.toUpperCase()];
  if (country?.enabled) {
    const enabled = enabledProviders(findMethodByQuoteType(country.payment_methods, quoteType));
    if (enabled.length > 0) return enabled;
  }

  if (currency) {
    const intl = data.international_bank?.currencies?.[currency.toUpperCase()];
    if (intl?.offramp) {
      const enabled = enabledProviders(findMethodByQuoteType(intl.payment_methods, quoteType));
      if (enabled.length > 0) return enabled;
    }
  }

  return null;
}

/**
 * Real, enabled OnRamp providers the catalog offers for a given country +
 * rail type — same shape as `offRampProvidersForRail` but reads
 * `data.onramp.countries` and `international_bank.currencies[].onramp`.
 */
export function onRampProvidersForRail(
  data: SupportedCatalogData | null | undefined,
  countryIso: string,
  railType: string,
  currency?: string,
): CatalogProvider[] | null {
  const quoteType = RAIL_TYPE_TO_QUOTE_TYPE[railType];
  if (!quoteType || !data) return null;

  const country = data.onramp?.countries?.[countryIso.toUpperCase()];
  if (country?.enabled) {
    const enabled = enabledProviders(findMethodByQuoteType(country.payment_methods, quoteType));
    if (enabled.length > 0) return enabled;
  }

  if (currency) {
    const intl = data.international_bank?.currencies?.[currency.toUpperCase()];
    if (intl?.onramp) {
      const enabled = enabledProviders(findMethodByQuoteType(intl.payment_methods, quoteType));
      if (enabled.length > 0) return enabled;
    }
  }

  return null;
}

/**
 * Display names for provider chips from the live catalog only.
 * While loading or when the corridor has no enabled providers, returns `[]`
 * — never a hardcoded standby list.
 */
export function providerNamesFromCatalog(
  catalogProviders: CatalogProvider[] | null | undefined,
  /** @deprecated Ignored — providers come only from the catalog. */
  _fallback?: string[],
  /** @deprecated Ignored — empty list while loading / unmatched. */
  _catalogSettled?: boolean,
): string[] {
  if (catalogProviders && catalogProviders.length > 0) {
    return catalogProviders.map((p) => p.name);
  }
  return [];
}

/**
 * Resolve the aggregator provider id (`networkId` on the order quote's
 * `destination` block) for a provider selected by display name/code.
 * Case-insensitive match on either `name` or `code` since UI copy and
 * catalog casing don't always line up (e.g. "M PESA" vs "M-Pesa").
 */
export function networkIdForProvider(
  providers: CatalogProvider[] | null | undefined,
  providerName: string,
): string | undefined {
  if (!providers) return undefined;
  const needle = providerName.trim().toLowerCase();
  const match = providers.find(
    (p) => p.name.trim().toLowerCase() === needle || p.code.trim().toLowerCase() === needle,
  );
  return match?.id;
}
