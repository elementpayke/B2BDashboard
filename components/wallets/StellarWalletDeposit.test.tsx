// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StellarWalletDeposit from "./StellarWalletDeposit";

const connectStellarWallet = vi.fn();
const disconnectStellarWallet = vi.fn();
const signStellarTransaction = vi.fn();
const sendStellarUsdc = vi.fn();

vi.mock("@/lib/stellar/walletKit", () => ({
  connectStellarWallet: (...args: unknown[]) => connectStellarWallet(...args),
  disconnectStellarWallet: (...args: unknown[]) => disconnectStellarWallet(...args),
  signStellarTransaction: (...args: unknown[]) => signStellarTransaction(...args),
}));

vi.mock("@/lib/stellar/sendUsdc", () => ({
  sendStellarUsdc: (...args: unknown[]) => sendStellarUsdc(...args),
}));

describe("StellarWalletDeposit", () => {
  it("connects then sends USDC from the wallet", async () => {
    connectStellarWallet.mockResolvedValue("GABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCD");
    sendStellarUsdc.mockResolvedValue({ hash: "abc123hash" });

    render(
      <StellarWalletDeposit
        destination="GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE"
        network="Stellar"
        suggestedAmount="100"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect wallet" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Send from wallet" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Send from wallet" }));
    await waitFor(() => expect(sendStellarUsdc).toHaveBeenCalled());
    expect(screen.getByText(/Payment submitted/)).toBeInTheDocument();
  });
});
