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

describe("WalletsScreen — currency account cards", () => {
  const account = {
    name: "US Dollar",
    currency: "USD",
    rail: "IBAN · SWIFT",
    balance: "1,250.40",
    detail: "GB33 BUKB ·· 5555",
    flagUrl: null,
    openDetail: vi.fn(),
  };

  it("offers New account once — from the header menu, not a second card in the list", () => {
    render(
      <WalletsScreen
        {...baseProps({ addAccountMenu: false, accounts: [account] as never, accountsCount: 1 })}
      />,
    );
    expect(screen.getAllByText(/New account/)).toHaveLength(1);
    const list = screen.getByLabelText("Currency accounts");
    expect(list.querySelector(".ep-wallets__new-card")).toBeNull();
  });

  it("opens an account's detail when its card is tapped", () => {
    const openDetail = vi.fn();
    render(
      <WalletsScreen
        {...baseProps({
          addAccountMenu: false,
          accounts: [{ ...account, openDetail }] as never,
          accountsCount: 1,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /US Dollar account/ }));
    expect(openDetail).toHaveBeenCalledTimes(1);
  });
});

describe("WalletsScreen — accounts run in one horizontal row", () => {
  const accounts = ["EUR", "GBP", "NGN", "GHS", "UGX", "TZS"].map((currency) => ({
    name: currency,
    currency,
    rail: "Bank transfer",
    balance: "0.00",
    detail: "Coordinates pending",
    flagUrl: null,
    openDetail: vi.fn(),
  }));

  function overflowing(el: HTMLElement, scrollLeft: number) {
    Object.defineProperty(el, "scrollWidth", { configurable: true, value: 1700 });
    Object.defineProperty(el, "clientWidth", { configurable: true, value: 1100 });
    Object.defineProperty(el, "scrollLeft", { configurable: true, value: scrollLeft, writable: true });
  }

  it("puts every account card in the one scrollable strip", () => {
    render(
      <WalletsScreen
        {...baseProps({ addAccountMenu: false, accounts: accounts as never, accountsCount: 6 })}
      />,
    );
    const strip = screen.getByLabelText("Currency accounts");
    expect(strip).toHaveClass("ep-wallets__strip");
    expect(strip.querySelectorAll(".ep-wallets__card")).toHaveLength(6);
  });

  it("shows the arrows only toward the side that has more, and pages sideways", () => {
    render(
      <WalletsScreen
        {...baseProps({ addAccountMenu: false, accounts: accounts as never, accountsCount: 6 })}
      />,
    );
    const strip = screen.getByLabelText("Currency accounts");
    const scrollBy = vi.fn();
    strip.scrollBy = scrollBy as never;

    overflowing(strip, 0);
    fireEvent.scroll(strip);
    const next = document.querySelector(".ep-wallets__strip-nav--next")!;
    const prev = document.querySelector(".ep-wallets__strip-nav--prev")!;
    expect(next).toHaveAttribute("aria-label", "More accounts");
    expect(prev).toHaveAttribute("aria-label", "Previous accounts");
    expect(next).not.toHaveAttribute("hidden");
    expect(prev).toHaveAttribute("hidden");

    fireEvent.click(next);
    expect(scrollBy).toHaveBeenCalledWith({ left: 1100 * 0.85, behavior: "smooth" });

    overflowing(strip, 600);
    fireEvent.scroll(strip);
    expect(next).toHaveAttribute("hidden");
    expect(prev).not.toHaveAttribute("hidden");
    fireEvent.click(prev);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -1100 * 0.85, behavior: "smooth" });
  });

  it("hides both arrows when everything fits", () => {
    render(
      <WalletsScreen
        {...baseProps({ addAccountMenu: false, accounts: accounts.slice(0, 2) as never, accountsCount: 2 })}
      />,
    );
    expect(document.querySelector(".ep-wallets__strip-nav--next")).toHaveAttribute("hidden");
    expect(document.querySelector(".ep-wallets__strip-nav--prev")).toHaveAttribute("hidden");
  });
});
