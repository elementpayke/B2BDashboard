"use client";

// Shared post-accept order status tracker. Owned by Track 2
// (feat/order-status-lifecycle) — other tracks should import this rather
// than rolling their own polling loop.
//
// Primary live updates come from the cookie-authenticated SSE watch stream
// (`/api/mboka/orders/watch-stream`) when the order is on the watch list.
// This hook keeps a tiered HTTP poll as fallback when the stream is down or
// the modal-scoped order is not yet registered for background watch.

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { ordersApi, type Order } from "@/lib/services/orders";
import {
  applyOrderStatusToCaches,
  invalidateCachesOnOrderTerminal,
} from "@/lib/hooks/orderStatusSideEffects";
import {
  FROZEN_POLL_MS,
  isPollingHaltStatus,
  isTerminalOrderStatus,
  nextPollIntervalMs,
} from "@/lib/orderStatusPolling";

export {
  TERMINAL_ORDER_STATUSES,
  FROZEN_POLL_MS,
  isTerminalOrderStatus,
  isPollingHaltStatus,
  nextPollIntervalMs,
} from "@/lib/orderStatusPolling";

export type UseOrderStatusOptions = {
  /** Set to false to pause polling without unmounting (e.g. modal closed). */
  enabled?: boolean;
  /** Fires once, the first time the order reaches a terminal status. */
  onSettled?: (order: Order) => void;
  /** When true, the shared SSE stream is pushing updates for this order. */
  streamActive?: boolean;
  /** Slow poll interval when the SSE stream is unavailable. */
  backupPollIntervalMs?: number | false;
};

export type UseOrderStatusResult = UseQueryResult<Order> & {
  isTerminal: boolean;
  isFrozen: boolean;
  isPollingHalted: boolean;
};

/**
 * Tracks `GET /v1/orders/{merchantOrderId}` until terminal. Prefer SSE when
 * `streamActive`; otherwise tiered polling (1s → 2s → 5s cap).
 */
export function useOrderStatus(
  merchantOrderId: number | string | null | undefined,
  options: UseOrderStatusOptions = {},
): UseOrderStatusResult {
  const {
    enabled = true,
    onSettled,
    streamActive = false,
    backupPollIntervalMs = false,
  } = options;
  const queryClient = useQueryClient();
  const attemptRef = useRef(0);
  const lastPatchedStatusRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: ["order-status", merchantOrderId],
    queryFn: () => ordersApi.get(merchantOrderId as number | string),
    enabled: merchantOrderId != null && enabled,
    retry: false,
    staleTime: 0,
    refetchIntervalInBackground: true,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (isPollingHaltStatus(status)) return false;
      if (streamActive) return false;
      if (backupPollIntervalMs) return backupPollIntervalMs;
      if (status === "frozen") return FROZEN_POLL_MS;
      attemptRef.current += 1;
      return nextPollIntervalMs(attemptRef.current);
    },
  });

  useEffect(() => {
    attemptRef.current = 0;
    lastPatchedStatusRef.current = null;
  }, [merchantOrderId]);

  useEffect(() => {
    const order = query.data;
    if (!order) return;

    if (lastPatchedStatusRef.current !== order.status) {
      lastPatchedStatusRef.current = order.status;
      applyOrderStatusToCaches(queryClient, order);
    }

    invalidateCachesOnOrderTerminal(queryClient, order, onSettled);
    // onSettled is intentionally excluded: callers often pass an inline
    // closure, and re-running this effect on every render would re-fire the
    // invalidations. Settlement is tracked in orderStatusSideEffects instead.
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
