"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { Order } from "@/lib/services/orders";
import { isTerminalOrderStatus } from "@/lib/services/orderStatus";
import { patchTransactionCachesFromOrder } from "@/lib/services/transactions";

const settledOrderIds = new Set<number | string>();

/** Apply a polled or streamed order row to React Query caches. */
export function applyOrderStatusToCaches(queryClient: QueryClient, order: Order): void {
  queryClient.setQueryData(["order-status", order.id], order);
  patchTransactionCachesFromOrder(queryClient, order);
}

/**
 * Invalidate balances/activity the first time an order reaches a terminal
 * status. Idempotent per order id for the lifetime of the page session.
 */
export function invalidateCachesOnOrderTerminal(
  queryClient: QueryClient,
  order: Order,
  onSettled?: (order: Order) => void,
): boolean {
  if (!isTerminalOrderStatus(order.status)) return false;
  if (settledOrderIds.has(order.id)) return false;
  settledOrderIds.add(order.id);

  queryClient.invalidateQueries({ queryKey: ["transactions"] });
  queryClient.invalidateQueries({ queryKey: ["transactions-page"] });
  queryClient.invalidateQueries({ queryKey: ["transaction", order.id] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-bootstrap"] });
  queryClient.invalidateQueries({ queryKey: ["stablecoin-accounts"] });
  queryClient.invalidateQueries({ queryKey: ["sendable-stablecoin-accounts"] });
  onSettled?.(order);
  return true;
}

/** Test-only reset for module-level settlement tracking. */
export function resetOrderSettlementTrackingForTests(): void {
  settledOrderIds.clear();
}
