// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MerchantMark, { avatarTone, merchantInitial } from "./MerchantMark";

describe("MerchantMark", () => {
  it("renders the brand logo when one was resolved", () => {
    const { container } = render(
      <MerchantMark name="Netflix" logoUrl="https://cdn/netflix.png" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://cdn/netflix.png");
  });

  it("falls back to an initial chip when there is no logo", () => {
    const { container } = render(<MerchantMark name="Java House" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("J");
  });

  it("falls back to the chip when the logo fails to load", () => {
    const { container } = render(
      <MerchantMark name="Netflix" logoUrl="https://cdn/gone.png" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();

    fireEvent.error(img!);

    // A dead CDN link must not leave a broken-image glyph in a money list.
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("N");
  });

  it("treats a blank logo url as no logo", () => {
    const { container } = render(<MerchantMark name="Uber" logoUrl="   " />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps the host layout class on both branches", () => {
    // The chip and the logo occupy the same grid slot, so losing the layout
    // class on either branch would shift the row.
    const withLogo = render(
      <MerchantMark
        name="Netflix"
        logoUrl="https://cdn/n.png"
        className="ep-card-spend__avatar"
      />,
    );
    expect(
      withLogo.container.querySelector("img")?.className,
    ).toContain("ep-card-spend__avatar");

    const withChip = render(
      <MerchantMark name="Netflix" className="ep-card-spend__avatar" />,
    );
    expect(
      withChip.container.querySelector("span")?.className,
    ).toContain("ep-card-spend__avatar");
  });

  it("marks the decorative chip as hidden from assistive tech", () => {
    const { container } = render(<MerchantMark name="Uber" />);
    expect(container.querySelector("span")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("gives the logo an empty alt so the row label is not doubled", () => {
    const { container } = render(
      <MerchantMark name="Uber" logoUrl="https://cdn/u.png" />,
    );
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });
});

describe("merchantInitial", () => {
  it("uses the first alphanumeric character", () => {
    expect(merchantInitial("*Netflix")).toBe("N");
    expect(merchantInitial("4Sight")).toBe("4");
  });

  it("falls back to a placeholder for an empty name", () => {
    expect(merchantInitial("   ")).toBe("?");
  });
});

describe("avatarTone", () => {
  it("is stable for the same name", () => {
    expect(avatarTone("Netflix")).toBe(avatarTone("Netflix"));
  });

  it("always returns a tone", () => {
    for (const name of ["", "a", "Java House", "ééé"]) {
      expect(avatarTone(name)).toBeTruthy();
    }
  });
});
