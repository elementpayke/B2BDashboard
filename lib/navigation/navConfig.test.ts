import { describe, expect, it } from "vitest";
import {
  DASHBOARD_NAV_ITEMS,
  isMoreNavigationActive,
  isNavigationItemActive,
  MOBILE_MORE_NAV_ITEMS,
  MOBILE_PRIMARY_NAV_ITEMS,
} from "./navConfig";

describe("dashboard navigation contract", () => {
  it("keeps the mobile bar focused on four primary money destinations", () => {
    expect(MOBILE_PRIMARY_NAV_ITEMS.map((item) => item.label)).toEqual([
      "Home",
      "Accounts",
      "Transactions",
      "Invoices",
    ]);
    expect(MOBILE_PRIMARY_NAV_ITEMS.some((item) => item.key === "cards")).toBe(false);
  });

  it("moves secondary workspace destinations into More", () => {
    expect(MOBILE_MORE_NAV_ITEMS.map((item) => item.key)).toEqual(
      expect.arrayContaining(["reports", "cards", "verification", "team", "developer"]),
    );
  });

  it("marks account detail as part of Accounts", () => {
    expect(isNavigationItemActive("wallets", "accountDetail")).toBe(true);
  });

  it("keeps More selected on secondary destinations after the sheet closes", () => {
    expect(isMoreNavigationActive("cards", false)).toBe(true);
    expect(isMoreNavigationActive("home", false)).toBe(false);
    expect(isMoreNavigationActive("home", true)).toBe(true);
  });

  it("assigns every destination to one desktop group", () => {
    expect(new Set(DASHBOARD_NAV_ITEMS.map((item) => item.key)).size).toBe(
      DASHBOARD_NAV_ITEMS.length,
    );
    expect(DASHBOARD_NAV_ITEMS.every((item) => Boolean(item.group))).toBe(true);
  });
});
