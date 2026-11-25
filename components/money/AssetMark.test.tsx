// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AssetMark, { assetMarkKind } from "./AssetMark";

describe("AssetMark", () => {
  it("renders the flag image when the currency maps to one country", () => {
    const { container } = render(
      <AssetMark code="KES" flagUrl="https://flagcdn.com/w40/ke.png" />,
    );
    const img = container.querySelector(".ep-wallets__flag-img") as HTMLElement;
    expect(img).toBeTruthy();
    expect(img.style.backgroundImage).toContain("flagcdn.com/w40/ke.png");
  });

  it("draws each stablecoin's own brand coin, not one shared glyph", () => {
    const { container: usdc } = render(<AssetMark code="USDC" flagUrl={null} />);
    const { container: usdt } = render(<AssetMark code="USDT" flagUrl={null} />);

    // Circle's blue vs Tether's "Jungle Green" — the whole point is that these
    // two are no longer indistinguishable.
    expect(usdc.querySelector('circle[fill="#2775CA"]')).toBeTruthy();
    expect(usdt.querySelector('circle[fill="#26A17B"]')).toBeTruthy();

    // Tether's mark is a filled ₮ path, not a text glyph.
    expect(usdt.querySelector("path[fill='#FFFFFF']")).toBeTruthy();
    expect(usdc.textContent).toContain("$");
  });

  it("badges the coin with the chain it settles on", () => {
    const { container } = render(
      <AssetMark code="USDC" flagUrl={null} network="Stellar" />,
    );
    const chain = container.querySelector(".ep-wallets__flag-chain");
    expect(chain).toBeTruthy();
    // Real brand art from public/brand, not a lettered stand-in.
    expect(chain?.querySelector("image")?.getAttribute("href")).toBe(
      "/brand/stellar-mark.png",
    );
  });

  it("omits the chain badge for a network with no brand art", () => {
    const { container } = render(
      <AssetMark code="USDC" flagUrl={null} network="Optimism" />,
    );
    expect(container.querySelector(".ep-wallets__flag-chain")).toBeNull();
    // The coin itself still renders.
    expect(container.querySelector('circle[fill="#2775CA"]')).toBeTruthy();
  });

  it("shows a code badge for shared currencies rather than a misleading flag", () => {
    // XOF spans 8 UEMOA states; no single national flag is correct.
    render(<AssetMark code="XOF" flagUrl={null} label="XOF account" />);
    expect(screen.getByRole("img", { name: "XOF account" })).toBeInTheDocument();
    expect(screen.getByText("₣")).toBeInTheDocument();
  });

  it("falls back to the asset code for an unrecognised asset", () => {
    render(<AssetMark code="ZZZ" flagUrl={null} />);
    expect(screen.getByText("ZZZ")).toBeInTheDocument();
  });

  it("classifies marks without rendering", () => {
    expect(assetMarkKind("KES", "https://flagcdn.com/w40/ke.png")).toBe("flag");
    expect(assetMarkKind("USDT", null)).toBe("coin");
    expect(assetMarkKind("XOF", null)).toBe("badge");
  });
});

describe("chain badge sizing", () => {
  it("sizes the chain badge relative to the coin, not the NetworkMark default", () => {
    // `.ep-network-mark` hard-codes 28px in CSS, which used to beat the
    // width/height attributes and swallow the 38px coin it sits on.
    const { container } = render(
      <AssetMark code="USDC" flagUrl={null} network="Stellar" coinSize={38} />,
    );
    const chain = container.querySelector(
      ".ep-wallets__flag-chain svg",
    ) as SVGElement | null;
    expect(chain).toBeTruthy();
    expect(chain?.getAttribute("width")).toBe("14");
    // Inline style is what actually wins over the class rule.
    expect((chain as unknown as HTMLElement).style.width).toBe("14px");
  });
});
