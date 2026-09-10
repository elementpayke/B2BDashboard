// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
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

describe("CardDetailModal freeze UX", () => {
  it("shows Frozen on the face and offers Unfreeze", () => {
    render(
      <CardDetailModal
        card={baseCard}
        cardholderName="Element Pay"
        accountLabel="Ops"
        billing={null}
        recent={[]}
        secrets={null}
        secretsBusy={false}
        secretsError=""
        freezeBusy={false}
        freezeError=""
        copiedField=""
        onCopy={() => () => {}}
        onToggleReveal={vi.fn()}
        onToggleFreeze={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Frozen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unfreeze card" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("surfaces freeze errors", () => {
    render(
      <CardDetailModal
        card={{ ...baseCard, status: "active" }}
        cardholderName="Element Pay"
        accountLabel="Ops"
        billing={null}
        recent={[]}
        secrets={null}
        secretsBusy={false}
        secretsError=""
        freezeBusy={false}
        freezeError="Partner rejected freeze"
        copiedField=""
        onCopy={() => () => {}}
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
});
