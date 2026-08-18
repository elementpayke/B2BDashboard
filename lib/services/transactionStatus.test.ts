import { describe, expect, it } from "vitest";
import {
  TRANSACTION_STATUS,
  describeTransactionStatus,
  isTerminalTransactionStatus,
} from "./transactionStatus";
import type { TransactionStatus } from "./transactions";

const ALL_STATUSES: TransactionStatus[] = [
  "processing",
  "completed",
  "failed",
  "refunded",
  "canceled",
  "frozen",
];

describe("transaction status contract", () => {
  it("defines presentation and lifecycle semantics for every backend status", () => {
    expect(Object.keys(TRANSACTION_STATUS).sort()).toEqual([...ALL_STATUSES].sort());
    for (const status of ALL_STATUSES) {
      const descriptor = describeTransactionStatus(status);
      expect(descriptor.label).not.toBe("");
      expect(descriptor.icon).not.toBe("");
      expect(descriptor.color).toMatch(/^var\(/);
      expect(descriptor.soft).toMatch(/^(var|color-mix)\(/);
    }
  });

  it("only treats backend terminal states as terminal", () => {
    expect(ALL_STATUSES.filter(isTerminalTransactionStatus)).toEqual([
      "completed",
      "failed",
      "refunded",
      "canceled",
    ]);
  });

  it("only allows receipts for settled transactions", () => {
    expect(
      ALL_STATUSES.filter((status) => describeTransactionStatus(status).receiptEligible),
    ).toEqual(["completed"]);
  });
});
