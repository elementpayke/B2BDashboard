import { describe, expect, it } from "vitest";
import {
  buildSendPreviewPayload,
  explainAccountSendError,
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
});
