// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GetStartedChecklist, { type GetStartedChecklistProps } from "./GetStartedChecklist";

function props(overrides: Partial<GetStartedChecklistProps> = {}): GetStartedChecklistProps {
  return {
    hasAccount: false,
    hasMoneyIn: false,
    hasMoneyOut: false,
    storageKey: "test:get-started",
    onOpenAccount: vi.fn(),
    onAddMoney: vi.fn(),
    onSend: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  window.localStorage.clear();
});

describe("GetStartedChecklist", () => {
  it("lists the three steps to a first payment, with progress", () => {
    render(<GetStartedChecklist {...props()} />);
    const region = screen.getByRole("region", { name: "Get started" });
    expect(within(region).getByText("0 of 3 done")).toBeInTheDocument();
    const items = within(region).getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("h3")?.textContent)).toEqual([
      "Open a currency account",
      "Add money or get paid",
      "Send your first payment",
    ]);
  });

  it("opens the right flow from each step", () => {
    const p = props();
    render(<GetStartedChecklist {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Open account" }));
    fireEvent.click(screen.getByRole("button", { name: "Add money" }));
    fireEvent.click(screen.getByRole("button", { name: "Send money" }));
    expect(p.onOpenAccount).toHaveBeenCalled();
    expect(p.onAddMoney).toHaveBeenCalled();
    expect(p.onSend).toHaveBeenCalled();
  });

  it("ticks off what's done and drops its button", () => {
    render(<GetStartedChecklist {...props({ hasAccount: true, hasMoneyIn: true })} />);
    expect(screen.getByText("2 of 3 done")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open account" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Done")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Send money" })).toBeInTheDocument();
  });

  it("goes away once all three are done", () => {
    const { container } = render(
      <GetStartedChecklist {...props({ hasAccount: true, hasMoneyIn: true, hasMoneyOut: true })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("can be hidden, and stays hidden", () => {
    const { unmount } = render(<GetStartedChecklist {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "Hide get started" }));
    expect(screen.queryByRole("region", { name: "Get started" })).not.toBeInTheDocument();
    unmount();
    render(<GetStartedChecklist {...props()} />);
    expect(screen.queryByRole("region", { name: "Get started" })).not.toBeInTheDocument();
  });
});
