// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WalletsScreen, { type WalletsScreenProps } from "./WalletsScreen";
import {
  occupiedFiatCurrencyCodes,
  supportedCurrenciesFromEligibility,
} from "@/lib/services/depositAccounts";

function baseProps(overrides: Partial<WalletsScreenProps> = {}): WalletsScreenProps {
  return {
    isMobile: false,
    mainWalletBalance: "20.82 USDC",
    mainWalletSub: "",
    stableTabs: [],
    accountsCount: 0,
    addAccountMenu: true,
    toggleAddAccountMenu: vi.fn(),
    closeAddAccountMenu: vi.fn(),
    openCreateAccount: vi.fn(() => vi.fn()),
    accounts: [],
    eligible: true,
    eligibilityLoading: false,
    accountsLoading: false,
    walletsRecent: [],
    goTransactions: vi.fn(),
    ...overrides,
  };
}

describe("WalletsScreen — Bank account gating with a backend-declared extra currency", () => {
  it("stays enabled when USD+GBP are both occupied but EUR remains available — reproduces the 2026-10-13 live bug", () => {
    // Backend's eligibility only ever declares GBP as an "extra" rail
    // (supported_rails.py lists GBP alone, additive to the USD/EUR the
    // dashboard hardcodes). A naive "replace" read of supported_accounts
    // would silently drop EUR from the known-supported list the moment GBP
    // ships; a naive occupied.size < supported.length comparison would then
    // also wrongly read "2 occupied >= 1 supported" as fully blocked — even
    // though EUR, the actually-still-open currency, was never touched.
    const supportedFiatCurrencies = supportedCurrenciesFromEligibility({
      eligible: true,
      verification_status: "approved",
      supported_accounts: [
        { currency: "GBP", rail_type: "uk_local_bank", fields: ["account_number", "sort_code"] },
      ],
    });
    const occupied = occupiedFiatCurrencyCodes([
      { currency: "USD" },
      { currency: "GBP" },
    ]);
    const canCreateBank = supportedFiatCurrencies.some((code) => !occupied.has(code));

    expect(supportedFiatCurrencies).toEqual(["USD", "EUR", "GBP"]);
    expect(canCreateBank).toBe(true);

    render(<WalletsScreen {...baseProps({ canCreateBank })} />);

    const bankItem = screen.getByRole("menuitem", { name: /bank account/i });
    expect(bankItem).not.toBeDisabled();
    expect(screen.getByText("Fiat rails · IBAN / local deposit")).toBeInTheDocument();
  });

  it("disables Bank account only once every backend-declared currency is actually occupied", () => {
    const supportedFiatCurrencies = supportedCurrenciesFromEligibility({
      eligible: true,
      verification_status: "approved",
      supported_accounts: [
        { currency: "GBP", rail_type: "uk_local_bank", fields: ["account_number", "sort_code"] },
      ],
    });
    const occupied = occupiedFiatCurrencyCodes([
      { currency: "USD" },
      { currency: "EUR" },
      { currency: "GBP" },
      { currency: "NOK" },
    ]);
    const canCreateBank = supportedFiatCurrencies.some((code) => !occupied.has(code));

    expect(canCreateBank).toBe(false);

    render(<WalletsScreen {...baseProps({ canCreateBank })} />);

    const bankItem = screen.getByRole("menuitem", { name: /bank account/i });
    expect(bankItem).toBeDisabled();
    expect(screen.getByText("All available currencies already open")).toBeInTheDocument();
  });

  it("opens the create-account flow when Bank account is clicked and enabled", () => {
    const openCreateAccount = vi.fn(() => vi.fn());
    render(<WalletsScreen {...baseProps({ canCreateBank: true, openCreateAccount })} />);
    fireEvent.click(screen.getByRole("menuitem", { name: /bank account/i }));
    expect(openCreateAccount).toHaveBeenCalledWith("bank");
  });
});
