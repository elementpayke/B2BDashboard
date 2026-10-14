import { describe, expect, it } from "vitest";
import {
  buildCreateBankAccountPayload,
  buildDepositAccountDetailRows,
  buildDepositAccountDetailSections,
  currencyIso,
  currencyLabel,
  describeDepositAccountStatus,
  formatBankAddress,
  isCurrencySupported,
  isStablecoinSupported,
  mapDepositAccountToCardView,
  maskAccountIdentifier,
  mergeDepositAccount,
  networksForStablecoin,
  SUPPORTED_IBAN_CURRENCIES,
  supportedCurrenciesFromEligibility,
  type DepositAccount,
  type DepositAccountEligibility,
} from "./depositAccounts";

describe("isCurrencySupported", () => {
  it("accepts EUR and USD only, case-insensitively, when no live list is given", () => {
    expect(isCurrencySupported("USD")).toBe(true);
    expect(isCurrencySupported("eur")).toBe(true);
    expect(isCurrencySupported("GBP")).toBe(false);
    expect(isCurrencySupported("kes")).toBe(false);
  });

  it("checks against an explicit supported list when one is given", () => {
    expect(isCurrencySupported("GBP", ["USD", "EUR", "GBP"])).toBe(true);
    expect(isCurrencySupported("kes", ["USD", "EUR", "GBP"])).toBe(false);
  });
});

describe("supportedCurrenciesFromEligibility", () => {
  it("falls back to SUPPORTED_IBAN_CURRENCIES when supported_accounts is absent or empty", () => {
    expect(supportedCurrenciesFromEligibility(undefined)).toEqual(
      SUPPORTED_IBAN_CURRENCIES,
    );
    expect(
      supportedCurrenciesFromEligibility({
        eligible: true,
        verification_status: "approved",
      }),
    ).toEqual(SUPPORTED_IBAN_CURRENCIES);
    expect(
      supportedCurrenciesFromEligibility({
        eligible: true,
        verification_status: "approved",
        supported_accounts: [],
      }),
    ).toEqual(SUPPORTED_IBAN_CURRENCIES);
  });

  it("adds supported_accounts currencies on top of USD/EUR rather than replacing them", () => {
    const eligibility: DepositAccountEligibility = {
      eligible: true,
      verification_status: "approved",
      supported_accounts: [
        { currency: "usd", rail_type: "ach_wire", fields: ["account_number", "routing_number"] },
        { currency: "GBP", country_code: "GB", rail_type: "local_bank", fields: ["account_number", "sort_code"] },
        { currency: "KES", country_code: "KE", rail_type: "local_bank", fields: ["account_number", "bank_code"] },
      ],
    };
    // supported_accounts is backend-declared *extra* rails, not the full
    // list — a backend that only ever declares GBP must not make EUR
    // disappear from the picker for a business that already has a EUR
    // account, or silently block Bank account creation once USD+GBP are
    // both occupied even though EUR remains available.
    expect(supportedCurrenciesFromEligibility(eligibility)).toEqual([
      "USD",
      "EUR",
      "GBP",
      "KES",
    ]);
  });

  it("drops entries with no usable currency rather than crashing", () => {
    const eligibility = {
      eligible: true,
      verification_status: "approved",
      supported_accounts: [
        { currency: "", rail_type: "local_bank", fields: [] },
        { currency: "GBP", rail_type: "local_bank", fields: ["sort_code"] },
      ],
    } as DepositAccountEligibility;
    expect(supportedCurrenciesFromEligibility(eligibility)).toEqual([
      "USD",
      "EUR",
      "GBP",
    ]);
  });
});

describe("stablecoin creation support", () => {
  it("keeps Base/Polygon USDT and adds allowlisted Stellar rails", () => {
    expect(isStablecoinSupported("USDC")).toBe(true);
    expect(isStablecoinSupported("USDT")).toBe(true);
    expect(isStablecoinSupported("EURC")).toBe(true);
    expect(networksForStablecoin("USDT")).toEqual(["BASE", "POLYGON", "STELLAR"]);
    expect(networksForStablecoin("EURC")).toEqual(["STELLAR"]);
    expect(networksForStablecoin("USDC")).toEqual(["BASE", "POLYGON", "STELLAR"]);
  });

  it("rejects unknown stablecoins", () => {
    expect(isStablecoinSupported("DAI")).toBe(false);
    expect(networksForStablecoin("DAI")).toEqual([]);
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

describe("currencyOptionsFor", () => {
  it("returns the known CURRENCY_OPTIONS list as-is when nothing extra is supported", async () => {
    const { currencyOptionsFor, CURRENCY_OPTIONS } = await import("./depositAccounts");
    expect(currencyOptionsFor(["USD", "EUR"])).toEqual(CURRENCY_OPTIONS);
  });

  it("appends a backend-declared currency with no local display metadata, using the raw code", async () => {
    const { currencyOptionsFor } = await import("./depositAccounts");
    const options = currencyOptionsFor(["USD", "EUR", "PHP"]);
    expect(options.find((o) => o.code === "PHP")).toEqual({
      code: "PHP",
      label: "PHP",
      iso: null,
    });
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
    expect(describeDepositAccountStatus("deposit_unavailable")).toBe("Unavailable");
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

  it("shows deposit unavailable copy instead of pending coordinates when fiat rails are off", () => {
    const account: DepositAccount = {
      currency: "USD",
      status: "deposit_unavailable",
      bank_name: "Community National Bank",
      instructions: "This rail is unavailable.",
    };
    const view = mapDepositAccountToCardView(account);
    expect(view.statusLabel).toBe("Unavailable");
    expect(view.primaryDetail).toBe("Deposit rail unavailable");
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

describe("buildDepositAccountDetailRows — local bank rails", () => {
  it("renders a UK sort-code account without needing an IBAN", () => {
    const account: DepositAccount = {
      currency: "GBP",
      status: "active",
      account_number: "12345678",
      sort_code: "04-00-04",
      bank_name: "Monzo Bank",
    };
    expect(buildDepositAccountDetailRows(account)).toEqual([
      { label: "Sort code", value: "04-00-04", copyValue: "04-00-04" },
      { label: "Account number", value: "12345678", copyValue: "12345678" },
      { label: "Bank", value: "Monzo Bank", copyValue: "Monzo Bank" },
    ]);
  });

  it("renders a Canadian institution/transit number pair", () => {
    const account: DepositAccount = {
      currency: "CAD",
      status: "active",
      account_number: "7834567",
      institution_number: "004",
      transit_number: "06003",
    };
    expect(buildDepositAccountDetailRows(account)).toEqual([
      { label: "Institution number", value: "004", copyValue: "004" },
      { label: "Transit number", value: "06003", copyValue: "06003" },
      { label: "Account number", value: "7834567", copyValue: "7834567" },
    ]);
  });

  it("includes a monthly maintenance fee row when the backend returns one", () => {
    const account: DepositAccount = {
      currency: "USD",
      status: "active",
      iban: "391881521473",
      monthly_maintenance_fee: { amount: "5.00", currency: "USD" },
    };
    expect(
      buildDepositAccountDetailRows(account).find((r) => r.label === "Monthly fee"),
    ).toEqual({ label: "Monthly fee", value: "5.00 USD/month" });
  });

  it("omits the monthly fee row when the backend doesn't return one", () => {
    const account: DepositAccount = {
      currency: "USD",
      status: "active",
      iban: "391881521473",
    };
    expect(
      buildDepositAccountDetailRows(account).some((r) => r.label === "Monthly fee"),
    ).toBe(false);
  });
});

describe("buildDepositAccountDetailSections", () => {
  it("splits a USD account into domestic and international rails", () => {
    const account: DepositAccount = {
      currency: "USD",
      status: "active",
      iban: "391881521473",
      bic: "CSRVUS33COS",
      routing_number: "021214891",
      bank_name: "CROSS RIVER BANK",
      bank_address: { city: "Fort Lee", country: "US", street: "2115 Linwood Ave" },
      account_holder_name: "Elementpay LTD",
    };

    expect(buildDepositAccountDetailSections(account)).toEqual([
      {
        title: "Domestic transfer (ACH/wire)",
        rows: [
          { label: "Account number", value: "391881521473", copyValue: "391881521473" },
          { label: "Routing number", value: "021214891", copyValue: "021214891" },
          { label: "Bank", value: "CROSS RIVER BANK", copyValue: "CROSS RIVER BANK" },
          {
            label: "Bank address",
            value: "2115 Linwood Ave, Fort Lee, US",
            copyValue: "2115 Linwood Ave, Fort Lee, US",
          },
        ],
      },
      {
        title: "International wire",
        rows: [
          { label: "Account number", value: "391881521473", copyValue: "391881521473" },
          { label: "SWIFT/BIC", value: "CSRVUS33COS", copyValue: "CSRVUS33COS" },
          { label: "Bank", value: "CROSS RIVER BANK", copyValue: "CROSS RIVER BANK" },
          {
            label: "Bank address",
            value: "2115 Linwood Ave, Fort Lee, US",
            copyValue: "2115 Linwood Ave, Fort Lee, US",
          },
        ],
      },
    ]);
  });

  it("keeps a single Bank details section for EUR/IBAN accounts", () => {
    const account: DepositAccount = {
      currency: "EUR",
      status: "active",
      iban: "FR7630006000011234567890189",
      bic: "MODRFR21",
      bank_name: "SOCIETE GENERALE",
    };

    expect(buildDepositAccountDetailSections(account)).toEqual([
      {
        title: "Bank details",
        rows: [
          {
            label: "IBAN",
            value: "FR7630006000011234567890189",
            copyValue: "FR7630006000011234567890189",
          },
          { label: "BIC / SWIFT", value: "MODRFR21", copyValue: "MODRFR21" },
          { label: "Bank", value: "SOCIETE GENERALE", copyValue: "SOCIETE GENERALE" },
        ],
      },
    ]);
  });

  it("falls back to a single domestic-only section when there is no SWIFT/BIC yet", () => {
    const account: DepositAccount = {
      currency: "USD",
      status: "active",
      iban: "391881521473",
      routing_number: "021214891",
      bank_name: "CROSS RIVER BANK",
    };

    expect(buildDepositAccountDetailSections(account)).toEqual([
      {
        title: "Domestic transfer (ACH/wire)",
        rows: [
          { label: "Account number", value: "391881521473", copyValue: "391881521473" },
          { label: "Routing number", value: "021214891", copyValue: "021214891" },
          { label: "Bank", value: "CROSS RIVER BANK", copyValue: "CROSS RIVER BANK" },
        ],
      },
    ]);
  });

  it("puts settlement fields in their own section for both currencies", () => {
    const account: DepositAccount = {
      currency: "USD",
      status: "active",
      iban: "391881521473",
      routing_number: "021214891",
      reference: "INV-42",
    };

    const sections = buildDepositAccountDetailSections(account);
    expect(sections.find((s) => s.title === "Settlement")?.rows).toEqual([
      { label: "Reference", value: "INV-42", copyValue: "INV-42" },
    ]);
  });

  it("returns no sections for a bare pending account", () => {
    const account: DepositAccount = { currency: "USD", status: "pending" };
    expect(buildDepositAccountDetailSections(account)).toEqual([]);
  });

  it("keeps a single Bank details section for a UK sort-code account (no routing_number)", () => {
    const account: DepositAccount = {
      currency: "GBP",
      status: "active",
      account_number: "12345678",
      sort_code: "04-00-04",
      bank_name: "Monzo Bank",
    };
    expect(buildDepositAccountDetailSections(account)).toEqual([
      {
        title: "Bank details",
        rows: [
          { label: "Sort code", value: "04-00-04", copyValue: "04-00-04" },
          { label: "Account number", value: "12345678", copyValue: "12345678" },
          { label: "Bank", value: "Monzo Bank", copyValue: "Monzo Bank" },
        ],
      },
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

  it("accepts a currency once it's in an explicit live supported list", () => {
    const payload = buildCreateBankAccountPayload(
      { currency: "GBP" },
      ["USD", "EUR", "GBP"],
    );
    expect(payload).toEqual({ currency: "GBP" });
  });

  it("includes country_code only when provided", () => {
    const payload = buildCreateBankAccountPayload(
      { currency: "KES", countryCode: "KE" },
      ["KES"],
    );
    expect(payload).toEqual({ currency: "KES", country_code: "KE" });
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
