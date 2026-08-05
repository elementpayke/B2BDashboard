import { apiEnvelope } from "@/lib/apiClient";

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
 * Send-modal rail `type` ("mobile" | "bank") -> the aggregator catalog's
 * `payment_methods[key].quote_type`. Mirrors mobile app's
 * `accountTypeForQuoteType` (inverted) so a "mobile" rail always resolves
 * to the catalog's `mobile_money` payment method rather than guessing.
 */
export const RAIL_TYPE_TO_QUOTE_TYPE: Record<string, string> = {
  mobile: "mobile_money",
  bank: "bank",
};

function findMethodByQuoteType(
  methods: Record<string, CatalogPaymentMethod> | undefined,
  quoteType: string,
): CatalogPaymentMethod | undefined {
  return Object.values(methods ?? {}).find((m) => m.quote_type === quoteType);
}

/**
 * Real, enabled OffRamp providers the catalog offers for a given
 * country + rail type, so the Send modal's provider picker can carry a
 * real aggregator `networkId` instead of relying on the hardcoded corridor
 * list alone. Looks up `data.offramp.countries[countryIso]` first (local
 * mobile-money/bank corridors), falling back to
 * `data.international_bank.currencies[currency]` for cross-border wire
 * currencies (EUR/USD/GBP) that aren't modeled as "countries" upstream.
 *
 * Returns `null` when the catalog has no matching corridor (not yet
 * onboarded, aggregator outage, or the request is still loading) —
 * callers should fall back to the existing static picker rather than
 * showing an empty list.
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
    const method = findMethodByQuoteType(country.payment_methods, quoteType);
    const enabled = method?.enabled ? method.providers.filter((p) => p.enabled) : [];
    if (enabled.length > 0) return enabled;
  }

  if (currency) {
    const intl = data.international_bank?.currencies?.[currency.toUpperCase()];
    if (intl?.offramp) {
      const method = findMethodByQuoteType(intl.payment_methods, quoteType);
      const enabled = method?.enabled ? method.providers.filter((p) => p.enabled) : [];
      if (enabled.length > 0) return enabled;
    }
  }

  return null;
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
