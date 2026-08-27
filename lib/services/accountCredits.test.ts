import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/apiClient", () => ({
  apiEnvelope: vi.fn(),
}));

import { apiEnvelope } from "@/lib/apiClient";
import {
  accountCreditsApi,
  extractAccountCreditRows,
  isInboundStellarDeposit,
  mapAccountCreditToTransaction,
  normalizeAccountCredit,
} from "./accountCredits";
import {
  normalizeTransactionWire,
  type Transaction,
} from "./transactions";

const mockedApiEnvelope = vi.mocked(apiEnvelope);

const STELLAR_HASH =
  "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";

function creditWire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "acr_01hqxyzcredit0001",
    tx_hash: STELLAR_HASH,
    amount: "25.50",
    currency: "USDC",
    financial_account_id: "acct_stellar_usdc_1",
    from_address: "GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE",
    to_address: "GDQNY3P73RXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    observed_at: "2026-08-20T12:00:00Z",
    source: "stellar_payment",
    crypto_network: "stellar_testnet",
    memo: null,
    ...overrides,
  };
}

describe("normalizeAccountCredit", () => {
  it("maps a full account-credit wire payload", () => {
    const credit = normalizeAccountCredit(creditWire());
    expect(credit).toEqual({
      id: "acr_01hqxyzcredit0001",
      tx_hash: STELLAR_HASH,
      amount: "25.50",
      currency: "USDC",
      financial_account_id: "acct_stellar_usdc_1",
      from_address: "GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE",
      to_address: "GDQNY3P73RXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      observed_at: "2026-08-20T12:00:00Z",
      source: "stellar_payment",
      crypto_network: "stellar_testnet",
      memo: null,
      wallet_address: "GDQNY3P73RXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    });
  });

  it("accepts alternate spellings (from/to, observedAt, financialAccountId)", () => {
    const credit = normalizeAccountCredit({
      id: "acr_alt",
      txHash: "hash_alt",
      amount: 10,
      currency: "usdc",
      financialAccountId: "acct_2",
      from: "GFROM",
      to: "GTO",
      observedAt: "2026-08-21T00:00:00Z",
      source: "account.credited",
      cryptoNetwork: "Stellar",
      memo: "ignored-ok",
    });
    expect(credit).toMatchObject({
      id: "acr_alt",
      tx_hash: "hash_alt",
      amount: "10",
      currency: "USDC",
      financial_account_id: "acct_2",
      from_address: "GFROM",
      to_address: "GTO",
      observed_at: "2026-08-21T00:00:00Z",
      crypto_network: "Stellar",
      memo: "ignored-ok",
    });
  });

  it("fails closed when id is missing", () => {
    expect(normalizeAccountCredit(creditWire({ id: "" }))).toBeNull();
    expect(normalizeAccountCredit(creditWire({ id: null }))).toBeNull();
    expect(normalizeAccountCredit({ amount: "1", tx_hash: "h" })).toBeNull();
  });

  it("fails closed when amount is missing or unparseable", () => {
    expect(normalizeAccountCredit(creditWire({ amount: "" }))).toBeNull();
    expect(normalizeAccountCredit(creditWire({ amount: "n/a" }))).toBeNull();
    expect(normalizeAccountCredit(creditWire({ amount: null }))).toBeNull();
  });

  it("fails closed when financial_account_id is missing", () => {
    expect(normalizeAccountCredit(creditWire({ financial_account_id: "" }))).toBeNull();
    expect(
      normalizeAccountCredit(creditWire({ financial_account_id: null, financialAccountId: null })),
    ).toBeNull();
  });

  it("fails closed when observed_at is missing", () => {
    expect(normalizeAccountCredit(creditWire({ observed_at: "" }))).toBeNull();
    expect(normalizeAccountCredit(creditWire({ observed_at: null, observedAt: null }))).toBeNull();
  });

  it("keeps tx_hash null when the API omitted it — never invents a hash", () => {
    const credit = normalizeAccountCredit(creditWire({ tx_hash: null, txHash: null }));
    expect(credit).not.toBeNull();
    expect(credit!.tx_hash).toBeNull();
  });

  it("keeps memo null when absent — never invents a memo", () => {
    const credit = normalizeAccountCredit(creditWire({ memo: undefined }));
    expect(credit!.memo).toBeNull();
  });
});

describe("extractAccountCreditRows", () => {
  it("reads items / credits / bare arrays", () => {
    expect(extractAccountCreditRows({ items: [creditWire()] })).toHaveLength(1);
    expect(extractAccountCreditRows({ credits: [creditWire({ id: "acr_2" })] })).toHaveLength(1);
    expect(extractAccountCreditRows([creditWire({ id: "acr_3" })])).toHaveLength(1);
    expect(extractAccountCreditRows(null)).toEqual([]);
    expect(extractAccountCreditRows({})).toEqual([]);
  });
});

describe("mapAccountCreditToTransaction", () => {
  it("projects an inbound deposit Transaction with Stellar fields", () => {
    const credit = normalizeAccountCredit(creditWire())!;
    const tx = mapAccountCreditToTransaction(credit);
    expect(tx).toMatchObject({
      id: "acr_01hqxyzcredit0001",
      direction: "in",
      status: "completed",
      amount_fiat: "25.50",
      currency: "USDC",
      wallet_address: "GDQNY3P73RXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      crypto_currency: "USDC",
      crypto_network: "stellar_testnet",
      tx_hash: STELLAR_HASH,
      memo: null,
      financial_account_id: "acct_stellar_usdc_1",
      source: "stellar_payment",
      created_at: "2026-08-20T12:00:00Z",
      updated_at: "2026-08-20T12:00:00Z",
    } satisfies Partial<Transaction>);
    expect(tx.aggregator_order_id).toBeNull();
    expect(tx.external_order_id).toBeNull();
    expect(isInboundStellarDeposit(tx)).toBe(true);
  });

  it("does not mark a non-Stellar credit as a Stellar inbound deposit", () => {
    const credit = normalizeAccountCredit(
      creditWire({ crypto_network: "Base", source: "card_charge" }),
    )!;
    const tx = mapAccountCreditToTransaction(credit);
    expect(isInboundStellarDeposit(tx)).toBe(false);
  });
});

describe("normalizeTransactionWire (extended inbound fields)", () => {
  it("keeps merchant-order numeric ids and optional Stellar fields", () => {
    const tx = normalizeTransactionWire({
      id: 42,
      direction: "in",
      status: "completed",
      amount_fiat: "100.00",
      currency: "KES",
      aggregator_order_id: null,
      external_order_id: null,
      wallet_address: "0xabc",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:05:00Z",
      tx_hash: "0xdead",
      crypto_network: "base",
      memo: null,
    });
    expect(tx).toMatchObject({
      id: 42,
      tx_hash: "0xdead",
      crypto_network: "base",
      memo: null,
    });
  });

  it("accepts projected credit rows with acr_ string ids", () => {
    const tx = normalizeTransactionWire({
      id: "acr_01hqxyzcredit0001",
      direction: "in",
      status: "completed",
      amount_fiat: "25.50",
      currency: "USDC",
      aggregator_order_id: null,
      external_order_id: null,
      wallet_address: "GDEST",
      created_at: "2026-08-20T12:00:00Z",
      updated_at: "2026-08-20T12:00:00Z",
      tx_hash: STELLAR_HASH,
      crypto_network: "stellar_testnet",
      memo: null,
      financial_account_id: "acct_1",
      source: "stellar_payment",
    });
    expect(tx).not.toBeNull();
    expect(tx!.id).toBe("acr_01hqxyzcredit0001");
    expect(tx!.tx_hash).toBe(STELLAR_HASH);
    expect(isInboundStellarDeposit(tx!)).toBe(true);
  });

  it("fails closed when required transaction fields are missing", () => {
    expect(normalizeTransactionWire({ id: 1, amount_fiat: "10" })).toBeNull();
    expect(
      normalizeTransactionWire({
        id: "",
        direction: "in",
        status: "completed",
        amount_fiat: "10",
        currency: "USDC",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    ).toBeNull();
    expect(
      normalizeTransactionWire({
        id: 1,
        direction: "in",
        status: "completed",
        amount_fiat: "n/a",
        currency: "USDC",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    ).toBeNull();
  });

  it("never invents tx_hash or memo when the wire omits them", () => {
    const tx = normalizeTransactionWire({
      id: 7,
      direction: "out",
      status: "completed",
      amount_fiat: "1.00",
      currency: "USDC",
      aggregator_order_id: null,
      external_order_id: null,
      wallet_address: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(tx).not.toBeNull();
    expect(tx!.tx_hash).toBeNull();
    expect(tx!.memo).toBeNull();
  });
});

describe("accountCreditsApi", () => {
  beforeEach(() => {
    mockedApiEnvelope.mockReset();
  });

  it("lists credits from GET /v1/account-credits and drops invalid rows", async () => {
    mockedApiEnvelope.mockResolvedValueOnce({
      items: [creditWire(), { id: "", amount: "1" }, creditWire({ id: "acr_ok2", amount: "3" })],
      total: 2,
    });

    const page = await accountCreditsApi.list();

    expect(mockedApiEnvelope).toHaveBeenCalledWith("GET", "/v1/account-credits");
    expect(page.items).toHaveLength(2);
    expect(page.items[0]?.id).toBe("acr_01hqxyzcredit0001");
    expect(page.items[1]?.id).toBe("acr_ok2");
    expect(page.total).toBe(2);
  });

  it("gets a single credit by id", async () => {
    mockedApiEnvelope.mockResolvedValueOnce(creditWire({ id: "acr_one" }));
    const credit = await accountCreditsApi.get("acr_one");
    expect(mockedApiEnvelope).toHaveBeenCalledWith("GET", "/v1/account-credits/acr_one");
    expect(credit?.id).toBe("acr_one");
  });

  it("returns null from get when the payload fails closed", async () => {
    mockedApiEnvelope.mockResolvedValueOnce({ amount: "1" });
    expect(await accountCreditsApi.get("acr_bad")).toBeNull();
  });
});
