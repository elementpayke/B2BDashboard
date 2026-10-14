// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WalletsScreen, { type WalletsScreenProps } from "./WalletsScreen";

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
