// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { COUNTRIES, flagUrl } from "@/components/mockData";
import {
  BANK_SEARCH_THRESHOLD,
  countryRailsLabel,
  countrySearchHaystack,
} from "@/lib/hooks/depositFlowHelpers";
import DepositModal, { type DepositCountryRow, type DepositMethodGroup } from "./DepositModal";

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

function methodGroupsFor(idx: number, selected?: { rail: number; provider: number }): DepositMethodGroup[] {
  return COUNTRIES[idx].rails.map((rail, railIdx) => ({
    railIdx,
    type: rail.type,
    label: rail.label,
    providers: rail.options.map((name, providerIdx) => ({
      name,
      selected: selected?.rail === railIdx && selected?.provider === providerIdx,
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
  depositNetworkLabel: "Base",
  depositAddress: "",
  closeModal: vi.fn(),
};

describe("DepositModal country-first step", () => {
  it("searches by provider name and hides Continue until a method is chosen", () => {
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
    fireEvent.change(screen.getByPlaceholderText("Search country, currency or provider"), {
      target: { value: "mtn" },
    });
    expect(screen.getByText("Uganda")).toBeInTheDocument();
    expect(screen.getByText("Ghana")).toBeInTheDocument();
    expect(screen.queryByText("Kenya")).not.toBeInTheDocument();
  });

  it("groups methods and shows bank search when Kenya has more than six banks", () => {
    const kenyaIdx = COUNTRIES.findIndex((c) => c.code === "KES");
    const banks = COUNTRIES[kenyaIdx].rails.find((r) => r.type === "bank")!.options;
    expect(banks.length).toBeGreaterThan(BANK_SEARCH_THRESHOLD);

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

    expect(screen.getByText("M-Pesa (Safaricom)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search banks")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("keeps a selected bank pinned when it does not match the bank search", () => {
    const kenyaIdx = COUNTRIES.findIndex((c) => c.code === "KES");
    const banks = COUNTRIES[kenyaIdx].rails.find((r) => r.type === "bank")!.options;
    const primeIdx = banks.findIndex((name) => name === "Prime Bank");

    render(
      <DepositModal
        {...baseProps}
        depositSub="method"
        depositCountryRows={countryRows(vi.fn())}
        depositMethodGroups={methodGroupsFor(kenyaIdx, { rail: 1, provider: primeIdx })}
        depositSelectedCountryName="Kenya"
        depositMethodChosen
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Search banks"), {
      target: { value: "equ" },
    });
    expect(screen.getByText("Prime Bank")).toBeInTheDocument();
    expect(screen.getByText("Currently selected")).toBeInTheDocument();
    expect(screen.getByText("Equity Bank")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });
});
