/** @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listCredits = vi.fn();
const listTransactions = vi.fn();

vi.mock("@/lib/services/accountCredits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/accountCredits")>();
  return {
    ...actual,
    accountCreditsApi: {
      ...actual.accountCreditsApi,
      list: (...args: unknown[]) => listCredits(...args),
    },
  };
});

vi.mock("@/lib/services/transactions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/transactions")>();
  return {
    ...actual,
    transactionsApi: {
      ...actual.transactionsApi,
      list: (...args: unknown[]) => listTransactions(...args),
    },
  };
});

vi.mock("@/lib/orderStatusPolling", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/orderStatusPolling")>();
  return {
    ...actual,
    nextPollIntervalMs: () => 1,
  };
});

import {
  CREDIT_WATCH_TIMEOUT_ATTEMPTS,
  useStellarCreditWatch,
} from "./useStellarCreditWatch";

const HASH =
  "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("useStellarCreditWatch polling", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = makeClient();
    listCredits.mockReset();
    listTransactions.mockReset();
    listCredits.mockResolvedValue({ items: [], total: 0 });
    listTransactions.mockResolvedValue({ items: [], total: 0 });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it(
    "times out only after 12 unmatched poll completions",
    async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useStellarCreditWatch(HASH), { wrapper });

      await waitFor(
        () => {
          expect(listCredits).toHaveBeenCalledTimes(CREDIT_WATCH_TIMEOUT_ATTEMPTS);
          expect(result.current.phase).toBe("timed_out");
        },
        { timeout: 5_000 },
      );

      expect(result.current.message).toMatch(/has not confirmed the credit yet/i);
      // One completed poll per attempt — not extra interval evaluations.
      expect(listCredits).toHaveBeenCalledTimes(CREDIT_WATCH_TIMEOUT_ATTEMPTS);
      expect(listTransactions).toHaveBeenCalledTimes(CREDIT_WATCH_TIMEOUT_ATTEMPTS);
    },
    10_000,
  );
});
