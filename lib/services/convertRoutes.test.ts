import { describe, expect, it } from "vitest";
import {
  convertAssetKind,
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
    "sends %s against a stablecoin to the ledger, which prices it",
    (code) => {
      // The ramp's resolve_pair only takes EUR/GBP/USD; the ledger conversion
      // takes the rest, so fall through to it rather than refuse.
      const route = resolveConvertRoute(fiat(code), stable("USDC"));
      expect(route.kind).toBe("ledger_fx");
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
  it("routes a holdable currency the old list excluded", () => {
    // KES was refused client-side while the aggregator and the published
    // pricing ("in-app currency conversion, e.g. USD <-> KES") both allowed
    // it. Holding the account is the precondition; the UI no longer keeps a
    // second, shorter list that can only be wrong by refusing valid pairs.
    expect(resolveConvertRoute(fiat("KES"), fiat("EUR")).kind).toBe("ledger_fx");
    expect(resolveConvertRoute(fiat("EUR"), fiat("TZS")).kind).toBe("ledger_fx");
    expect(resolveConvertRoute(fiat("KES"), stable("USDT")).kind).toBe("ledger_fx");
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
      [stable("USDC", "polygon", "a"), stable("USDC", "base", "b")],
      [stable("USDC", "stellar", "a"), stable("USDC", "base", "b")],
      [fiat("EUR", "same"), fiat("USD", "same")],
    ];
    for (const [from, to] of pairs) {
      const route = resolveConvertRoute(from, to);
      expect(route.kind).toBe("unsupported");
      expect(route.reason.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("Stellar USDC converts through the bridged ledger route", () => {
  // CONVERSIONS.md: a Stellar leg is bridged over CCTP via a Nuvion Base USDC
  // account. The ramp has no bridge, so even EUR/GBP/USD pairs go to the ledger.
  it("detects a Stellar leg from the network", () => {
    expect(isStellarLeg(stable("USDC", "stellar"))).toBe(true);
    expect(isStellarLeg(stable("USDC", "STELLAR"))).toBe(true);
    expect(isStellarLeg(stable("USDC", "polygon"))).toBe(false);
    expect(isStellarLeg(fiat("EUR"))).toBe(false);
  });

  it.each([
    [stable("USDC", "stellar"), fiat("USD")],
    [fiat("USD"), stable("USDC", "stellar")],
    [stable("USDC", "stellar"), stable("USDT")],
    [stable("USDT"), stable("USDC", "stellar")],
    [stable("USDC", "stellar"), fiat("NGN")],
  ])("routes %o -> %o to the ledger as bridged", (from, to) => {
    const route = resolveConvertRoute(from, to);
    expect(route.kind).toBe("ledger_fx");
    expect(route.settlesVia).toContain("Bridged");
    expect(route.summary).toContain("few minutes");
  });

  it("still refuses Stellar USDC to USDC on another chain — that is a Send", () => {
    const route = resolveConvertRoute(
      stable("USDC", "stellar", "a"),
      stable("USDC", "base", "b"),
    );
    expect(route.kind).toBe("unsupported");
    expect(route.reason).toContain("Send");
  });

  it("keeps a non-Stellar EUR/GBP/USD pair on the ramp", () => {
    expect(resolveConvertRoute(stable("USDC", "base"), fiat("USD")).kind).toBe("ramp");
  });

  it("still routes a non-Stellar stablecoin pair as direct ledger FX", () => {
    const route = resolveConvertRoute(stable("USDC", "base"), stable("USDT"));
    expect(route.kind).toBe("ledger_fx");
    expect(route.settlesVia).toBe("Ledger FX · same customer");
  });
});

describe("fiat ↔ fiat is not gated by a client-side currency list", () => {
  // The bug: the UI mirrored an old aggregator allowlist of seven fiats, so
  // it refused KES → USD even though the backend and the published pricing
  // both allowed it. Every currency below sits outside that old list. If
  // anyone reintroduces a list, these are what fail.
  const OUTSIDE_THE_OLD_LIST = ["KES", "TZS", "ZAR", "MXN"];

  for (const code of OUTSIDE_THE_OLD_LIST) {
    it(`routes ${code} → USD on the ledger`, () => {
      expect(resolveConvertRoute(fiat(code), fiat("USD")).kind).toBe("ledger_fx");
    });

    it(`routes USD → ${code} on the ledger`, () => {
      expect(resolveConvertRoute(fiat("USD"), fiat(code)).kind).toBe("ledger_fx");
    });
  }

  it("sends a non-ramp fiat against a stablecoin to the ledger too", () => {
    // The ramp takes only EUR/GBP/USD against a stablecoin, but the ledger
    // conversion prices the rest, so nothing is refused for currency alone.
    expect(resolveConvertRoute(fiat("KES"), stable("USDC")).kind).toBe("ledger_fx");
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
