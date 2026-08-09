import { describe, expect, it } from "vitest";
import {
  buildCreateBankAccountPayload,
  buildDepositAccountDetailRows,
  currencyIso,
  currencyLabel,
  describeDepositAccountStatus,
  isCurrencySupported,
  mapDepositAccountToCardView,
  maskAccountIdentifier,
  type DepositAccount,
} from "./depositAccounts";

describe("isCurrencySupported", () => {
  it("accepts EUR and USD only, case-insensitively", () => {
    expect(isCurrencySupported("USD")).toBe(true);
    expect(isCurrencySupported("eur")).toBe(true);
    expect(isCurrencySupported("GBP")).toBe(false);
    expect(isCurrencySupported("kes")).toBe(false);
  });
});

describe("occupiedFiatCurrencyCodes", () => {
  it("collects ISO codes already listed", async () => {
    const { occupiedFiatCurrencyCodes, isFiatCurrencyOccupied } = await import(
      "./depositAccounts"
    );
    const occupied = occupiedFiatCurrencyCodes([
      { currency: "usd" },
      { currency: "EUR" },
    ]);
    expect(occupied.has("USD")).toBe(true);
    expect(occupied.has("EUR")).toBe(true);
    expect(isFiatCurrencyOccupied([{ currency: "USD" }], "usd")).toBe(true);
    expect(isFiatCurrencyOccupied([{ currency: "USD" }], "EUR")).toBe(false);
  });
});

describe("currencyIso / currencyLabel", () => {
  it("looks up the flag ISO and display label for a known currency", () => {
    expect(currencyIso("USD")).toBe("us");
    expect(currencyIso("eur")).toBe("eu");
    expect(currencyLabel("USD")).toBe("US Dollar");
  });

  it("falls back gracefully for unknown or missing currencies", () => {
    expect(currencyIso("ZZZ")).toBeNull();
    expect(currencyIso(null)).toBeNull();
    expect(currencyLabel("ZZZ")).toBe("ZZZ");
    expect(currencyLabel(undefined)).toBe("—");
  });
});

describe("describeDepositAccountStatus", () => {
  it("maps known backend statuses to display labels", () => {
    expect(describeDepositAccountStatus("active")).toBe("Active");
    expect(describeDepositAccountStatus("pending")).toBe("Pending");
    expect(describeDepositAccountStatus("unavailable")).toBe("Unavailable");
  });

  it("passes through unknown statuses rather than hiding them", () => {
    expect(describeDepositAccountStatus("weird_status")).toBe("weird_status");
    expect(describeDepositAccountStatus(null)).toBe("Unknown");
  });
});

describe("maskAccountIdentifier", () => {
  it("masks long identifiers to first-8/last-4, grouped in fours", () => {
    expect(maskAccountIdentifier("DE89370400440532013000")).toBe(
      "DE89 3704 ·· 3000",
    );
  });

  it("strips whitespace and normalizes case before masking", () => {
    expect(maskAccountIdentifier("de89 3704 0044 0532 0130 00")).toBe(
      "DE89 3704 ·· 3000",
    );
  });

  it("shows short identifiers in full rather than masking nothing useful", () => {
    expect(maskAccountIdentifier("12345678")).toBe("1234 5678");
  });

  it("returns an em dash when there is nothing to show", () => {
    expect(maskAccountIdentifier(null)).toBe("—");
    expect(maskAccountIdentifier(undefined)).toBe("—");
    expect(maskAccountIdentifier("")).toBe("—");
  });
});

describe("mapDepositAccountToCardView", () => {
  it("prefers the masked IBAN as the primary detail when present", () => {
    const account: DepositAccount = {
      currency: "EUR",
      status: "active",
      iban: "FR7630006000011234567890189",
      bic: "MODRFR21",
      account_holder_name: "ElementPay Business Ltd",
      bank_name: "Crédit Mutuel",
    };
    const view = mapDepositAccountToCardView(account);
    expect(view.currency).toBe("EUR");
    expect(view.name).toBe("Euro");
    expect(view.iso).toBe("eu");
    expect(view.status).toBe("active");
    expect(view.statusLabel).toBe("Active");
    expect(view.primaryDetail).toBe("FR76 3000 ·· 0189");
    expect(view.secondaryDetail).toBe("MODRFR21 · ElementPay Business Ltd");
  });

  it("falls back to bank name, then instructions, when there is no IBAN yet", () => {
    const pendingWithBankName: DepositAccount = {
      currency: "USD",
      status: "pending",
      bank_name: "Community National Bank",
    };
    expect(mapDepositAccountToCardView(pendingWithBankName).primaryDetail).toBe(
      "Community National Bank",
    );

    const pendingWithInstructions: DepositAccount = {
      currency: "USD",
      status: "pending",
      instructions: "Coordinates are being provisioned.",
    };
    expect(
      mapDepositAccountToCardView(pendingWithInstructions).primaryDetail,
    ).toBe("Coordinates are being provisioned.");

    const pendingWithNeither: DepositAccount = {
      currency: "USD",
      status: "pending",
    };
    expect(mapDepositAccountToCardView(pendingWithNeither).primaryDetail).toBe(
      "Coordinates pending",
    );
  });

  it("never fabricates a balance field on the card view", () => {
    const account: DepositAccount = { currency: "USD", status: "active", iban: "US1234567890123456" };
    const view = mapDepositAccountToCardView(account);
    expect(view).not.toHaveProperty("balance");
  });
});

describe("buildDepositAccountDetailRows", () => {
  it("includes only the fields the backend actually returned", () => {
    const account: DepositAccount = {
      currency: "EUR",
      status: "active",
      iban: "FR7630006000011234567890189",
      bic: "MODRFR21",
    };
    const rows = buildDepositAccountDetailRows(account);
    expect(rows).toEqual([
      { label: "IBAN", value: "FR7630006000011234567890189", copyValue: "FR7630006000011234567890189" },
      { label: "BIC / SWIFT", value: "MODRFR21", copyValue: "MODRFR21" },
    ]);
  });

  it("returns no rows for a bare pending account rather than inventing placeholders", () => {
    const account: DepositAccount = { currency: "USD", status: "pending" };
    expect(buildDepositAccountDetailRows(account)).toEqual([]);
  });

  it("surfaces settlement asset/network as a single combined row", () => {
    const account: DepositAccount = {
      currency: "USD",
      status: "active",
      destination_asset: "USDC",
      destination_network: "Polygon",
    };
    expect(buildDepositAccountDetailRows(account)).toEqual([
      { label: "Settlement asset", value: "USDC · Polygon" },
    ]);
  });
});

describe("buildCreateBankAccountPayload", () => {
  it("omits the account name — the backend schema has no field for it", () => {
    const payload = buildCreateBankAccountPayload({
      currency: "usd",
      accountName: "Payroll",
    });
    expect(payload).toEqual({ currency: "USD" });
  });

  it("includes wallet_address only when provided", () => {
    const payload = buildCreateBankAccountPayload({
      currency: "EUR",
      walletAddress: "0xabc",
    });
    expect(payload).toEqual({ currency: "EUR", wallet_address: "0xabc" });
  });

  it("rejects unsupported currencies before hitting the network", () => {
    expect(() => buildCreateBankAccountPayload({ currency: "GBP" })).toThrow(
      /available yet/,
    );
  });
});
