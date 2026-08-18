import { describe, expect, it } from "vitest";
import {
  describeMissingTreasuryWallet,
  resolveTreasuryWalletAddress,
} from "@/lib/services/treasuryWallet";

const TREASURY = "0xb75C1B86B89598b310810181cc6E345a6037B831";
const ACCOUNT_WALLET = "0xed8BCf00bD75f127266331880c4E345a6037Bd91";

const readyUsdc = { status: "active", currency: "USDC", walletAddress: ACCOUNT_WALLET };

describe("resolveTreasuryWalletAddress", () => {
  it("prefers the summary's canonical address", () => {
    expect(
      resolveTreasuryWalletAddress({
        summaryWallet: TREASURY,
        stablecoinAccounts: [readyUsdc],
      }),
    ).toBe(TREASURY);
  });

  it("falls back to a ready USDC account when summary is unavailable", () => {
    // The regression this exists for: /v1/dashboard/summary 500s, so
    // wallet_address is undefined and the flow used to report the business
    // as having no treasury wallet.
    expect(
      resolveTreasuryWalletAddress({
        summaryWallet: undefined,
        stablecoinAccounts: [readyUsdc],
      }),
    ).toBe(ACCOUNT_WALLET);
  });

  it("ignores accounts that are not ready", () => {
    expect(
      resolveTreasuryWalletAddress({
        stablecoinAccounts: [{ ...readyUsdc, status: "pending" }],
      }),
    ).toBeNull();
  });

  it("ignores non-USDC accounts", () => {
    expect(
      resolveTreasuryWalletAddress({
        stablecoinAccounts: [{ ...readyUsdc, currency: "USDT" }],
      }),
    ).toBeNull();
  });

  it("matches the currency case-insensitively", () => {
    expect(
      resolveTreasuryWalletAddress({ stablecoinAccounts: [{ ...readyUsdc, currency: "usdc" }] }),
    ).toBe(ACCOUNT_WALLET);
  });

  it("skips ready accounts that carry no address and keeps looking", () => {
    expect(
      resolveTreasuryWalletAddress({
        stablecoinAccounts: [
          { status: "active", currency: "USDC", walletAddress: null },
          { status: "active", currency: "USDC", walletAddress: "   " },
          readyUsdc,
        ],
      }),
    ).toBe(ACCOUNT_WALLET);
  });

  it("treats a blank summary address as absent rather than sending whitespace", () => {
    expect(
      resolveTreasuryWalletAddress({ summaryWallet: "   ", stablecoinAccounts: [readyUsdc] }),
    ).toBe(ACCOUNT_WALLET);
  });

  it("returns null when there is genuinely nothing", () => {
    expect(resolveTreasuryWalletAddress({})).toBeNull();
    expect(
      resolveTreasuryWalletAddress({ summaryWallet: null, stablecoinAccounts: [] }),
    ).toBeNull();
  });
});

describe("describeMissingTreasuryWallet", () => {
  it("blames the outage, not the account, when summary failed", () => {
    const message = describeMissingTreasuryWallet(true);
    expect(message).toMatch(/couldn't load your account details/i);
    expect(message).not.toMatch(/not provisioned|no treasury wallet/i);
  });

  it("still reports a genuinely unprovisioned business plainly", () => {
    expect(describeMissingTreasuryWallet(false)).toMatch(/no treasury wallet is provisioned/i);
  });
});
