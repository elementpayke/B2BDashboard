// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ConvertFlow, { type ConvertFlowProps } from "./ConvertFlow";
import { ledgerPreviewToConversionOut } from "@/lib/services/ledgerConversions";
import { bookTransferPreviewToConversionOut } from "@/lib/services/bookTransfers";
import type { ConversionOut } from "@/lib/services/conversions";
import { resolveConvertRoute } from "@/lib/services/convertRoutes";

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
    // EUR → USD: ledger FX, the same route the default quote describes.
    route: resolveConvertRoute(
      { id: "src", currency: "EUR" },
      { id: "dst", currency: "USD" },
    ),
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

describe("ConvertFlow fee disclosure across every rail", () => {
  // Every rail normalizes into ConversionOut, which is why the fee row
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
    render(<ConvertFlow {...props({ quote: ledger })} />);
    expect(screen.getByTestId("convert-fee").textContent).toBe("1.25 EUR");
  });

  it("discloses the ramp fee", () => {
    const ramp = quote({
      direction: "fiat_to_stable",
      destination_currency: "USDC",
      fee_amount: "0.50",
      fee_currency: "EUR",
    });
    render(
      <ConvertFlow
        {...props({
          route: resolveConvertRoute(
            { id: "src", currency: "EUR" },
            { id: "dst", currency: "USDC" },
          ),
          quote: ramp,
        })}
      />,
    );
    expect(screen.getByTestId("convert-fee").textContent).toBe("0.50 EUR");
  });

  it("reads a book transfer's explicit zero as No fee, never blank", () => {
    const book = bookTransferPreviewToConversionOut(
      {
        preview_token: "tok",
        from_account_id: "src",
        to_account_id: "dst",
        currency: "EUR",
        amount: "100.00",
        fee: "0.00",
        expires_at: null,
      },
      { sourceAccountId: "src", destinationAccountId: "dst", currency: "EUR" },
    );
    render(
      <ConvertFlow
        {...props({
          route: resolveConvertRoute(
            { id: "src", currency: "EUR" },
            { id: "dst", currency: "EUR" },
          ),
          quote: book,
        })}
      />,
    );
    expect(screen.getByTestId("convert-fee").textContent).toBe("No fee");
  });
});

describe("ConvertFlow states the derived route and refuses the rest", () => {
  const routeFor = (
    from: { id: string; currency: string; network?: string | null },
    to: { id: string; currency: string; network?: string | null },
  ) => resolveConvertRoute(from, to);

  it("names the rail instead of asking the user to choose one", () => {
    render(<ConvertFlow {...props({ quote: null })} />);
    expect(screen.getByTestId("convert-route").textContent).toContain(
      "Converts on the ledger",
    );
    // The mode tabs are gone — there is nothing to select a direction with.
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("calls a same-currency move instant and free before any quote", () => {
    render(
      <ConvertFlow
        {...props({
          route: routeFor({ id: "a", currency: "EUR" }, { id: "b", currency: "EUR" }),
          quote: null,
        })}
      />,
    );
    expect(screen.getByTestId("convert-route").textContent).toContain("no fee");
  });

  it("announces USDC → USDT as a ledger conversion", () => {
    render(
      <ConvertFlow
        {...props({
          route: routeFor(
            { id: "a", currency: "USDC", network: "polygon" },
            { id: "b", currency: "USDT", network: "polygon" },
          ),
          quote: null,
        })}
      />,
    );
    expect(screen.getByTestId("convert-route").textContent).toContain(
      "Converts on the ledger",
    );
  });

  it("explains an unsupported pair and disables the quote button", () => {
    render(
      <ConvertFlow
        {...props({
          route: routeFor(
            { id: "a", currency: "USDC", network: "polygon" },
            { id: "b", currency: "USDC", network: "base" },
          ),
          quote: null,
        })}
      />,
    );
    const why = screen.getByTestId("convert-unsupported").textContent || "";
    expect(why).toContain("Use Send");
    expect(screen.getByRole("button", { name: /get quote/i })).toBeDisabled();
  });

  it("does not refuse a fiat pair the old ledger list excluded", () => {
    // The regression this change exists to kill: KES → USD was refused in the
    // UI while both the aggregator and the published pricing allowed it.
    render(
      <ConvertFlow
        {...props({
          route: routeFor({ id: "a", currency: "KES" }, { id: "b", currency: "USD" }),
          quote: null,
        })}
      />,
    );
    expect(screen.queryByTestId("convert-unsupported")).toBeNull();
    expect(screen.getByRole("button", { name: /get quote/i })).toBeEnabled();
  });

  it("hides the amount field for an unsupported pair", () => {
    // Catching the refusal only after an amount is typed is the failure this
    // routing change exists to prevent.
    render(
      <ConvertFlow
        {...props({
          route: routeFor(
            { id: "a", currency: "USDC", network: "stellar" },
            { id: "b", currency: "USDC", network: "polygon" },
          ),
          quote: null,
        })}
      />,
    );
    expect(screen.queryByLabelText(/^Amount/)).toBeNull();
    expect(screen.getByTestId("convert-unsupported").textContent).toContain("isn't a conversion");
  });

  it("lets a Stellar USDC -> USD pair be quoted", () => {
    render(
      <ConvertFlow
        {...props({
          route: routeFor(
            { id: "src", currency: "USDC", network: "stellar" },
            { id: "dst", currency: "USD" },
          ),
          quote: null,
        })}
      />,
    );
    expect(screen.getByTestId("convert-route").textContent).toContain("few minutes");
    expect(screen.getByRole("button", { name: /get quote/i })).toBeEnabled();
  });

  it("keeps the quote button live for a supported pair", () => {
    render(<ConvertFlow {...props({ quote: null })} />);
    expect(screen.getByRole("button", { name: /get quote/i })).toBeEnabled();
  });

  it("labels Settles via from the route when the call site passes none", () => {
    render(<ConvertFlow {...props()} />);
    expect(screen.getByTestId("convert-settles-via").textContent).toBe(
      "Ledger FX · same customer",
    );
  });
});

describe("ConvertFlow bridged conversions", () => {
  const bridgedQuote = (overrides: Partial<ConversionOut> = {}) =>
    quote({
      route: "bridged",
      source_currency: "USDC",
      destination_currency: "USD",
      source_amount: "2.00",
      destination_amount: "2.07",
      fee_amount: null,
      fee_status: "estimated",
      rate_locked: false,
      destination_amount_estimated: true,
      notice: "This conversion moves USDC on-chain and takes a few minutes.",
      stages: ["pending", "processing_onchain", "processing_to_fiat", "completed"],
      ...overrides,
    });

  it("shows an estimate, the notice, and no countdown", () => {
    render(<ConvertFlow {...props({ quote: bridgedQuote(), quoteSeconds: 0 })} />);
    expect(screen.getByTestId("convert-receive").textContent).toContain("≈");
    expect(screen.getByTestId("convert-notice").textContent).toContain("few minutes");
    expect(screen.queryByRole("timer")).toBeNull();
    // quoteSeconds 0 would expire a locked quote; an unlocked one stays acceptable.
    expect(screen.queryByText(/Rate expired/)).toBeNull();
    expect(screen.getByRole("button", { name: /accept & convert/i })).toBeEnabled();
    expect(screen.getByTestId("convert-fee").textContent).toContain("Charged on top");
  });

  it("shows stage progress for an in-flight job", () => {
    render(
      <ConvertFlow
        {...props({
          done: true,
          quote: bridgedQuote({
            id: "cvj_42",
            status: "processing_onchain",
            stage: "USDC is crossing chains.",
          }),
        })}
      />,
    );
    const job = screen.getByTestId("convert-job");
    expect(job.textContent).toContain("Conversion in progress");
    expect(job.textContent).toContain("USDC is crossing chains.");
    expect(job.textContent).toContain("cvj_42");
    const current = job.querySelector('[data-state="current"]');
    expect(current?.textContent).toContain("Moving USDC on-chain");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("explains a returned job", () => {
    render(
      <ConvertFlow
        {...props({
          done: true,
          quote: bridgedQuote({
            id: "cvj_42",
            status: "returned",
            return_reason: "Nuvion rejected the FX leg.",
          }),
        })}
      />,
    );
    expect(screen.getByTestId("convert-job").textContent).toContain("Conversion returned");
    expect(screen.getByTestId("convert-job").textContent).toContain("Nuvion rejected the FX leg.");
  });

  it("falls through to the normal success screen once completed", () => {
    render(
      <ConvertFlow
        {...props({ done: true, quote: bridgedQuote({ status: "completed" }) })}
      />,
    );
    expect(screen.getByText("Conversion complete")).toBeInTheDocument();
  });
});
