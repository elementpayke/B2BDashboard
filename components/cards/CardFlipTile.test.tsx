// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CardFlipTile from "./CardFlipTile";

const baseProps = {
  cardId: "card_1",
  label: "Marketing Ads",
  bg: "linear-gradient(135deg,#1B1733,#3B2ED3)",
  status: "active",
  statusLabel: "Active",
  balance: "$1,240.00",
  last4: "4471",
  expiry: "09/29",
  brand: "mastercard" as const,
  cardholderLabel: "MBOKA BUSINESS LTD",
  flipped: false,
  onFlip: vi.fn(),
  secrets: null as null | { number: string; cvv: string },
  secretsBusy: false,
  secretsError: "",
  copiedField: "",
  onCopy: () => () => {},
};

describe("CardFlipTile", () => {
  it("renders the front face with label, status, and balance", () => {
    render(<CardFlipTile {...baseProps} />);
    expect(screen.getByText("Marketing Ads")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("$1,240.00")).toBeInTheDocument();
  });

  it("flips on click and reflects state via aria-pressed / aria-hidden", () => {
    const onFlip = vi.fn();
    const { container, rerender } = render(
      <CardFlipTile {...baseProps} onFlip={onFlip} />,
    );
    const flipButton = screen.getByRole("button", { name: "Show card details" });
    fireEvent.click(flipButton);
    expect(onFlip).toHaveBeenCalledTimes(1);

    const backFaceHidden = container.querySelector(".ep-card-flip__face--back");
    expect(backFaceHidden).toHaveAttribute("aria-hidden", "true");
    expect(backFaceHidden).toHaveAttribute("inert");

    rerender(<CardFlipTile {...baseProps} onFlip={onFlip} flipped />);
    expect(
      screen.getByRole("button", { name: "Hide card details" }),
    ).toHaveAttribute("aria-pressed", "true");
    const backFaceShown = container.querySelector(".ep-card-flip__face--back");
    expect(backFaceShown).toHaveAttribute("aria-hidden", "false");
    expect(backFaceShown).not.toHaveAttribute("inert");
  });

  it("shows a masked PAN before reveal, and 'Loading…' while fetching", () => {
    render(<CardFlipTile {...baseProps} flipped secretsBusy />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows formatted PAN/expiry/CVV as independently copyable once revealed", () => {
    const onCopy = vi.fn(() => vi.fn());
    render(
      <CardFlipTile
        {...baseProps}
        flipped
        secrets={{ number: "5412753490214471", cvv: "318" }}
        onCopy={onCopy}
      />,
    );
    expect(screen.getByText("5412 7534 9021 4471")).toBeInTheDocument();
    expect(screen.getByText("09/29")).toBeInTheDocument();
    expect(screen.getByText("318")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy Card number" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy Expiry" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy CVV" }));

    expect(onCopy).toHaveBeenCalledWith("card:card_1:num", "5412753490214471");
    expect(onCopy).toHaveBeenCalledWith("card:card_1:exp", "09/29");
    expect(onCopy).toHaveBeenCalledWith("card:card_1:cvv", "318");
  });

  it("only marks the copied field as copied, not the others (regression guard)", () => {
    render(
      <CardFlipTile
        {...baseProps}
        flipped
        secrets={{ number: "5412753490214471", cvv: "318" }}
        copiedField="card:card_1:cvv"
      />,
    );
    expect(screen.getByRole("button", { name: "CVV copied" })).toHaveAttribute(
      "data-copied",
      "true",
    );
    expect(screen.getByRole("button", { name: "Copy Expiry" })).toHaveAttribute(
      "data-copied",
      "false",
    );
    expect(screen.getByRole("button", { name: "Copy Card number" })).toHaveAttribute(
      "data-copied",
      "false",
    );
  });

  it("copy clicks stop propagation so they don't also flip the card", () => {
    const onFlip = vi.fn();
    render(
      <CardFlipTile
        {...baseProps}
        flipped
        onFlip={onFlip}
        secrets={{ number: "5412753490214471", cvv: "318" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy CVV" }));
    expect(onFlip).not.toHaveBeenCalled();
  });

  it("disables the front face and shows the disabled reason when actionDisabled", () => {
    render(
      <CardFlipTile
        {...baseProps}
        actionDisabled
        actionDisabledReason="This card is closed."
      />,
    );
    const flipButton = screen.getByRole("button", { name: "Show card details" });
    expect(flipButton).toBeDisabled();
    expect(flipButton).toHaveAttribute("title", "This card is closed.");
  });

  it("surfaces a reveal error", () => {
    render(<CardFlipTile {...baseProps} flipped secretsError="Couldn't load card details." />);
    expect(screen.getByText("Couldn't load card details.")).toBeInTheDocument();
  });
});
