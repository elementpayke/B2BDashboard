import { describe, expect, it } from "vitest";
import {
  formatSavedRecipientSummary,
  isRailType,
  parseCreateSavedRecipientInput,
  toSendFormFields,
  type SavedRecipient,
} from "./savedRecipients";

describe("isRailType", () => {
  it("accepts bank, mobile, crypto", () => {
    expect(isRailType("bank")).toBe(true);
    expect(isRailType("mobile")).toBe(true);
    expect(isRailType("crypto")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isRailType("momo")).toBe(false);
    expect(isRailType("")).toBe(false);
    expect(isRailType(null)).toBe(false);
  });
});

describe("parseCreateSavedRecipientInput", () => {
  it("normalises a valid mobile payload", () => {
    const result = parseCreateSavedRecipientInput({
      label: "  Jane Mukami  ",
      accountNumber: " 0712345678 ",
      railType: "mobile",
      countryCode: "ke",
      currency: "kes",
      provider: "mpesa",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({
      label: "Jane Mukami",
      accountNumber: "0712345678",
      railType: "mobile",
      countryCode: "KE",
      currency: "KES",
      provider: "mpesa",
      network: null,
    });
  });

  it("requires network for crypto rails", () => {
    const missing = parseCreateSavedRecipientInput({
      label: "Treasury",
      accountNumber: "0xabc123",
      railType: "crypto",
    });
    expect(missing.ok).toBe(false);
    if (missing.ok === false) {
      expect(missing.field).toBe("network");
    }

    const ok = parseCreateSavedRecipientInput({
      label: "Treasury",
      accountNumber: "0xabc123",
      railType: "crypto",
      network: "Base",
    });
    expect(ok.ok).toBe(true);

    const stellar = parseCreateSavedRecipientInput({
      label: "Stellar desk",
      accountNumber: "GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE",
      railType: "crypto",
      network: "stellar",
    });
    expect(stellar.ok).toBe(true);
  });

  it("rejects empty label / accountNumber / bad railType", () => {
    expect(parseCreateSavedRecipientInput({ label: " ", accountNumber: "x", railType: "bank" }).ok).toBe(
      false,
    );
    expect(
      parseCreateSavedRecipientInput({ label: "A", accountNumber: "  ", railType: "bank" }).ok,
    ).toBe(false);
    expect(
      parseCreateSavedRecipientInput({ label: "A", accountNumber: "x", railType: "wire" }).ok,
    ).toBe(false);
  });

  it("rejects non-object bodies", () => {
    expect(parseCreateSavedRecipientInput(null).ok).toBe(false);
    expect(parseCreateSavedRecipientInput("nope").ok).toBe(false);
    expect(parseCreateSavedRecipientInput([]).ok).toBe(false);
  });

  it("coerces blank optional strings to null", () => {
    const result = parseCreateSavedRecipientInput({
      label: "Acme Ltd",
      accountNumber: "1234567890",
      railType: "bank",
      countryCode: "  ",
      currency: "",
      provider: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.countryCode).toBeNull();
    expect(result.value.currency).toBeNull();
    expect(result.value.provider).toBeNull();
  });

  it("accepts UI aliases name/account/rail", () => {
    const result = parseCreateSavedRecipientInput({
      name: "Jane",
      account: "0712345678",
      rail: "mobile",
      countryCode: "KE",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.label).toBe("Jane");
    expect(result.value.accountNumber).toBe("0712345678");
    expect(result.value.railType).toBe("mobile");
  });
});

describe("toSendFormFields / formatSavedRecipientSummary", () => {
  const sample: SavedRecipient = {
    id: "r1",
    businessId: 9,
    label: "Jane Mukami",
    accountNumber: "254712345678",
    railType: "mobile",
    countryCode: "KE",
    currency: "KES",
    provider: "M-Pesa",
    network: null,
    createdAt: "2026-08-09T00:00:00.000Z",
    updatedAt: "2026-08-09T00:00:00.000Z",
  };

  it("maps saved rows onto Send form fields", () => {
    expect(toSendFormFields(sample)).toEqual({
      recipientName: "Jane Mukami",
      recipient: "254712345678",
      railType: "mobile",
      countryCode: "KE",
      currency: "KES",
      provider: "M-Pesa",
      network: null,
    });
  });

  it("builds a short picker summary with masked account", () => {
    expect(formatSavedRecipientSummary(sample)).toBe("Jane Mukami · Mobile money · •••5678");
  });
});
