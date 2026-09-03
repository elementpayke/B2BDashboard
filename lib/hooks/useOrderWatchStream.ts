"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ordersApi } from "@/lib/services/orders";
import {
  applyOrderStatusToCaches,
  invalidateCachesOnOrderTerminal,
} from "@/lib/hooks/orderStatusSideEffects";
import { unregisterOrderWatch } from "@/lib/hooks/orderWatchRegistry";
import type { OrderWatchStreamEvent } from "@/lib/server/orderWatchStream";

const STREAM_RETRY_MS = 3_000;
const BACKUP_POLL_MS = 5_000;

export type UseOrderWatchStreamResult = {
  /** True while an EventSource connection is open for the current id set. */
  streamConnected: boolean;
  /** Slow poll interval when the stream is down, for modal-scoped useOrderStatus. */
  backupPollIntervalMs: number | false;
};

function onTerminal(queryClient: ReturnType<typeof useQueryClient>, order: Parameters<typeof invalidateCachesOnOrderTerminal>[1]) {
  invalidateCachesOnOrderTerminal(queryClient, order, () => {
    unregisterOrderWatch(order.id);
  });
}

/**
 * Opens one SSE connection for all background-watched order ids. Falls back to
 * a 5s client poll loop when EventSource is unavailable.
 */
export function useOrderWatchStream(watchIds: number[]): UseOrderWatchStreamResult {
  const queryClient = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const idsKey = watchIds.join(",");

  useEffect(() => {
    if (!watchIds.length) {
      setStreamConnected(false);
      return;
    }

    let closed = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      const params = new URLSearchParams({ ids: watchIds.join(",") });
      source = new EventSource(`/api/mboka/orders/watch-stream?${params.toString()}`);

      source.onopen = () => {
        setStreamConnected(true);
      };

      source.onmessage = (message) => {
        let event: OrderWatchStreamEvent;
        try {
          event = JSON.parse(message.data) as OrderWatchStreamEvent;
        } catch {
          return;
        }

        if (event.type === "order") {
          applyOrderStatusToCaches(queryClient, event.order);
          onTerminal(queryClient, event.order);
          return;
        }

        if (event.type === "done") {
          source?.close();
          setStreamConnected(false);
          return;
        }

        if (event.type === "error") {
          source?.close();
          setStreamConnected(false);
          if (!closed && event.code !== "session_expired") {
            retryTimer = setTimeout(connect, STREAM_RETRY_MS);
          }
        }
      };

      source.onerror = () => {
        setStreamConnected(false);
        source?.close();
        if (!closed) {
          retryTimer = setTimeout(connect, STREAM_RETRY_MS);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
      setStreamConnected(false);
    };
  }, [idsKey, queryClient, watchIds]);

  useEffect(() => {
    if (streamConnected || !watchIds.length) return;

    let cancelled = false;
    const poll = async () => {
      for (const id of watchIds) {
        if (cancelled) return;
        try {
          const order = await ordersApi.get(id);
          applyOrderStatusToCaches(queryClient, order);
          onTerminal(queryClient, order);
        } catch {
          // Keep polling other ids.
        }
      }
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, BACKUP_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [idsKey, queryClient, streamConnected, watchIds]);

  return {
    streamConnected,
    backupPollIntervalMs: watchIds.length && !streamConnected ? BACKUP_POLL_MS : false,
  };
}

/** True when the shared watch stream covers a merchant order id. */
export function orderIdOnWatchStream(
  merchantOrderId: number | string | null | undefined,
  watchIds: number[],
  streamConnected: boolean,
): boolean {
  if (!streamConnected || merchantOrderId == null) return false;
  const numericId = typeof merchantOrderId === "number" ? merchantOrderId : Number(merchantOrderId);
  return Number.isFinite(numericId) && watchIds.includes(numericId);
}
