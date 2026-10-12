"use client";

import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { accountActivityApi } from "@/lib/services/accountActivity";

export const ACCOUNT_ACTIVITY_PAGE_SIZE = 10;

/**
 * Mirrors `useTransactionsPage`'s offset/limit pagination shape, scoped to
 * one account's activity log. `enabled` defaults to `Boolean(accountId)` so
 * callers can pass a possibly-absent id without guarding themselves.
 */
export function useAccountActivityPage(
  accountId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const [offset, setOffset] = useState(0);
  const enabled = (options?.enabled ?? true) && Boolean(accountId);

  useEffect(() => {
    setOffset(0);
  }, [accountId]);

  const query = useQuery({
    queryKey: ["account-activity", accountId, offset],
    queryFn: () =>
      accountActivityApi.listPage(accountId as string, {
        limit: ACCOUNT_ACTIVITY_PAGE_SIZE,
        offset,
      }),
    placeholderData: keepPreviousData,
    enabled,
    retry: false,
  });

  const entries = query.data?.entries ?? [];
  const total = query.data?.total ?? 0;
  const hasNext = offset + entries.length < total;
  const hasPrev = offset > 0;

  return {
    entries,
    total,
    hasNext,
    hasPrev,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    nextPage: () => setOffset((o) => (hasNext ? o + ACCOUNT_ACTIVITY_PAGE_SIZE : o)),
    prevPage: () => setOffset((o) => (hasPrev ? Math.max(0, o - ACCOUNT_ACTIVITY_PAGE_SIZE) : o)),
  };
}
