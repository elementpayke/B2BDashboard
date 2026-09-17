// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CardSpendList from "./CardSpendList";

describe("CardSpendList", () => {
  it("renders merchant rows with last4, status, and amount", () => {
    render(
      <CardSpendList
        items={[
          {
            id: "1",
            merchant: "Netflix",
            meta: "Card spend · Today · 09:14",
            cardLast4: "···· 4471",
            statusLabel: "Settled",
            statusColor: "var(--indigo-text)",
            statusSoft: "var(--indigo-tint)",
            amount: "-$19.99",
            openDetail: vi.fn(),
          },
        ]}
        onViewAll={vi.fn()}
      />,
    );

    expect(screen.getByText("Card spend")).toBeInTheDocument();
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Card spend · Today · 09:14")).toBeInTheDocument();
    expect(screen.getByText("···· 4471")).toBeInTheDocument();
    expect(screen.getByText("Settled")).toBeInTheDocument();
    expect(screen.getByText("-$19.99")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View all →" })).toBeInTheDocument();
  });
});

describe("CardSpendList merchant marks", () => {
  const baseItem = {
    id: "1",
    merchant: "Netflix",
    meta: "Card spend · Today · 09:14",
    cardLast4: "···· 4471",
    statusLabel: "Settled",
    statusColor: "var(--indigo-text)",
    statusSoft: "var(--indigo-tint)",
    amount: "-$19.99",
  };

  it("renders the enriched brand logo when one is supplied", () => {
    const { container } = render(
      <CardSpendList
        items={[{ ...baseItem, merchantLogoUrl: "https://cdn/netflix.png" }]}
      />,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn/netflix.png",
    );
  });

  it("falls back to the initial chip when the row has no logo", () => {
    const { container } = render(<CardSpendList items={[baseItem]} />);
    expect(container.querySelector("img")).toBeNull();
    expect(
      container.querySelector(".ep-card-spend__avatar")?.textContent,
    ).toBe("N");
  });

  it("keeps the merchant name out of the mark so the row label reads once", () => {
    render(
      <CardSpendList
        items={[{ ...baseItem, merchantLogoUrl: "https://cdn/netflix.png" }]}
      />,
    );
    expect(screen.getByText("Netflix")).toBeInTheDocument();
  });
});
