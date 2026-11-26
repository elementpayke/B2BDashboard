// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DepositFlow from "./DepositFlow";
import { baseProps, reviewProps } from "./DepositFlow.fixtures";
import type { DepositFlowProps } from "./types";

const clip = vi.hoisted(() => ({ copyText: vi.fn(async () => true) }));
vi.mock("@/lib/clipboard", () => clip);

const wallet = vi.hoisted(() => ({
  state: {
    address: null as string | null,
    amount: "",
    setAmount: vi.fn(),
    busy: null as "connect" | "send" | null,
    error: null as string | null,
    hash: null as string | null,
    canSend: false,
    amountHint: null as string | null,
    explorerUrl: null as string | null,
    phase: "submitted" as "submitted" | "processing" | "credited" | "timed_out",
    message: "",
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    reset: vi.fn(),
  },
}));
vi.mock("@/lib/hooks/useStellarWalletDeposit", () => ({
  useStellarWalletDeposit: () => wallet.state,
}));

const pr = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
}));
vi.mock("@/lib/services/paymentRequests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/paymentRequests")>();
  return { ...actual, paymentRequestsApi: { ...actual.paymentRequestsApi, create: pr.create, get: pr.get } };
});

beforeEach(() => {
  wallet.state = { ...wallet.state, address: null, hash: null, busy: null, error: null, canSend: false };
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

function renderFlow(props: DepositFlowProps) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DepositFlow {...props} />
    </QueryClientProvider>,
  );
}

const click = (name: RegExp | string) => fireEvent.click(screen.getByRole("button", { name }));
const title = () => screen.getByRole("heading", { level: 1 });

describe("DepositFlow — which account", () => {
  it("opens on the account step with each wallet and its balance, — when it didn't load", () => {
    renderFlow(baseProps());
    expect(title()).toHaveTextContent("Add money");
    expect(screen.getByText("Which account are you funding?")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
    const base = screen.getByRole("button", { name: /USDC wallet · Base/ });
    expect(base).toHaveTextContent("1,240.50 USDC");
    expect(screen.getByRole("button", { name: /USDC wallet · Stellar/ })).toHaveTextContent("—");
  });

  it("selects the wallet and moves on to the method", () => {
    const selectWallet = vi.fn();
    renderFlow(baseProps({ selectWallet }));
    click(/USDC wallet · Stellar/);
    expect(selectWallet).toHaveBeenCalledWith("w-stellar");
    expect(screen.getByText("How is the money coming in?")).toBeInTheDocument();
  });

  it("skips the account step when opened from inside an account", () => {
    renderFlow(baseProps({ walletLocked: true }));
    expect(screen.getByText("How is the money coming in?")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Change account/ })).not.toBeInTheDocument();
  });

  it("shows loading, then an error with a retry, instead of an empty list", () => {
    const { unmount } = renderFlow(baseProps({ walletOptions: [], walletsLoading: true }));
    expect(screen.getByRole("status", { name: "Loading accounts" })).toBeInTheDocument();
    unmount();
    const onRetryWallets = vi.fn();
    renderFlow(baseProps({ walletOptions: [], walletsError: "Couldn't load your accounts.", onRetryWallets }));
    expect(screen.getByText("Couldn't load your accounts.")).toBeInTheDocument();
    click("Try again");
    expect(onRetryWallets).toHaveBeenCalled();
  });

  it("lists CAD accounts that take Interac", () => {
    renderFlow(baseProps({ interacAccounts: [{ id: "cad-1", entityId: "e1", label: "CAD account", balanceText: "40.00 CAD" }] }));
    expect(screen.getByRole("button", { name: /CAD account/ })).toHaveTextContent("Fund by Interac e-Transfer");
  });
});

describe("DepositFlow — how is the money coming in", () => {
  it("offers mobile money, bank transfer and stablecoin, with the chosen account as a chip", () => {
    renderFlow(baseProps({ walletLocked: false }));
    click(/USDC wallet · Base/);
    expect(screen.getByRole("button", { name: /Mobile money/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Bank transfer/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stablecoin/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Interac/ })).not.toBeInTheDocument();
    click("Change account");
    expect(screen.getByText("Which account are you funding?")).toBeInTheDocument();
  });

  it("moves mobile money onto the country corridor", () => {
    const setGroup = vi.fn();
    renderFlow(baseProps({ walletLocked: true, setGroup }));
    click(/Mobile money/);
    expect(setGroup).toHaveBeenCalledWith("country");
    expect(title()).toHaveTextContent("Which country?");
  });

  it("offers only Interac for a CAD account", () => {
    renderFlow(baseProps({ interacAccounts: [{ id: "cad-1", entityId: "e1", label: "CAD account" }] }));
    click(/CAD account/);
    expect(screen.getByRole("button", { name: /Interac e-Transfer/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mobile money/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Stablecoin/ })).not.toBeInTheDocument();
  });
});

describe("DepositFlow — country and provider", () => {
  function toCountry(method: RegExp, overrides: Partial<DepositFlowProps> = {}) {
    renderFlow(baseProps({ walletLocked: true, ...overrides }));
    click(method);
  }

  it("lists only countries that take the chosen method", () => {
    toCountry(/Mobile money/);
    expect(screen.getByRole("button", { name: /Kenya/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nigeria/ })).not.toBeInTheDocument();
  });

  it("searches by country, currency or provider and says when nothing matches", () => {
    toCountry(/Bank transfer/);
    const search = screen.getByRole("searchbox", { name: "Search country or currency" });
    fireEvent.change(search, { target: { value: "ngn" } });
    expect(screen.getByRole("button", { name: /Nigeria/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Kenya/ })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText(/No country matches/)).toBeInTheDocument();
  });

  it("shows the catalogue error with a retry, not an empty search", () => {
    const onRetryCatalog = vi.fn();
    toCountry(/Mobile money/, { countryRows: [], catalogError: "Couldn't load countries.", onRetryCatalog });
    expect(screen.getByText("Couldn't load countries.")).toBeInTheDocument();
    click("Try again");
    expect(onRetryCatalog).toHaveBeenCalled();
  });

  it("picks the country, then the provider, then moves the parent to the amount step", () => {
    const selectKenya = vi.fn();
    const selectMpesa = vi.fn();
    const next = vi.fn();
    const props = baseProps();
    toCountry(/Mobile money/, {
      next,
      countryRows: props.countryRows.map((r) => (r.idx === 0 ? { ...r, select: selectKenya } : r)),
      railGroups: props.railGroups.map((g) =>
        g.type === "mobile"
          ? { ...g, providers: g.providers.map((p, i) => (i === 0 ? { ...p, select: selectMpesa } : p)) }
          : g,
      ),
    });
    click(/Kenya/);
    expect(selectKenya).toHaveBeenCalled();
    expect(title()).toHaveTextContent("Which provider?");
    expect(screen.queryByRole("button", { name: /KCB Bank/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    click(/M-Pesa/);
    expect(selectMpesa).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("continues to the amount once a provider is selected", () => {
    const next = vi.fn();
    const props = baseProps();
    toCountry(/Mobile money/, {
      next,
      railGroups: props.railGroups.map((g) =>
        g.type === "mobile" ? { ...g, providers: g.providers.map((p, i) => ({ ...p, selected: i === 0 })) } : g,
      ),
    });
    click(/Kenya/);
    click("Continue");
    expect(next).toHaveBeenCalled();
  });

  it("uses a searchable dropdown for a long bank list, with Continue right under it", () => {
    const next = vi.fn();
    const pick = vi.fn();
    const banks = Array.from({ length: 9 }, (_, i) => ({
      name: `Bank ${String.fromCharCode(65 + i)}`,
      selected: false,
      select: i === 4 ? pick : vi.fn(),
    }));
    toCountry(/Bank transfer/, {
      next,
      railGroups: [{ railIdx: 1, type: "bank", label: "Bank transfer", providers: banks }],
    });
    click(/Kenya/);
    expect(screen.queryByRole("button", { name: /Bank A/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Min KES 100 · Max KES 150,000/)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /^Bank:/ }));
    fireEvent.click(screen.getByRole("option", { name: "Bank E" }));
    expect(pick).toHaveBeenCalled();
  });

  it("uses bank wording and lists banks for a bank transfer", () => {
    toCountry(/Bank transfer/);
    click(/Kenya/);
    expect(title()).toHaveTextContent("Which bank?");
    expect(screen.getByRole("button", { name: /KCB Bank/ })).toBeInTheDocument();
  });
});

describe("DepositFlow — how much", () => {
  const amountProps = (o: Partial<DepositFlowProps> = {}) => baseProps({ walletLocked: true, stepIs2: true, ...o });

  it("asks for the number to charge and the amount, with the limits", () => {
    renderFlow(amountProps());
    expect(title()).toHaveTextContent("How much?");
    expect(screen.getByLabelText(/M-Pesa number to charge/)).toBeInTheDocument();
    expect(screen.getByText("+254")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount (KES)")).toBeInTheDocument();
    expect(screen.getByText("Min KES 100 · Max KES 150,000")).toBeInTheDocument();
    expect(screen.getByText(/fee and rate are shown on the next step/i)).toBeInTheDocument();
  });

  it("keeps Continue off until both are filled, then fetches the quote", () => {
    const next = vi.fn();
    const { unmount } = renderFlow(amountProps({ next }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    unmount();
    renderFlow(amountProps({ next, phone: "712345678", amount: "13000" }));
    click("Continue");
    expect(next).toHaveBeenCalled();
  });

  it("shows a limit problem and the quote error, and blocks Continue on the limit", () => {
    renderFlow(amountProps({ phone: "712345678", amount: "50", limitError: "The minimum is KES 100.", quoteError: "Rates are unavailable." }));
    expect(screen.getByText("The minimum is KES 100.")).toBeInTheDocument();
    expect(screen.getByText("Rates are unavailable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("says it's getting the quote while it loads", () => {
    renderFlow(amountProps({ phone: "712345678", amount: "13000", quoteLoading: true }));
    expect(screen.getByRole("button", { name: /Getting quote/ })).toBeDisabled();
  });

  it("goes back through the parent's handler", () => {
    const back = vi.fn();
    renderFlow(amountProps({ back }));
    click(/Back/);
    expect(back).toHaveBeenCalled();
  });
});

describe("DepositFlow — check and pay", () => {
  it("shows both amounts, fee, rate, from and into, and pays from the named button", () => {
    const submit = vi.fn();
    renderFlow(reviewProps({ submit }));
    expect(title()).toHaveTextContent("Check and pay");
    const summary = screen.getByRole("region", { name: "Top-up summary" });
    expect(within(summary).getByText("You pay")).toBeInTheDocument();
    expect(within(summary).getByText("13,000.00")).toBeInTheDocument();
    expect(within(summary).getByText("99.38")).toBeInTheDocument();
    expect(within(summary).getByText("130.00 KES")).toBeInTheDocument();
    expect(within(summary).getByText("1 USDC = 129.50 KES")).toBeInTheDocument();
    expect(within(summary).getByText("+254 712345678")).toBeInTheDocument();
    expect(within(summary).getByText("USDC wallet · Base")).toBeInTheDocument();
    click("Pay 13,000.00 KES");
    expect(submit).toHaveBeenCalled();
  });

  it("asks for bank details instead of paying on a bank transfer", () => {
    renderFlow(reviewProps({ providerLabel: "KCB Bank", railGroups: baseProps().railGroups.map((g) => ({ ...g, providers: g.providers.map((p) => ({ ...p, selected: g.type === "bank" })) })) }));
    expect(screen.getByRole("button", { name: "Get bank details" })).toBeInTheDocument();
  });

  it("shows why it wasn't accepted, and goes back", () => {
    const back = vi.fn();
    renderFlow(reviewProps({ back, acceptError: "This rate has expired." }));
    expect(screen.getByText("This rate has expired.")).toBeInTheDocument();
    click(/Back/);
    expect(back).toHaveBeenCalled();
  });

  it("counts down the held rate, then blocks paying once it runs out", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T10:00:00Z"));
    renderFlow(reviewProps({ quoteExpiresAt: "2026-11-25T10:00:42Z" }));
    expect(screen.getByText("0:42")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(43_000);
    });
    expect(screen.getByText(/rate has run out/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pay/ })).toBeDisabled();
  });
});

describe("DepositFlow — after paying", () => {
  const paid = (o: Partial<DepositFlowProps> = {}) => reviewProps({ stepIs3: false, done: true, ...o });

  it("asks the payer to check their phone while it's processing, and can be closed", () => {
    const close = vi.fn();
    renderFlow(paid({ outcome: "processing", close }));
    expect(title()).toHaveTextContent("Check your phone");
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getAllByText(/\+254 712345678/).length).toBeGreaterThan(0);
    click("Done");
    expect(close).toHaveBeenCalled();
  });

  it("confirms the money landed", () => {
    renderFlow(paid({ outcome: "received" }));
    expect(title()).toHaveTextContent("Money received");
    expect(screen.getByText("Settled")).toBeInTheDocument();
    expect(screen.getByText("+99.38")).toBeInTheDocument();
  });

  it("explains a failure, says no money was taken, and offers to try again", () => {
    const retry = vi.fn();
    renderFlow(paid({ outcome: "failed", failureMessage: "The request was cancelled by the user.", retry }));
    expect(title()).toHaveTextContent("Not completed");
    expect(screen.getByText("The request was cancelled by the user.")).toBeInTheDocument();
    expect(screen.getByText(/was charged anyway/)).toBeInTheDocument();
    click("Try again");
    expect(retry).toHaveBeenCalled();
  });

  it("shows the background convert for a fiat account", () => {
    renderFlow(paid({ outcome: "received", fundTargetCurrency: "EUR", fundConvertStatus: "Converting to EUR" }));
    expect(screen.getByText("Converting to EUR")).toBeInTheDocument();
  });

  it("lays out bank details with the fee, a copy per field and a required reference", async () => {
    const close = vi.fn();
    renderFlow(
      paid({
        close,
        providerLabel: "KCB Bank",
        railGroups: baseProps().railGroups.map((g) => ({ ...g, providers: g.providers.map((p) => ({ ...p, selected: g.type === "bank" })) })),
        bankLines: [
          { k: "Bank", v: "Equity Bank" },
          { k: "Account number", v: "0123456789" },
          { k: "Reference", v: "EP-4821" },
        ],
      }),
    );
    expect(title()).toHaveTextContent("Pay to these details");
    expect(screen.getByText(/Send exactly/)).toHaveTextContent("13,000.00 KES");
    expect(screen.getByText("Fees · paid by you")).toBeInTheDocument();
    expect(screen.getByText(/Reference · must be included/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy Account number" }));
    await waitFor(() => expect(clip.copyText).toHaveBeenCalledWith("0123456789"));
    expect(await screen.findByRole("button", { name: "Account number copied" })).toBeInTheDocument();
    click("I’ve sent it");
    expect(close).toHaveBeenCalled();
  });
});

describe("DepositFlow — stablecoin", () => {
  it("asks what's being sent, then fetches the address", () => {
    const setGroup = vi.fn();
    const next = vi.fn();
    const pickStellar = vi.fn();
    const props = baseProps();
    renderFlow(
      baseProps({
        walletLocked: true,
        setGroup,
        next,
        networks: props.networks.map((n) => (n.key === "stellar" ? { ...n, select: pickStellar } : n)),
      }),
    );
    click(/Stablecoin/);
    expect(setGroup).toHaveBeenCalledWith("crypto");
    expect(title()).toHaveTextContent("What are you sending?");
    expect(screen.getByRole("button", { name: "USDT" })).toBeInTheDocument();
    click(/USDC on Stellar/);
    expect(pickStellar).toHaveBeenCalled();
    click("Continue");
    expect(next).toHaveBeenCalled();
  });

  it("shows the address with a copy, a QR and the network warning, without wallet connect on Base", async () => {
    renderFlow(baseProps({ walletLocked: true, group: "crypto", stepIs2: true }));
    expect(title()).toHaveTextContent("Send USDC on Base here");
    expect(screen.getByText("0x9b44c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8")).toBeInTheDocument();
    expect(screen.getByText(/Only send USDC on Base/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Connect wallet" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/memo/i)).not.toBeInTheDocument();
    click("Copy address");
    await waitFor(() => expect(clip.copyText).toHaveBeenCalledWith("0x9b44c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8"));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("says so when copying fails", async () => {
    clip.copyText.mockResolvedValueOnce(false);
    renderFlow(baseProps({ walletLocked: true, group: "crypto", stepIs2: true }));
    click("Copy address");
    expect(await screen.findByText(/Couldn't copy/)).toBeInTheDocument();
  });

  it("offers wallet connect, an amount and a memo on Stellar", () => {
    renderFlow(
      baseProps({
        walletLocked: true,
        group: "crypto",
        stepIs2: true,
        networkKey: "stellar",
        networkLabel: "Stellar",
        address: "GDX4ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOP7QPL",
      }),
    );
    expect(screen.getByLabelText("Reference memo (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount (optional)")).toBeInTheDocument();
    click("Connect wallet");
    expect(wallet.state.connect).toHaveBeenCalled();
  });

  it("sends from a connected Stellar wallet and shows where it is", () => {
    wallet.state = { ...wallet.state, address: "GBQ7ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMN2KXM", canSend: true };
    const stellar = baseProps({
      walletLocked: true,
      group: "crypto",
      stepIs2: true,
      networkKey: "stellar",
      networkLabel: "Stellar",
      address: "GDX4ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOP7QPL",
    });
    const { unmount } = renderFlow(stellar);
    expect(screen.getByText(/connected/)).toBeInTheDocument();
    click(/^Send .* USDC$|^Send USDC$/);
    expect(wallet.state.send).toHaveBeenCalled();
    unmount();
    wallet.state = { ...wallet.state, hash: "abc123", phase: "processing", message: "Deposit received and is being processed." };
    renderFlow(stellar);
    expect(screen.getByText("Deposit received and is being processed.")).toBeInTheDocument();
  });

  it("says there's no address yet and offers to create the account", () => {
    const createAccount = vi.fn();
    renderFlow(baseProps({ walletLocked: true, group: "crypto", stepIs2: true, address: "", addressEmptyMessage: "No USDC wallet on Base yet.", createAccount, createAccountLabel: "Create USDC wallet" }));
    expect(screen.getByText("No USDC wallet on Base yet.")).toBeInTheDocument();
    click("Create USDC wallet");
    expect(createAccount).toHaveBeenCalled();
  });
});

describe("DepositFlow — Interac", () => {
  const cad = { id: "cad-1", entityId: "e1", label: "CAD account" };

  function toRequest(o: Partial<DepositFlowProps> = {}) {
    renderFlow(baseProps({ interacAccounts: [cad], interacPayerName: "Acme Ltd", interacDefaultEmail: "ops@acme.test", ...o }));
    click(/CAD account/);
    click(/Interac e-Transfer/);
  }

  it("fills in the user's email and sends the request with the business as payer", async () => {
    pr.create.mockResolvedValue({ id: "pr1", entity_id: "e1", account_id: "cad-1", method: "interac", status: "awaiting_payer", amount: "100.00", currency: "CAD", reference_number: "CA1111111111" });
    pr.get.mockResolvedValue({ id: "pr1", entity_id: "e1", account_id: "cad-1", method: "interac", status: "awaiting_payer", amount: "100.00", currency: "CAD", reference_number: "CA1111111111" });
    toRequest();
    expect(title()).toHaveTextContent("Fund by Interac");
    expect(screen.getByLabelText("Send the request to")).toHaveValue("ops@acme.test");
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Amount (CAD)"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "March top-up" } });
    click("Send request");
    await waitFor(() => expect(pr.create).toHaveBeenCalled());
    const [entityId, accountId, payload] = pr.create.mock.calls[0];
    expect(entityId).toBe("e1");
    expect(accountId).toBe("cad-1");
    expect(payload).toMatchObject({
      method: "interac",
      amount: "100.00",
      narration: "March top-up",
      payer: { name: "Acme Ltd", email: "ops@acme.test" },
    });
    expect(payload.client_ref).toMatch(/^pr-/);
    expect(payload.redirect_url).toMatch(/^https?:\/\//);
    expect(await screen.findByRole("heading", { level: 1, name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByText("CA1111111111")).toBeInTheDocument();
  });

  it("shows the backend's message when the request can't be created", async () => {
    pr.create.mockRejectedValue(new Error("Interac is unavailable for this account."));
    toRequest();
    fireEvent.change(screen.getByLabelText("Amount (CAD)"), { target: { value: "100" } });
    click("Send request");
    expect(await screen.findByText("Interac is unavailable for this account.")).toBeInTheDocument();
  });

  it("moves to received once the request settles", async () => {
    pr.create.mockResolvedValue({ id: "pr1", entity_id: "e1", account_id: "cad-1", method: "interac", status: "awaiting_payer", amount: "100.00", currency: "CAD" });
    pr.get.mockResolvedValue({ id: "pr1", entity_id: "e1", account_id: "cad-1", method: "interac", status: "settled", amount: "100.00", currency: "CAD" });
    toRequest();
    fireEvent.change(screen.getByLabelText("Amount (CAD)"), { target: { value: "100" } });
    click("Send request");
    expect(await screen.findByRole("heading", { level: 1, name: "Money received" }, { timeout: 3000 })).toBeInTheDocument();
  });
});
