// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ConvertFlow, { type ConvertFlowProps, type ConvertMode } from "./ConvertFlow";
import { ledgerPreviewToConversionOut } from "@/lib/services/ledgerConversions";
import type { ConversionOut } from "@/lib/services/conversions";

const account = (id: string, currency: string) => ({
  id,
  currency,
  label: `${currency} account`,
  balanceLabel: "1,000.00",
  balanceAmount: 1000,
});

function quote(overrides: Partial<ConversionOut> = {}): ConversionOut {
  return {
    id: "q1",
    status: "quoted",
    direction: "ledger_fx",
    source_account_id: "src",
    destination_account_id: "dst",
    source_currency: "EUR",
    destination_currency: "USD",
    source_amount: "100.00",
    destination_amount: "108.40",
    fee_amount: "1.25",
    fee_currency: "EUR",
    quote_id: "q1",
    order_id: null,
    ledger_journal_reference: null,
    expires_at: null,
    ...overrides,
  };
}

function props(overrides: Partial<ConvertFlowProps> = {}): ConvertFlowProps {
  const noop = () => {};
  return {
    mode: "fiat_to_fiat" as ConvertMode,
    onMode: noop,
    sourceAccounts: [account("src", "EUR")],
    destinationAccounts: [account("dst", "USD")],
    sourceAccountId: "src",
    destinationAccountId: "dst",
    onSourceAccount: noop,
    onDestinationAccount: noop,
    amount: "100",
    onAmount: noop,
    quote: quote(),
    quoteSeconds: 90,
    quoteLoading: false,
    acceptLoading: false,
    error: "",
    done: false,
    onRefreshQuote: noop,
    onAccept: noop,
    onDone: noop,
    ...overrides,
  };
}

describe("ConvertFlow fee disclosure", () => {
  it("shows the quote's fee before the user accepts", () => {
    render(<ConvertFlow {...props()} />);
    expect(screen.getByTestId("convert-fee").textContent).toBe("1.25 EUR");
  });

  it("falls back to the source currency when the quote omits a fee currency", () => {
    render(<ConvertFlow {...props({ quote: quote({ fee_currency: null }) })} />);
    expect(screen.getByTestId("convert-fee").textContent).toBe("1.25 EUR");
  });

  it("says No fee for a backend zero instead of hiding the row", () => {
    render(<ConvertFlow {...props({ quote: quote({ fee_amount: "0.00" }) })} />);
    expect(screen.getByTestId("convert-fee").textContent).toBe("No fee");
  });

  it("says when an unquoted fee will surface rather than implying it is free", () => {
    render(<ConvertFlow {...props({ quote: quote({ fee_amount: null }) })} />);
    expect(screen.getByTestId("convert-fee").textContent).toBe(
      "Shown on your statement once settled",
    );
  });

  it("lets a call site override the copy", () => {
    render(<ConvertFlow {...props({ feeText: "Included in the rate" })} />);
    expect(screen.getByTestId("convert-fee").textContent).toBe("Included in the rate");
  });

  it("renders no fee row at all before a quote exists", () => {
    render(<ConvertFlow {...props({ quote: null })} />);
    expect(screen.queryByTestId("convert-fee")).toBeNull();
  });
});

describe("ConvertFlow fee disclosure across all three directions", () => {
  // Every direction normalizes into ConversionOut, which is why the fee row
  // needs no per-flow wiring. These assert that contract holds rather than
  // trusting it.
  it("discloses the ledger FX fee", () => {
    const ledger = ledgerPreviewToConversionOut(
      {
        preview_token: "tok",
        from_account_id: "src",
        to_account_id: "dst",
        from_currency: "EUR",
        to_currency: "USD",
        amount_from: "100.00",
        amount_to: "108.40",
        fee: "1.25",
        expires_at: null,
      },
      { sourceAccountId: "src", destinationAccountId: "dst" },
    );
    render(<ConvertFlow {...props({ mode: "fiat_to_fiat", quote: ledger })} />);
    expect(screen.getByTestId("convert-fee").textContent).toBe("1.25 EUR");
  });

  it("discloses the ramp fee", () => {
    const ramp = quote({
      direction: "fiat_to_stable",
      destination_currency: "USDC",
      fee_amount: "0.50",
      fee_currency: "EUR",
    });
    render(<ConvertFlow {...props({ mode: "fiat_to_stable", quote: ramp })} />);
    expect(screen.getByTestId("convert-fee").textContent).toBe("0.50 EUR");
  });

  it("discloses the Stellar swap fee", () => {
    const swap = quote({
      direction: "stable_to_stable",
      source_currency: "USDT",
      destination_currency: "USDC",
      fee_amount: "0.0100",
      fee_currency: "USDC",
    });
    render(<ConvertFlow {...props({ mode: "stable_to_stable", quote: swap })} />);
    expect(screen.getByTestId("convert-fee").textContent).toBe("0.01 USDC");
  });
});
