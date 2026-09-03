"use client";

// Server-side filtered/paginated transaction history for the dedicated
// Transactions screen. See docs/api-contract.md "Transaction history
// filters & pagination" for why this sources pages from `GET /v1/orders`
// rather than `GET /v1/transactions` (which accepts no query params).
//
// Deliberately a separate query/cache key from `["transactions"]` (Home,
// Wallets/Cards recents, Reports, tx detail's list fallback) — those keep
// reading the original unpaginated endpoint unchanged; this hook only
// backs the Transactions screen's filter chips + Prev/Next controls.

import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { transactionsApi, type TransactionStatus } from "@/lib/services/transactions";

export const TRANSACTIONS_PAGE_SIZE = 10;

export function useTransactionsPage(
  statusFilter: TransactionStatus | "all",
  options?: { enabled?: boolean; refetchIntervalMs?: number | false },
) {
  const [offset, setOffset] = useState(0);
  const status = statusFilter === "all" ? undefined : statusFilter;
  const enabled = options?.enabled ?? true;

  // A stale offset from a previous filter's page 3 would silently show an
  // empty (or just wrong) page under the new status scope, so switching
  // filters always goes back to page 1.
  useEffect(() => {
    setOffset(0);
  }, [status]);

  const query = useQuery({
    queryKey: ["transactions-page", status, offset],
    queryFn: () => transactionsApi.listPage({ status, limit: TRANSACTIONS_PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
    enabled,
    // Poll only while the Transactions screen is mounted/active — Home no
    // longer pays for a second 15s orders stream on every dashboard visit.
    // Boost to 5s while an in-flight order is being tracked elsewhere.
    refetchInterval:
      options?.refetchIntervalMs === false
        ? false
        : (options?.refetchIntervalMs ?? (enabled ? 15_000 : false)),
    retry: false,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const hasNext = offset + items.length < total;
  const hasPrev = offset > 0;
  const pageNumber = Math.floor(offset / TRANSACTIONS_PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / TRANSACTIONS_PAGE_SIZE));

  return {
    items,
    total,
    pageNumber,
    pageCount,
    hasNext,
    hasPrev,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    nextPage: () => setOffset((o) => (hasNext ? o + TRANSACTIONS_PAGE_SIZE : o)),
    prevPage: () => setOffset((o) => (hasPrev ? Math.max(0, o - TRANSACTIONS_PAGE_SIZE) : o)),
  };
}
