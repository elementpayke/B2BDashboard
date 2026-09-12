import { describe, expect, it } from "vitest";
import {
  isCardSpendTransaction,
  mapCardTransactionToTransaction,
  mapCardTxnStatus,
  mergeCardTransactionList,
  normalizeCardTransaction,
  toCardTransactionId,
} from "@/lib/services/cardTransactions";
import { presentTransaction } from "@/lib/services/transactionPresentation";
import { describeTransactionStatus } from "@/lib/services/transactionStatus";

describe("cardTransactions", () => {
  it("normalizes declined partner rows", () => {
    const row = normalizeCardTransaction({
      transaction_id: "txn_1",
      card_id: "4",
      account_id: "acct_usd",
      amount: "12.50",
      currency: "usd",
      status: "declined",
      type: "debit",
      narration: "STRIPE INVOICE",
      created_at: 1_700_000_000_000,
      card_last_four: "4242",
    });
    expect(row?.transaction_id).toBe("txn_1");
    expect(row?.status).toBe("declined");
    expect(row?.created_at).toMatch(/^\d{4}-/);
  });

  it("maps declined spend into Transaction with Declined label", () => {
    const txn = mapCardTransactionToTransaction({
      transaction_id: "txn_1",
      card_id: "4",
      account_id: "acct_usd",
      amount: "12.50",
      currency: "USD",
      status: "declined",
      type: "debit",
      narration: "STRIPE INVOICE",
      created_at: "2024-01-01T00:00:00.000Z",
      card_last_four: "4242",
      card_name: "Ops",
    });
    expect(txn.id).toBe("ctx_txn_1");
    expect(txn.status).toBe("declined");
    expect(txn.direction).toBe("out");
    expect(txn.card_id).toBe("4");
    expect(isCardSpendTransaction(txn)).toBe(true);
    expect(describeTransactionStatus(txn.status).label).toBe("Declined");
    expect(presentTransaction(txn).type).toBe("Card authorization");
    expect(presentTransaction(txn).client).toMatch(/STRIPE|Ops|Card/i);
  });

  it("maps compact status aliases", () => {
    expect(mapCardTxnStatus("denied")).toBe("declined");
    expect(mapCardTxnStatus("settled")).toBe("completed");
    expect(mapCardTxnStatus("authorized")).toBe("processing");
    expect(mapCardTxnStatus("mystery-hold")).toBe("failed");
    expect(toCardTransactionId("abc")).toBe("ctx_abc");
  });

  it("fail-closes without id or amount", () => {
    expect(
      normalizeCardTransaction({
        card_id: "4",
        account_id: "a",
        amount: "1.00",
        created_at: "2024-01-01T00:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      normalizeCardTransaction({
        transaction_id: "t",
        card_id: "4",
        account_id: "a",
        created_at: "2024-01-01T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("accepts Nuvion-style _id when transaction_id/id are absent", () => {
    const row = normalizeCardTransaction({
      _id: "txn_01HXYZ",
      card_id: "4",
      account_id: "acct_usd",
      amount: "12.50",
      currency: "USD",
      status: "completed",
      type: "debit",
      created_at: 1_700_000_000_000,
    });
    expect(row?.transaction_id).toBe("txn_01HXYZ");
  });

  it("skips out-of-range timestamps without throwing", () => {
    expect(
      normalizeCardTransaction({
        transaction_id: "t",
        card_id: "4",
        account_id: "a",
        amount: "1.00",
        created_at: Number.MAX_SAFE_INTEGER * 1000,
      }),
    ).toBeNull();
  });

  it("passes through payment_type and falls back to txn_type when type is absent", () => {
    const row = normalizeCardTransaction({
      transaction_id: "txn_2",
      card_id: "4",
      account_id: "acct_usd",
      amount: "7.00",
      currency: "usd",
      payment_type: "pos",
      txn_type: "credit",
      created_at: "2024-01-01T00:00:00.000Z",
    });
    expect(row?.payment_type).toBe("pos");
    expect(row?.type).toBe("credit");
  });

  it("merges a live row to the front and replaces the older copy by transaction id", () => {
    const merged = mergeCardTransactionList(
      {
        entity_id: "ent_1",
        account_id: "acct_usd",
        transactions: [
          {
            transaction_id: "txn_1",
            card_id: "4",
            account_id: "acct_usd",
            amount: "12.50",
            currency: "USD",
            status: "pending",
            type: "debit",
            created_at: "2024-01-01T00:00:00.000Z",
          },
        ],
      },
      {
        transaction_id: "txn_1",
        card_id: "4",
        account_id: "acct_usd",
        entity_id: "ent_1",
        amount: "12.50",
        currency: "USD",
        status: "completed",
        type: "debit",
        created_at: "2024-01-02T00:00:00.000Z",
      },
    );

    expect(merged.transactions).toHaveLength(1);
    expect(merged.transactions[0]?.status).toBe("completed");
    expect(merged.transactions[0]?.created_at).toBe("2024-01-02T00:00:00.000Z");
  });
});
