import { describe, expect, it } from "vitest";
import { buildCollectEvmFundRails, mergeFundStablecoinRails } from "./cctpRails";
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
    expect(rails[0].chainDisclaimer).toMatch(/CCTP/);
  });

  it("ignores missing collect block", () => {
    expect(buildCollectEvmFundRails({ wallet_address: "G" }, { homeAccountId: "1" })).toEqual([]);
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
