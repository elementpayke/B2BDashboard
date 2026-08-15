// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActivityList, { type ActivityItem } from "./ActivityList";

const item: ActivityItem = {
  id: 1,
  client: "Acme Payments",
  type: "Deposit",
  amount: "+128,040.00 KES",
  statusLabel: "Settled",
  statusIcon: "✓",
  statusColor: "var(--success)",
  statusSoft: "var(--success-tint)",
  dateLabel: "Today, 14:32",
  meta: "Today, 14:32 · Ref invoice-17",
  openDetail: vi.fn(),
};

describe("ActivityList", () => {
  it("gives each transaction a human-readable accessible name", () => {
    render(
      <ActivityList
        title="Transactions"
        items={[item]}
        columns="transactions"
        showHeader={false}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Acme Payments, Deposit, +128,040.00 KES, Settled",
      }),
    ).toBeInTheDocument();
  });

  it("renders the five-column transaction contract", () => {
    const { container } = render(
      <ActivityList
        title="Transactions"
        items={[item]}
        columns="transactions"
        showHeader={false}
      />,
    );

    expect(container.querySelector(".ep-activity__table-head")?.textContent).toContain(
      "PaymentTypeAmountStatusDate",
    );
    expect(screen.getAllByText("Today, 14:32").length).toBeGreaterThan(0);
  });
});
