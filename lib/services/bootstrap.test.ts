import { describe, expect, it } from "vitest";
import { mapBootstrap, type BootstrapOut } from "./bootstrap";

const sample: BootstrapOut = {
  identity: {
    user_id: 7,
    business_id: 42,
    business_name: "Acme Ltd",
    role: "admin",
    permissions: [],
    kyb_status: "approved",
  },
  eligibility: {
    eligible: true,
    can_issue_iban: true,
    can_open_stablecoin: true,
    primary_entity_id: "20",
    verification_status: "approved",
  },
  treasury: { wallet_address: "0xabc" },
  fx_rates: { base: "USD", rates: { KES: 129.5, EUR: 0.92 } },
  accounts: [
    {
      id: "64",
      entity_id: "20",
      kind: "fiat_deposit",
      asset_type: "fiat",
      currency: "USD",
      network: null,
      status: "active",
      display_name: "Operating USD",
      iban: "DE89TEST",
      bic: "TESTDE",
      bank_name: "Test Bank",
      account_holder_name: "Acme Ltd",
      wallet_address: null,
      balance: { available: "10.00", current: "10.00", currency: "USD" },
    },
    {
      id: "88",
      entity_id: "20",
      kind: "stablecoin",
      asset_type: "stablecoin",
      currency: "USDC",
      network: "Stellar",
      status: "active",
      display_name: "USDC Stellar",
      wallet_address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
      balance: { available: "5.00", current: "5.00", currency: "USDC" },
    },
  ],
};

describe("mapBootstrap", () => {
  it("splits fiat and stablecoin accounts and preserves entity_id", () => {
    const mapped = mapBootstrap(sample);
    expect(mapped.fiatAccounts).toHaveLength(1);
    expect(mapped.fiatAccounts[0]?.entity_id).toBe("20");
    expect(mapped.fiatAccounts[0]?.iban).toBe("DE89TEST");
    expect(mapped.stablecoinAccounts).toHaveLength(1);
    expect(mapped.stablecoinAccounts[0]?.entityId).toBe("20");
    expect(mapped.stablecoinAccounts[0]?.network).toBe("Stellar");
    expect(mapped.eligibility.eligible).toBe(true);
    expect(mapped.treasuryWallet).toBe("0xabc");
    expect(mapped.fxRates?.rates.KES).toBe(129.5);
    expect(mapped.authMePatch.business?.name).toBe("Acme Ltd");
    expect(mapped.authMePatch.kyb_summary?.profile?.kyb_status).toBe("approved");
  });

  it("maps unverified eligibility without inventing accounts", () => {
    const mapped = mapBootstrap({
      ...sample,
      eligibility: {
        eligible: false,
        can_issue_iban: false,
        can_open_stablecoin: false,
        primary_entity_id: null,
        verification_status: "pending",
      },
      accounts: [],
    });
    expect(mapped.eligibility.eligible).toBe(false);
    expect(mapped.fiatAccounts).toEqual([]);
    expect(mapped.stablecoinAccounts).toEqual([]);
  });
});
