/** @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCardTransactionsLive } from "./useCardTransactionsLive";

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  url: string;
  closed = false;
  private listeners = new Map<string, Array<(event: { data: string }) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: { data: string }) => void) {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, payload?: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: payload == null ? "" : JSON.stringify(payload) });
    }
  }
}

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("useCardTransactionsLive", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeClient();
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource as unknown as typeof EventSource);
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it("patches card transactions and issued card status from live events", async () => {
    queryClient.setQueryData(["card-transactions", "ent_1", "acct_1"], {
      entity_id: "ent_1",
      account_id: "acct_1",
      transactions: [],
    });
    queryClient.setQueryData(["issued-cards", "ent_1", "acct_1"], {
      entity_id: "ent_1",
      account_id: "acct_1",
      cards: [
        {
          id: "card_1",
          account_id: "acct_1",
          entity_id: "ent_1",
          type: "virtual",
          status: "pending",
          currency: "USD",
          provider_ready: false,
        },
      ],
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result, unmount } = renderHook(
      () => useCardTransactionsLive("ent_1", "acct_1", true),
      { wrapper },
    );

    expect(FakeEventSource.instances).toHaveLength(1);
    const source = FakeEventSource.instances[0]!;
    expect(source.url).toContain("/api/mboka/v1/entities/ent_1/accounts/acct_1/card-transactions/watch");

    source.emit("open");

    await waitFor(() => {
      expect(result.current.streamActive).toBe(true);
    });

    source.emit("card.transaction", {
      transaction_id: "txn_1",
      account_id: "acct_1",
      card_id: "card_1",
      entity_id: "ent_1",
      amount: "25.00",
      currency: "usd",
      status: "completed",
      payment_type: "pos",
      txn_type: "debit",
      created_at: "2026-09-12T10:00:00.000Z",
    });
    source.emit("card.status", {
      card_id: "card_1",
      account_id: "acct_1",
      entity_id: "ent_1",
      status: "active",
      provider_ready: true,
    });

    await waitFor(() => {
      const txs = queryClient.getQueryData<{
        transactions: Array<{ transaction_id: string; payment_type?: string | null; type: string }>;
      }>(["card-transactions", "ent_1", "acct_1"]);
      expect(txs?.transactions[0]?.transaction_id).toBe("txn_1");
      expect(txs?.transactions[0]?.payment_type).toBe("pos");
      expect(txs?.transactions[0]?.type).toBe("debit");
    });

    const cards = queryClient.getQueryData<{
      cards: Array<{ status: string; provider_ready?: boolean | null }>;
    }>(["issued-cards", "ent_1", "acct_1"]);
    expect(cards?.cards[0]?.status).toBe("active");
    expect(cards?.cards[0]?.provider_ready).toBe(true);

    unmount();
    expect(source.closed).toBe(true);
  });
});
