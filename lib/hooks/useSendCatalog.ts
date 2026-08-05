"use client";
import { useQuery } from "@tanstack/react-query";
import { catalogApi, type SupportedCatalogData } from "@/lib/services/catalog";

/**
 * Fetches the public supported-catalog for the Send ("by country") flow.
 * The endpoint is public/cacheable (no business auth required upstream —
 * see `docs/CATALOG_CACHE.md` in Mboka-Backend), so a failure here should
 * never block the modal: callers fall back to the existing hardcoded
 * corridor list via `offRampProvidersForRail` returning `null`.
 */
export function useSendCatalog() {
  return useQuery<SupportedCatalogData>({
    queryKey: ["supported-catalog"],
    queryFn: () => catalogApi.get(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
