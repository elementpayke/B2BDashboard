"use client";

// Shared post-accept order status tracker. Owned by Track 2
// (feat/order-status-lifecycle) — other tracks should import this rather
// than rolling their own polling loop.
//
// The backend documents a WebSocket for live status
// (Mboka-Backend docs/api/ORDER_STATUS_WEBSOCKET.md), but it authenticates
// via a raw JWT in the query string (`?token=`). This app never puts a JWT
// in the browser — access/refresh tokens live in httpOnly cookies handled
// entirely by lib/server/mbokaProxy.ts — so that socket is not reachable
// from client code without violating the "tokens never in browser" rule.
// Polling with backoff through the existing cookie-authenticated proxy is
// the deliberate choice here, not a fallback for a missing feature.

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { ordersApi, type Order, type OrderStatus } from "@/lib/services/orders";

// Mirrors Mboka's TERMINAL_STATUSES (app/services/orders/status.py).
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  "completed",
  "failed",
  "refunded",
  "canceled",
];

/** True for the 4 statuses the backend will never transition out of. */
export function isTerminalOrderStatus(status: string | null | undefined): status is OrderStatus {
  if (!status) return false;
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * True when polling should stop: terminal, or `frozen` (requires manual
 * review — Mboka's own transition table still allows a frozen order to move
 * to processing/completed/failed later, so this is deliberately distinct
 * from "terminal"; a frozen order is not settled).
 */
export function isPollingHaltStatus(status: string | null | undefined): boolean {
  return isTerminalOrderStatus(status) || status === "frozen";
}

const DEFAULT_BASE_MS = 2_000;
const DEFAULT_MAX_MS = 30_000;

/**
 * Exponential backoff for order-status polling: baseMs, 2x, 4x, 8x... capped
 * at maxMs. `attempt` is 1-based (the poll number about to be scheduled);
 * anything less than 1 returns the base interval.
 *
 * Starts fast (2s) so the send-success screen feels live right after accept,
 * then backs off so a slow settlement doesn't hammer the backend or the
 * aggregator indefinitely.
 */
export function nextPollIntervalMs(
  attempt: number,
  opts: { baseMs?: number; maxMs?: number } = {},
): number {
  const baseMs = opts.baseMs ?? DEFAULT_BASE_MS;
  const maxMs = opts.maxMs ?? DEFAULT_MAX_MS;
  if (attempt < 1) return baseMs;
  return Math.min(maxMs, baseMs * 2 ** (attempt - 1));
}

export type UseOrderStatusOptions = {
  /** Set to false to pause polling without unmounting (e.g. modal closed). */
  enabled?: boolean;
  /** Fires once, the first time the order reaches a terminal status. */
  onSettled?: (order: Order) => void;
};

export type UseOrderStatusResult = UseQueryResult<Order> & {
  isTerminal: boolean;
  isFrozen: boolean;
  isPollingHalted: boolean;
};

/**
 * Polls `GET /v1/orders/{merchantOrderId}` (ORDER_FLOW.md step 3) with
 * backoff until the order reaches a terminal status, then invalidates the
 * transactions list, the single-transaction detail (same id — transactions
 * are a read-view over merchant_orders), and the dashboard summary so the
 * rest of the app reflects the settled order without a manual refresh.
 */
export function useOrderStatus(
  merchantOrderId: number | string | null | undefined,
  options: UseOrderStatusOptions = {},
): UseOrderStatusResult {
  const { enabled = true, onSettled } = options;
  const queryClient = useQueryClient();
  const attemptRef = useRef(0);
  const settledIdRef = useRef<number | string | null>(null);

  const query = useQuery({
    queryKey: ["order-status", merchantOrderId],
    queryFn: () => ordersApi.get(merchantOrderId as number | string),
    enabled: merchantOrderId != null && enabled,
    retry: false,
    refetchInterval: (q) => {
      if (isPollingHaltStatus(q.state.data?.status)) return false;
      attemptRef.current += 1;
      return nextPollIntervalMs(attemptRef.current);
    },
  });

  useEffect(() => {
    attemptRef.current = 0;
  }, [merchantOrderId]);

  useEffect(() => {
    const order = query.data;
    if (!order || !isTerminalOrderStatus(order.status)) return;
    if (settledIdRef.current === order.id) return;
    settledIdRef.current = order.id;
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["transaction", order.id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    onSettled?.(order);
    // onSettled is intentionally excluded: callers often pass an inline
    // closure, and re-running this effect on every render would re-fire the
    // invalidations. Settlement is tracked via settledIdRef instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, queryClient]);

  const status = query.data?.status;
  return {
    ...query,
    isTerminal: isTerminalOrderStatus(status),
    isFrozen: status === "frozen",
    isPollingHalted: isPollingHaltStatus(status),
  };
}
