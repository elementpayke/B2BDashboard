import { describe, expect, it } from "vitest";
import {
  buildCollectEvmFundRails,
  buildCollectFundModalRails,
  findRailForAssetNetwork,
  findUsdcRailForNetwork,
  fundRailsForAccount,
  mergeFundStablecoinRails,
  networkOptionsForAssetFromRails,
  usdcNetworkOptionsFromRails,
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

  it("adds Stellar EURC and USDT only when each trustline is open", () => {
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
        collect: {
          stellar_eurc: { trustline_open: false, address: null, asset: "EURC" },
          stellar_usdt: { trustline_open: false, address: null, asset: "USDT" },
        },
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
            convertible: true,
          },
          stellar_usdt: {
            trustline_open: true,
            address: "GHOMEADDRESS",
            asset: "USDT",
            convertible: true,
          },
        },
      },
    });
    expect(open.map((r) => r.currency)).toEqual(["USDC", "EURC", "USDT"]);
    expect(open[1].chainDisclaimer).toMatch(/Converts to USDC via Aquarius/);
    expect(open[2].chainDisclaimer).toMatch(/Converts to USDC via Aquarius/);
    expect(open[1].walletAddress).toBe("GHOMEADDRESS");
    expect(open[2].walletAddress).toBe("GHOMEADDRESS");

    const gated = buildCollectFundModalRails({
      ...base,
      depositInstructions: {
        collect: {
          stellar_eurc: {
            trustline_open: true,
            address: null,
            asset: "EURC",
            convertible: false,
            convertible_reason: "thin_liquidity",
          },
          stellar_usdt: {
            trustline_open: true,
            address: null,
            asset: "USDT",
            convertible: false,
            convertible_reason: "rate_sanity_failed",
          },
        },
      },
    });
    expect(gated.map((r) => r.currency)).toEqual(["USDC"]);
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
        convertible: true,
      },
      stellar_usdt: {
        trustline_open: true,
        address: "GHOMEADDRESS",
        asset: "USDT",
        convertible: true,
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

  it("keeps Base USDC, Stellar USDC, and Stellar EURC/USDT on the Stellar home", () => {
    const rails = fundRailsForAccount({ ...shared, selected: accounts[0] });
    expect(rails.map((r) => `${r.currency} ${r.networkLabel}`)).toEqual([
      "USDC Base",
      "USDC Stellar",
      "EURC Stellar",
      "USDT Stellar",
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

describe("Top Up's \"which network is this coming from\" picker", () => {
  const rails: FundStablecoinRail[] = [
    {
      id: "collect-cctp:67:base:0x71d3",
      currency: "USDC",
      network: "base",
      networkLabel: "Base",
      walletAddress: "0x71d323E4af97b1deca2e9Bc7F31F86B1Bce55903",
      chainDisclaimer: "x",
      checkoutUrl: null,
    },
    {
      id: "67",
      currency: "USDC",
      network: "stellar_testnet",
      networkLabel: "Stellar",
      walletAddress: "GCNPEB",
      chainDisclaimer: "y",
      checkoutUrl: null,
    },
    {
      id: "67:eurc",
      currency: "EURC",
      network: "stellar_testnet",
      networkLabel: "Stellar",
      walletAddress: "GCNPEB",
      chainDisclaimer: "z",
      checkoutUrl: null,
    },
  ];

  it("lists only USDC rails as network options, keyed like the UI picker", () => {
    expect(usdcNetworkOptionsFromRails(rails)).toEqual([
      { key: "base", label: "Base" },
      { key: "stellar", label: "Stellar" },
    ]);
  });

  it("finds the real deposit address for a chosen bridge network", () => {
    const match = findUsdcRailForNetwork(rails, "base");
    expect(match?.walletAddress).toBe("0x71d323E4af97b1deca2e9Bc7F31F86B1Bce55903");
  });

  it("normalizes a raw Stellar network spelling (stellar_testnet) to the UI's plain 'stellar' key", () => {
    const match = findUsdcRailForNetwork(rails, "stellar");
    expect(match?.walletAddress).toBe("GCNPEB");
  });

  it("never matches a non-USDC rail even on the same network", () => {
    const match = findUsdcRailForNetwork(rails, "stellar");
    expect(match?.currency).toBe("USDC");
  });

  it("returns undefined for a network with no rail", () => {
    expect(findUsdcRailForNetwork(rails, "arbitrum")).toBeUndefined();
  });

  it("lists Stellar-only networks for EURC / Aquarius USDT rails", () => {
    expect(networkOptionsForAssetFromRails(rails, "EURC")).toEqual([
      { key: "stellar", label: "Stellar" },
    ]);
    expect(networkOptionsForAssetFromRails(rails, "usdt")).toEqual([]);
  });

  it("matches Aquarius EURC on the Stellar home address", () => {
    const match = findRailForAssetNetwork(rails, "EURC", "stellar");
    expect(match?.walletAddress).toBe("GCNPEB");
    expect(match?.currency).toBe("EURC");
  });
});

describe("Top Up Aquarius USDT rail match", () => {
  const rails: FundStablecoinRail[] = [
    {
      id: "67:usdt",
      currency: "USDT",
      network: "stellar_testnet",
      networkLabel: "Stellar",
      walletAddress: "GCNPEB",
      chainDisclaimer: "Deposit USDT on Stellar. Converts to USDC via Aquarius.",
      checkoutUrl: null,
    },
  ];

  it("exposes Stellar for Collect USDT and resolves the G-address", () => {
    expect(networkOptionsForAssetFromRails(rails, "USDT")).toEqual([
      { key: "stellar", label: "Stellar" },
    ]);
    expect(findRailForAssetNetwork(rails, "usdt", "stellar")?.walletAddress).toBe("GCNPEB");
  });
});
