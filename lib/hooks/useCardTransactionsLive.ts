"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { nextPollIntervalMs } from "@/lib/orderStatusPolling";
import {
  mergeCardTransactionList,
  normalizeCardTransaction,
  type CardTransactionList,
} from "@/lib/services/cardTransactions";
import type { IssuedCard } from "@/lib/services/cards";

type CardStatusEvent = {
  card_id?: string | null;
  status?: string | null;
  provider_ready?: boolean | null;
};

type IssuedCardsList = {
  account_id: string;
  entity_id: string;
  cards: IssuedCard[];
};

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function useCardTransactionsLive(
  entityId: string | null | undefined,
  accountId: string | null | undefined,
  enabled: boolean,
): { streamActive: boolean } {
  const queryClient = useQueryClient();
  const [streamActive, setStreamActive] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const closedRef = useRef(false);

  useEffect(() => {
    const stop = () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setStreamActive(false);
    };

    const scheduleReconnect = () => {
      if (closedRef.current || !enabled || !entityId || !accountId) return;
      if (retryTimerRef.current !== null) return;
      const delayMs = nextPollIntervalMs(attemptsRef.current, { maxMs: 30_000 });
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        connect();
      }, delayMs);
    };

    const connect = () => {
      if (closedRef.current || !enabled || !entityId || !accountId) return;
      stop();
      const source = new EventSource(
        `/api/mboka/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/card-transactions/watch`,
      );
      eventSourceRef.current = source;

      source.addEventListener("open", () => {
        attemptsRef.current = 0;
        setStreamActive(true);
      });

      source.addEventListener("card.transaction", (event) => {
        const payload = parseJson<unknown>((event as MessageEvent).data);
        const transaction = normalizeCardTransaction(payload);
        if (!transaction) return;
        queryClient.setQueryData<CardTransactionList | undefined>(
          ["card-transactions", entityId, accountId],
          (current) => mergeCardTransactionList(current, transaction),
        );
      });

      source.addEventListener("card.status", (event) => {
        const payload = parseJson<CardStatusEvent>((event as MessageEvent).data);
        const cardId = String(payload?.card_id ?? "").trim();
        if (!cardId) return;
        queryClient.setQueryData<IssuedCardsList | undefined>(
          ["issued-cards", entityId, accountId],
          (current) => {
            if (!current) return current;
            return {
              ...current,
              cards: current.cards.map((card) =>
                card.id === cardId
                  ? {
                      ...card,
                      ...(payload?.status ? { status: payload.status } : {}),
                      ...(payload?.provider_ready !== undefined
                        ? { provider_ready: payload.provider_ready }
                        : {}),
                    }
                  : card,
              ),
            };
          },
        );
      });

      source.addEventListener("error", () => {
        attemptsRef.current += 1;
        setStreamActive(false);
        source.close();
        if (eventSourceRef.current === source) {
          eventSourceRef.current = null;
        }
        scheduleReconnect();
      });
    };

    closedRef.current = false;
    attemptsRef.current = 0;

    if (enabled && entityId && accountId) {
      connect();
    } else {
      stop();
    }

    return () => {
      closedRef.current = true;
      stop();
    };
  }, [accountId, enabled, entityId, queryClient]);

  return { streamActive };
}
