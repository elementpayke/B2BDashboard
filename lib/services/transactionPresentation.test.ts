import { describe, expect, it } from "vitest";
import {
  formatTransactionDate,
  presentTransaction,
  transactionReference,
} from "./transactionPresentation";
import type { Transaction } from "./transactions";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 42,
    direction: "out",
    status: "processing",
    amount_fiat: "128040",
    currency: "KES",
    aggregator_order_id: "YC-90de94b9-0981-52e2",
    external_order_id: null,
    wallet_address: null,
    created_at: "2026-08-14T11:32:00Z",
    updated_at: "2026-08-14T11:32:00Z",
    ...overrides,
  };
}

describe("presentTransaction", () => {
  it("keeps technical IDs secondary and never surfaces partner brands", () => {
    const view = presentTransaction(transaction({ provider: "yellowcard" }));

    expect(view.client).toBe("Payout · KES");
    expect(view.client).not.toContain("yellowcard");
    expect(view.client).not.toContain("YC-");
    expect(view.meta).toContain("Ref YC-90de94");
    expect(view.amount).toBe("−128,040.00 KES");
    expect(view.statusLabel).toBe("Pending");
  });

  it("uses workflow + currency even when a counterparty string is present", () => {
    expect(presentTransaction(transaction({ provider: "Acme Payments" })).client).toBe(
      "Payout · KES",
    );
  });

  it("uses a human workflow fallback when no counterparty is returned", () => {
    expect(presentTransaction(transaction()).client).toBe("Payout · KES");
    expect(
      presentTransaction(transaction({ direction: "in", currency: "NGN" })).client,
    ).toBe("Deposit · NGN");
  });

  it("uses the external reference before aggregator and PSP references", () => {
    expect(
      transactionReference(
        transaction({
          external_order_id: "supplier-invoice-17",
          psp_transaction_id: "psp-22",
        }),
      ),
    ).toBe("supplier-invoice-17");
  });

  it("flattens payment counterparty fields for the detail modal and receipt", () => {
    const view = presentTransaction(
      transaction({
        payment: {
          party_name: "Jane Wanjiku",
          account_number: "+254712345678",
          account_kind: "phone",
          method_type: "mobile_money",
          network_name: "M-PESA",
        },
      }),
    );
    expect(view.partyName).toBe("Jane Wanjiku");
    expect(view.client).toBe("Jane Wanjiku");
    expect(view.meta).toContain("Payout · KES");
    expect(view.meta).toContain("Ref YC-90de94");
    expect(view.accountName).toBeNull();
    expect(view.accountNumber).toBe("+254712345678");
    expect(view.accountKind).toBe("phone");
    expect(view.networkName).toBe("M-PESA");
    expect(view.railType).toBe("mobile");
  });

  it("uses payment.account_name as list title when party_name is missing", () => {
    const view = presentTransaction(
      transaction({
        payment: {
          account_name: "Chidi Okonkwo",
          account_number: "0123456789",
          account_kind: "bank_account",
          method_type: "bank",
        },
      }),
    );
    expect(view.partyName).toBe("Chidi Okonkwo");
    expect(view.client).toBe("Chidi Okonkwo");
    expect(view.accountName).toBeNull();
  });

  it("prefers party_name and keeps a distinct account_name as Account name", () => {
    const view = presentTransaction(
      transaction({
        payment: {
          party_name: "Jane Wanjiku",
          account_name: "JANE W KCB",
          account_number: "+254712345678",
          account_kind: "phone",
        },
      }),
    );
    expect(view.partyName).toBe("Jane Wanjiku");
    expect(view.accountName).toBe("JANE W KCB");
  });

  it("collapses matching party_name and account_name into one display name", () => {
    const view = presentTransaction(
      transaction({
        payment: {
          party_name: "Jane Wanjiku",
          account_name: "jane wanjiku",
        },
      }),
    );
    expect(view.partyName).toBe("Jane Wanjiku");
    expect(view.accountName).toBeNull();
  });
  it("prefers tx_hash then credit id for inbound Stellar deposits", () => {
    const hash =
      "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";
    expect(
      transactionReference(
        transaction({
          id: "acr_01hqxyzcredit0001",
          direction: "in",
          currency: "USDC",
          crypto_network: "stellar_testnet",
          source: "stellar_payment",
          tx_hash: hash,
          aggregator_order_id: null,
          external_order_id: null,
        }),
      ),
    ).toBe(hash);
    expect(
      transactionReference(
        transaction({
          id: "acr_01hqxyzcredit0001",
          direction: "in",
          currency: "USDC",
          crypto_network: "stellar_testnet",
          source: "stellar_payment",
          tx_hash: null,
          aggregator_order_id: null,
          external_order_id: null,
        }),
      ),
    ).toBe("acr_01hqxyzcredit0001");
  });

  it("labels inbound Stellar credits as Stellar deposit and keeps the hash in meta", () => {
    const hash =
      "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";
    const view = presentTransaction(
      transaction({
        id: "acr_01hqxyzcredit0001",
        direction: "in",
        status: "completed",
        amount_fiat: "25.50",
        currency: "USDC",
        crypto_network: "stellar_testnet",
        source: "stellar_payment",
        tx_hash: hash,
        memo: null,
        aggregator_order_id: null,
        external_order_id: null,
      }),
    );
    expect(view.type).toBe("Stellar deposit");
    expect(view.client).toBe("Deposit · USDC");
    expect(view.ref).toBe(hash);
    expect(view.meta).toContain("Ref a1b2c3d4e5");
    expect(view.explorerUrl).toBe(
      `https://stellar.expert/explorer/testnet/tx/${hash}`,
    );
  });

  it("uses network-aware explorers and skips stellar.expert for EVM hashes", () => {
    expect(
      presentTransaction(
        transaction({
          crypto_network: "Base",
          tx_hash: "0xdeadbeef",
        }),
      ).explorerUrl,
    ).toBe("https://basescan.org/tx/0xdeadbeef");

    expect(
      presentTransaction(
        transaction({
          crypto_network: "Polygon",
          tx_hash: "0xabc",
        }),
      ).explorerUrl,
    ).toBe("https://polygonscan.com/tx/0xabc");
  });
});

describe("formatTransactionDate", () => {
  it("labels today and yesterday relative to the supplied clock", () => {
    const now = new Date(2026, 7, 14, 16, 0);
    expect(formatTransactionDate(new Date(2026, 7, 14, 14, 32).toISOString(), now)).toMatch(
      /^Today, /,
    );
    expect(formatTransactionDate(new Date(2026, 7, 13, 14, 32).toISOString(), now)).toMatch(
      /^Yesterday, /,
    );
  });

  it("handles invalid timestamps without fabricating a date", () => {
    expect(formatTransactionDate("not-a-date")).toBe("Date unavailable");
  });

  it("includes the year for transactions outside the current year", () => {
    const now = new Date(2026, 7, 14, 16, 0);
    expect(formatTransactionDate(new Date(2025, 0, 5, 9, 15).toISOString(), now)).toContain(
      "2025",
    );
  });
});
