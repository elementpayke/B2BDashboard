// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CardFlipTile, { CardPreview, shortExpiry } from "./CardFlipTile";
import { cardColor } from "@/lib/services/cardColors";

const baseProps = {
  cardId: "card_1",
  label: "Marketing Ads",
  status: "active",
  statusLabel: "Active",
  last4: "4471",
  expiry: "09/29",
  flipped: false,
  onFlip: vi.fn(),
  secrets: null as null | { number: string; cvv: string },
  secretsBusy: false,
  secretsError: "",
  copiedField: "",
  onCopy: () => () => {},
};

const revealed = { number: "5412 7534 9021 4471", cvv: "318" };

describe("CardFlipTile", () => {
  it("renders the spec front face: Mboka mark, card name and masked last four", () => {
    render(<CardFlipTile {...baseProps} />);
    expect(screen.getByText("MBOKA")).toBeInTheDocument();
    expect(screen.getByText("Marketing Ads")).toBeInTheDocument();
    expect(screen.getByText("•••• 4471")).toBeInTheDocument();
    // Removed on purpose by the spec.
    expect(screen.queryByText(/virtual/i)).not.toBeInTheDocument();
  });

  it("paints both faces with the card's palette bg and ink", () => {
    const { container } = render(<CardFlipTile {...baseProps} color={cardColor("marigold")} />);
    const faces = container.querySelectorAll<HTMLElement>(".ep-card-flip__face");
    expect(faces).toHaveLength(2);
    for (const face of faces) {
      expect(face.style.background).toMatch(/255, 178, 36|#ffb224/i);
      expect(face.style.color).toMatch(/19, 17, 38|#131126/i);
    }
  });

  it("flips on click and reflects state via aria-pressed / aria-hidden", () => {
    const onFlip = vi.fn();
    const { container, rerender } = render(<CardFlipTile {...baseProps} onFlip={onFlip} />);
    fireEvent.click(screen.getByRole("button", { name: "Show card details" }));
    expect(onFlip).toHaveBeenCalledTimes(1);

    const back = () => container.querySelector(".ep-card-flip__face--back");
    expect(back()).toHaveAttribute("aria-hidden", "true");
    expect(back()).toHaveAttribute("inert");

    rerender(<CardFlipTile {...baseProps} onFlip={onFlip} flipped />);
    expect(screen.getByRole("button", { name: "Hide card details" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(back()).toHaveAttribute("aria-hidden", "false");
    expect(back()).not.toHaveAttribute("inert");
  });

  it("tapping the revealed back face flips the card home", () => {
    const onFlip = vi.fn();
    const { container } = render(
      <CardFlipTile {...baseProps} flipped onFlip={onFlip} secrets={revealed} />,
    );
    fireEvent.click(container.querySelector(".ep-card-flip__face--back")!);
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it("shows 'Loading…' in the number slot while credentials are fetched", () => {
    render(<CardFlipTile {...baseProps} flipped secretsBusy />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    // Nothing is copyable until the real values arrive.
    expect(screen.queryByRole("button", { name: /^Copy / })).not.toBeInTheDocument();
  });

  it("each revealed value is a copy button that strips spaces", () => {
    const onCopy = vi.fn(() => vi.fn());
    render(<CardFlipTile {...baseProps} flipped secrets={revealed} onCopy={onCopy} />);
    expect(screen.getByText("5412 7534 9021 4471")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy card number" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy expiry" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy CVV" }));

    expect(onCopy).toHaveBeenCalledWith("card:card_1:num", "5412753490214471");
    expect(onCopy).toHaveBeenCalledWith("card:card_1:exp", "09/29");
    expect(onCopy).toHaveBeenCalledWith("card:card_1:cvv", "318");
  });

  it("copy clicks stop propagation so the card does not flip back", () => {
    const onFlip = vi.fn();
    render(<CardFlipTile {...baseProps} flipped onFlip={onFlip} secrets={revealed} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy card number" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy CVV" }));
    expect(onFlip).not.toHaveBeenCalled();
  });

  it("confirms a copy visibly on the card and to screen readers", () => {
    const { container } = render(
      <CardFlipTile {...baseProps} flipped secrets={revealed} copiedField="card:card_1:cvv" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("CVV copied");
    const chip = container.querySelector(".ep-card-face__copied")!;
    expect(chip).toHaveAttribute("data-show", "true");
    expect(chip).toHaveTextContent("CVV copied");
    expect(screen.getByRole("button", { name: "Copy CVV" })).toHaveAttribute("data-copied", "true");
    expect(screen.getByRole("button", { name: "Copy expiry" })).toHaveAttribute("data-copied", "false");
  });

  it("ignores another card's copy", () => {
    const { container } = render(
      <CardFlipTile {...baseProps} flipped secrets={revealed} copiedField="card:card_2:cvv" />,
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(container.querySelector(".ep-card-face__copied")).toHaveAttribute("data-show", "false");
  });

  it("disables the front face and shows the disabled reason when actionDisabled", () => {
    render(
      <CardFlipTile {...baseProps} actionDisabled actionDisabledReason="This card is closed." />,
    );
    const flipButton = screen.getByRole("button", { name: "Show card details" });
    expect(flipButton).toBeDisabled();
    expect(flipButton).toHaveAttribute("title", "This card is closed.");
  });

  it("covers a frozen card with the Frozen pill and locks the flip", () => {
    const onFlip = vi.fn();
    render(<CardFlipTile {...baseProps} status="frozen" statusLabel="Frozen" onFlip={onFlip} />);
    expect(screen.getByText("Frozen")).toHaveClass("ep-card-face__frozen-pill");
    const flipButton = screen.getByRole("button", { name: "Show card details" });
    expect(flipButton).toBeDisabled();
    expect(flipButton).toHaveAttribute("title", "Unfreeze this card to view its details");
    fireEvent.click(flipButton);
    expect(onFlip).not.toHaveBeenCalled();
  });

  it("does not disable the front face while secrets are loading, so it can still flip back", () => {
    render(<CardFlipTile {...baseProps} flipped secretsBusy />);
    expect(screen.getByRole("button", { name: "Hide card details" })).not.toBeDisabled();
  });

  it("surfaces a reveal error inside the fixed card face, not as extra height below it", () => {
    render(<CardFlipTile {...baseProps} flipped secretsError="Couldn't load card details." />);
    expect(screen.getByText("Couldn't load")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("ep-sr-only");
  });
});

describe("shortExpiry", () => {
  it("shortens four-digit years and pads months", () => {
    expect(shortExpiry("9/2029")).toBe("09/29");
    expect(shortExpiry("09/29")).toBe("09/29");
    expect(shortExpiry(null)).toBeNull();
    expect(shortExpiry("bad")).toBeNull();
  });
});

describe("CardPreview", () => {
  it("shows the front face in the chosen colour with no controls", () => {
    render(<CardPreview label="Travel" color={cardColor("plum")} />);
    const preview = screen.getByRole("img", { name: "Card preview: Travel, Plum" });
    expect(preview).toHaveTextContent("Travel");
    expect(preview).toHaveTextContent("MBOKA");
    expect(preview.querySelector("button")).toBeNull();
    const face = preview.querySelector<HTMLElement>(".ep-card-face")!;
    expect(face.style.background).toMatch(/74, 29, 110|#4a1d6e/i);
  });
});
