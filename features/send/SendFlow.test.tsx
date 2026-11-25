// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SendFlow from "./SendFlow";
import { baseProps, cryptoProps } from "./SendFlow.fixtures";
import type { SavedRecipient } from "./types";

const pdf = vi.hoisted(() => ({
  build: vi.fn(() => ({ blob: new Blob(["pdf"]), filename: "mboka-receipt.pdf" })),
  download: vi.fn(),
}));
vi.mock("@/lib/documents/receiptPdf", () => ({
  buildReceiptPdfBlob: pdf.build,
  downloadPdfBlob: pdf.download,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

const click = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));
const heading = (name: string) => screen.getByRole("heading", { name });

/** Open a picker by its trigger and choose an option from its list. */
function choose(trigger: RegExp, option: RegExp | string) {
  click(trigger);
  fireEvent.click(screen.getByRole("option", { name: option }));
}

/** Walk the bank steps up to the account screen. */
function toBankAccount() {
  click(/Bank account/);
  choose(/^Country:/, /Kenya/);
  click("Continue");
  choose(/^Bank:/, "KCB Bank");
  click("Continue");
}

function toBankAmount() {
  toBankAccount();
  click("Continue");
}

function recipient(overrides: Partial<SavedRecipient>): SavedRecipient {
  return {
    id: "r1",
    businessId: 1,
    label: "Jane Mukami",
    accountNumber: "1234567890",
    railType: "bank",
    countryCode: "KE",
    currency: "KES",
    provider: "KCB Bank",
    createdAt: "2026-11-01T10:00:00Z",
    updatedAt: "2026-11-01T10:00:00Z",
    ...overrides,
  };
}

const jane = recipient({});
const janeMobile = recipient({
  id: "r2",
  accountNumber: "+254712345678",
  railType: "mobile",
  provider: "M-Pesa",
  updatedAt: "2026-11-05T10:00:00Z",
});
const kito = recipient({
  id: "r3",
  label: "Kito Logistics",
  accountNumber: "0x9b44c1d2e3f4a5b6",
  railType: "crypto",
  countryCode: null,
  currency: null,
  provider: null,
  network: "Base",
  updatedAt: "2026-11-20T10:00:00Z",
});
const ade = recipient({
  id: "r4",
  label: "Ade Okafor",
  accountNumber: "0099887766",
  currency: "NGN",
  countryCode: "NG",
  provider: "GTBank",
  updatedAt: "2026-10-01T10:00:00Z",
});

describe("SendFlow — who are you paying", () => {
  it("opens on step 1 with the three live methods, Convert, and two methods marked coming soon", () => {
    const internal = vi.fn();
    const options = baseProps().sendMethodOptions.map((m) =>
      m.key === "internal" ? { ...m, select: internal } : m,
    );
    render(<SendFlow {...baseProps({ sendMethodChosen: false, sendMethodKey: null, sendMethodOptions: options })} />);
    expect(heading("Send money")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bank account/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Mobile money/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Stablecoins/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Mboka to Mboka.*Coming soon/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Interac.*Coming soon/ })).toBeDisabled();
    click(/Between my accounts/);
    expect(internal).toHaveBeenCalledTimes(1);
  });

  it("selects the method and moves to the country step", () => {
    const selectBank = vi.fn();
    const options = baseProps().sendMethodOptions.map((m) => (m.key === "bank" ? { ...m, select: selectBank } : m));
    render(<SendFlow {...baseProps({ sendMethodOptions: options })} />);
    click(/Bank account/);
    expect(selectBank).toHaveBeenCalledTimes(1);
    expect(heading("Which country?")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 6")).toBeInTheDocument();
  });

  it("shows only the most recent recipient under Pay again until a search is typed", () => {
    render(<SendFlow {...baseProps({ savedRecipients: [jane, kito, ade] })} />);
    expect(screen.getByRole("button", { name: /Kito Logistics/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ade Okafor/ })).toBeNull();
    expect(screen.getByRole("button", { name: "All 3 recipients" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search recipients" }), { target: { value: "gtbank" } });
    expect(screen.getByRole("button", { name: /Ade Okafor/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Kito Logistics/ })).toBeNull();
    expect(screen.getByRole("button", { name: "See all 1 matches" })).toBeInTheDocument();
  });

  it("says so when there are no saved recipients, and hides the list link", () => {
    render(<SendFlow {...baseProps()} />);
    expect(screen.getByText(/No saved recipients yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /recipients$/ })).toBeNull();
  });

  it("selects the saved recipient's method first, then applies the recipient once that method is active", () => {
    const selectCrypto = vi.fn();
    const apply = vi.fn();
    const options = baseProps().sendMethodOptions.map((m) =>
      m.key === "crypto" ? { ...m, select: selectCrypto } : m,
    );
    const props = baseProps({
      sendMethodChosen: false,
      sendMethodKey: null,
      sendMethodOptions: options,
      savedRecipients: [kito],
      onSelectSavedRecipient: apply,
    });
    const { rerender } = render(<SendFlow {...props} />);
    click(/Kito Logistics/);
    expect(selectCrypto).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();
    rerender(<SendFlow {...cryptoProps({ sendMethodOptions: options, savedRecipients: [kito], onSelectSavedRecipient: apply })} />);
    expect(apply).toHaveBeenCalledWith(kito);
    expect(heading("How much?")).toBeInTheDocument();
  });

  it("applies a saved recipient straight away when its method is already active", () => {
    const apply = vi.fn();
    render(<SendFlow {...baseProps({ savedRecipients: [jane], onSelectSavedRecipient: apply })} />);
    click(/Jane Mukami/);
    expect(apply).toHaveBeenCalledWith(jane);
    expect(heading("How much?")).toBeInTheDocument();
    expect(screen.getByText("Step 5 of 6")).toBeInTheDocument();
  });
});

describe("SendFlow — saved recipients list", () => {
  const all = [jane, janeMobile, kito, ade];
  const open = () => {
    render(<SendFlow {...baseProps({ savedRecipients: all })} />);
    click("All 4 recipients");
  };
  const names = () =>
    screen
      .getAllByRole("listitem")
      .map((li) => li.textContent || "")
      .map((text) => (text.startsWith("JM") ? "Jane" : text.startsWith("KL") ? "Kito" : "Ade"));

  it("lists every recipient, most recent first", () => {
    open();
    expect(heading("Saved recipients")).toBeInTheDocument();
    expect(screen.getByText("4 recipients")).toBeInTheDocument();
    expect(names()).toEqual(["Kito", "Jane", "Jane", "Ade"]);
  });

  it("filters by method and counts what is left", () => {
    open();
    click("Stablecoin");
    expect(screen.getByText("1 of 4 recipients")).toBeInTheDocument();
    expect(names()).toEqual(["Kito"]);
    expect(screen.getByRole("button", { name: "Stablecoin" })).toHaveAttribute("aria-pressed", "true");
  });

  it("sorts A to Z on request", () => {
    open();
    click("Sorted by recent");
    expect(screen.getByRole("button", { name: "Sorted A to Z" })).toBeInTheDocument();
    expect(names()).toEqual(["Ade", "Jane", "Jane", "Kito"]);
  });

  it("searches by account number and explains an empty result", () => {
    open();
    const box = screen.getByRole("searchbox", { name: "Search saved recipients" });
    fireEvent.change(box, { target: { value: "0099887766" } });
    expect(names()).toEqual(["Ade"]);
    fireEvent.change(box, { target: { value: "nobody" } });
    expect(screen.getByText(/No saved recipient matches/)).toBeInTheDocument();
  });

  it("carries the search typed on step 1 into the list", () => {
    render(<SendFlow {...baseProps({ savedRecipients: all })} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search recipients" }), { target: { value: "jane" } });
    click("See all 2 matches");
    expect(screen.getByRole("searchbox", { name: "Search saved recipients" })).toHaveValue("jane");
    expect(screen.getByText("2 of 4 recipients")).toBeInTheDocument();
  });

  it("picks a recipient from the list and goes back with Back", () => {
    const apply = vi.fn();
    render(<SendFlow {...baseProps({ savedRecipients: all, onSelectSavedRecipient: apply })} />);
    click("All 4 recipients");
    click(/Back/);
    expect(heading("Send money")).toBeInTheDocument();
    click("All 4 recipients");
    click(/Ade Okafor/);
    expect(apply).toHaveBeenCalledWith(ade);
    expect(heading("How much?")).toBeInTheDocument();
  });
});

describe("SendFlow — bank and mobile money steps", () => {
  it("asks one question per screen and never sends a default country or bank", () => {
    const selectCountry = vi.fn();
    const selectProvider = vi.fn();
    render(<SendFlow {...baseProps({ selectSendCountry: selectCountry, selectSendProvider: selectProvider })} />);
    click(/Bank account/);
    expect(screen.getByRole("button", { name: "Country: Select a country" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    choose(/^Country:/, /Nigeria/);
    expect(selectCountry).toHaveBeenCalledWith(1);
    click("Continue");

    expect(heading("Which bank?")).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 6")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bank: Select a bank" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    choose(/^Bank:/, "Equity Bank");
    expect(selectProvider).toHaveBeenCalledWith(1);
    click("Continue");

    expect(heading("Who gets it?")).toBeInTheDocument();
    click("Continue");
    expect(heading("How much?")).toBeInTheDocument();
    expect(screen.getByText("Step 5 of 6")).toBeInTheDocument();
  });

  it("offers the countries of saved recipients as shortcuts", () => {
    const selectCountry = vi.fn();
    render(<SendFlow {...baseProps({ savedRecipients: [ade], selectSendCountry: selectCountry })} />);
    click(/Bank account/);
    expect(screen.getByText("From your saved recipients")).toBeInTheDocument();
    click("Nigeria");
    expect(selectCountry).toHaveBeenCalledWith(1);
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("shows the catalog error with a retry on the country step", () => {
    const retry = vi.fn();
    render(
      <SendFlow
        {...baseProps({ sendCountryChips: [], sendCatalogError: "Network down.", onRetrySendCatalog: retry })}
      />,
    );
    click(/Bank account/);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn’t load destination countries. Network down.");
    click("Retry");
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("uses provider wording for mobile money", () => {
    render(
      <SendFlow
        {...baseProps({
          sendMethodKey: "mobile",
          sendIsBankRail: false,
          sendIsMobileRail: true,
          sendProviderOptions: ["M-Pesa", "Airtel Money"],
          sendRecipientLabel: "Phone number",
        })}
      />,
    );
    click(/Mobile money/);
    expect(screen.getByText(/Where the wallet is registered/)).toBeInTheDocument();
    choose(/^Country:/, /Kenya/);
    click("Continue");
    expect(heading("Which provider?")).toBeInTheDocument();
    choose(/^Provider:/, "M-Pesa");
    click("Continue");
    expect(screen.getByLabelText("Phone number")).toBeInTheDocument();
    expect(screen.getByLabelText("Registered name")).toBeInTheDocument();
  });

  it("lets the account step be reached when the country has no bank list", () => {
    render(<SendFlow {...baseProps({ sendProviderOptions: [] })} />);
    click(/Bank account/);
    choose(/^Country:/, /Kenya/);
    click("Continue");
    expect(screen.getByRole("status")).toHaveTextContent("There’s no bank to choose for Kenya");
    click("Continue");
    expect(heading("Who gets it?")).toBeInTheDocument();
  });

  it("keeps Continue disabled on the account step until name and number are filled", () => {
    render(<SendFlow {...baseProps({ sendRecipientName: "" })} />);
    toBankAccount();
    expect(screen.getByLabelText("Name on the account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("lets a chosen step be changed from its chip", () => {
    render(<SendFlow {...baseProps()} />);
    toBankAccount();
    click("Change bank");
    expect(heading("Which bank?")).toBeInTheDocument();
    click("Change country");
    expect(heading("Which country?")).toBeInTheDocument();
    click("Change payment method");
    expect(heading("Send money")).toBeInTheDocument();
  });
});

describe("SendFlow — saving a new recipient", () => {
  it("saves the recipient on Continue while the box is ticked", () => {
    const save = vi.fn();
    render(<SendFlow {...baseProps({ onSaveRecipientDetails: save })} />);
    toBankAccount();
    expect(screen.getByRole("checkbox", { name: "Save to recipients for next time" })).toBeChecked();
    click("Continue");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does not save when the box is unticked", () => {
    const save = vi.fn();
    render(<SendFlow {...baseProps({ onSaveRecipientDetails: save })} />);
    toBankAccount();
    fireEvent.click(screen.getByRole("checkbox", { name: "Save to recipients for next time" }));
    click("Continue");
    expect(save).not.toHaveBeenCalled();
    expect(heading("How much?")).toBeInTheDocument();
  });

  it("does not save an account that is already in the list", () => {
    const save = vi.fn();
    render(<SendFlow {...baseProps({ onSaveRecipientDetails: save, savedRecipients: [jane] })} />);
    toBankAccount();
    click("Continue");
    expect(save).not.toHaveBeenCalled();
  });
});

describe("SendFlow — amount", () => {
  it("fetches the quote from Continue once an amount is entered", () => {
    const review = vi.fn();
    render(<SendFlow {...baseProps({ sendReview: review })} />);
    toBankAmount();
    expect(screen.getByLabelText("Amount (USD)")).toHaveValue("500");
    click("Continue");
    expect(review).toHaveBeenCalledTimes(1);
  });

  it("disables Continue with no amount", () => {
    render(<SendFlow {...baseProps({ sendAmount: "" })} />);
    toBankAmount();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("shows a balance or limit problem and offers the most that can be sent", () => {
    const max = vi.fn();
    render(
      <SendFlow
        {...baseProps({ sendLimitError: "You have 900.00 USDT.", sendMaxAmount: "900.00", onMaxSendAmount: max })}
      />,
    );
    toBankAmount();
    expect(screen.getByText("You have 900.00 USDT.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    const button = screen.getByRole("button", { name: "Send the maximum of 900.00 USD" });
    expect(button).toHaveTextContent("Send 900.00 instead");
    fireEvent.click(button);
    expect(max).toHaveBeenCalledTimes(1);
  });

  it("hides the maximum when there is no handler for it", () => {
    render(<SendFlow {...baseProps({ sendMaxAmount: "900.00" })} />);
    toBankAmount();
    expect(screen.queryByRole("button", { name: /maximum/ })).toBeNull();
  });

  it("labels the equivalent by direction", () => {
    const { unmount } = render(<SendFlow {...baseProps({ sendAmountEquivalent: "≈ 64,600.00 KES" })} />);
    toBankAmount();
    expect(screen.getByText("Jane gets")).toBeInTheDocument();
    unmount();
    render(
      <SendFlow
        {...baseProps({ sendAmountEquivalent: "≈ 3.87 USD", sendAmountCurrency: "KES", sendCanEnterLocal: true })}
      />,
    );
    toBankAmount();
    expect(screen.getByRole("button", { name: "KES" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText(/You send/).length).toBeGreaterThan(1);
  });

  it("shows the quote error and offers help when it says to contact support", () => {
    const help = vi.fn();
    render(
      <SendFlow {...baseProps({ sendQuoteError: "Limit reached. Contact support.", onContactSupport: help })} />,
    );
    toBankAmount();
    expect(screen.getByText("Limit reached. Contact support.")).toBeInTheDocument();
    click("Get help");
    expect(help).toHaveBeenCalledTimes(1);
  });

  it("offers the other saved ways to pay the same recipient", () => {
    const apply = vi.fn();
    render(<SendFlow {...baseProps({ savedRecipients: [jane, janeMobile, ade], onSelectSavedRecipient: apply })} />);
    click("All 3 recipients");
    click(/Bank · KCB Bank/);
    expect(apply).toHaveBeenLastCalledWith(jane);
    click(/^Pay to:/);
    expect(screen.getAllByRole("option")).toHaveLength(2);
    fireEvent.click(screen.getByRole("option", { name: /Mobile money · M-Pesa/ }));
    expect(heading("How much?")).toBeInTheDocument();
  });

  it("has no Pay to picker for a recipient with one saved route", () => {
    render(<SendFlow {...baseProps({ savedRecipients: [jane, ade] })} />);
    click("All 2 recipients");
    click(/Ade Okafor/);
    expect(screen.queryByRole("button", { name: /^Pay to:/ })).toBeNull();
  });

  it("goes back to step 1 from a saved recipient, and to the account step otherwise", () => {
    const { unmount } = render(<SendFlow {...baseProps({ savedRecipients: [jane] })} />);
    click(/Jane Mukami/);
    click(/Back/);
    expect(heading("Send money")).toBeInTheDocument();
    unmount();
    render(<SendFlow {...baseProps()} />);
    toBankAmount();
    click(/Back/);
    expect(heading("Who gets it?")).toBeInTheDocument();
  });
});

describe("SendFlow — stablecoin", () => {
  const twoAssets = [
    { key: "usdc", label: "USDC", select: vi.fn(), selected: true },
    { key: "usdt", label: "USDT", select: vi.fn(), selected: false },
  ];

  it("asks for the stablecoin, then the network, and warns about the wrong network", () => {
    const selectBase = vi.fn();
    const chains = [
      { key: "base", label: "Base", select: selectBase, selected: false },
      { key: "stellar", label: "Stellar", select: vi.fn(), selected: true },
    ];
    render(<SendFlow {...cryptoProps({ sendAssets: twoAssets, sendChains: chains })} />);
    click(/Stablecoins/);
    expect(heading("Which stablecoin?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    choose(/^Stablecoin:/, "USDT");
    expect(twoAssets[1]?.select).toHaveBeenCalledTimes(1);
    click("Continue");

    expect(heading("Which network?")).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("wrong network can lose funds");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    choose(/^Network:/, "Base");
    expect(selectBase).toHaveBeenCalledTimes(1);
    click("Continue");
    expect(heading("Who gets it?")).toBeInTheDocument();
  });

  it("skips the choice when only one stablecoin is on offer", () => {
    render(<SendFlow {...cryptoProps()} />);
    click(/Stablecoins/);
    expect(screen.getByRole("button", { name: "Stablecoin: USDC" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  function toWallet(overrides = {}) {
    render(<SendFlow {...cryptoProps(overrides)} />);
    click(/Stablecoins/);
    click("Continue");
    choose(/^Network:/, "Stellar");
    click("Continue");
  }

  it("asks for a wallet address, an optional name and a memo on Stellar", () => {
    toWallet();
    expect(screen.getByLabelText("Wallet address")).toHaveValue("GABC…XYZ");
    expect(screen.getByLabelText("Name for this wallet (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Memo (optional)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("hides the memo on a network that ignores it", () => {
    toWallet({ sendMemoApplies: false });
    expect(screen.queryByLabelText("Memo (optional)")).toBeNull();
  });

  it("does not save a wallet that has no name", () => {
    const save = vi.fn();
    toWallet({ onSaveRecipientDetails: save });
    click("Continue");
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Amount (USDC)")).toBeInTheDocument();
  });

  it("says there is no wallet to send from when no network is ready", () => {
    render(<SendFlow {...cryptoProps({ sendChains: [] })} />);
    click(/Stablecoins/);
    click("Continue");
    expect(screen.getByRole("status")).toHaveTextContent("No ready USDC wallet to send from");
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });
});

describe("SendFlow — check and send", () => {
  const review = { sendStepIs1: false, sendStepIs3: true };

  it("shows both amounts, the rate and fee, and sends from the named button", () => {
    const submit = vi.fn();
    render(<SendFlow {...baseProps({ ...review, submitSend: submit })} />);
    expect(heading("Check and send")).toBeInTheDocument();
    expect(screen.getByText("Step 6 of 6")).toBeInTheDocument();
    expect(screen.getByText("Jane gets")).toBeInTheDocument();
    expect(screen.getByText("1 USD = 129.20 KES")).toBeInTheDocument();
    expect(screen.getByText("3.00 USD")).toBeInTheDocument();
    click("Send 503.00 USDT");
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("shows the backend's total debit on a stablecoin send, never a client-side sum", () => {
    const { unmount } = render(<SendFlow {...cryptoProps({ ...review, sendTotalDebitText: "10.5 USDC" })} />);
    expect(screen.getByRole("button", { name: "Send 10.5 USDC" })).toBeInTheDocument();
    unmount();
    render(<SendFlow {...cryptoProps(review)} />);
    expect(screen.getByText("Shown once confirmed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send 10 USDC" })).toBeInTheDocument();
  });

  it("shows the memo once entered", () => {
    render(<SendFlow {...cryptoProps({ ...review, sendMemo: " 4471 " })} />);
    expect(screen.getByText("4471")).toBeInTheDocument();
  });

  it("shows why the send was not accepted", () => {
    render(<SendFlow {...baseProps({ ...review, sendAcceptError: "Quote expired." })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Quote expired.");
  });

  it("goes back through the parent's handler", () => {
    const back = vi.fn();
    render(<SendFlow {...baseProps({ ...review, sendBack: back })} />);
    click(/Back/);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("counts down how long the rate is held, then says it has run out", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T12:00:00Z"));
    render(<SendFlow {...baseProps({ ...review, sendQuoteExpiresAt: "2026-11-23T12:01:24Z" })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Rate held for 1:24");
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Rate held for 1:04");
    act(() => {
      vi.advanceTimersByTime(70_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("This rate has run out");
  });

  it("shows no countdown when the quote carries no expiry", () => {
    render(<SendFlow {...baseProps(review)} />);
    expect(screen.queryByText(/Rate held/)).toBeNull();
  });
});

describe("SendFlow — after sending", () => {
  const review = { sendStepIs1: false, sendStepIs3: true };
  const done = { ...review, sendNotDone: false, sendDone: true, sendOrderId: "4821" };

  it("shows the sending state, which can be closed without stopping the payment", () => {
    const close = vi.fn();
    render(<SendFlow {...baseProps({ ...review, sendAccepting: true, closeModal: close })} />);
    expect(heading("Sending your payment")).toBeInTheDocument();
    expect(screen.getByText("64600.00 KES to Jane Mukami")).toBeInTheDocument();
    expect(screen.queryByText(/Step \d of 6/)).toBeNull();
    click("Close, it keeps going");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("says a payment is almost there and points to Transactions", () => {
    const transactions = vi.fn();
    render(<SendFlow {...baseProps({ ...done, onViewTransactions: transactions })} />);
    expect(heading("Almost there")).toBeInTheDocument();
    expect(screen.getByText(/on its way to Jane\. KCB Bank is still processing it/)).toBeInTheDocument();
    click("Follow it in Transactions");
    expect(transactions).toHaveBeenCalledTimes(1);
  });

  it("marks a processing receipt as not yet delivered", () => {
    render(<SendFlow {...baseProps(done)} />);
    click("View receipt");
    expect(heading("Payment receipt")).toBeInTheDocument();
    expect(screen.getByText("Processing")).toBeInTheDocument();
    expect(screen.getByText("Amount beneficiary will receive")).toBeInTheDocument();
    expect(screen.getByText(/does not confirm delivery/)).toBeInTheDocument();
  });

  it("confirms a delivered payment and closes from Done", () => {
    const close = vi.fn();
    render(<SendFlow {...baseProps({ ...done, sendOutcome: "delivered", closeModal: close })} />);
    expect(heading("All done")).toBeInTheDocument();
    expect(screen.getByText("Jane received 64600.00 KES.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Follow it in Transactions" })).toBeNull();
    click("Done");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("opens a receipt with the payment laid out, and copies or downloads it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <SendFlow {...baseProps({ ...done, sendOutcome: "delivered", sendUpdatedAt: "2026-11-20T14:05:00Z" })} />,
    );
    click("View receipt");
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Receipt no.")).toBeInTheDocument();
    expect(screen.getAllByText("4821").length).toBe(2);
    expect(screen.getByText("KCB Bank, Kenya")).toBeInTheDocument();
    expect(screen.getByText("1234567890")).toBeInTheDocument();
    expect(screen.getByText("500 USD")).toBeInTheDocument();
    expect(screen.getByText("Bank transfer")).toBeInTheDocument();
    expect(screen.getByText("Amount received by beneficiary")).toBeInTheDocument();

    click("Copy details");
    expect(await screen.findByText("Details copied")).toBeInTheDocument();
    const text = String(writeText.mock.calls[0]?.[0]);
    expect(text).toContain("Mboka payment receipt 4821");
    expect(text).toContain("64600.00 KES to Jane Mukami");
    expect(text).toContain("Total debited: 503.00 USDT");

    click("Download PDF");
    expect(pdf.build).toHaveBeenCalledWith(expect.objectContaining({ statusBadge: "Paid" }), "mboka-receipt-4821");
    expect(pdf.download).toHaveBeenCalledTimes(1);

    click("Close receipt");
    expect(heading("All done")).toBeInTheDocument();
  });

  it("says so when the details can't be copied", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    render(<SendFlow {...baseProps({ ...done, sendOutcome: "delivered" })} />);
    click("View receipt");
    click("Copy details");
    expect(await screen.findByText("Couldn’t copy the details")).toBeInTheDocument();
  });

  it("offers Fix the details and help on a failed payment, without claiming a refund", () => {
    const retry = vi.fn();
    const help = vi.fn();
    render(
      <SendFlow {...baseProps({ ...done, sendOutcome: "failed", sendRetry: retry, onContactSupport: help })} />,
    );
    expect(heading("That didn’t go through")).toBeInTheDocument();
    expect(screen.getByText(/wasn’t delivered\. Check the details and try again/)).toBeInTheDocument();
    expect(screen.queryByText(/is back in/)).toBeNull();
    expect(screen.queryByRole("button", { name: "View receipt" })).toBeNull();
    click("Get help");
    expect(help).toHaveBeenCalledTimes(1);
    click("Fix the details");
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("says the money is back only when the order is refunded", () => {
    render(<SendFlow {...baseProps({ ...done, sendOutcome: "refunded" })} />);
    expect(screen.getByText(/Your 503.00 USDT is back in USDT · Polygon/)).toBeInTheDocument();
  });

  it("shows the backend's reason for a failed payment when it has one", () => {
    render(
      <SendFlow
        {...baseProps({
          ...done,
          sendOutcome: "failed",
          sendFailureMessage: "KCB Bank could not find that account.",
        })}
      />,
    );
    expect(screen.getByText("KCB Bank could not find that account.")).toBeInTheDocument();
    expect(screen.queryByText(/Check the details and try again/)).toBeNull();
    expect(screen.queryByText(/is back in/)).toBeNull();
  });

  it("says exactly what came back when a refund is in another currency", () => {
    render(
      <SendFlow
        {...baseProps({
          ...done,
          sendOutcome: "refunded",
          sendFailureMessage: "The recipient name does not match the account holder.",
          sendRefundText: "99.50 USDT",
        })}
      />,
    );
    expect(
      screen.getByText(
        "The recipient name does not match the account holder. Your 99.50 USDT is back in your account.",
      ),
    ).toBeInTheDocument();
  });

  it("links to the explorer for a stablecoin send", () => {
    render(
      <SendFlow
        {...cryptoProps({ ...done, sendOutcome: "delivered", sendExplorerUrl: "https://stellar.expert/tx/abc" })}
      />,
    );
    expect(screen.getByRole("link", { name: /View onchain/ })).toHaveAttribute(
      "href",
      "https://stellar.expert/tx/abc",
    );
    click("View receipt");
    expect(screen.getByText("USDC on Stellar")).toBeInTheDocument();
    expect(screen.getByText("Stablecoin")).toBeInTheDocument();
  });
});

describe("payout rails", () => {
  it("names the choices as transfer types and collects the rail's extra fields", () => {
    const setExtra = vi.fn();
    render(
      <SendFlow
        {...baseProps({
          sendProviderIsRail: true,
          sendProviderOptions: ["ACH", "Wire transfer"],
          sendRecipient: "1234567890",
          sendRecipientName: "Jane Mukami",
          sendExtraFields: [
            { key: "routing_number", label: "Routing number", placeholder: "9 digits", value: "" },
            { key: "bank_name", label: "Bank name", value: "Chase" },
          ],
          setSendExtraField: setExtra,
        })}
      />,
    );
    click(/Bank account/);
    choose(/^Country:/, /Kenya/);
    click("Continue");
    expect(heading("How should it be sent?")).toBeInTheDocument();
    choose(/^Transfer type:/, "ACH");
    click("Continue");

    expect(heading("Who gets it?")).toBeInTheDocument();
    const routing = screen.getByPlaceholderText("9 digits");
    fireEvent.change(routing, { target: { value: "021000021" } });
    expect(setExtra).toHaveBeenCalledWith("routing_number", "021000021");
    // An empty rail field keeps the step from continuing.
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});

describe("live breakdown on the amount step", () => {
  const rows = [
    { key: "rate", label: "Exchange rate", value: "1 USDC = 129.58 KES" },
    { key: "fee", label: "Fee", value: "0.0849 USDC" },
    { key: "receive", label: "Jane receives", value: "≈ 636.90 KES", strong: true },
    { key: "total", label: "Total deducted", value: "5.00 USDC", strong: true, divider: true },
  ];
  const headline = { label: "Jane receives", value: "636.90 KES" };

  function toAmount(extra: Record<string, unknown>) {
    render(
      <SendFlow
        {...baseProps({
          sendRecipient: "1234567890",
          sendRecipientName: "Jane Mukami",
          sendAmount: "5",
          ...extra,
        })}
      />,
    );
    toBankAccount();
    click("Continue");
    expect(heading("How much?")).toBeInTheDocument();
  }

  it("shows what they receive, the rate, the fee and the total as the amount is typed", () => {
    toAmount({ sendBreakdown: { rows, headline, pending: false, error: null } });
    const card = screen.getByRole("region", { name: "Price breakdown" });
    expect(card).toHaveTextContent("Exchange rate1 USDC = 129.58 KES");
    expect(card).toHaveTextContent("Fee0.0849 USDC");
    expect(card).toHaveTextContent("Total deducted5.00 USDC");
    expect(card).toHaveTextContent("Estimate · locked on the next step");
    // The receive figure is also the large headline under the amount.
    expect(screen.getAllByText(/Jane receives/).length).toBeGreaterThan(1);
  });

  it("says it is working before the first figure arrives", () => {
    toAmount({ sendBreakdown: { rows: [], headline: null, pending: true, error: null } });
    expect(screen.getByText("Working out the fee and rate…")).toBeInTheDocument();
  });

  it("takes an optional reference and shows it on the review", () => {
    const setReference = vi.fn();
    toAmount({ sendReference: "INV-0042", setSendReference: setReference });
    const input = screen.getByPlaceholderText("e.g. INV-0042");
    fireEvent.change(input, { target: { value: "INV-0043" } });
    expect(setReference).toHaveBeenCalled();
  });
});

describe("pay-from account list", () => {
  it("says the list did not load, not that there are no accounts, and offers a retry", () => {
    const retry = vi.fn();
    const message = "We couldn’t load your accounts just now. Try again in a moment.";
    render(
      <SendFlow
        {...baseProps({
          sendRecipient: "1234567890",
          sendRecipientName: "Jane Mukami",
          sendRefundWalletsError: message,
          onRetrySendRefundWallets: retry,
          sendQuoteError: message,
        })}
      />,
    );
    toBankAccount();
    click("Continue");
    expect(screen.getAllByText(message)).toHaveLength(1);
    expect(screen.queryByText(/You have no account to pay from yet/)).not.toBeInTheDocument();
    click("Try again");
    expect(retry).toHaveBeenCalled();
  });
});

