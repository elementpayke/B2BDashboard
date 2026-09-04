"use client";
import { useQuery } from "@tanstack/react-query";
import { catalogApi, type SupportedCatalogData } from "@/lib/services/catalog";

/**
 * Fetches the public supported-catalog for the Send ("by country") flow.
 * The endpoint is public/cacheable (no business auth required upstream —
 * see `docs/CATALOG_CACHE.md` in Mboka-Backend). Callers should wait for
 * `isFetched` before falling back to hardcoded corridor options — while the
 * first fetch is in flight, `offRampProvidersForRail` returns `null` and
 * `providerNamesFromCatalog(...)` yields `[]` so the Send modal does not
 * flash stale provider names. Countries and rails themselves also come from
 * the catalog (`offRampCountriesFromCatalog`) — never a hardcoded list.
 */
export function useSendCatalog(options?: { enabled?: boolean }) {
  return useQuery<SupportedCatalogData>({
    queryKey: ["supported-catalog"],
    queryFn: () => catalogApi.get(),
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}
