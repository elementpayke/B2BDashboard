// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FundStablecoinModal from "./FundStablecoinModal";
import type { FundStablecoinRail } from "@/lib/services/entities";

vi.mock("next/dynamic", () => ({
  default: () =>
    function StellarWalletStub() {
      return <div>Or send from a wallet</div>;
    },
}));

vi.mock("./DepositAddressQr", () => ({
  default: ({ networkLabel }: { networkLabel: string }) => (
    <div>Scan with a {networkLabel} wallet</div>
  ),
}));

const stellar: FundStablecoinRail = {
  id: "s1",
  currency: "USDC",
  network: "Stellar",
  networkLabel: "Stellar",
  walletAddress: "GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE",
  chainDisclaimer: "Send only USDC on Stellar. Funds sent on the wrong network may be lost.",
  checkoutUrl: null,
};

const base: FundStablecoinRail = {
  id: "b1",
  currency: "USDC",
  network: "Base",
  networkLabel: "Base",
  walletAddress: "0xabc",
  chainDisclaimer: "Send only USDC on Base.",
  checkoutUrl: null,
};

function openAddressStep(rails: FundStablecoinRail[]) {
  render(
    <FundStablecoinModal targetCurrency="KES" targetName="Kenyan Shilling" rails={rails} onBack={vi.fn()} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

describe("FundStablecoinModal Stellar wallet", () => {
  it("keeps copy-address and offers wallet connect on Stellar USDC", () => {
    openAddressStep([stellar]);
    expect(screen.getByText("Deposit address ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy deposit address/i })).toBeInTheDocument();
    expect(screen.getByText("Scan with a Stellar wallet")).toBeInTheDocument();
    expect(screen.getByText("Or send from a wallet")).toBeInTheDocument();
  });

  it("does not offer Stellar wallet connect on other rails", () => {
    openAddressStep([base]);
    expect(screen.queryByText("Or send from a wallet")).not.toBeInTheDocument();
  });

  it("does not offer Stellar wallet connect for a Stellar-labelled rail with an EVM address", () => {
    openAddressStep([
      {
        ...stellar,
        walletAddress: "0xcbdb81Ce50aE547e7cD19ccE3af45164e0bF3169",
      },
    ]);
    expect(screen.queryByText("Or send from a wallet")).not.toBeInTheDocument();
  });
});
