/**
 * ITU-T E.164 country calling codes (digits only) keyed by ISO 3166-1 alpha-2.
 * Used to normalise mobile-money account numbers when the supported catalog
 * does not carry dial codes itself.
 */
const DIAL_BY_ISO: Record<string, string> = {
  AR: "54",
  AT: "43",
  BE: "32",
  BG: "359",
  BR: "55",
  BW: "267",
  CH: "41",
  CY: "357",
  CZ: "420",
  DE: "49",
  DK: "45",
  DO: "1",
  EE: "372",
  EG: "20",
  ES: "34",
  FI: "358",
  FR: "33",
  GB: "44",
  GH: "233",
  GR: "30",
  HR: "385",
  HU: "36",
  IE: "353",
  IS: "354",
  IT: "39",
  KE: "254",
  LI: "423",
  LT: "370",
  LU: "352",
  LV: "371",
  MT: "356",
  MW: "265",
  MY: "60",
  NG: "234",
  NL: "31",
  NO: "47",
  PL: "48",
  PT: "351",
  RO: "40",
  RS: "381",
  RW: "250",
  SE: "46",
  SI: "386",
  SK: "421",
  TZ: "255",
  UG: "256",
  US: "1",
  ZA: "27",
};

/** Digits-only calling code for an ISO country, or undefined if unknown. */
export function dialCodeForIso(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  return DIAL_BY_ISO[iso.trim().toUpperCase()];
}
