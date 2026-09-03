import { describe, expect, it } from "vitest";
import {
  buildCreateBankAccountPayload,
  buildDepositAccountDetailRows,
  currencyIso,
  currencyLabel,
  describeDepositAccountStatus,
  formatBankAddress,
  isCurrencySupported,
  mapDepositAccountToCardView,
  maskAccountIdentifier,
  mergeDepositAccount,
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

  it("shows partner available balance when present, otherwise —", () => {
    const withBal: DepositAccount = {
      currency: "EUR",
      status: "active",
      iban: "FR7630006000011234567890189",
      balance: { available: "25.00", current: "25.00", currency: "EUR" },
    };
    const funded = mapDepositAccountToCardView(withBal);
    expect(funded.balance).toBe("25.00");
    expect(funded.hasBalance).toBe(true);

    const empty: DepositAccount = {
      currency: "USD",
      status: "active",
      iban: "US1234567890123456",
    };
    const blank = mapDepositAccountToCardView(empty);
    expect(blank.balance).toBe("—");
    expect(blank.hasBalance).toBe(false);
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

  it("copies bank name and account holder, and omits blank strings", () => {
    const account: DepositAccount = {
      currency: "USD",
      status: "active",
      iban: "  ",
      bank_name: "CROSS RIVER BANK",
      account_holder_name: "Elementpay LTD",
      bank_address: { city: "New York", country: "US", street: "885 3rd Ave" },
    };
    expect(buildDepositAccountDetailRows(account)).toEqual([
      { label: "Bank", value: "CROSS RIVER BANK", copyValue: "CROSS RIVER BANK" },
      {
        label: "Bank address",
        value: "885 3rd Ave, New York, US",
        copyValue: "885 3rd Ave, New York, US",
      },
      { label: "Account name", value: "Elementpay LTD", copyValue: "Elementpay LTD" },
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

describe("buildDepositAccountDetailRows — balance row", () => {
  it("formats the balance so the detail row matches the card view", () => {
    const account: DepositAccount = {
      currency: "EUR",
      status: "active",
      iban: "FR7630006000011234567890189",
      balance: { available: "25", current: "25", currency: "EUR" },
    };
    const row = buildDepositAccountDetailRows(account).find(
      (r) => r.label === "Available balance",
    );
    expect(row?.value).toBe("25.00 EUR");
    expect(mapDepositAccountToCardView(account).balance).toBe("25.00");
  });

  it("omits the row when the partner returned no balance", () => {
    const account: DepositAccount = { currency: "USD", status: "active", iban: "US1234567890123456" };
    expect(
      buildDepositAccountDetailRows(account).some((r) => r.label === "Available balance"),
    ).toBe(false);
  });
});

describe("formatBankAddress", () => {
  it("joins known address keys and skips empty values", () => {
    expect(
      formatBankAddress({
        street: "885 3rd Ave",
        city: "New York",
        country: "US",
        extra: "",
      }),
    ).toBe("885 3rd Ave, New York, US");
  });

  it("returns null when the partner sent no address text", () => {
    expect(formatBankAddress(null)).toBeNull();
    expect(formatBankAddress({})).toBeNull();
  });
});

describe("mergeDepositAccount", () => {
  it("lets a full IBAN list row fill coordinates missing from bootstrap", () => {
    const stub: DepositAccount = {
      currency: "USD",
      status: "active",
      account_holder_name: "Elementpay LTD",
    };
    const overlay: DepositAccount = {
      currency: "USD",
      status: "active",
      iban: "US123456789012345678",
      bic: "021214891",
      bank_name: "CROSS RIVER BANK",
    };
    expect(mergeDepositAccount(stub, overlay)).toMatchObject({
      account_holder_name: "Elementpay LTD",
      iban: "US123456789012345678",
      bic: "021214891",
      bank_name: "CROSS RIVER BANK",
    });
  });

  it("does not overlay blank strings onto a stub", () => {
    const stub: DepositAccount = {
      currency: "EUR",
      status: "active",
      iban: "FR7630006000011234567890189",
    };
    expect(
      mergeDepositAccount(stub, { currency: "EUR", status: "active", iban: "  " })?.iban,
    ).toBe("FR7630006000011234567890189");
  });
});
