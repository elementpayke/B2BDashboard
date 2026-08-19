const MAX_STELLAR_DECIMALS = 7;

export type ParsedStellarAmount = {
  ok: boolean;
  amount: string | null;
  error: string | null;
};

/**
 * Normalize a user-entered amount into a Stellar payment string (up to 7 decimals).
 */
export function parseStellarAmount(raw: string): ParsedStellarAmount {
  const trimmed = raw.trim().replace(/,/g, "").replace(/\.$/, "");
  if (!trimmed) {
    return { ok: false, amount: null, error: "Enter an amount to send from your wallet." };
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, amount: null, error: "Amount must be a positive number." };
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > MAX_STELLAR_DECIMALS) {
    return { ok: false, amount: null, error: "Stellar amounts support at most 7 decimal places." };
  }
  const asNumber = Number(trimmed);
  if (!Number.isFinite(asNumber) || asNumber <= 0) {
    return { ok: false, amount: null, error: "Enter an amount greater than zero." };
  }
  const normalizedFrac = frac.replace(/0+$/, "");
  const amount = normalizedFrac.length > 0 ? `${whole.replace(/^0+(?=\d)/, "") || "0"}.${normalizedFrac}` : String(BigInt(whole));
  return { ok: true, amount, error: null };
}
