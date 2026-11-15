// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FeeDisclosureRows, {
  NO_FEE_TEXT,
  feeDisclosureText,
  feeState,
} from "./FeeDisclosure";
import TermsLine from "./TermsLine";

describe("feeState", () => {
  it("keeps an explicit zero distinct from an unknown fee", () => {
    expect(feeState("0.00")).toBe("none");
    expect(feeState(0)).toBe("none");
    expect(feeState("0")).toBe("none");
    expect(feeState(null)).toBe("unknown");
    expect(feeState(undefined)).toBe("unknown");
    expect(feeState("")).toBe("unknown");
    expect(feeState("   ")).toBe("unknown");
  });

  it("treats an unparseable figure as unknown, never as free", () => {
    expect(feeState("n/a")).toBe("unknown");
    expect(feeState("included in the rate")).toBe("unknown");
  });

  it("reads a real fee as charged, commas and all", () => {
    expect(feeState("17.50")).toBe("charged");
    expect(feeState("1,250.00")).toBe("charged");
    expect(feeState(0.0001)).toBe("charged");
  });
});

describe("feeDisclosureText", () => {
  it("says No fee for a backend zero rather than going blank", () => {
    expect(
      feeDisclosureText({ raw: "0.00", formatted: "0.00 EUR", whenUnknown: "Shown once confirmed" }),
    ).toBe(NO_FEE_TEXT);
  });

  it("says when the fee will be shown when there is no figure yet", () => {
    expect(
      feeDisclosureText({ raw: null, formatted: null, whenUnknown: "Shown once confirmed" }),
    ).toBe("Shown once confirmed");
  });

  it("shows the caller's formatted figure for a real fee", () => {
    expect(
      feeDisclosureText({ raw: "17.5", formatted: "17.50 USDT", whenUnknown: "Shown once confirmed" }),
    ).toBe("17.50 USDT");
  });

  it("falls back to the honest copy when a charged fee has no formatting", () => {
    expect(
      feeDisclosureText({ raw: "17.5", formatted: "", whenUnknown: "Shown once confirmed" }),
    ).toBe("Shown once confirmed");
  });
});

describe("FeeDisclosureRows", () => {
  it("renders the fee and the backend total", () => {
    render(<FeeDisclosureRows fee="17.50 USDT" total="7,017.50 USDT" />);
    expect(screen.getByText("Fee")).toBeInTheDocument();
    expect(screen.getByText("17.50 USDT")).toBeInTheDocument();
    expect(screen.getByText("Total deducted")).toBeInTheDocument();
    expect(screen.getByText("7,017.50 USDT")).toBeInTheDocument();
  });

  it("renders No fee as its own row", () => {
    render(<FeeDisclosureRows fee={NO_FEE_TEXT} total="500.00 EUR" />);
    expect(screen.getByText("No fee")).toBeInTheDocument();
  });

  it("says when the total will be known rather than deriving one", () => {
    render(<FeeDisclosureRows fee="Shown once confirmed" totalWhenUnknown="Shown once confirmed" />);
    expect(screen.getByText("Total deducted")).toBeInTheDocument();
    expect(screen.getAllByText("Shown once confirmed")).toHaveLength(2);
  });

  it("omits the total row entirely when there is nothing honest to say", () => {
    render(<FeeDisclosureRows fee="17.50 USDT" />);
    expect(screen.queryByText("Total deducted")).toBeNull();
  });
});

describe("TermsLine", () => {
  it("shows fee and total beside the limits", () => {
    render(<TermsLine id="t" limits="Min USD 1.00" fee="No fee" total="500.00 EUR" />);
    expect(screen.getByText("Min USD 1.00 per transaction")).toBeInTheDocument();
    expect(screen.getByText("Fee · No fee")).toBeInTheDocument();
    expect(screen.getByText("Total · 500.00 EUR")).toBeInTheDocument();
  });

  it("renders for a fee alone, with no limits", () => {
    render(<TermsLine id="t" fee="17.50 USDT" />);
    expect(screen.getByText("Fee · 17.50 USDT")).toBeInTheDocument();
  });

  it("suppresses fee and total while an error is showing", () => {
    render(<TermsLine id="t" error="Insufficient balance." fee="No fee" total="500.00 EUR" />);
    expect(screen.getByText("Insufficient balance.")).toBeInTheDocument();
    expect(screen.queryByText("Fee · No fee")).toBeNull();
    expect(screen.queryByText("Total · 500.00 EUR")).toBeNull();
  });

  it("still renders nothing when it has nothing to say", () => {
    const { container } = render(<TermsLine id="t" />);
    expect(container.firstChild).toBeNull();
  });
});
