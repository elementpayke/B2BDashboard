import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/lib/apiClient";
import {
  failureMessage,
  feeText,
  findPayoutDestination,
  findWalletDestination,
  isFinalSend,
  accountBoxError,
  defaultSendSource,
  eligibleSendSources,
  extraFieldError,
  invalidExtraField,
  isQuoteExpired,
  isUsdLike,
  missingExtraField,
  payableCorridors,
  payoutRailDestinations,
  payoutSource,
  recipientDetails,
  recipientExtraFields,
  moneyText,
  rateLine,
  refundText,
  sendApiError,
  sendErrorMessage,
  sendPollIntervalMs,
  sendSourceLabel,
  toOrderQuoteShape,
  toSendPreviewShape,
  unifiedSendsEnabled,
  type SendOptions,
  type SendQuote,
  type UnifiedSend,
} from "./unifiedSends";

const field = { type: "account_number", label: "Account number", pattern: null, example: null };

const OPTIONS: SendOptions = {
  methods: [{ key: "bank", label: "Bank transfer", status: "live" }],
  destinations: [
    { id: "dst_ke_bank_kcb", method: "bank", country: "KE", currency: "KES", network: null, name: "KCB Bank", logo_url: null, account_field: field, limits: null, status: "live" },
    { id: "dst_ke_bank_old", method: "bank", country: "KE", currency: "KES", network: null, name: "Old Bank", logo_url: null, account_field: field, limits: null, status: "unavailable" },
    { id: "dst_ke_mobile_money_m_pesa", method: "mobile_money", country: "KE", currency: "KES", network: null, name: "Mobile Wallet (M-PESA)", logo_url: null, account_field: field, limits: null, status: "live" },
    { id: "dst_gh_bank_kcb", method: "bank", country: "GH", currency: "GHS", network: null, name: "KCB Bank", logo_url: null, account_field: field, limits: null, status: "live" },
    { id: "dst_usdt_polygon", method: "stablecoin", country: null, currency: "USDT", network: "polygon", name: "USDT · Polygon", logo_url: null, account_field: field, limits: null, status: "live" },
  ],
  sources: [],
};

const QUOTE: SendQuote = {
  quote_id: "qt_1",
  expires_at: "2026-11-23T12:01:24Z",
  expires_in_seconds: 84,
  send_amount: { value: "99.00", currency: "USDT" },
  fee: { value: "1.00", currency: "USDT" },
  total_debit: { value: "100.00", currency: "USDT" },
  receive_amount: { value: "12672.00", currency: "KES" },
  rate: { from: "USDT", to: "KES", value: "128.00" },
  fee_breakdown: [],
  route_summary: "USDT → KES",
  reference_delivered: false,
  notes: [],
  binding: true,
};

function send(overrides: Partial<UnifiedSend>): UnifiedSend {
  return {
    ...QUOTE,
    send_id: "snd_1",
    status: "processing",
    failure: null,
    refund: null,
    timeline: [],
    created_at: "2026-11-23T12:01:02Z",
    updated_at: "2026-11-23T12:01:02Z",
    ...overrides,
  } as UnifiedSend;
}

afterEach(() => vi.unstubAllEnvs());

describe("unifiedSendsEnabled", () => {
  it("is off unless the flag is exactly true", () => {
    vi.stubEnv("NEXT_PUBLIC_UNIFIED_SENDS", "");
    expect(unifiedSendsEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_UNIFIED_SENDS", "1");
    expect(unifiedSendsEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_UNIFIED_SENDS", "true");
    expect(unifiedSendsEnabled()).toBe(true);
  });
});

describe("destination lookup", () => {
  it("matches country, method and provider name", () => {
    expect(findPayoutDestination(OPTIONS, { countryIso: "ke", railType: "bank", providerName: "kcb bank" })?.id).toBe("dst_ke_bank_kcb");
    expect(findPayoutDestination(OPTIONS, { countryIso: "GH", railType: "bank", providerName: "KCB Bank" })?.id).toBe("dst_gh_bank_kcb");
    expect(findPayoutDestination(OPTIONS, { countryIso: "KE", railType: "mobile", providerName: "M-PESA" })?.id).toBe("dst_ke_mobile_money_m_pesa");
  });

  it("fails closed for unknown, unavailable or missing input", () => {
    expect(findPayoutDestination(OPTIONS, { countryIso: "KE", railType: "bank", providerName: "Old Bank" })).toBeNull();
    expect(findPayoutDestination(OPTIONS, { countryIso: "KE", railType: "bank", providerName: "Nope Bank" })).toBeNull();
    expect(findPayoutDestination(OPTIONS, { countryIso: "KE", railType: "bank", providerName: "" })).toBeNull();
    expect(findPayoutDestination(null, { countryIso: "KE", railType: "bank", providerName: "KCB Bank" })).toBeNull();
  });

  it("finds a wallet destination by asset and chain", () => {
    expect(findWalletDestination(OPTIONS, { asset: "usdt", network: "Polygon" })?.id).toBe("dst_usdt_polygon");
    expect(findWalletDestination(OPTIONS, { asset: "USDC", network: "polygon" })).toBeNull();
  });
});

describe("presentation", () => {
  it("formats money, fees and rates without recomputing them", () => {
    expect(moneyText({ value: "503.00", currency: "USDT" })).toBe("503.00 USDT");
    expect(moneyText(null)).toBeNull();
    expect(feeText({ value: "0.00", currency: "USDT" })).toBe("No fee");
    expect(feeText({ value: "3.00", currency: "USDT" })).toBe("3.00 USDT");
    expect(rateLine(QUOTE)).toBe("1 USDT = 128.00 KES");
    expect(rateLine({ rate: { from: "USD", to: "USD", value: "1" } })).toBeNull();
    expect(rateLine({ rate: null })).toBeNull();
  });

  it("maps a quote onto the shapes the review screen already renders", () => {
    expect(toOrderQuoteShape(QUOTE)).toEqual({
      quote_id: "qt_1",
      expires_at: "2026-11-23T12:01:24Z",
      amounts: {
        rate: "128.00",
        rate_currency: "KES",
        user_pays: { amount: "100.00", currency: "USDT" },
        user_receives: { amount: "12672.00", currency: "KES" },
        fees: { amount: "1.00", currency: "USDT" },
      },
    });
    expect(toSendPreviewShape(QUOTE)).toEqual({
      currency: "USDT",
      amount: "99.00",
      fee_amount: "1.00",
      total_debit: "100.00",
      receive_amount: "12672.00",
      expires_at: "2026-11-23T12:01:24Z",
    });
  });
});

describe("status", () => {
  it("knows when a send is final", () => {
    expect(isFinalSend(null)).toBe(false);
    expect(isFinalSend(send({ status: "sending" }))).toBe(false);
    expect(isFinalSend(send({ status: "processing" }))).toBe(false);
    expect(isFinalSend(send({ status: "delivered" }))).toBe(true);
    expect(isFinalSend(send({ status: "refunded" }))).toBe(true);
    expect(isFinalSend(send({ status: "failed" }))).toBe(true);
    expect(isFinalSend(send({ status: "failed", refund: { status: "pending", amount: null, completed_at: null } }))).toBe(false);
  });

  it("polls fast while moving, slowly while a refund is pending, never when final", () => {
    expect(sendPollIntervalMs(undefined)).toBe(2000);
    expect(sendPollIntervalMs(send({ status: "processing" }))).toBe(2000);
    expect(sendPollIntervalMs(send({ status: "failed", refund: { status: "pending", amount: null, completed_at: null } }))).toBe(15000);
    expect(sendPollIntervalMs(send({ status: "delivered" }))).toBe(false);
    expect(sendPollIntervalMs(send({ status: "processing" }), 30)).toBe(2000);
    expect(sendPollIntervalMs(send({ status: "processing" }), 31)).toBe(5000);
  });

  it("surfaces the failure reason and a confirmed refund only", () => {
    const failed = send({
      status: "refunded",
      failure: { code: "account_not_found", message: "KCB Bank could not find that account.", retryable: true, fix: "edit_recipient" },
      refund: { status: "completed", amount: { value: "99.50", currency: "USDT" }, completed_at: "2026-11-23T12:09:00Z" },
    });
    expect(failureMessage(failed)).toBe("KCB Bank could not find that account.");
    expect(refundText(failed)).toBe("99.50 USDT");
    expect(refundText(send({ status: "failed", refund: { status: "pending", amount: { value: "1", currency: "USDT" }, completed_at: null } }))).toBeNull();
    expect(failureMessage(send({}))).toBeNull();
  });
});

describe("errors", () => {
  const limit = { value: "10000.00", currency: "USD" };
  const err = new ApiRequestError("The most you can send to KCB Bank is 10,000.00 USD.", 400, {
    error: { code: "amount_above_limit", message: "The most you can send to KCB Bank is 10,000.00 USD.", field: "amount", limit },
  });

  it("reads the one error shape", () => {
    expect(sendApiError(err)).toEqual({
      code: "amount_above_limit",
      message: "The most you can send to KCB Bank is 10,000.00 USD.",
      field: "amount",
      limit,
    });
    expect(sendApiError(new Error("x"))).toBeNull();
    expect(sendApiError(new ApiRequestError("x", 500, { errors: [] }))).toBeNull();
  });

  it("prefers backend copy, then the error text, then the fallback", () => {
    expect(sendErrorMessage(err, "fallback")).toBe("The most you can send to KCB Bank is 10,000.00 USD.");
    expect(sendErrorMessage(new ApiRequestError("Bad gateway", 502), "fallback")).toBe("Bad gateway");
    expect(sendErrorMessage("nope", "fallback")).toBe("fallback");
  });

  it("detects an expired quote by code", () => {
    const expired = new ApiRequestError("expired", 410, { error: { code: "quote_expired", message: "The price expired.", field: "quote_id", limit: null } });
    expect(isQuoteExpired(expired)).toBe(true);
    expect(isQuoteExpired(err)).toBe(false);
  });
});

describe("payout rails", () => {
  const ach = {
    id: "dst_us_bank_ach", method: "bank", country: "US", currency: "USD", network: null, name: "ACH", logo_url: null, account_field: field, limits: null, status: "live" as const,
    source_account_ids: ["22"],
    required_fields: ["routing_number", "account_number", "bank_name", "country", "account_holder_name", "beneficiary_email"],
  };
  const swift = {
    ...ach, id: "dst_usd_bank_swift", country: null, name: "SWIFT",
    required_fields: ["swift_bic", "bank_name", "country", "account_holder_name", "iban|account_number"],
  };
  const options: SendOptions = {
    ...OPTIONS,
    destinations: [...OPTIONS.destinations, ach, swift],
    sources: [{ account_id: "22", label: "USD Balance", currency: "USD", network: null, available: "7.95" }],
  };

  it("lists only rails a held balance pays, for the currency", () => {
    expect(payoutRailDestinations(options, "usd").map((d) => d.name)).toEqual(["ACH", "SWIFT"]);
    // KES banks are reached by converting, so they are not payout rails.
    expect(payoutRailDestinations(options, "KES")).toEqual([]);
    expect(payoutRailDestinations(null, "USD")).toEqual([]);
  });

  it("finds the balance that pays a rail", () => {
    expect(payoutSource(options, ach)?.available).toBe("7.95");
    expect(payoutSource(options, OPTIONS.destinations[0])).toBeNull();
  });

  it("asks only for what the recipient step does not already collect", () => {
    expect(recipientExtraFields(ach).map((f) => f.key)).toEqual([
      "routing_number", "bank_name", "beneficiary_email",
    ]);
    // No pinned country on SWIFT, and IBAN-or-account is the account input.
    // The BIC carries the country and IBAN-or-account is the account input.
    expect(recipientExtraFields(swift).map((f) => f.key)).toEqual(["swift_bic", "bank_name"]);
    expect(recipientExtraFields(OPTIONS.destinations[0])).toEqual([]);
    expect(recipientExtraFields(ach)[0].label).toBe("Routing number");
    expect(recipientExtraFields(ach)[0].lead).toBe(true);
    expect(recipientExtraFields(ach)[1].lead).toBe(false);
  });

  it("reports the first empty field and builds trimmed details", () => {
    const fields = recipientExtraFields(ach);
    expect(missingExtraField(fields, { routing_number: "021000021" })?.key).toBe("bank_name");
    const values = { routing_number: " 021000021 ", bank_name: "Chase", beneficiary_email: "a@b.co", stray: "x" };
    expect(missingExtraField(fields, values)).toBeNull();
    expect(recipientDetails(fields, values)).toEqual({
      routing_number: "021000021", bank_name: "Chase", beneficiary_email: "a@b.co",
    });
    expect(recipientDetails([], values)).toBeUndefined();
  });

  it("flags malformed identifiers but not empty ones", () => {
    expect(extraFieldError("routing_number", "")).toBeNull();
    expect(extraFieldError("routing_number", "021000021")).toBeNull();
    expect(extraFieldError("routing_number", "021000022")).toMatch(/routing number/);
    expect(extraFieldError("swift_bic", "CHASUS3")).toMatch(/SWIFT/);
    expect(extraFieldError("bank_name", "anything")).toBeNull();
    expect(extraFieldError("beneficiary_email", "anjoki@gmail")).toMatch(/email/);
    expect(extraFieldError("beneficiary_email", "anjoki@gmail.com")).toBeNull();
    expect(extraFieldError("beneficiary_postal_code", "04", "US")).toMatch(/ZIP/);
    expect(extraFieldError("beneficiary_postal_code", "73301", "US")).toBeNull();
    // Other countries have their own formats; not checked here.
    expect(extraFieldError("beneficiary_postal_code", "04", "DE")).toBeNull();
    const fields = recipientExtraFields(ach);
    expect(invalidExtraField(fields, { routing_number: "111111111" })?.field.key).toBe("routing_number");
    expect(invalidExtraField(fields, { routing_number: "021000021" })).toBeNull();
  });

  it("checks an IBAN typed into the account box on SWIFT only", () => {
    const swiftFields = recipientExtraFields(swift);
    expect(accountBoxError(swiftFields, "DE89370400440532013001")).toMatch(/IBAN/);
    expect(accountBoxError(swiftFields, "DE89370400440532013000")).toBeNull();
    expect(accountBoxError(swiftFields, "1234567890")).toBeNull();
    expect(accountBoxError(recipientExtraFields(ach), "DE89370400440532013001")).toBeNull();
  });

  it("drops bare currencies that no held balance can pay", () => {
    const corridors = [
      { iso: "ke", code: "KES", name: "Kenya" },
      { iso: "us", code: "USD", name: "US Dollar" },
      { iso: "ca", code: "CAD", name: "Canadian Dollar" },
    ];
    // Kenya is a real country corridor; USD has ACH from a held balance; CAD has nothing.
    expect(payableCorridors(corridors, ["KE"], options).map((c) => c.code)).toEqual(["KES", "USD"]);
    // Until the options load, only real countries are offered.
    expect(payableCorridors(corridors, ["KE"], null).map((c) => c.code)).toEqual(["KES"]);
  });
});

describe("pay-from account", () => {
  const usd = { account_id: "22", label: "USD Balance", currency: "USD", network: null, available: "1.19" };
  const usdc = { account_id: "19", label: "USDC · Base", currency: "USDC", network: "base", available: "5.28" };
  const cad = { account_id: "18", label: "CAD Balance", currency: "CAD", network: null, available: null };
  const empty = { account_id: "23", label: "USDT · Polygon", currency: "USDT", network: "polygon", available: "0.00" };
  const options: SendOptions = { ...OPTIONS, sources: [cad, empty, usd, usdc] };
  const ach = { ...OPTIONS.destinations[0], id: "dst_us_bank_ach", source_account_ids: ["22"] };

  it("offers every account, or only the ones a rail names", () => {
    expect(eligibleSendSources(options, OPTIONS.destinations[0])).toHaveLength(4);
    expect(eligibleSendSources(options, ach).map((s) => s.account_id)).toEqual(["22"]);
    expect(eligibleSendSources(null, ach)).toEqual([]);
  });

  it("keeps the chosen account, else a funded wallet, else a funded balance", () => {
    const all = eligibleSendSources(options, null);
    expect(defaultSendSource(all, "19")?.account_id).toBe("19");
    // A funded stablecoin wallet is preferred over a funded fiat balance.
    expect(defaultSendSource(all, "gone")?.account_id).toBe("19");
    // With no funded wallet, the funded fiat balance.
    expect(defaultSendSource([cad, empty, usd], null)?.account_id).toBe("22");
    expect(defaultSendSource([cad, empty], null)?.account_id).toBe("18");
    expect(defaultSendSource([], null)).toBeNull();
  });

  it("labels an account with its balance", () => {
    expect(sendSourceLabel(usdc)).toBe("USDC · Base · Available 5.28 USDC");
    expect(sendSourceLabel(cad)).toBe("CAD Balance · Balance not available");
    expect(isUsdLike("usdc")).toBe(true);
    expect(isUsdLike("CAD")).toBe(false);
  });
});

