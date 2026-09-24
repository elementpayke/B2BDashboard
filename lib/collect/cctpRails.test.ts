import { describe, expect, it } from "vitest";
import {
  buildCollectEvmFundRails,
  buildCollectFundModalRails,
  fundRailsForAccount,
  mergeFundStablecoinRails,
} from "./cctpRails";
import type { FundStablecoinRail } from "@/lib/services/entities";

describe("buildCollectEvmFundRails", () => {
  it("maps collect.evm_usdc into fund rails", () => {
    const rails = buildCollectEvmFundRails(
      {
        wallet_address: "GHOME",
        collect: {
          evm_usdc: [
            {
              network: "base",
              address: "0x71d323E4af97b1deca2e9Bc7F31F86B1Bce55903",
              asset: "USDC",
              token_address: "0x036cbd",
            },
          ],
        },
      },
      { homeAccountId: "42" },
    );
    expect(rails).toHaveLength(1);
    expect(rails[0]).toMatchObject({
      currency: "USDC",
      network: "base",
      networkLabel: "Base",
      walletAddress: "0x71d323E4af97b1deca2e9Bc7F31F86B1Bce55903",
    });
    expect(rails[0].id).toMatch(/^collect-cctp:/);
    expect(rails[0].chainDisclaimer).toMatch(/Credits your USDC balance/);
    expect(rails[0].chainDisclaimer).not.toMatch(/CCTP/i);
  });

  it("ignores missing collect block", () => {
    expect(buildCollectEvmFundRails({ wallet_address: "G" }, { homeAccountId: "1" })).toEqual([]);
  });

  it("rejects non-hex and overlong EVM addresses", () => {
    const rails = buildCollectEvmFundRails(
      {
        collect: {
          evm_usdc: [
            {
              network: "base",
              address: "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
              asset: "USDC",
            },
            {
              network: "base",
              address: "0x71d323E4af97b1deca2e9Bc7F31F86B1Bce55903ff",
              asset: "USDC",
            },
            {
              network: "base",
              address: "0x71d323E4af97b1deca2e9Bc7F31F86B1Bce55903",
              asset: "USDC",
            },
          ],
        },
      },
      { homeAccountId: "1" },
    );
    expect(rails).toHaveLength(1);
    expect(rails[0].walletAddress).toBe("0x71d323E4af97b1deca2e9Bc7F31F86B1Bce55903");
  });
});

describe("buildCollectFundModalRails", () => {
  it("keeps Collect EVM + Stellar home and blocks native EVM/USDT accounts", () => {
    const rails = buildCollectFundModalRails({
      accounts: [
        {
          id: "base-acct",
          currency: "USDC",
          network: "Base",
          walletAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          status: "ready",
        },
        {
          id: "stellar-home",
          currency: "USDC",
          network: "Stellar",
          walletAddress: "GHOMEADDRESS",
          status: "ready",
        },
        {
          id: "usdt-poly",
          currency: "USDT",
          network: "Polygon",
          walletAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          status: "ready",
        },
      ],
      depositInstructions: {
        collect: {
          evm_usdc: [
            {
              network: "base",
              address: "0x71d323E4af97b1deca2e9Bc7F31F86B1Bce55903",
              asset: "USDC",
            },
          ],
        },
      },
      isFundable: (a) => Boolean(a.walletAddress),
      isStellarUsdc: (a) =>
        a.currency.toUpperCase() === "USDC" && /stellar/i.test(a.network),
    });
    expect(rails.map((r) => r.id)).toEqual([
      "collect-cctp:stellar-home:base:0x71d323e4af97b1deca2e9bc7f31f86b1bce55903",
      "stellar-home",
    ]);
    expect(rails[0].chainDisclaimer).toMatch(/Credits your USDC balance/);
    expect(rails[0].chainDisclaimer).not.toMatch(/CCTP/i);
  });

  it("adds Stellar EURC only when the trustline is open", () => {
    const base = {
      accounts: [
        {
          id: "stellar-home",
          currency: "USDC",
          network: "Stellar",
          walletAddress: "GHOMEADDRESS",
          status: "ready",
        },
      ],
      isFundable: (a: { walletAddress?: string | null }) => Boolean(a.walletAddress),
      isStellarUsdc: (a: { currency: string; network: string }) =>
        a.currency.toUpperCase() === "USDC" && /stellar/i.test(a.network),
    };
    const closed = buildCollectFundModalRails({
      ...base,
      depositInstructions: {
        collect: { stellar_eurc: { trustline_open: false, address: null, asset: "EURC" } },
      },
    });
    expect(closed.map((r) => r.currency)).toEqual(["USDC"]);

    const open = buildCollectFundModalRails({
      ...base,
      depositInstructions: {
        collect: {
          stellar_eurc: {
            trustline_open: true,
            address: "GHOMEADDRESS",
            asset: "EURC",
          },
        },
      },
    });
    expect(open.map((r) => r.currency)).toEqual(["USDC", "EURC"]);
    expect(open[1].chainDisclaimer).toMatch(/Converts to USDC via Aquarius/);
    expect(open[1].walletAddress).toBe("GHOMEADDRESS");
  });
});

describe("fundRailsForAccount", () => {
  const accounts = [
    {
      id: "stellar-home",
      currency: "USDC",
      network: "Stellar",
      walletAddress: "GHOMEADDRESS",
      status: "ready",
    },
    {
      id: "usdt-poly",
      currency: "USDT",
      network: "Polygon",
      walletAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      status: "ready",
    },
  ];
  const depositInstructions = {
    collect: {
      evm_usdc: [
        {
          network: "base",
          address: "0x71d323E4af97b1deca2e9Bc7F31F86B1Bce55903",
          asset: "USDC",
        },
      ],
      stellar_eurc: {
        trustline_open: true,
        address: "GHOMEADDRESS",
        asset: "EURC",
      },
    },
  };
  const shared = {
    accounts,
    depositInstructions,
    isFundable: (a: { walletAddress?: string | null }) => Boolean(a.walletAddress),
    isStellarUsdc: (a: { currency: string; network: string }) =>
      a.currency.toUpperCase() === "USDC" && /stellar/i.test(a.network),
  };

  it("keeps Base USDC, Stellar USDC, and Stellar EURC on the Stellar home", () => {
    const rails = fundRailsForAccount({ ...shared, selected: accounts[0] });
    expect(rails.map((r) => `${r.currency} ${r.networkLabel}`)).toEqual([
      "USDC Base",
      "USDC Stellar",
      "EURC Stellar",
    ]);
  });

  it("offers only the selected chain wallet", () => {
    const rails = fundRailsForAccount({ ...shared, selected: accounts[1] });
    expect(rails).toHaveLength(1);
    expect(rails[0]).toMatchObject({
      id: "usdt-poly",
      currency: "USDT",
      networkLabel: "Polygon",
      walletAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
  });

  it("does not fall back to Stellar rails for a wallet with no address", () => {
    const rails = fundRailsForAccount({
      ...shared,
      selected: { ...accounts[1], walletAddress: null },
    });
    expect(rails).toEqual([]);
  });
});

describe("mergeFundStablecoinRails", () => {
  it("appends collect rails without duplicating addresses", () => {
    const account: FundStablecoinRail[] = [
      {
        id: "1",
        currency: "USDC",
        network: "Stellar",
        networkLabel: "Stellar",
        walletAddress: "GHOME",
        chainDisclaimer: "x",
        checkoutUrl: null,
      },
    ];
    const collect: FundStablecoinRail[] = [
      {
        id: "c",
        currency: "USDC",
        network: "base",
        networkLabel: "Base",
        walletAddress: "0xabc",
        chainDisclaimer: "y",
        checkoutUrl: null,
      },
    ];
    expect(mergeFundStablecoinRails(account, collect)).toHaveLength(2);
  });
});
