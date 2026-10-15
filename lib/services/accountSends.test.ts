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
  validateStellarMemo,
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
        accountNetwork: "Stellar",
      }),
    ).toEqual({
      to_address: "0x1111111111111111111111111111111111111111",
      amount: "2.5",
      network: "Base",
    });
    expect(toPartnerNetwork("POLYGON")).toBe("Polygon");
    expect(toPartnerNetwork("ethereum")).toBe("Ethereum");
    expect(toPartnerNetwork("optimism")).toBe("Optimism");
    expect(toPartnerNetwork("arc")).toBe("Arc");
    expect(toPartnerNetwork("solana")).toBeNull();
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

  it("carries an optional memo through to a Stellar preview payload", () => {
    const stellar = "GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE";
    expect(
      buildSendPreviewPayload({
        toAddress: stellar,
        amount: "5",
        networkKey: "stellar",
        memo: "123456",
      }),
    ).toEqual({
      to_address: stellar,
      amount: "5",
      network: "Stellar",
      memo: "123456",
    });
  });

  it("drops the memo on an EVM destination instead of sending it to a chain that ignores it", () => {
    expect(
      buildSendPreviewPayload({
        toAddress: "0x1111111111111111111111111111111111111111",
        amount: "2.5",
        networkKey: "base",
        memo: "123456",
      }),
    ).toEqual({
      to_address: "0x1111111111111111111111111111111111111111",
      amount: "2.5",
      network: "Base",
    });
  });

  it("validates the Stellar memo by UTF-8 byte length, not character count", () => {
    expect(validateStellarMemo("")).toBe("");
    expect(validateStellarMemo("   ")).toBe("");
    expect(validateStellarMemo("123456")).toBe("123456");
    expect(validateStellarMemo("a".repeat(28))).toBe("a".repeat(28));
    expect(() => validateStellarMemo("a".repeat(29))).toThrow(/28 bytes/);
    // 15 multi-byte (3-byte UTF-8) characters = 45 bytes, well under 28 chars.
    expect(() => validateStellarMemo("あ".repeat(15))).toThrow(/28 bytes/);
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
      "https://sepolia.basescan.org/tx/0xdead",
    );
    expect(buildSendExplorerUrl({ network: "Stellar", txHash: "" })).toBeNull();
  });

  it("links every EVM chain to its testnet explorer, not mainnet", () => {
    // This deployment only ever produces testnet transactions today — a
    // mainnet explorer URL here 404s for every real send.
    expect(buildSendExplorerUrl({ network: "Polygon", txHash: "0xdead" })).toBe(
      "https://amoy.polygonscan.com/tx/0xdead",
    );
    expect(buildSendExplorerUrl({ network: "Ethereum", txHash: "0xdead" })).toBe(
      "https://sepolia.etherscan.io/tx/0xdead",
    );
    expect(buildSendExplorerUrl({ network: "Optimism", txHash: "0xdead" })).toBe(
      "https://sepolia-optimism.etherscan.io/tx/0xdead",
    );
    expect(buildSendExplorerUrl({ network: "Arbitrum", txHash: "0xdead" })).toBe(
      "https://sepolia.arbiscan.io/tx/0xdead",
    );
  });
});

describe("sendable account discovery helpers", () => {
  it("extracts accounts from several partner list shapes", () => {
    expect(extractAccountRows({ accounts: [{ id: "a1" }] })).toHaveLength(1);
    expect(extractAccountRows({ items: [{ id: "a2" }] })).toHaveLength(1);
    expect(extractAccountRows([{ id: "a3" }])).toHaveLength(1);
  });

  it("only Stellar USDC is sendable — Base is a bridge network, not a source account", () => {
    const readyBase = normalizeFinancialAccount(
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
    expect(isSendableStablecoinAccount(readyBase)).toBe(false);
    expect(isSendableStablecoinAccount(eth)).toBe(false);
    expect(isSendableStablecoinAccount(pending)).toBe(false);
    expect(isSendableStablecoinAccount(stellar)).toBe(true);
    // accountForNetwork is a raw network/currency matcher used once a network
    // is already chosen (e.g. a CCTP destination) — it is not gated by
    // "sendable" and still finds a Base-network row when asked directly.
    expect(accountForNetwork([readyBase], "base")?.id).toBe("acct_base");
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

  it("without a Stellar USDC home, a legacy Base USDC account is not sendable — only USDT is", () => {
    const accounts = mergeSendableAccounts([baseUsdc, polyUsdt]);
    expect(sendableAssetsFromAccounts(accounts)).toEqual(["usdt"]);
    expect(sendableChainsForAsset(accounts, "usdc", { accountsReady: true }).map((n) => n.key)).toEqual(
      [],
    );
    expect(sendableChainsForAsset(accounts, "usdt", { accountsReady: true }).map((n) => n.key)).toEqual([
      "polygon",
    ]);
  });

  it("snaps a leftover chain key onto a wallet the raw list actually has", () => {
    // resolveSendStablecoinSelection is a pure snapping function — production
    // code always feeds it an already-filtered list (mergeSendableAccounts),
    // but the function itself must not crash or misbehave on an unfiltered one.
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

  it("USDC with Stellar home uses dest chips and sources from Stellar", () => {
    const stellarUsdc = normalizeFinancialAccount(
      {
        id: "stellar_usdc",
        asset_type: "stablecoin",
        currency: "USDC",
        network: "Stellar",
        status: "ready",
        wallet_address: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
      },
      "ent_1",
    )!;
    const accounts = mergeSendableAccounts([stellarUsdc, baseUsdc]);
    expect(
      sendableChainsForAsset(accounts, "usdc", {
        accountsReady: true,
        supportedChainKeys: ["base", "polygon"],
      }).map((n) => n.key),
    ).toEqual(["base", "polygon", "stellar"]);
    const next = resolveSendStablecoinSelection({
      accounts,
      asset: "usdc",
      chain: "base",
      accountsReady: true,
      supportedChainKeys: ["base", "polygon"],
    });
    expect(next).toMatchObject({
      asset: "usdc",
      chain: "base",
      accountId: "stellar_usdc",
    });
  });

  it("offers Arc as a dest chip and resolves it end-to-end (address, preview payload, explorer link)", () => {
    const stellarUsdc = normalizeFinancialAccount(
      {
        id: "stellar_usdc",
        asset_type: "stablecoin",
        currency: "USDC",
        network: "Stellar",
        status: "ready",
        wallet_address: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
      },
      "ent_1",
    )!;
    const accounts = mergeSendableAccounts([stellarUsdc]);
    expect(
      sendableChainsForAsset(accounts, "usdc", {
        accountsReady: true,
        supportedChainKeys: ["arc"],
      }).map((n) => n.key),
    ).toEqual(["arc", "stellar"]);

    const arcAddress = "0x1111111111111111111111111111111111111111";
    expect(validateSendAddress(arcAddress, "arc")).toBe(arcAddress);
    expect(
      buildSendPreviewPayload({ toAddress: arcAddress, amount: "5", networkKey: "arc" }),
    ).toEqual({ to_address: arcAddress, amount: "5", network: "Arc" });
    expect(sendCryptoRecipientPlaceholder("arc")).toMatch(/EVM/);
    expect(buildSendExplorerUrl({ network: "Arc", txHash: "0xdead" })).toBe(
      "https://testnet.arcscan.app/tx/0xdead",
    );

    const next = resolveSendStablecoinSelection({
      accounts,
      asset: "usdc",
      chain: "arc",
      accountsReady: true,
      supportedChainKeys: ["arc"],
    });
    expect(next).toMatchObject({ asset: "usdc", chain: "arc", accountId: "stellar_usdc" });
  });
});
