// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AccountDetailScreen from "./AccountDetailScreen";

const baseProps = {
  name: "USDC · Stellar",
  currency: "USDC",
  flagUrl: null,
  railLabel: "Stablecoin · Stellar",
  statusLabel: "Active",
  statusColor: "var(--indigo-text)",
  statusSoft: "var(--indigo-tint)",
  balance: "—",
  balanceSub: "Balance not yet available",
  summaryLines: [],
  recent: [],
  onBack: vi.fn(),
  onOpenDetails: vi.fn(),
  onFund: vi.fn(),
  onSend: vi.fn(),
  onViewAllTx: vi.fn(),
};

describe("AccountDetailScreen close account", () => {
  it("opens the close-account chooser from the dotted menu", () => {
    const onCloseAccount = vi.fn();
    render(
      <AccountDetailScreen
        {...baseProps}
        canClose
        onCloseAccount={onCloseAccount}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More account actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Close account/i }));
    expect(onCloseAccount).toHaveBeenCalledTimes(1);
  });

  it("disables Fund and Send when the wallet is closed", () => {
    render(
      <AccountDetailScreen
        {...baseProps}
        statusLabel="Closed"
        canFund={false}
        canSend={false}
        canClose
        onCloseAccount={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Fund/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Send/ })).toBeDisabled();
  });
});

describe("AccountDetailScreen actions", () => {
  it("shows one action per job in the main row, primary Send first", () => {
    render(
      <AccountDetailScreen
        {...baseProps}
        canConvert
        onConvert={vi.fn()}
        onMove={vi.fn()}
        onPayout={vi.fn()}
      />,
    );
    const row = screen.getByRole("group", { name: "Account actions" });
    const labels = Array.from(row.querySelectorAll(":scope > button, :scope > div > button")).map(
      (b) => b.getAttribute("aria-label") || b.textContent?.trim(),
    );
    expect(labels).toEqual(["Send", "Fund", "Convert", "Details", "More account actions"]);
    // Move and Payout overlap with Send, so they are not repeated in the row.
    expect(screen.queryByRole("button", { name: "Move" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Payout" })).not.toBeInTheDocument();
  });

  it("offers Move and Bank payout from the More menu and closes it on pick", () => {
    const onMove = vi.fn();
    const onPayout = vi.fn();
    render(<AccountDetailScreen {...baseProps} onMove={onMove} onPayout={onPayout} />);

    fireEvent.click(screen.getByRole("button", { name: "More account actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Move between accounts/ }));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "More account actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Bank payout/ }));
    expect(onPayout).toHaveBeenCalledTimes(1);
  });

  it("leaves Move and Bank payout out of the menu when not offered (stablecoin)", () => {
    render(<AccountDetailScreen {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "More account actions" }));
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    expect(screen.getByRole("menuitem", { name: /Close account/ })).toBeInTheDocument();
  });

  it("hides Convert when the account can't convert", () => {
    render(<AccountDetailScreen {...baseProps} onConvert={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Convert" })).not.toBeInTheDocument();
  });
});
