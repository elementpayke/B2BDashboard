/**
 * Convert routing: derive the rail from the pair the user picked.
 *
 * Convert used to make the user choose a *mode* first ("Fiat → Stablecoin",
 * "Stablecoin → Fiat", "Fiat ↔ Fiat") and then filtered the account lists to
 * match. That is backwards: the user knows which two of *their* accounts they
 * want to move between, not which of our three backends services that pair.
 * Worse, it made a whole advertised product unreachable — USDC ↔ USDT has no
 * tab, so the UI offered no route for it at all.
 *
 * So the pair is the input and the rail is the output. Four routes:
 *
 *   1. same currency, different account    → book transfer   (free)
 *   2. fiat ↔ stablecoin, either direction → ramp
 *   3. fiat ↔ fiat, different currencies   → ledger FX
 *   4. stablecoin ↔ stablecoin             → ledger FX
 *
 * Everything else is refused *here*, with a reason, before the user types an
 * amount — the whole point of resolving up front is that an unsupported pair
 * never reaches a backend to come back as a 422 the user has to decode.
 *
 * Each rule below mirrors a specific server-side guard. Those citations are
 * the contract: widening a rule here without widening it there just moves the
 * failure later, which is exactly the bug this module exists to kill.
 */

import {
  LEDGER_FIAT_CURRENCIES,
  RAMP_FIAT_CURRENCIES,
  isRampFiatCurrency,
} from "@/lib/services/conversions";
import { isStellarNetwork } from "@/lib/stellar/network";

/** The only stablecoins any convert rail accepts. */
export const CONVERT_STABLECOINS = ["USDC", "USDT"] as const;

/**
 * Every currency the ledger-FX rail (routes 3 and 4) will convert.
 *
 * Mirrors `_ALLOWED_CURRENCIES` in the aggregator's
 * `app/services/psp/nuvion/transfers/customer_conversion.py`, which is
 * `LEDGER_FIAT_CURRENCIES | {USDC, USDT}` and 422s anything outside it
 * ("Source account currency is not supported for conversion").
 *
 * A customer can *hold* far more than these — the account catalog lists ~30 —
 * so KES/TZS/ZAR balances are real and spendable, just not convertible.
 */
export const LEDGER_CONVERTIBLE_CURRENCIES = [
  ...LEDGER_FIAT_CURRENCIES,
  ...CONVERT_STABLECOINS,
] as const;

export type ConvertAssetKind = "fiat" | "stablecoin";

export function convertAssetKind(code: string | null | undefined): ConvertAssetKind {
  const upper = String(code ?? "").trim().toUpperCase();
  return (CONVERT_STABLECOINS as readonly string[]).includes(upper)
    ? "stablecoin"
    : "fiat";
}

export function isLedgerConvertibleCurrency(code: string | null | undefined): boolean {
  const upper = String(code ?? "").trim().toUpperCase();
  return (LEDGER_CONVERTIBLE_CURRENCIES as readonly string[]).includes(upper);
}

/** One side of the pair. `network` only matters for stablecoins. */
export type ConvertRouteLeg = {
  id: string;
  currency: string;
  network?: string | null;
};

export type ConvertRouteKind =
  /** One or both legs not chosen yet. Not an error. */
  | "incomplete"
  | "book_transfer"
  | "ramp"
  | "ledger_fx"
  | "unsupported";

export type ConvertRoute = {
  kind: ConvertRouteKind;
  /** Plain-language line under the pickers naming the rail. */
  summary: string;
  /** Copy for the quote's "Settles via" row. Empty when there is no rail. */
  settlesVia: string;
  /** Why this pair is refused. Empty unless `kind` is "unsupported". */
  reason: string;
};

/** True for an Element-provisioned Stellar account — see `stellarRefusal`. */
export function isStellarLeg(leg: ConvertRouteLeg | null | undefined): boolean {
  return Boolean(leg) && isStellarNetwork(leg?.network);
}

/** "EUR, USD and GBP" — so refusals can name the real set without a wall of commas. */
export function listCurrencies(codes: readonly string[]): string {
  const list = codes.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

function normalizeLeg(
  leg: ConvertRouteLeg | null | undefined,
): ConvertRouteLeg | null {
  if (!leg) return null;
  const currency = String(leg.currency ?? "").trim().toUpperCase();
  const id = String(leg.id ?? "").trim();
  if (!id || !currency) return null;
  return { id, currency, network: leg.network ?? null };
}

function unsupported(reason: string): ConvertRoute {
  return { kind: "unsupported", summary: "Not available", settlesVia: "", reason };
}

/**
 * The route for a (source, destination) pair.
 *
 * Pure and total: every pair gets an answer, and an unsupported one carries
 * copy that names the actual currency at fault rather than "unsupported pair".
 */
export function resolveConvertRoute(
  source: ConvertRouteLeg | null | undefined,
  destination: ConvertRouteLeg | null | undefined,
): ConvertRoute {
  const src = normalizeLeg(source);
  const dst = normalizeLeg(destination);

  if (!src || !dst) {
    return {
      kind: "incomplete",
      summary: "Pick an account to convert from and an account to receive.",
      settlesVia: "",
      reason: "",
    };
  }

  if (src.id === dst.id) {
    return unsupported(
      "Pick two different accounts — money has to land somewhere other than where it started.",
    );
  }

  const srcKind = convertAssetKind(src.currency);
  const dstKind = convertAssetKind(dst.currency);

  // ── Route 1: same currency → book transfer ───────────────────────────────
  //
  // Free, per pricing sheet s1 ("Transfers between Mboka accounts (any
  // currency): Free"), and open to every currency a customer can hold — the
  // aggregator puts no allowlist on book transfers. It does require *fiat*
  // on both legs: `_assert_active_fiat` in `book_transfer.py` 422s a
  // stablecoin account with "Book transfers are only supported on fiat
  // accounts". Two same-currency stablecoin accounts therefore have no rail
  // here at all — conversion refuses them too, because
  // `customer_conversion.py` requires `from_ccy != to_ccy`.
  if (src.currency === dst.currency) {
    if (srcKind === "fiat" && dstKind === "fiat") {
      return {
        kind: "book_transfer",
        summary: "Same currency — moves instantly between your accounts, no fee.",
        settlesVia: "Book transfer · your accounts",
        reason: "",
      };
    }
    return unsupported(
      `${src.currency} → ${src.currency} isn't a conversion, and book transfers run on fiat accounts only. ` +
        `Use Send to move ${src.currency} between your stablecoin accounts.`,
    );
  }

  // Everything past here converts, and no conversion rail accepts an
  // Element-provisioned Stellar account. Its `ep_stellar:` id is unknown to
  // Nuvion, and unlike the swap path the conversion path has no
  // `is_element_provisioned_account` guard — so it gets as far as refreshing
  // the balance and dies with a 502 instead of a clean 422. Refusing it here
  // is the difference between an explanation and an unexplained failure.
  const stellar = isStellarLeg(src) ? src : isStellarLeg(dst) ? dst : null;
  if (stellar) {
    return unsupported(
      `Stellar ${stellar.currency} can't be converted yet — only sent and received. ` +
        `Move the balance to a Base or Polygon ${stellar.currency} account to convert it.`,
    );
  }

  // ── Route 2: fiat ↔ stablecoin → ramp ────────────────────────────────────
  //
  // Mboka `POST /v1/conversions/quote`. Its `resolve_pair` accepts only
  // EUR/GBP/USD against USDC|USDT, so the fiat leg stays on the narrower
  // ramp list even though the ledger rail below would take seven.
  if (srcKind !== dstKind) {
    const fiat = srcKind === "fiat" ? src : dst;
    const stable = srcKind === "fiat" ? dst : src;
    if (!isRampFiatCurrency(fiat.currency)) {
      return unsupported(
        `${fiat.currency} can't be converted to ${stable.currency} yet — ` +
          `stablecoin conversions are available for ${listCurrencies(RAMP_FIAT_CURRENCIES)}.`,
      );
    }
    const onRamp = srcKind === "fiat";
    return {
      kind: "ramp",
      summary: onRamp
        ? `On-ramp — buys ${stable.currency} with your ${fiat.currency} balance.`
        : `Off-ramp — sells ${stable.currency} into your ${fiat.currency} balance.`,
      settlesVia: `Conversion order · ${src.currency} → ${dst.currency}`,
      reason: "",
    };
  }

  // ── Routes 3 and 4: fiat ↔ fiat, and stablecoin ↔ stablecoin → ledger FX ─
  //
  // Both go to the aggregator's customer conversions
  // (`/v1/entities/{entity_id}/accounts/{account_id}/conversions/preview`),
  // whose only pair rule is `from != to` once both currencies are in
  // `_ALLOWED_CURRENCIES`. That is what makes USDC ↔ USDT work — and why it
  // must NOT go through Mboka's `/v1/conversions/quote`, whose `resolve_pair`
  // explicitly raises "stablecoin-to-stablecoin conversions are not
  // supported".
  const offending = [src, dst].find((leg) => !isLedgerConvertibleCurrency(leg.currency));
  if (offending) {
    return unsupported(
      `${offending.currency} accounts can't be converted yet — available for ` +
        `${listCurrencies(LEDGER_CONVERTIBLE_CURRENCIES)}.`,
    );
  }

  return {
    kind: "ledger_fx",
    summary:
      srcKind === "stablecoin"
        ? `Converts on the ledger — ${src.currency} to ${dst.currency}, one quote, one confirm.`
        : "Converts on the ledger — one quote, one confirm.",
    settlesVia: "Ledger FX · same customer",
    reason: "",
  };
}

/** True when a route can actually be quoted. */
export function isQuotableRoute(route: ConvertRoute): boolean {
  return (
    route.kind === "book_transfer" ||
    route.kind === "ramp" ||
    route.kind === "ledger_fx"
  );
}
