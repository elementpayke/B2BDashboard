import { describe, expect, it } from "vitest";
import {
  LEDGER_CONVERTIBLE_CURRENCIES,
  convertAssetKind,
  isLedgerConvertibleCurrency,
  isQuotableRoute,
  isStellarLeg,
  listCurrencies,
  resolveConvertRoute,
  type ConvertRouteLeg,
} from "./convertRoutes";

const fiat = (currency: string, id = `fiat-${currency}`): ConvertRouteLeg => ({
  id,
  currency,
  network: null,
});

const stable = (
  currency: string,
  network = "polygon",
  id = `stable-${currency}-${network}`,
): ConvertRouteLeg => ({ id, currency, network });

describe("convertAssetKind", () => {
  it("treats only USDC and USDT as stablecoins", () => {
    expect(convertAssetKind("USDC")).toBe("stablecoin");
    expect(convertAssetKind("usdt")).toBe("stablecoin");
    expect(convertAssetKind("EUR")).toBe("fiat");
    expect(convertAssetKind("KES")).toBe("fiat");
    // EURC is holdable but no convert rail quotes it, so it is not special-cased.
    expect(convertAssetKind("EURC")).toBe("fiat");
  });
});

describe("route 1 — same currency goes to a book transfer", () => {
  it("routes two EUR accounts to the free book-transfer rail", () => {
    const route = resolveConvertRoute(fiat("EUR", "a"), fiat("EUR", "b"));
    expect(route.kind).toBe("book_transfer");
    expect(route.summary).toContain("no fee");
    expect(isQuotableRoute(route)).toBe(true);
  });

  it("allows a currency the conversion rails refuse", () => {
    // KES is not in _ALLOWED_CURRENCIES, but book transfers carry no currency
    // allowlist at all — only a fiat + active check. Hiding KES from Convert
    // would hide a move that works.
    const route = resolveConvertRoute(fiat("KES", "a"), fiat("KES", "b"));
    expect(route.kind).toBe("book_transfer");
  });

  it("refuses a same-currency stablecoin pair, which has no rail", () => {
    // book_transfer.py: "Book transfers are only supported on fiat accounts".
    // customer_conversion.py needs from_ccy != to_ccy. Neither will take it.
    const route = resolveConvertRoute(
      stable("USDC", "polygon", "a"),
      stable("USDC", "base", "b"),
    );
    expect(route.kind).toBe("unsupported");
    expect(route.reason).toContain("fiat accounts only");
    expect(isQuotableRoute(route)).toBe(false);
  });
});

describe("route 2 — fiat <-> stablecoin goes to the ramp", () => {
  it("routes EUR -> USDC as an on-ramp", () => {
    const route = resolveConvertRoute(fiat("EUR"), stable("USDC"));
    expect(route.kind).toBe("ramp");
    expect(route.summary).toContain("On-ramp");
  });

  it("routes USDT -> GBP as an off-ramp", () => {
    const route = resolveConvertRoute(stable("USDT"), fiat("GBP"));
    expect(route.kind).toBe("ramp");
    expect(route.summary).toContain("Off-ramp");
  });

  it.each(["EUR", "GBP", "USD"])("accepts %s against a stablecoin", (code) => {
    expect(resolveConvertRoute(fiat(code), stable("USDC")).kind).toBe("ramp");
  });

  it.each(["NGN", "CAD", "GHS", "AED"])(
    "refuses %s against a stablecoin even though ledger FX takes it",
    (code) => {
      // Mboka's resolve_pair: "conversions support only EUR/GBP/USD ↔ USDC|USDT".
      const route = resolveConvertRoute(fiat(code), stable("USDC"));
      expect(route.kind).toBe("unsupported");
      expect(route.reason).toContain(code);
      expect(route.reason).toContain("EUR, GBP and USD");
    },
  );
});

describe("route 3 — fiat <-> fiat goes to ledger FX", () => {
  it("routes EUR -> USD on the ledger", () => {
    const route = resolveConvertRoute(fiat("EUR"), fiat("USD"));
    expect(route.kind).toBe("ledger_fx");
    expect(route.settlesVia).toBe("Ledger FX · same customer");
  });

  it("takes the wider ledger set the ramp refuses", () => {
    expect(resolveConvertRoute(fiat("CAD"), fiat("NGN")).kind).toBe("ledger_fx");
    expect(resolveConvertRoute(fiat("AED"), fiat("GHS")).kind).toBe("ledger_fx");
  });
});

describe("route 4 — stablecoin <-> stablecoin goes to ledger FX", () => {
  // The advertised product (pricing sheet s4, "Stablecoin transfer (incl.
  // USDC <-> USDT): 0.25%") that the mode tabs left with no route at all.
  it("routes USDC -> USDT on the ledger, not through the ramp", () => {
    const route = resolveConvertRoute(stable("USDC"), stable("USDT"));
    expect(route.kind).toBe("ledger_fx");
    // Must NOT be "ramp": Mboka's resolve_pair raises
    // "stablecoin-to-stablecoin conversions are not supported".
    expect(route.settlesVia).toBe("Ledger FX · same customer");
    expect(isQuotableRoute(route)).toBe(true);
  });

  it("routes USDT -> USDC the same way", () => {
    expect(resolveConvertRoute(stable("USDT"), stable("USDC")).kind).toBe("ledger_fx");
  });

  it("works across different chains", () => {
    const route = resolveConvertRoute(
      stable("USDC", "base"),
      stable("USDT", "polygon"),
    );
    expect(route.kind).toBe("ledger_fx");
  });
});

describe("route 5 — unsupported pairs are refused before the amount", () => {
  it("names the currency at fault for a non-convertible fiat pair", () => {
    const route = resolveConvertRoute(fiat("KES"), fiat("EUR"));
    expect(route.kind).toBe("unsupported");
    expect(route.reason).toContain("KES");
    expect(route.reason).toContain(
      "EUR, USD, GBP, CAD, NGN, GHS, AED, USDC and USDT",
    );
  });

  it("refuses when only the destination is non-convertible", () => {
    const route = resolveConvertRoute(fiat("EUR"), fiat("TZS"));
    expect(route.kind).toBe("unsupported");
    expect(route.reason).toContain("TZS");
  });

  it("refuses the same account on both sides", () => {
    const route = resolveConvertRoute(fiat("EUR", "same"), fiat("USD", "same"));
    expect(route.kind).toBe("unsupported");
    expect(route.reason).toContain("two different accounts");
  });

  it("reports an unchosen leg as incomplete, not as a refusal", () => {
    expect(resolveConvertRoute(fiat("EUR"), null).kind).toBe("incomplete");
    expect(resolveConvertRoute(null, null).reason).toBe("");
    // A row with no id or no currency is not a choice either.
    expect(resolveConvertRoute(fiat("EUR"), { id: "", currency: "USD" }).kind).toBe(
      "incomplete",
    );
  });

  it("never leaves a refusal without a reason", () => {
    const pairs: [ConvertRouteLeg, ConvertRouteLeg][] = [
      [fiat("KES"), fiat("EUR")],
      [fiat("NGN"), stable("USDC")],
      [stable("USDC", "stellar"), fiat("EUR")],
      [stable("USDC", "polygon", "a"), stable("USDC", "base", "b")],
      [fiat("EUR", "same"), fiat("USD", "same")],
    ];
    for (const [from, to] of pairs) {
      const route = resolveConvertRoute(from, to);
      expect(route.kind).toBe("unsupported");
      expect(route.reason.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("Stellar accounts are kept off every conversion rail", () => {
  // Their `ep_stellar:` id is unknown to Nuvion and the conversion path has no
  // is_element_provisioned guard, so the failure is a 502 on balance refresh
  // rather than a clean 422. Refusing here is the difference between an
  // explanation and an unexplained error.
  it("detects a Stellar leg from the network", () => {
    expect(isStellarLeg(stable("USDC", "stellar"))).toBe(true);
    expect(isStellarLeg(stable("USDC", "STELLAR"))).toBe(true);
    expect(isStellarLeg(stable("USDC", "polygon"))).toBe(false);
    expect(isStellarLeg(fiat("EUR"))).toBe(false);
  });

  it("refuses a Stellar source on ledger FX (route 4)", () => {
    const route = resolveConvertRoute(stable("USDC", "stellar"), stable("USDT"));
    expect(route.kind).toBe("unsupported");
    expect(route.reason).toContain("Stellar");
  });

  it("refuses a Stellar destination on ledger FX (route 4)", () => {
    const route = resolveConvertRoute(stable("USDT"), stable("USDC", "stellar"));
    expect(route.kind).toBe("unsupported");
    expect(route.reason).toContain("Stellar");
  });

  it("refuses a Stellar leg on the ramp too", () => {
    expect(resolveConvertRoute(stable("USDC", "stellar"), fiat("EUR")).kind).toBe(
      "unsupported",
    );
    expect(resolveConvertRoute(fiat("EUR"), stable("USDC", "stellar")).kind).toBe(
      "unsupported",
    );
  });

  it("still routes a non-Stellar pair that looks otherwise identical", () => {
    expect(resolveConvertRoute(stable("USDC", "base"), stable("USDT")).kind).toBe(
      "ledger_fx",
    );
  });
});

describe("the convertible currency set", () => {
  it("is exactly the nine the aggregator allows", () => {
    expect([...LEDGER_CONVERTIBLE_CURRENCIES]).toEqual([
      "EUR",
      "USD",
      "GBP",
      "CAD",
      "NGN",
      "GHS",
      "AED",
      "USDC",
      "USDT",
    ]);
  });

  it("excludes currencies a customer can hold but not convert", () => {
    for (const code of ["KES", "TZS", "ZAR", "UGX", "EURC"]) {
      expect(isLedgerConvertibleCurrency(code)).toBe(false);
    }
  });
});

describe("listCurrencies", () => {
  it("reads as a sentence rather than a comma dump", () => {
    expect(listCurrencies(["EUR", "GBP", "USD"])).toBe("EUR, GBP and USD");
    expect(listCurrencies(["EUR", "USD"])).toBe("EUR and USD");
    expect(listCurrencies(["EUR"])).toBe("EUR");
    expect(listCurrencies([])).toBe("");
  });
});
