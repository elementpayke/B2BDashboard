// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { COUNTRIES, flagUrl } from "@/components/mockData";
import {
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
  depositNetworkLabel: "Base",
  depositAddress: "",
  closeModal: vi.fn(),
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
});
