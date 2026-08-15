// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MobileBottomNav from "./MobileBottomNav";
import MoreSheet from "./MoreSheet";

describe("compact navigation", () => {
  it("renders four primary destinations plus More", () => {
    render(
      <MobileBottomNav
        screen="transactions"
        moreOpen={false}
        onNavigate={vi.fn()}
        onOpenMore={vi.fn()}
      />,
    );

    expect(
      screen.getAllByRole("button").map((button) => button.textContent?.trim()),
    ).toEqual(["⌂Home", "▦Accounts", "≣Transactions", "▤Invoices", "⋯More"]);
    expect(screen.queryByRole("button", { name: /cards/i })).not.toBeInTheDocument();
  });

  it("keeps secondary destinations in More without embedding live rates", () => {
    render(
      <MoreSheet
        open
        screen="home"
        businessName="Acme Imports"
        role="Owner"
        themeIcon="☾"
        onClose={vi.fn()}
        onNavigate={vi.fn()}
        onOpenBulk={vi.fn()}
        onOpenTopUp={vi.fn()}
        onToggleTheme={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "More" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cards/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bulk payouts/i })).toBeInTheDocument();
    expect(screen.queryByText(/live rates/i)).not.toBeInTheDocument();
  });

  it("marks More as the current destination on secondary screens", () => {
    render(
      <MobileBottomNav
        screen="cards"
        moreOpen={false}
        onNavigate={vi.fn()}
        onOpenMore={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /more/i })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("button", { name: /home/i })).toHaveAttribute("data-active", "false");
  });
});
