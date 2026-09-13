// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CardDetailModal, { billingAddressFromKyb } from "./CardDetailModal";
import type { IssuedCard } from "@/lib/services/cards";

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
  onClose: vi.fn(),
};

describe("CardDetailModal freeze UX", () => {
  it("shows Frozen on the face and offers Unfreeze", () => {
    render(
      <CardDetailModal
        {...baseProps}
        card={baseCard}
        onToggleReveal={vi.fn()}
        onToggleFreeze={vi.fn()}
        onClose={vi.fn()}
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
        onClose={vi.fn()}
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
        onClose={vi.fn()}
      />,
    );
    const flip = screen.getByRole("button", {
      name: "Show card number — flip to back",
    });
    fireEvent.click(flip);
    expect(onToggleReveal).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Hide card number — flip to front" }),
    ).toHaveAttribute("data-flipped", "true");
  });
});
