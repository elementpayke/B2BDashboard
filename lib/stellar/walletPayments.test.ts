import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchStellarWalletPayments,
  parseHorizonPaymentRecord,
} from "./walletPayments";

const ACCOUNT = "GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE";
const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const HASH =
  "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";

function paymentRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "123",
    paging_token: "123",
    transaction_successful: true,
    type: "payment",
    created_at: "2026-08-20T12:00:00Z",
    transaction_hash: HASH,
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: ISSUER,
    from: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA6LSVQPDXQNY7JQDI2R4FQWONHC",
    to: ACCOUNT,
    amount: "25.5000000",
    transaction_attr: {
      memo: "INV-42",
      memo_type: "MEMO_TEXT",
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseHorizonPaymentRecord", () => {
  it("maps inbound Circle USDC payments for the selected wallet", () => {
    expect(
      parseHorizonPaymentRecord(paymentRecord(), {
        account: ACCOUNT,
        usdcIssuer: ISSUER,
      }),
    ).toEqual({
      txHash: HASH,
      amount: "25.5000000",
      direction: "in",
      from: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA6LSVQPDXQNY7JQDI2R4FQWONHC",
      to: ACCOUNT,
      memo: "INV-42",
      createdAt: "2026-08-20T12:00:00Z",
      pagingToken: "123",
    });
  });

  it("maps outbound Circle USDC payments for the selected wallet", () => {
    expect(
      parseHorizonPaymentRecord(
        paymentRecord({
          from: ACCOUNT,
          to: "GCEZWKPX56LJ7EG6H7KPWNTJ6V45WILG5PCVLRBOLLMOTLWTWWHLCSMM",
          amount: "9.0000000",
          transaction_attr: { memo: null },
        }),
        {
          account: ACCOUNT,
          usdcIssuer: ISSUER,
        },
      ),
    ).toMatchObject({
      txHash: HASH,
      amount: "9.0000000",
      direction: "out",
      memo: null,
    });
  });

  it("drops rows that are not Circle USDC wallet payments", () => {
    expect(
      parseHorizonPaymentRecord(
        paymentRecord({
          asset_issuer: "GOTHERISSUER23456789012345678901234567890123456789012345",
        }),
        {
          account: ACCOUNT,
          usdcIssuer: ISSUER,
        },
      ),
    ).toBeNull();

    expect(
      parseHorizonPaymentRecord(
        paymentRecord({
          type: "create_account",
        }),
        {
          account: ACCOUNT,
          usdcIssuer: ISSUER,
        },
      ),
    ).toBeNull();

    expect(
      parseHorizonPaymentRecord(
        paymentRecord({
          to: "GANOTMINE7EG6H7KPWNTJ6V45WILG5PCVLRBOLLMOTLWTWWHLCSMMAB",
        }),
        {
          account: ACCOUNT,
          usdcIssuer: ISSUER,
        },
      ),
    ).toBeNull();
  });
});

describe("fetchStellarWalletPayments", () => {
  it("requests Horizon payments with joined transactions and parses Circle USDC only", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        _embedded: {
          records: [
            paymentRecord(),
            paymentRecord({
              transaction_hash: "deadbeef",
              paging_token: "124",
              asset_code: "EURC",
            }),
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const payments = await fetchStellarWalletPayments({
      horizonUrl: "https://horizon.stellar.org",
      account: ACCOUNT,
      usdcIssuer: ISSUER,
      limit: 25,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://horizon.stellar.org/accounts/GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE/payments?order=desc&limit=25&join=transactions",
      expect.objectContaining({
        headers: { Accept: "application/json" },
      }),
    );
    expect(payments).toHaveLength(1);
    expect(payments[0]?.txHash).toBe(HASH);
  });

  it("throws on Horizon transport errors so callers can fail closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    );

    await expect(
      fetchStellarWalletPayments({
        horizonUrl: "https://horizon.stellar.org",
        account: ACCOUNT,
        usdcIssuer: ISSUER,
        limit: 10,
      }),
    ).rejects.toThrow(/503/);
  });
});
