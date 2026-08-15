"use client";
import { useQuery } from "@tanstack/react-query";
import {
  listStellarAccounts,
  listStellarActivity,
  type StellarActivity,
  type StellarManagedAccount,
} from "@/lib/services/stellarSimulation";

/**
 * Query hooks for the simulated Stellar USDC Account.
 *
 * Deliberately its own query keys under `stellar/*` rather than joining the
 * `balances` / `accounts` keys — the simulated account must never end up in a
 * cache that real totals read from. When the endpoints land, only the
 * `queryFn`s change.
 */

export function useStellarAccount(enabled: boolean) {
  const query = useQuery<StellarManagedAccount[]>({
    queryKey: ["stellar", "accounts"],
    queryFn: listStellarAccounts,
    enabled,
    staleTime: 30_000,
    retry: false,
  });
  return { ...query, account: query.data?.[0] ?? null };
}

export function useStellarActivity(enabled: boolean) {
  return useQuery<StellarActivity[]>({
    queryKey: ["stellar", "activity"],
    queryFn: listStellarActivity,
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}
