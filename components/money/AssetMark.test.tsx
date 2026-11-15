// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AssetMark, { BRAND_MARKS, assetMarkKind } from "./AssetMark";

describe("AssetMark", () => {
  it("renders the flag image when the currency maps to one country", () => {
    const { container } = render(
      <AssetMark code="KES" flagUrl="https://flagcdn.com/w40/ke.png" />,
    );
    const img = container.querySelector(".ep-wallets__flag-img") as HTMLElement;
    expect(img).toBeTruthy();
    expect(img.style.backgroundImage).toContain("flagcdn.com/w40/ke.png");
  });

  it("gives each stablecoin its own issuer brand colour, not a shared glyph", () => {
    const { container: usdc } = render(<AssetMark code="USDC" flagUrl={null} />);
    const { container: usdt } = render(<AssetMark code="USDT" flagUrl={null} />);

    const a = usdc.querySelector(".ep-wallets__flag--brand") as HTMLElement;
    const b = usdt.querySelector(".ep-wallets__flag--brand") as HTMLElement;

    // Circle's USDC blue and Tether's "Jungle Green" — the whole point is that
    // these two are no longer indistinguishable.
    expect(a.style.background).toBe("rgb(39, 117, 202)");
    expect(b.style.background).toBe("rgb(38, 161, 123)");
    expect(a.style.background).not.toBe(b.style.background);
    expect(a.textContent).toBe("$");
    expect(b.textContent).toBe("₮");
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
    expect(assetMarkKind("USDT", null)).toBe("stablecoin");
    expect(assetMarkKind("XOF", null)).toBe("badge");
  });

  it("keeps every brand mark visually distinct", () => {
    const colours = Object.values(BRAND_MARKS).map((m) => `${m.background}|${m.glyph}`);
    expect(new Set(colours).size).toBe(colours.length);
  });
});
