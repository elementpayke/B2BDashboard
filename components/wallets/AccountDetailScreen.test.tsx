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
