import { describe, expect, it } from "vitest";
import {
  OFFRAMP_ASSET,
  preferCountryOfframpWallet,
} from "@/lib/services/offrampAsset";

describe("preferCountryOfframpWallet", () => {
  const baseUsdc = { id: "19", currency: "USDC", network: "Base" };
  const polyUsdt = { id: "23", currency: "USDT", network: "Polygon" };
  const polyUsdc = { id: "22", currency: "USDC", network: "Polygon" };

  it("prefers Polygon USDT over Base USDC when nothing is selected", () => {
    expect(preferCountryOfframpWallet([baseUsdc, polyUsdt, polyUsdc])?.id).toBe("23");
  });

  it("keeps an explicit selection", () => {
    expect(
      preferCountryOfframpWallet([baseUsdc, polyUsdt], "19")?.id,
    ).toBe("19");
  });

  it("falls back to any USDT then first wallet", () => {
    expect(
      preferCountryOfframpWallet([{ id: "1", currency: "USDT", network: "Base" }, baseUsdc])
        ?.id,
    ).toBe("1");
    expect(preferCountryOfframpWallet([baseUsdc])?.id).toBe("19");
  });

  it("exports the locked OffRamp asset", () => {
    expect(OFFRAMP_ASSET.currency).toBe("USDT");
    expect(OFFRAMP_ASSET.network).toBe("Polygon");
  });
});
