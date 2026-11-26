// @vitest-environment jsdom

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConvertComposer, { AUTO_QUOTE_DELAY_MS } from "./ConvertComposer";
import type { ConvertComposerProps } from "./ConvertComposer";
import type { ConversionOut } from "@/lib/services/conversions";
import { resolveConvertRoute } from "@/lib/services/convertRoutes";
import type { ConvertAccountOption } from "@/components/convert/ConvertFlow";

const usd: ConvertAccountOption = {
  id: "usd",
  currency: "USD",
  label: "USD account",
  balanceLabel: "12,480.00",
  balanceAmount: 12480,
  flagUrl: "https://flagcdn.com/w80/us.png",
};
const eur: ConvertAccountOption = {
  id: "eur",
  currency: "EUR",
  label: "EUR account",
  balanceLabel: "3,210.55",
  balanceAmount: 3210.55,
  flagUrl: "https://flagcdn.com/w80/eu.png",
};
const usdcBase: ConvertAccountOption = {
  id: "usdc-base",
  currency: "USDC",
  label: "USDC wallet · Base",
  balanceLabel: "1,240.50",
  balanceAmount: 1240.5,
  network: "Base",
};
const usdcPolygon: ConvertAccountOption = {
  id: "usdc-polygon",
  currency: "USDC",
  label: "USDC wallet · Polygon",
  balanceLabel: "40.00",
  balanceAmount: 40,
  network: "Polygon",
};

function quote(overrides: Partial<ConversionOut> = {}): ConversionOut {
  return {
    id: "q1",
    status: "quoted",
    direction: "ledger_fx",
    source_account_id: "usd",
    destination_account_id: "eur",
    source_currency: "USD",
    destination_currency: "EUR",
    source_amount: "1000.00",
    destination_amount: "921.30",
    fee_amount: "4.00",
    fee_currency: "USD",
    quote_id: "q1",
    order_id: null,
    ledger_journal_reference: null,
    expires_at: null,
    ...overrides,
  };
}

function props(overrides: Partial<ConvertComposerProps> = {}): ConvertComposerProps {
  const noop = () => {};
  const all = [usd, eur, usdcBase, usdcPolygon];
  const src = overrides.sourceAccountId ?? "usd";
  const dst = overrides.destinationAccountId ?? "eur";
  return {
    route: resolveConvertRoute(all.find((a) => a.id === src), all.find((a) => a.id === dst)),
    sourceAccounts: all,
    destinationAccounts: all.filter((a) => a.id !== src),
    sourceAccountId: src,
    destinationAccountId: dst,
    onSourceAccount: noop,
    onDestinationAccount: noop,
    amount: "1000",
    onAmount: noop,
    quote: null,
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

const title = () => screen.getByRole("heading", { level: 1 });

afterEach(() => {
  vi.useRealTimers();
});

describe("ConvertComposer — one screen for from, to and amount", () => {
  it("shows both accounts, the amount and the available balance on step 1 of 2", () => {
    render(<ConvertComposer {...props()} />);
    expect(title()).toHaveTextContent("Convert");
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    const from = screen.getByRole("group", { name: "From" });
    expect(within(from).getByRole("button", { name: /From USD account/ })).toBeInTheDocument();
    expect(within(from).getByText(/12,480\.00/)).toBeInTheDocument();
    expect(within(from).getByRole("textbox", { name: "Amount to convert, USD" })).toHaveValue("1000");
    const to = screen.getByRole("group", { name: "To" });
    expect(within(to).getByRole("button", { name: /To EUR account/ })).toBeInTheDocument();
  });

  it("fills the whole balance with Use max", () => {
    const onAmount = vi.fn();
    render(<ConvertComposer {...props({ onAmount })} />);
    fireEvent.click(screen.getByRole("button", { name: "Use max" }));
    expect(onAmount).toHaveBeenCalledWith("12480.00");
  });

  it("swaps from and to in one tap", () => {
    const onSourceAccount = vi.fn();
    const onDestinationAccount = vi.fn();
    render(<ConvertComposer {...props({ onSourceAccount, onDestinationAccount })} />);
    fireEvent.click(screen.getByRole("button", { name: "Swap from and to" }));
    expect(onSourceAccount).toHaveBeenCalledWith("eur");
    expect(onDestinationAccount).toHaveBeenCalledWith("usd");
  });

  it("prices live a moment after typing stops, once", () => {
    vi.useFakeTimers();
    const onRefreshQuote = vi.fn();
    render(<ConvertComposer {...props({ onRefreshQuote })} />);
    expect(screen.getByText(/Enter an amount to see the live rate and fee/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(AUTO_QUOTE_DELAY_MS - 1);
    });
    expect(onRefreshQuote).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onRefreshQuote).toHaveBeenCalledTimes(1);
  });

  it("says the amount is over the balance, and neither prices nor continues", () => {
    vi.useFakeTimers();
    const onRefreshQuote = vi.fn();
    render(<ConvertComposer {...props({ amount: "20000", onRefreshQuote })} />);
    expect(screen.getByText(/more than the 12,480\.00 USD available/)).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(AUTO_QUOTE_DELAY_MS * 2);
    });
    expect(onRefreshQuote).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("shows the price breakdown with the fee and who pays it, then continues", () => {
    render(<ConvertComposer {...props({ quote: quote() })} />);
    const to = screen.getByRole("group", { name: "To" });
    expect(within(to).getByText("921.30")).toBeInTheDocument();
    const breakdown = screen.getByRole("region", { name: "Price breakdown" });
    expect(within(breakdown).getByText("Fees · paid by you")).toBeInTheDocument();
    expect(within(breakdown).getByText(/4\.00/)).toBeInTheDocument();
    expect(within(breakdown).getByText(/1 USD → 0\.9213 EUR/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(title()).toHaveTextContent("Check and convert");
  });

  it("explains a pair we can't convert instead of asking for an amount", () => {
    render(<ConvertComposer {...props({ sourceAccountId: "usdc-base", destinationAccountId: "usdc-polygon" })} />);
    expect(screen.getByText(/isn't a conversion/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Amount to convert/ })).not.toBeInTheDocument();
  });

  it("asks for two accounts when there aren't enough", () => {
    render(<ConvertComposer {...props({ sourceAccounts: [usd], destinationAccounts: [] })} />);
    expect(screen.getByText("Accounts needed")).toBeInTheDocument();
  });

  it("names a backend refusal in plain words", () => {
    render(<ConvertComposer {...props({ error: "Insufficient balance on the source account" })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Not enough balance");
  });

  it("never shows the plumbing behind a route", () => {
    const { container } = render(
      <ConvertComposer {...props({ sourceAccountId: "usdc-base", destinationAccountId: "eur", quote: quote() })} />,
    );
    expect(container.textContent).not.toMatch(/CCTP|bridge|ledger fx|on-ramp|off-ramp/i);
  });
});

describe("ConvertComposer — the account picker", () => {
  it("lists every account with its balance and picks the one to convert from", () => {
    const onSourceAccount = vi.fn();
    render(<ConvertComposer {...props({ onSourceAccount })} />);
    fireEvent.click(screen.getByRole("button", { name: /From USD account/ }));
    const dialog = screen.getByRole("dialog", { name: "Convert from" });
    expect(within(dialog).getByRole("button", { name: /USDC wallet · Base/ })).toHaveTextContent("1,240.50");
    fireEvent.click(within(dialog).getByRole("button", { name: /EUR account/ }));
    expect(onSourceAccount).toHaveBeenCalledWith("eur");
    expect(screen.queryByRole("dialog", { name: "Convert from" })).not.toBeInTheDocument();
  });

  it("shows a pair we can't convert with its reason, and won't pick it", () => {
    const onDestinationAccount = vi.fn();
    render(
      <ConvertComposer
        {...props({ sourceAccountId: "usdc-base", destinationAccountId: "eur", onDestinationAccount })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /To EUR account/ }));
    const dialog = screen.getByRole("dialog", { name: "Convert into" });
    const polygon = within(dialog).getByRole("button", { name: /USDC wallet · Polygon/ });
    expect(polygon).toBeDisabled();
    expect(polygon).toHaveTextContent(/isn't a conversion/);
    fireEvent.click(within(dialog).getByRole("button", { name: /USD account/ }));
    expect(onDestinationAccount).toHaveBeenCalledWith("usd");
  });

  it("searches the accounts by name, currency or balance", () => {
    const kes: ConvertAccountOption = { id: "kes", currency: "KES", label: "KES account", balanceLabel: "5,000.00", balanceAmount: 5000 };
    render(<ConvertComposer {...props({ sourceAccounts: [usd, eur, usdcBase, usdcPolygon, kes] })} />);
    fireEvent.click(screen.getByRole("button", { name: /From USD account/ }));
    const dialog = screen.getByRole("dialog", { name: "Convert from" });
    fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search accounts" }), {
      target: { value: "polygon" },
    });
    expect(within(dialog).getAllByRole("button", { name: /wallet|account/ })).toHaveLength(1);
    fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search accounts" }), {
      target: { value: "zzz" },
    });
    expect(within(dialog).getByText("No accounts match “zzz”.")).toBeInTheDocument();
  });
});

describe("ConvertComposer — check and convert", () => {
  function toReview(overrides: Partial<ConvertComposerProps> = {}) {
    const view = render(<ConvertComposer {...props({ quote: quote(), ...overrides })} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    return view;
  }

  it("shows the locked rate counting down and converts from the named button", () => {
    const onAccept = vi.fn();
    toReview({ onAccept });
    expect(screen.getByText("Step 2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("Rate locked for 1:30");
    const details = screen.getByRole("region", { name: "Conversion details" });
    expect(within(details).getByText("USD account")).toBeInTheDocument();
    expect(within(details).getByText("EUR account")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Convert 1,000\.00 USD/ }));
    expect(onAccept).toHaveBeenCalled();
  });

  it("offers a new rate once the lock runs out, never a stale convert", () => {
    const onRefreshQuote = vi.fn();
    const view = toReview({ onRefreshQuote });
    view.rerender(<ConvertComposer {...props({ quote: quote(), quoteSeconds: 0, onRefreshQuote })} />);
    expect(screen.getByText("The rate ran out")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Convert / })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Get a new rate" }));
    expect(onRefreshQuote).toHaveBeenCalled();
  });

  it("says a rate isn't locked when it's priced on arrival", () => {
    toReview({ quote: quote({ rate_locked: false, destination_amount_estimated: true }) });
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    expect(screen.getByText(/priced when the USDC arrives|priced when it arrives/i)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Conversion details" })).toHaveTextContent("≈");
  });

  it("goes back to the composer", () => {
    toReview();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(title()).toHaveTextContent("Convert");
  });

  it("shows converting while the accept is in flight", () => {
    const view = toReview();
    view.rerender(<ConvertComposer {...props({ quote: quote(), acceptLoading: true })} />);
    expect(screen.getByRole("button", { name: /Convert 1,000\.00 USD/ })).toHaveAttribute("aria-busy", "true");
  });
});

describe("ConvertComposer — what happens next", () => {
  it("confirms a settled conversion and closes on Done", () => {
    const onDone = vi.fn();
    render(<ConvertComposer {...props({ quote: quote({ status: "completed" }), done: true, onDone })} />);
    expect(title()).toHaveTextContent("Converted");
    expect(screen.getByText("Settled")).toBeInTheDocument();
    expect(screen.getByText(/is in your EUR account/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalled();
  });

  it("follows a multi-step conversion stage by stage, and can be closed", () => {
    render(
      <ConvertComposer
        {...props({
          sourceAccountId: "usdc-base",
          quote: quote({
            route: "bridged",
            status: "processing_onchain",
            stages: ["pending", "processing_onchain", "processing_to_fiat", "completed"],
            source_currency: "USDC",
            destination_amount_estimated: true,
          }),
          done: true,
        })}
      />,
    );
    expect(title()).toHaveTextContent("Converting");
    expect(screen.getByText("Pending")).toBeInTheDocument();
    const steps = screen.getByRole("list", { name: "Conversion steps" });
    expect(within(steps).getAllByRole("listitem")).toHaveLength(4);
    expect(within(steps).getByText("Moving USDC on-chain").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(/You can close this/)).toBeInTheDocument();
    // The header ✕ and the button under the steps both close it.
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(2);
  });

  it("says where the money went when a conversion is returned", () => {
    render(
      <ConvertComposer
        {...props({
          quote: quote({ route: "bridged", status: "returned", return_reason: "The rate moved too far." }),
          done: true,
        })}
      />,
    );
    expect(title()).toHaveTextContent("Your money is back");
    expect(screen.getByRole("status")).toHaveTextContent(
      "The rate moved too far. We sent 1,000.00 USD back to your USD account.",
    );
  });

  it("hands a stuck conversion to support with its reference", () => {
    render(
      <ConvertComposer
        {...props({ quote: quote({ id: "job-77", route: "bridged", status: "failed" }), done: true })}
      />,
    );
    expect(title()).toHaveTextContent("Needs support");
    expect(screen.getByText("job-77")).toBeInTheDocument();
  });
});
