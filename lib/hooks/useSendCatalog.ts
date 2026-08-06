"use client";
import { useQuery } from "@tanstack/react-query";
import { catalogApi, type SupportedCatalogData } from "@/lib/services/catalog";

/**
 * Fetches the public supported-catalog for the Send ("by country") flow.
 * The endpoint is public/cacheable (no business auth required upstream —
 * see `docs/CATALOG_CACHE.md` in Mboka-Backend). Callers should wait for
 * `isFetched` before falling back to hardcoded corridor options — while the
 * first fetch is in flight, `offRampProvidersForRail` returns `null` and
 * `providerNamesFromCatalog(..., catalogSettled=false)` yields `[]` so the
 * provider chips do not flash stale names.
 */
export function useSendCatalog() {
  return useQuery<SupportedCatalogData>({
    queryKey: ["supported-catalog"],
    queryFn: () => catalogApi.get(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
