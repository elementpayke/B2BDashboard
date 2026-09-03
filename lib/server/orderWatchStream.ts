import type { Order } from "@/lib/services/orders";
import { isTerminalOrderStatus } from "@/lib/services/orderStatus";

export const ORDER_WATCH_STREAM_POLL_MS = 1_000;
export const ORDER_WATCH_STREAM_HEARTBEAT_MS = 15_000;
export const ORDER_WATCH_STREAM_MAX_IDS = 10;

export type OrderWatchStreamEvent =
  | { type: "order"; order: Order }
  | { type: "error"; code: "session_expired" | "upstream"; message?: string }
  | { type: "done" };

export function parseOrderWatchIds(raw: string | null): number[] {
  if (!raw?.trim()) return [];
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const part of raw.split(",")) {
    const id = Number(part.trim());
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids.slice(0, ORDER_WATCH_STREAM_MAX_IDS);
}

export function encodeSseEvent(event: OrderWatchStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function encodeSseHeartbeat(): string {
  return ": heartbeat\n\n";
}

export function shouldEndOrderWatch(
  ids: number[],
  lastStatusById: Map<number, string>,
): boolean {
  if (!ids.length) return true;
  return ids.every((id) => {
    const status = lastStatusById.get(id);
    return status != null && isTerminalOrderStatus(status);
  });
}

export function orderStatusChanged(
  lastStatusById: Map<number, string>,
  order: Order,
): boolean {
  const prev = lastStatusById.get(order.id);
  if (prev === order.status) return false;
  lastStatusById.set(order.id, order.status);
  return true;
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
