import { describe, expect, it } from "vitest";
import {
  buildAccountSendResultSummary,
  buildAccountSendSuccessDetails,
  buildSendExplorerUrl,
  buildSendPreviewPayload,
  explainAccountSendError,
  formatSendAmountDisplay,
  mergeSendableAccounts,
  resolveSendStablecoinSelection,
  sendableAssetsFromAccounts,
  sendableChainsForAsset,
  sendCryptoRecipientPlaceholder,
  validateEvmAddress,
  validateSendAddress,
  validateSendAmount,
  validateStellarAddress,
} from "./accountSends";
import {
  accountForNetwork,
  extractAccountRows,
  isSendableStablecoinAccount,
  normalizeFinancialAccount,
  toPartnerNetwork,
} from "./entities";

describe("account send validation", () => {
  it("accepts a checksummed EVM address", () => {
    expect(validateEvmAddress("0x1111111111111111111111111111111111111111")).toBe(
      "0x1111111111111111111111111111111111111111",
    );
  });

  it("rejects ENS / short addresses", () => {
    expect(() => validateEvmAddress("vitalik.eth")).toThrow(/0x EVM/);
    expect(() => validateEvmAddress("0xabc")).toThrow(/0x EVM/);
  });

  it("enforces the 1 USDC minimum", () => {
    expect(validateSendAmount("1")).toBe("1");
    expect(validateSendAmount("1.00")).toBe("1.00");
    expect(() => validateSendAmount("0.99")).toThrow(/Minimum/);
  });

  it("builds a partner-shaped preview body", () => {
    expect(
      buildSendPreviewPayload({
        toAddress: "0x1111111111111111111111111111111111111111",
        amount: "2.5",
        networkKey: "base",
      }),
    ).toEqual({
      to_address: "0x1111111111111111111111111111111111111111",
      amount: "2.5",
      network: "Base",
    });
    expect(toPartnerNetwork("POLYGON")).toBe("Polygon");
    expect(toPartnerNetwork("ethereum")).toBeNull();
  });

  it("accepts a Stellar public key and pins network Stellar", () => {
    const stellar = "GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE";
    expect(validateStellarAddress(stellar.toLowerCase())).toBe(stellar);
    expect(validateSendAddress(stellar, "stellar")).toBe(stellar);
    expect(() => validateSendAddress("0x1111111111111111111111111111111111111111", "stellar")).toThrow(
      /Stellar public key/,
    );
    expect(() => validateSendAddress(stellar, "base")).toThrow(/0x EVM/);
    expect(
      buildSendPreviewPayload({
        toAddress: stellar,
        amount: "5",
        networkKey: "stellar",
      }),
    ).toEqual({
      to_address: stellar,
      amount: "5",
      network: "Stellar",
    });
    expect(
      buildSendPreviewPayload({
        toAddress: stellar,
        amount: "5",
        networkKey: "stellar",
        accountNetwork: "stellar_testnet",
      }).network,
    ).toBe("stellar_testnet");
    expect(sendCryptoRecipientPlaceholder("stellar")).toMatch(/Stellar/);
    expect(sendCryptoRecipientPlaceholder("base")).toMatch(/EVM/);
  });

  it("rejects short or checksum-invalid Stellar keys", () => {
    expect(() => validateStellarAddress("GABC")).toThrow(/Stellar public key/);
    expect(() => validateStellarAddress("0x1111111111111111111111111111111111111111")).toThrow(
      /Stellar public key/,
    );
    const valid = "GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE";
    const swapped = `${valid.slice(0, -1)}F`;
    expect(swapped).toHaveLength(56);
    expect(() => validateStellarAddress(swapped)).toThrow(/Stellar public key/);
  });

  it("rewrites legacy EVM-only send errors on the Stellar rail", () => {
    expect(explainAccountSendError("to_address must be a valid 20-byte EVM address.", "stellar")).toMatch(
      /backend that accepts G/i,
    );
    expect(explainAccountSendError("to_address must be a valid 20-byte EVM address.", "base")).toBe(
      "to_address must be a valid 20-byte EVM address.",
    );
  });

  it("formats send amounts to two decimal places", () => {
    expect(formatSendAmountDisplay("3.000000000000000000")).toBe("3.00");
    expect(formatSendAmountDisplay("12.5")).toBe("12.50");
    expect(formatSendAmountDisplay("")).toBe("0.00");
  });

  it("builds a compact success summary and explorer links", () => {
    expect(
      buildAccountSendResultSummary({
        amount: "3.000000000000000000",
        currency: "USDC",
        status: "completed",
        id: "snd_0617a5b5cf7e4e3f957e06c934a15931",
      }),
    ).toBe("3.00 USDC · completed · snd_0617a5b5cf7e4e3f957e06c934a15931");

    expect(
      buildAccountSendSuccessDetails({
        amount: "4.000000000000000000",
        currency: "USDC",
        status: "completed",
        id: "snd_2167511adc59414bb399563d8cebe337",
        network: "Stellar",
      }),
    ).toEqual({
      title: "Transfer complete",
      amountDisplay: "4.00",
      currency: "USDC",
      statusLabel: "Completed",
      referenceId: "snd_2167511adc59414bb399563d8cebe337",
      networkLabel: "Stellar",
      explorerLabel: "View on Stellar",
    });

    expect(
      buildSendExplorerUrl({
        network: "Stellar",
        txHash: "abc123",
      }),
    ).toBe("https://stellar.expert/explorer/testnet/tx/abc123");
    expect(
      buildSendExplorerUrl({
        network: "stellar_public",
        txHash: "abc123",
      }),
    ).toBe("https://stellar.expert/explorer/public/tx/abc123");
    expect(buildSendExplorerUrl({ network: "Base", txHash: "0xdead" })).toBe(
      "https://basescan.org/tx/0xdead",
    );
    expect(buildSendExplorerUrl({ network: "Stellar", txHash: "" })).toBeNull();
  });
});

describe("sendable account discovery helpers", () => {
  it("extracts accounts from several partner list shapes", () => {
    expect(extractAccountRows({ accounts: [{ id: "a1" }] })).toHaveLength(1);
    expect(extractAccountRows({ items: [{ id: "a2" }] })).toHaveLength(1);
    expect(extractAccountRows([{ id: "a3" }])).toHaveLength(1);
  });

  it("keeps ready USDC Base, Polygon, and Stellar accounts", () => {
    const ready = normalizeFinancialAccount(
      {
        id: "acct_base",
        asset_type: "stablecoin",
        currency: "usdc",
        network: "Base",
        status: "ready",
      },
      "ent_1",
    )!;
    const eth = normalizeFinancialAccount(
      {
        id: "acct_eth",
        asset_type: "stablecoin",
        currency: "USDC",
        network: "Ethereum",
        status: "ready",
      },
      "ent_1",
    )!;
    const pending = normalizeFinancialAccount(
      {
        id: "acct_poly",
        asset_type: "stablecoin",
        currency: "USDC",
        network: "Polygon",
        status: "pending",
      },
      "ent_1",
    )!;
    const stellar = normalizeFinancialAccount(
      {
        id: "acct_xlm",
        asset_type: "stablecoin",
        currency: "USDC",
        network: "stellar_testnet",
        status: "ready",
      },
      "ent_1",
    )!;
    expect(isSendableStablecoinAccount(ready)).toBe(true);
    expect(isSendableStablecoinAccount(eth)).toBe(false);
    expect(isSendableStablecoinAccount(pending)).toBe(false);
    expect(isSendableStablecoinAccount(stellar)).toBe(true);
    expect(accountForNetwork([ready], "base")?.id).toBe("acct_base");
    expect(accountForNetwork([stellar], "stellar")?.id).toBe("acct_xlm");
    expect(accountForNetwork([stellar], "stellar_public")).toBeUndefined();
  });

  it("matches sendable accounts by network and currency", () => {
    const usdc = normalizeFinancialAccount(
      {
        id: "acct_usdc",
        asset_type: "stablecoin",
        currency: "USDC",
        network: "Polygon",
        status: "ready",
      },
      "ent_1",
    )!;
    const usdt = normalizeFinancialAccount(
      {
        id: "acct_usdt",
        asset_type: "stablecoin",
        currency: "USDT",
        network: "Polygon",
        status: "ready",
      },
      "ent_1",
    )!;
    expect(isSendableStablecoinAccount(usdt)).toBe(true);
    expect(accountForNetwork([usdc, usdt], "polygon", "USDT")?.id).toBe("acct_usdt");
    expect(accountForNetwork([usdc, usdt], "polygon", "USDC")?.id).toBe("acct_usdc");
  });
});

describe("sendable asset/chain picker from backend wallets", () => {
  const baseUsdc = normalizeFinancialAccount(
    {
      id: "base_usdc",
      asset_type: "stablecoin",
      currency: "USDC",
      network: "Base",
      status: "ready",
      wallet_address: "0x1111111111111111111111111111111111111111",
    },
    "ent_1",
  )!;
  const polyUsdt = normalizeFinancialAccount(
    {
      id: "poly_usdt",
      asset_type: "stablecoin",
      currency: "USDT",
      network: "Polygon",
      status: "ready",
      wallet_address: "0x2222222222222222222222222222222222222222",
    },
    "ent_1",
  )!;

  it("lists only assets and chains the user can send from", () => {
    const accounts = mergeSendableAccounts([baseUsdc, polyUsdt]);
    expect(sendableAssetsFromAccounts(accounts)).toEqual(["usdc", "usdt"]);
    expect(sendableChainsForAsset(accounts, "usdc", { accountsReady: true }).map((n) => n.key)).toEqual([
      "base",
    ]);
    expect(sendableChainsForAsset(accounts, "usdt", { accountsReady: true }).map((n) => n.key)).toEqual([
      "polygon",
    ]);
  });

  it("snaps Stellar leftovers onto a wallet the user actually has", () => {
    const next = resolveSendStablecoinSelection({
      accounts: [baseUsdc, polyUsdt],
      asset: "usdc",
      chain: "stellar",
      accountsReady: true,
    });
    expect(next).toMatchObject({
      asset: "usdc",
      chain: "base",
      accountId: "base_usdc",
    });
  });

  it("returns no chain chips when accounts are ready but empty for that asset", () => {
    expect(sendableChainsForAsset([polyUsdt], "usdc", { accountsReady: true })).toEqual([]);
  });
});
