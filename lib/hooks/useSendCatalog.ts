"use client";
import { useQuery } from "@tanstack/react-query";
import { ApiRequestError } from "@/lib/apiClient";
import { catalogApi, type SupportedCatalogData } from "@/lib/services/catalog";

export function shouldRetryCatalog(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiRequestError) {
    return error.status === 408 || error.status === 502 || error.status === 503 || error.status === 504;
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /timed out|timeout|upstream|502|503|504/i.test(message);
}

/**
 * Fetches the public supported-catalog for the Send ("by country") flow.
 * The endpoint is public/cacheable (no business auth required upstream —
 * see `docs/CATALOG_CACHE.md` in Mboka-Backend). Callers should wait for
 * `isFetched` before falling back to hardcoded corridor options — while the
 * first fetch is in flight, `offRampProvidersForRail` returns `null` and
 * `providerNamesFromCatalog(...)` yields `[]` so the Send modal does not
 * flash stale provider names. Countries and rails themselves also come from
 * the catalog (`offRampCountriesFromCatalog`) — never a hardcoded list.
 *
 * Retries transient upstream timeouts (dashboard proxy aborts at 30s) so a
 * cold catalog miss does not leave Send/Deposit permanently empty.
 */
export function useSendCatalog(options?: { enabled?: boolean }) {
  return useQuery<SupportedCatalogData>({
    queryKey: ["supported-catalog"],
    queryFn: () => catalogApi.get(),
    retry: shouldRetryCatalog,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}
