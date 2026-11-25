/**
 * Offline checks on bank identifiers a payout rail asks for.
 *
 * They catch a mistyped routing number, SWIFT/BIC or IBAN as it is typed.
 * They show the identifier is well-formed, not that the account exists. The
 * backend runs the same checks (`app/domain/send_routing/bank_checks.py`), so
 * keep the two in step.
 */

const BIC = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const IBAN_SHAPE = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/;

/** IBAN length per country (ISO 13616). Others are checked on shape + checksum. */
const IBAN_LENGTHS: Record<string, number> = {
  AD: 24, AE: 23, AT: 20, BE: 16, BG: 22, BH: 22, CH: 21, CY: 28, CZ: 24, DE: 22,
  DK: 18, EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GI: 23, GR: 27, HR: 21, HU: 28,
  IE: 22, IL: 23, IS: 26, IT: 27, KW: 30, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27,
  MT: 31, MU: 30, NL: 18, NO: 15, PL: 28, PT: 25, QA: 29, RO: 24, SA: 24, SE: 24,
  SI: 19, SK: 24, SM: 27, TR: 26,
};

/** Upper-cased with spaces and dashes removed. */
export function compactBankCode(value: string | null | undefined): string {
  return String(value ?? "").replace(/[\s-]+/g, "").toUpperCase();
}

/** US ABA routing number: nine digits whose weighted sum is a multiple of ten. */
export function isValidRoutingNumber(value: string | null | undefined): boolean {
  const digits = compactBankCode(value);
  if (!/^[0-9]{9}$/.test(digits) || digits === "000000000") return false;
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1];
  const sum = weights.reduce((total, weight, i) => total + Number(digits[i]) * weight, 0);
  return sum % 10 === 0;
}

/** SWIFT/BIC: 8 or 11 characters (bank, country, location, optional branch). */
export function isValidBic(value: string | null | undefined): boolean {
  return BIC.test(compactBankCode(value));
}

/** The ISO country inside a valid BIC (characters 5–6), else null. */
export function bicCountry(value: string | null | undefined): string | null {
  const code = compactBankCode(value);
  return BIC.test(code) ? code.slice(4, 6) : null;
}

/** Two letters then two digits: meant as an IBAN, valid or not. */
export function looksLikeIban(value: string | null | undefined): boolean {
  return /^[A-Z]{2}[0-9]{2}/.test(compactBankCode(value));
}

/** IBAN: known country length where we have it, then the mod-97 checksum. */
export function isValidIban(value: string | null | undefined): boolean {
  const iban = compactBankCode(value);
  if (!IBAN_SHAPE.test(iban)) return false;
  const expected = IBAN_LENGTHS[iban.slice(0, 2)];
  if (expected !== undefined && iban.length !== expected) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = String(parseInt(ch, 36));
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}
