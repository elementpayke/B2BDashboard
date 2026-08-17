// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TransactionsScreen from "./TransactionsScreen";

const baseProps = {
  txFilters: [
    { key: "all", label: "All", select: vi.fn(), active: true },
    { key: "incoming", label: "Incoming", select: vi.fn(), active: false },
  ],
  filteredTransactions: [],
  emptyLabel: "No transactions match this filter",
  pageNumber: 1,
  pageCount: 1,
  total: 0,
  hasNext: false,
  hasPrev: false,
  onNextPage: vi.fn(),
  onPrevPage: vi.fn(),
  search: "",
  onSearchChange: vi.fn(),
  currency: "all",
  currencyOptions: ["KES", "USD"],
  onCurrencyChange: vi.fn(),
  dateRange: "all" as const,
  onDateRangeChange: vi.fn(),
};

describe("TransactionsScreen", () => {
  it("opens compact advanced filters as a dismissible dialog", () => {
    render(<TransactionsScreen {...baseProps} />);

    const trigger = screen.getByRole("button", { name: "Filters" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Filter activity" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Currency" })).toBeInTheDocument();
    const close = within(dialog).getByRole("button", { name: "Close filters" });
    const date = within(dialog).getByRole("combobox", { name: "Date" });
    expect(close).toHaveFocus();

    date.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Filter activity" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("discloses the latest-50 scope when local filters are active", () => {
    render(<TransactionsScreen {...baseProps} usesLatestFifty />);

    expect(screen.getByRole("note")).toHaveTextContent(
      "Showing matches in the latest 50 transactions",
    );
    expect(screen.queryByRole("navigation", { name: "Transaction pages" })).not.toBeInTheDocument();
  });
});
