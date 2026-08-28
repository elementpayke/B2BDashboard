// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { COUNTRIES, flagUrl } from "@/components/mockData";
import {
  countryRailsLabel,
  countrySearchHaystack,
} from "@/lib/hooks/depositFlowHelpers";
import DepositModal, { type DepositCountryRow, type DepositMethodGroup } from "./DepositModal";

vi.mock("next/dynamic", () => ({
  default: () =>
    function StellarWalletStub() {
      return <div>Or send from a wallet</div>;
    },
}));

vi.mock("@/components/wallets/DepositAddressQr", () => ({
  default: ({ networkLabel }: { networkLabel: string }) => (
    <div>Scan with a {networkLabel} wallet</div>
  ),
}));

function countryRows(onSelect: (idx: number) => void): DepositCountryRow[] {
  return COUNTRIES.map((c, i) => ({
    idx: i,
    name: c.name,
    code: c.code,
    flagUrl: flagUrl(c.iso),
    railsLabel: countryRailsLabel(c),
    searchText: countrySearchHaystack(c),
    select: () => onSelect(i),
  }));
}

function methodGroupsFor(idx: number, selectedRail?: number): DepositMethodGroup[] {
  return COUNTRIES[idx].rails.map((rail, railIdx) => ({
    railIdx,
    type: rail.type,
    label: rail.label,
    providers: rail.options.map((name, providerIdx) => ({
      name,
      selected: selectedRail === railIdx && providerIdx === 0,
      select: vi.fn(),
    })),
  }));
}

const baseProps = {
  depositNotDone: true,
  depositDone: false,
  depositStepDots: [{ on: true }, { on: false }, { on: false }],
  depositStepIs1: true,
  depositStepIs2: false,
  depositStepIs3: false,
  depositMethods: [
    { label: "By country", select: vi.fn(), bg: "#000", color: "#fff" },
    { label: "Stablecoin", select: vi.fn(), bg: "#eee", color: "#111" },
  ],
  depositIsCountry: true,
  depositIsCrypto: false,
  depositAssets: [],
  depositNetworks: [],
  depositNext: vi.fn(),
  depositBack: vi.fn(),
  depositDestinationSummary: "",
  depositIsMobileRail: true,
  depositIsBankRail: false,
  depositPayerLabel: "Your mobile number",
  depositPayerPlaceholder: "712",
  depositPhone: "",
  setDepositPhone: vi.fn(),
  depositMobileCode: "KES",
  depositAmount: "",
  setDepositAmount: vi.fn(),
  depositAmountLabel: "Amount",
  depositQuoteError: "",
  depositQuoteLoading: false,
  depositQuoteRateText: null,
  depositFeeText: "",
  depositArrivalText: "",
  depositAcceptError: "",
  depositAccepting: false,
  submitDeposit: vi.fn(),
  depositResultText: null,
  depositLiveStatus: null,
  depositOperator: "",
  depositBankLabel: "",
  depositBankArrival: "",
  depositBankLines: [],
  depositPromptSent: false,
  depositAssetCode: "USDC",
  depositNetwork: "base",
  depositNetworkLabel: "Base",
  depositAddress: "",
  closeModal: vi.fn(),
  depositWalletOptions: [
    { value: "acct-usdc-base", label: "USDC · Base · 0xabc1…def0" },
  ],
  depositWalletId: "acct-usdc-base",
  selectDepositWallet: vi.fn(),
  depositWalletsLoading: false,
  depositWalletLocked: false,
  depositWalletLabel: "USDC · Base · 0xabc1…def0",
};

describe("DepositModal country-first step", () => {
  it("searches by country or currency and hides Continue until a method is chosen", () => {
    const onSelect = vi.fn();
    render(
      <DepositModal
        {...baseProps}
        depositSub="country"
        depositCountryRows={countryRows(onSelect)}
        depositMethodGroups={[]}
        depositSelectedCountryName=""
        depositMethodChosen={false}
      />,
    );

    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Search country or currency"), {
      target: { value: "kenya" },
    });
    expect(screen.getByText("Kenya")).toBeInTheDocument();
    expect(screen.queryByText("Uganda")).not.toBeInTheDocument();
  });

  it("lists rails without partner or bank institution names", () => {
    const kenyaIdx = COUNTRIES.findIndex((c) => c.code === "KES");

    render(
      <DepositModal
        {...baseProps}
        depositSub="method"
        depositCountryRows={countryRows(vi.fn())}
        depositMethodGroups={methodGroupsFor(kenyaIdx)}
        depositSelectedCountryName="Kenya"
        depositMethodChosen={false}
      />,
    );

    expect(screen.getByText("Mobile money")).toBeInTheDocument();
    expect(screen.getByText("Bank transfer")).toBeInTheDocument();
    expect(screen.queryByText("M-Pesa (Safaricom)")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search banks")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("shows Continue once a rail is selected", () => {
    const kenyaIdx = COUNTRIES.findIndex((c) => c.code === "KES");

    render(
      <DepositModal
        {...baseProps}
        depositSub="method"
        depositCountryRows={countryRows(vi.fn())}
        depositMethodGroups={methodGroupsFor(kenyaIdx, 0)}
        depositSelectedCountryName="Kenya"
        depositMethodChosen
      />,
    );

    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("lets the user pick which wallet to top up to", () => {
    const selectDepositWallet = vi.fn();
    render(
      <DepositModal
        {...baseProps}
        depositSub="country"
        depositCountryRows={countryRows(vi.fn())}
        depositMethodGroups={[]}
        depositSelectedCountryName=""
        depositMethodChosen={false}
        depositWalletOptions={[
          { value: "acct-usdc-base", label: "USDC · Base · 0xabc1…def0" },
          { value: "acct-usdc-stellar", label: "USDC · Stellar · GABCDE…WXYZ" },
        ]}
        depositWalletId="acct-usdc-base"
        selectDepositWallet={selectDepositWallet}
      />,
    );

    expect(screen.getByText("Top up to wallet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /USDC · Base/i }));
    fireEvent.click(screen.getByRole("option", { name: /USDC · Stellar/i }));
    expect(selectDepositWallet).toHaveBeenCalledWith("acct-usdc-stellar");
  });

  it("hides Continue until a destination wallet is selected", () => {
    const kenyaIdx = COUNTRIES.findIndex((c) => c.code === "KES");
    render(
      <DepositModal
        {...baseProps}
        depositSub="method"
        depositCountryRows={countryRows(vi.fn())}
        depositMethodGroups={methodGroupsFor(kenyaIdx, 0)}
        depositSelectedCountryName="Kenya"
        depositMethodChosen
        depositWalletId=""
        depositWalletLabel={null}
      />,
    );
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("shows the selected wallet on the review step", () => {
    render(
      <DepositModal
        {...baseProps}
        depositStepIs1={false}
        depositStepIs3
        depositStepDots={[{ on: true }, { on: true }, { on: true }]}
        depositSub="method"
        depositCountryRows={[]}
        depositMethodGroups={[]}
        depositSelectedCountryName="Kenya"
        depositMethodChosen
        depositAmount="1000"
        depositPhone="712345678"
        depositDestinationSummary="Kenya · Mobile money"
        depositWalletLabel="USDC · Base · 0xabc1…def0"
      />,
    );

    expect(screen.getByText("To")).toBeInTheDocument();
    expect(screen.getByText("USDC · Base · 0xabc1…def0")).toBeInTheDocument();
  });
});

describe("DepositModal stablecoin address step", () => {
  const STELLAR_ADDR = "GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE";

  it("shows QR scan and Stellar wallet connect for Stellar USDC G… destinations", () => {
    render(
      <DepositModal
        {...baseProps}
        depositIsCountry={false}
        depositIsCrypto
        depositStepIs1={false}
        depositStepIs2
        depositStepDots={[{ on: true }, { on: true }]}
        depositSub="country"
        depositCountryRows={[]}
        depositMethodGroups={[]}
        depositSelectedCountryName=""
        depositMethodChosen={false}
        depositDestinationSummary="USDC · Stellar"
        depositAssetCode="USDC"
        depositNetwork="stellar"
        depositNetworkLabel="Stellar"
        depositAddress={STELLAR_ADDR}
        depositWalletId="acct-usdc-stellar"
        depositWalletLabel="USDC · Stellar · GBXCJB…OKEE"
      />,
    );

    expect(screen.getByRole("button", { name: /Copy deposit address/i })).toBeInTheDocument();
    expect(screen.getByText("Scan with a Stellar wallet")).toBeInTheDocument();
    expect(screen.getByText("Or send from a wallet")).toBeInTheDocument();
    expect(screen.getByText(STELLAR_ADDR)).toBeInTheDocument();
  });

  it("still offers wallet connect for stellar_public / stellar_testnet spellings", () => {
    const { rerender } = render(
      <DepositModal
        {...baseProps}
        depositIsCountry={false}
        depositIsCrypto
        depositStepIs1={false}
        depositStepIs2
        depositStepDots={[{ on: true }, { on: true }]}
        depositSub="country"
        depositCountryRows={[]}
        depositMethodGroups={[]}
        depositSelectedCountryName=""
        depositMethodChosen={false}
        depositDestinationSummary="USDC · Stellar"
        depositAssetCode="USDC"
        depositNetwork="stellar_public"
        depositNetworkLabel="Stellar"
        depositAddress={STELLAR_ADDR}
      />,
    );
    expect(screen.getByText("Or send from a wallet")).toBeInTheDocument();

    rerender(
      <DepositModal
        {...baseProps}
        depositIsCountry={false}
        depositIsCrypto
        depositStepIs1={false}
        depositStepIs2
        depositStepDots={[{ on: true }, { on: true }]}
        depositSub="country"
        depositCountryRows={[]}
        depositMethodGroups={[]}
        depositSelectedCountryName=""
        depositMethodChosen={false}
        depositDestinationSummary="USDC · Stellar"
        depositAssetCode="USDC"
        depositNetwork="stellar_testnet"
        depositNetworkLabel="Stellar"
        depositAddress={STELLAR_ADDR}
      />,
    );
    expect(screen.getByText("Or send from a wallet")).toBeInTheDocument();
  });

  it("never offers Stellar wallet connect when the destination is an EVM 0x address", () => {
    render(
      <DepositModal
        {...baseProps}
        depositIsCountry={false}
        depositIsCrypto
        depositStepIs1={false}
        depositStepIs2
        depositStepDots={[{ on: true }, { on: true }]}
        depositSub="country"
        depositCountryRows={[]}
        depositMethodGroups={[]}
        depositSelectedCountryName=""
        depositMethodChosen={false}
        depositDestinationSummary="USDC · Stellar"
        depositAssetCode="USDC"
        depositNetwork="stellar"
        depositNetworkLabel="Stellar"
        depositAddress="0xcbdb81Ce50aE547e7cD19ccE3af45164e0bF3169"
      />,
    );

    expect(screen.getByText("Scan with a Stellar wallet")).toBeInTheDocument();
    expect(screen.queryByText("Or send from a wallet")).not.toBeInTheDocument();
  });

  it("shows QR but not Stellar wallet connect on Base", () => {
    render(
      <DepositModal
        {...baseProps}
        depositIsCountry={false}
        depositIsCrypto
        depositStepIs1={false}
        depositStepIs2
        depositStepDots={[{ on: true }, { on: true }]}
        depositSub="country"
        depositCountryRows={[]}
        depositMethodGroups={[]}
        depositSelectedCountryName=""
        depositMethodChosen={false}
        depositDestinationSummary="USDC · Base"
        depositAssetCode="USDC"
        depositNetwork="base"
        depositNetworkLabel="Base"
        depositAddress="0xabc123"
      />,
    );

    expect(screen.getByText("Scan with a Base wallet")).toBeInTheDocument();
    expect(screen.queryByText("Or send from a wallet")).not.toBeInTheDocument();
  });

  it("does not offer wallet connect when the Stellar address is missing", () => {
    render(
      <DepositModal
        {...baseProps}
        depositIsCountry={false}
        depositIsCrypto
        depositStepIs1={false}
        depositStepIs2
        depositStepDots={[{ on: true }, { on: true }]}
        depositSub="country"
        depositCountryRows={[]}
        depositMethodGroups={[]}
        depositSelectedCountryName=""
        depositMethodChosen={false}
        depositDestinationSummary="USDC · Stellar"
        depositAssetCode="USDC"
        depositNetwork="stellar"
        depositNetworkLabel="Stellar"
        depositAddress=""
        depositAddressEmptyMessage="No Stellar USDC wallet yet."
      />,
    );

    expect(screen.getByText("No Stellar USDC wallet yet.")).toBeInTheDocument();
    expect(screen.queryByText("Or send from a wallet")).not.toBeInTheDocument();
  });
});
