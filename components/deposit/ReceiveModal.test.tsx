// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReceiveModal, { type ReceiveModalProps } from "./ReceiveModal";

const stellarAddr = "GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE";

function renderCrypto(overrides: Partial<ReceiveModalProps> = {}) {
  const onStellar = vi.fn();
  render(
    <ReceiveModal
      receiveGroups={[]}
      receiveIsFiat={false}
      receiveIsCrypto={true}
      receiveAcctChips={[]}
      receiveAcctRail=""
      receiveAcctLines={[]}
      receiveAssets={[{ label: "USDC", select: vi.fn(), bg: "", color: "" }]}
      receiveNetworks={[
        { label: "Base", select: vi.fn(), border: "", bg: "", color: "" },
        { label: "Stellar", select: onStellar, border: "", bg: "", color: "" },
      ]}
      receiveAssetCode="USDC"
      receiveNetworkLabel="Stellar"
      receiveAddress={stellarAddr}
      copyReceiveAddress={vi.fn()}
      receiveAddressCopied={false}
      {...overrides}
    />,
  );
  return { onStellar };
}

describe("ReceiveModal stablecoin", () => {
  it("shows Stellar among networks and the G-address with Stellar warning copy", () => {
    renderCrypto();
    expect(screen.getByRole("button", { name: "Stellar" })).toBeInTheDocument();
    expect(screen.getByText(stellarAddr)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Only accept USDC on Stellar — funds sent on other networks cannot be recovered.",
    );
  });

  it("fails closed with a clear message when no Stellar wallet is ready", () => {
    renderCrypto({
      receiveAddress: "—",
      receiveAddressEmptyMessage:
        "No Stellar USDC wallet yet. Create one to get a deposit address.",
    });
    expect(screen.queryByText(stellarAddr)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/No Stellar USDC wallet yet/i);
  });

  it("offers Create Account when no Stellar wallet exists", () => {
    const onCreate = vi.fn();
    renderCrypto({
      receiveAddress: "—",
      receiveAddressEmptyMessage:
        "No Stellar USDC wallet yet. Create one to get a deposit address.",
      onCreateStablecoinAccount: onCreate,
      createStablecoinAccountLabel: "Create USDC on Stellar",
    });
    fireEvent.click(screen.getByRole("button", { name: "Create USDC on Stellar" }));
    expect(onCreate).toHaveBeenCalled();
  });

  it("selects Stellar when the chip is clicked", () => {
    const { onStellar } = renderCrypto();
    fireEvent.click(screen.getByRole("button", { name: "Stellar" }));
    expect(onStellar).toHaveBeenCalled();
  });
});
