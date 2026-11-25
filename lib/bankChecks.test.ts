import { describe, expect, it } from "vitest";
import {
  bicCountry,
  compactBankCode,
  isValidBic,
  isValidIban,
  isValidRoutingNumber,
  looksLikeIban,
} from "./bankChecks";

describe("routing number", () => {
  it.each(["021000021", "011401533", "0210-0002-1", " 021000021 "])("accepts %s", (value) => {
    expect(isValidRoutingNumber(value)).toBe(true);
  });
  it.each(["021000022", "12345678", "0210000210", "abcdefghi", "000000000", ""])(
    "rejects %s",
    (value) => {
      expect(isValidRoutingNumber(value)).toBe(false);
    },
  );
});

describe("SWIFT/BIC", () => {
  it("checks the shape and reads the country", () => {
    expect(isValidBic("chasus33")).toBe(true);
    expect(isValidBic("DEUTDEFF500")).toBe(true);
    expect(bicCountry("deutdeff")).toBe("DE");
    for (const bad of ["CHAS", "CHASUS3", "CHASUS333X", "1HASUS33", ""]) {
      expect(isValidBic(bad)).toBe(false);
      expect(bicCountry(bad)).toBeNull();
    }
  });
});

describe("IBAN", () => {
  it("checks length and checksum", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("gb82west12345698765432")).toBe(true);
    expect(isValidIban("DE89370400440532013001")).toBe(false);
    expect(isValidIban("DE8937040044053201300")).toBe(false);
    expect(isValidIban("1234567890")).toBe(false);
    expect(looksLikeIban("de89")).toBe(true);
    expect(looksLikeIban("1234567890")).toBe(false);
    expect(compactBankCode(" de89-3704 ")).toBe("DE893704");
  });
});
