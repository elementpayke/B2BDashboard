// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CardDetailModal, { billingAddressFromKyb } from "./CardDetailModal";
import type { IssuedCard } from "@/lib/services/cards";
import { cardColor } from "@/lib/services/cardColors";

describe("billingAddressFromKyb", () => {
  it("returns null without street/city", () => {
    expect(billingAddressFromKyb(null)).toBeNull();
    expect(
      billingAddressFromKyb({
        street: "",
        city: "Miami",
        post_code: "33179",
        country: "US",
      }),
    ).toBeNull();
  });

  it("formats registered address for display and copy", () => {
    expect(
      billingAddressFromKyb({
        street: "390 NE 191ST ST",
        street2: "STE 8972",
        city: "MIAMI",
        state: "FL",
        post_code: "33179",
        country: "US",
      }),
    ).toEqual({
      line1: "390 NE 191ST ST, STE 8972",
      line2: "MIAMI, FL, 33179 · US",
      copyText: "390 NE 191ST ST\nSTE 8972\nMIAMI, FL, 33179\nUS",
    });
  });
});

const baseCard: IssuedCard = {
  id: "4",
  account_id: "acct_1",
  entity_id: "pcus_1",
  type: "virtual",
  status: "frozen",
  currency: "USD",
  card_name: "Ops",
  last_four: "4242",
};

const baseProps = {
  cardholderName: "Element Pay",
  accountLabel: "Ops",
  balance: "$1,240.00",
  billing: null as null,
  recent: [] as [],
  secrets: null as null,
  secretsBusy: false,
  secretsError: "",
  freezeBusy: false,
  freezeError: "",
  copiedField: "",
  onCopy: () => () => {},
  onToggleReveal: vi.fn(),
  onToggleFreeze: vi.fn(),
};

describe("CardDetailModal freeze UX", () => {
  it("shows Frozen on the face and offers Unfreeze", () => {
    render(
      <CardDetailModal
        {...baseProps}
        card={baseCard}
        onToggleReveal={vi.fn()}
        onToggleFreeze={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Frozen").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Unfreeze card" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("surfaces freeze errors", () => {
    render(
      <CardDetailModal
        {...baseProps}
        card={{ ...baseCard, status: "active" }}
        freezeError="Partner rejected freeze"
        onToggleReveal={vi.fn()}
        onToggleFreeze={vi.fn()}
      />,
    );
    expect(screen.getByText("Partner rejected freeze")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Freeze card" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("flips on click and requests reveal", () => {
    const onToggleReveal = vi.fn();
    render(
      <CardDetailModal
        {...baseProps}
        card={{ ...baseCard, status: "active" }}
        onToggleReveal={onToggleReveal}
        onToggleFreeze={vi.fn()}
      />,
    );
    // The card face itself (first) and the eye button share the same action.
    fireEvent.click(screen.getAllByRole("button", { name: "Show card details" })[0]);
    expect(onToggleReveal).toHaveBeenCalledTimes(1);
    for (const button of screen.getAllByRole("button", { name: "Hide card details" })) {
      expect(button).toHaveAttribute("aria-pressed", "true");
    }
  });

  it("has a single close control — the modal header owns it", () => {
    render(<CardDetailModal {...baseProps} card={{ ...baseCard, status: "active" }} />);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});

describe("CardDetailModal colour picker", () => {
  it("offers all twelve palette colours with the current one checked", () => {
    render(
      <CardDetailModal
        {...baseProps}
        card={{ ...baseCard, status: "active" }}
        color={cardColor("mint")}
        onColorChange={vi.fn()}
      />,
    );
    const swatches = screen.getAllByRole("radio");
    expect(swatches).toHaveLength(12);
    expect(screen.getByRole("radio", { name: "Mint" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Coral" })).toHaveAttribute("aria-checked", "false");
  });

  it("reports a new pick and ignores re-picking the current colour", () => {
    const onColorChange = vi.fn();
    render(
      <CardDetailModal
        {...baseProps}
        card={{ ...baseCard, status: "active" }}
        color={cardColor("mint")}
        onColorChange={onColorChange}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Mint" }));
    expect(onColorChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "Plum" }));
    expect(onColorChange).toHaveBeenCalledWith("plum");
  });

  it("shows a save error and disables swatches while saving", () => {
    const { container } = render(
      <CardDetailModal
        {...baseProps}
        card={{ ...baseCard, status: "active" }}
        onColorChange={vi.fn()}
        colorBusy
        colorError="Couldn't save this colour. Try again."
      />,
    );
    expect(container.querySelector("fieldset.ep-card-colors")).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save this colour");
  });

  it("hides the picker when no change handler is wired", () => {
    render(<CardDetailModal {...baseProps} card={{ ...baseCard, status: "active" }} />);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });
});
