import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "@/lib/apiClient";
import {
  failureMessage,
  feeText,
  findPayoutDestination,
  findWalletDestination,
  isFinalSend,
  isQuoteExpired,
  moneyText,
  rateLine,
  refundText,
  sendApiError,
  sendErrorMessage,
  sendPollIntervalMs,
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
