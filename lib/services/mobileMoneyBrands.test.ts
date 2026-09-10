import { describe, expect, it } from "vitest";
import {
  isMobileMoneyRail,
  mobileMoneyDisplayLabel,
  resolveMobileMoneyBrand,
} from "@/lib/services/mobileMoneyBrands";

describe("resolveMobileMoneyBrand", () => {
  it("maps catalog M-Pesa spellings", () => {
    expect(resolveMobileMoneyBrand("Mobile Wallet (M-PESA)")?.key).toBe("mpesa");
    expect(resolveMobileMoneyBrand("M PESA")?.label).toBe("M-Pesa");
    expect(resolveMobileMoneyBrand("M-Pesa (Safaricom)")?.logoSrc).toContain("mpesa");
  });

  it("maps Airtel and MTN", () => {
    expect(resolveMobileMoneyBrand("Airtel Money")?.key).toBe("airtel");
    expect(resolveMobileMoneyBrand("MTN MoMo")?.key).toBe("mtn");
  });

  it("maps compact catalog codes without separators", () => {
    expect(resolveMobileMoneyBrand("AIRTELMONEYTZ")?.key).toBe("airtel");
    expect(resolveMobileMoneyBrand("AIRTELMONEYTZ")?.label).toBe("Airtel Money");
    expect(resolveMobileMoneyBrand("MPESATZ")?.key).toBe("mpesa");
    expect(resolveMobileMoneyBrand("MTNMOMOUG")?.key).toBe("mtn");
  });

  it("returns null for bank institution names", () => {
    expect(resolveMobileMoneyBrand("NATIONAL BANK OF KENYA")).toBeNull();
    expect(resolveMobileMoneyBrand("Equity Bank")).toBeNull();
    expect(resolveMobileMoneyBrand("Money Market Bank")).toBeNull();
  });
});

describe("mobileMoneyDisplayLabel", () => {
  it("shortens M-Pesa catalog names", () => {
    expect(mobileMoneyDisplayLabel("Mobile Wallet (M-PESA)")).toBe("M-Pesa");
  });

  it("humanizes compact Airtel codes", () => {
    expect(mobileMoneyDisplayLabel("AIRTELMONEYTZ")).toBe("Airtel Money");
  });
});

describe("isMobileMoneyRail", () => {
  it("recognizes mobile rails", () => {
    expect(isMobileMoneyRail("mobile")).toBe(true);
    expect(isMobileMoneyRail("momo")).toBe(true);
    expect(isMobileMoneyRail("bank")).toBe(false);
  });
});
