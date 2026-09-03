import { describe, expect, it } from "vitest";
import {
  CREDIT_WATCH_TIMEOUT_ATTEMPTS,
  creditWatchStatusMessage,
  findCreditByTxHash,
  nextCreditWatchPhase,
  type CreditWatchPhase,
} from "./useStellarCreditWatch";
import { nextPollIntervalMs } from "@/lib/orderStatusPolling";
import type { AccountCredit } from "@/lib/services/accountCredits";
import type { Transaction } from "@/lib/services/transactions";

const HASH =
  "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";

function credit(overrides: Partial<AccountCredit> = {}): AccountCredit {
  return {
    id: "acr_1",
    tx_hash: HASH,
    amount: "25.50",
    currency: "USDC",
    financial_account_id: "acct_1",
    from_address: "GFROM",
    to_address: "GTO",
    observed_at: "2026-08-20T12:00:00Z",
    source: "stellar_payment",
    crypto_network: "stellar_testnet",
    memo: null,
    wallet_address: "GTO",
    ...overrides,
  };
}

describe("findCreditByTxHash", () => {
  it("matches credits and transactions by tx_hash (case-insensitive)", () => {
    expect(
      findCreditByTxHash({
        txHash: HASH,
        credits: [credit({ tx_hash: HASH.toUpperCase() })],
        transactions: [],
      })?.id,
    ).toBe("acr_1");

    const tx = {
      id: "acr_2",
      direction: "in",
      status: "completed",
      amount_fiat: "10",
      currency: "USDC",
      aggregator_order_id: null,
      external_order_id: null,
      wallet_address: null,
      tx_hash: HASH,
      created_at: "2026-08-20T12:00:00Z",
      updated_at: "2026-08-20T12:00:00Z",
    } satisfies Transaction;
    expect(
      findCreditByTxHash({
        txHash: HASH,
        credits: [],
        transactions: [tx],
      })?.id,
    ).toBe("acr_2");
  });

  it("returns null when hash is missing or no row matches — never invents a credit", () => {
    expect(
      findCreditByTxHash({
        txHash: "",
        credits: [credit()],
        transactions: [],
      }),
    ).toBeNull();
    expect(
      findCreditByTxHash({
        txHash: HASH,
        credits: [credit({ tx_hash: "other" })],
        transactions: [],
      }),
    ).toBeNull();
  });
});

describe("nextCreditWatchPhase", () => {
  it("stays submitted until a match, then credited", () => {
    expect(
      nextCreditWatchPhase({
        phase: "submitted",
        matched: null,
        attempt: 1,
      }),
    ).toBe("submitted");
    expect(
      nextCreditWatchPhase({
        phase: "submitted",
        matched: credit(),
        attempt: 2,
      }),
    ).toBe("credited");
  });

  it("times out after the attempt budget without inventing credited", () => {
    expect(
      nextCreditWatchPhase({
        phase: "submitted",
        matched: null,
        attempt: CREDIT_WATCH_TIMEOUT_ATTEMPTS,
      }),
    ).toBe("timed_out");
    expect(
      nextCreditWatchPhase({
        phase: "submitted",
        matched: null,
        attempt: CREDIT_WATCH_TIMEOUT_ATTEMPTS - 1,
      }),
    ).toBe("submitted");
  });

  it("keeps credited / timed_out terminal", () => {
    expect(
      nextCreditWatchPhase({
        phase: "credited",
        matched: null,
        attempt: 99,
      }),
    ).toBe("credited");
    expect(
      nextCreditWatchPhase({
        phase: "timed_out",
        matched: credit(),
        attempt: 1,
      }),
    ).toBe("timed_out");
  });
});

describe("creditWatchStatusMessage", () => {
  it("mirrors existing Top-up / Freighter copy tones", () => {
    expect(creditWatchStatusMessage("submitted")).toMatch(/should credit shortly/i);
    expect(creditWatchStatusMessage("credited")).toMatch(/^Credited$/i);
    expect(creditWatchStatusMessage("timed_out")).toMatch(/has not confirmed the credit yet/i);
    expect(creditWatchStatusMessage("timed_out")).not.toMatch(/\d+\.\d+\s*USDC/);
  });
});

describe("credit watch backoff", () => {
  it("reuses order-status tiered polling intervals", () => {
    expect(nextPollIntervalMs(1)).toBe(1_000);
    expect(nextPollIntervalMs(61)).toBe(5_000);
  });
});

describe("credit watch phase type", () => {
  it("exposes the three UI phases", () => {
    const phases: CreditWatchPhase[] = ["submitted", "credited", "timed_out"];
    expect(phases).toHaveLength(3);
  });
});
