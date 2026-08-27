// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SendModal, { type SendModalProps } from "./SendModal";

function cryptoStep1(overrides: Partial<SendModalProps> = {}): SendModalProps {
  const noop = () => {};
  return {
    sendNotDone: true,
    sendDone: false,
    sendMethodChosen: true,
    sendMethodOptions: [],
    resetSendMethod: noop,
    sendStepDots: [{ on: true }, { on: false }, { on: false }],
    sendStepIs1: true,
    sendStepIs2: false,
    sendStepIs3: false,
    sendIsCountry: false,
    sendIsCrypto: true,
    sendCountryChips: [],
    sendRailHasChoice: false,
    sendRailChips: [],
    sendProviderHasChoice: false,
    sendProviderChips: [],
    sendCatalogLoading: false,
    sendAssets: [{ key: "usdc", label: "USDC", select: noop, selected: true, bg: "", color: "" }],
    sendChains: [
      { key: "base", label: "Base", select: noop, selected: false, bg: "", border: "", color: "" },
      { key: "polygon", label: "Polygon", select: noop, selected: false, bg: "", border: "", color: "" },
      { key: "stellar", label: "Stellar", select: noop, selected: true, bg: "", border: "", color: "" },
    ],
    sendAssetCode: "USDC",
    sendChainLabel: "Stellar",
    sendNext: noop,
    sendBack: noop,
    sendDestinationSummary: "USDC · Stellar",
    sendCountryName: "Kenya",
    sendCountryFlagUrl: null,
    sendCurrencyCode: "KES",
    sendCurrencyName: "Kenyan Shilling",
    sendCountryIdx: 0,
    selectSendCountry: noop,
    sendProviderLabel: "Bank",
    sendProviderOptions: [],
    selectSendProvider: noop,
    sendProviderIdx: 0,
    sendIsBankRail: false,
    sendProvidersAreFallback: false,
    sendBlockedNoNetworkId: false,
    sendAmountCurrency: "USD",
    sendYouPayText: "",
    sendLocalCurrency: "KES",
    sendCanEnterLocal: false,
    setSendAmountCurrency: noop,
    sendAmountEquivalent: null,
    sendIndicativeRateLine: null,
    sendQuotedRateLine: null,
    savedRecipients: [],
    onSelectSavedRecipient: noop,
    onSaveRecipientDetails: noop,
    sendRecipientName: "",
    setSendRecipientName: noop,
    sendRecipientLabel: "Recipient wallet address",
    sendRecipient: "",
    setSendRecipient: noop,
    sendRecipientPlaceholder: "G… (Stellar public key)",
    sendAmount: "",
    setSendAmount: noop,
    sendQuoteError: "",
    sendQuoteLoading: false,
    sendQuoteRateText: null,
    sendFeeText: "",
    sendArrivalText: "",
    sendAcceptError: "",
    sendAccepting: false,
    submitSend: noop,
    sendResultText: null,
    sendLiveStatus: null,
    closeModal: noop,
    ...overrides,
  };
}

describe("SendModal stablecoin chain picker", () => {
  it("shows Stellar next to Base and Polygon and warns about USDC on Stellar", () => {
    render(<SendModal {...cryptoStep1()} />);
    expect(screen.getByRole("button", { name: "Base" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Polygon" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stellar" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/accepts USDC on Stellar/i)).toBeInTheDocument();
  });

  it("uses a Stellar public-key placeholder on the recipient step", () => {
    render(
      <SendModal
        {...cryptoStep1({
          sendStepIs1: false,
          sendStepIs2: true,
          sendStepDots: [{ on: true }, { on: true }, { on: false }],
        })}
      />,
    );
    expect(screen.getByLabelText(/Recipient wallet address/i)).toHaveAttribute(
      "placeholder",
      "G… (Stellar public key)",
    );
  });

  it("calls sendNext from Continue on step 1", () => {
    const sendNext = vi.fn();
    render(<SendModal {...cryptoStep1({ sendNext })} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(sendNext).toHaveBeenCalledTimes(1);
  });
});

describe("SendModal success step", () => {
  it("renders a receipt with amount, status, and explorer link", () => {
    render(
      <SendModal
        {...cryptoStep1({
          sendNotDone: false,
          sendDone: true,
          sendSuccessDetails: {
            title: "Transfer complete",
            amountDisplay: "4.00",
            currency: "USDC",
            statusLabel: "Completed",
            referenceId: "snd_2167511adc59414bb399563d8cebe337",
            networkLabel: "Stellar",
            explorerLabel: "View on Stellar",
          },
          sendExplorerUrl: "https://stellar.expert/explorer/testnet/tx/abc123",
        })}
      />,
    );
    expect(screen.getByRole("heading", { name: "Transfer complete" })).toBeInTheDocument();
    expect(screen.getByText("4.00")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Stellar")).toBeInTheDocument();
    expect(screen.getByText("snd_2167511adc59414bb399563d8cebe337")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /View on Stellar/i });
    expect(link).toHaveAttribute("href", "https://stellar.expert/explorer/testnet/tx/abc123");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("hides View onchain when no explorer URL is available", () => {
    render(
      <SendModal
        {...cryptoStep1({
          sendNotDone: false,
          sendDone: true,
          sendSuccessDetails: {
            title: "Transfer complete",
            amountDisplay: "3.00",
            currency: "USDC",
            statusLabel: "Completed",
            referenceId: "snd_abc",
            networkLabel: "Stellar",
            explorerLabel: "View on Stellar",
          },
          sendExplorerUrl: null,
        })}
      />,
    );
    expect(screen.queryByRole("link", { name: /View on/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });
});
