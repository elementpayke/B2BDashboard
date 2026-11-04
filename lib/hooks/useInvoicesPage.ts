"use client";

// Server-side filtered/paginated invoice list for the Invoices screen.
// Mirrors useTransactionsPage.ts's shape — same query/pagination pattern,
// different resource.

import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { invoicesApi, type InvoiceStatus } from "@/lib/services/invoices";

export const INVOICES_PAGE_SIZE = 10;

export function useInvoicesPage(
  statusFilter: InvoiceStatus | "all",
  networkFilter: string | "all",
  options?: { enabled?: boolean },
) {
  const [offset, setOffset] = useState(0);
  const status = statusFilter === "all" ? undefined : statusFilter;
  const network = networkFilter === "all" ? undefined : networkFilter;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    setOffset(0);
  }, [status, network]);

  const query = useQuery({
    queryKey: ["invoices-page", status, network, offset],
    queryFn: () =>
      invoicesApi.list({ status, network, limit: INVOICES_PAGE_SIZE, offset }),
    placeholderData: keepPreviousData,
    enabled,
    retry: false,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const hasNext = offset + items.length < total;
  const hasPrev = offset > 0;
  const pageNumber = Math.floor(offset / INVOICES_PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / INVOICES_PAGE_SIZE));

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
    refetch: query.refetch,
    nextPage: () => setOffset((o) => (hasNext ? o + INVOICES_PAGE_SIZE : o)),
    prevPage: () => setOffset((o) => (hasPrev ? Math.max(0, o - INVOICES_PAGE_SIZE) : o)),
  };
}
