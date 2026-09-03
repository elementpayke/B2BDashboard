import type { NextRequest } from "next/server";
import { fetchMbokaAuthedJson } from "@/lib/server/mbokaAuthedFetch";
import {
  encodeSseEvent,
  encodeSseHeartbeat,
  ORDER_WATCH_STREAM_HEARTBEAT_MS,
  ORDER_WATCH_STREAM_MAX_IDS,
  ORDER_WATCH_STREAM_POLL_MS,
  orderStatusChanged,
  parseOrderWatchIds,
  shouldEndOrderWatch,
  sleep,
  type OrderWatchStreamEvent,
} from "@/lib/server/orderWatchStream";
import type { Order } from "@/lib/services/orders";

export const runtime = "nodejs";

/**
 * Cookie-authenticated SSE fan-out for in-flight merchant orders.
 * The server polls Mboka with the session JWT (never exposed to the browser)
 * and pushes `{ type: "order", order }` events when status changes.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const ids = parseOrderWatchIds(request.nextUrl.searchParams.get("ids"));
  if (!ids.length) {
    return Response.json(
      { status: "error", message: "Missing or invalid ids query parameter", data: null },
      { status: 400 },
    );
  }
  if (ids.length > ORDER_WATCH_STREAM_MAX_IDS) {
    return Response.json(
      { status: "error", message: `At most ${ORDER_WATCH_STREAM_MAX_IDS} ids per stream`, data: null },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const lastStatusById = new Map<number, string>();
  let lastHeartbeatAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: OrderWatchStreamEvent) => {
        controller.enqueue(encoder.encode(encodeSseEvent(event)));
      };

      try {
        while (!request.signal.aborted) {
          for (const id of ids) {
            const result = await fetchMbokaAuthedJson<Order>(
              request,
              `/api/v1/orders/${encodeURIComponent(String(id))}`,
            );
            if (!result.ok) {
              if (result.sessionExpired) {
                send({ type: "error", code: "session_expired", message: result.message });
                return;
              }
              send({ type: "error", code: "upstream", message: result.message });
              continue;
            }
            if (orderStatusChanged(lastStatusById, result.data)) {
              send({ type: "order", order: result.data });
            }
          }

          if (shouldEndOrderWatch(ids, lastStatusById)) {
            send({ type: "done" });
            return;
          }

          const now = Date.now();
          if (now - lastHeartbeatAt >= ORDER_WATCH_STREAM_HEARTBEAT_MS) {
            controller.enqueue(encoder.encode(encodeSseHeartbeat()));
            lastHeartbeatAt = now;
          }

          await sleep(ORDER_WATCH_STREAM_POLL_MS, request.signal);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        send({
          type: "error",
          code: "upstream",
          message: err instanceof Error ? err.message : "Stream failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
