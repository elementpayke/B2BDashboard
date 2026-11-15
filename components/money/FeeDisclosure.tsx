"use client";

/**
 * Fee and total-deducted disclosure for every flow that moves money.
 *
 * Rule (same as `lib/services/transferTerms.ts`): never invent a number. The
 * figure always comes from the quote/preview, formatted by whichever money
 * formatter the calling flow already uses — this module deliberately owns no
 * formatter of its own.
 *
 * What it does own is the *three* states a fee can be in, which are easy to
 * collapse into two and must not be:
 *
 *   CHARGED  — a real non-zero fee. Show it.
 *   NONE     — the backend said zero. "No fee" is real information the user
 *              is entitled to see; a blank or a missing row reads as "we
 *              haven't told you yet" and loses it.
 *   UNKNOWN  — no figure yet. Say *when* it will be shown rather than
 *              estimating it or rendering nothing.
 */

/** Copy for an explicit zero fee. Matches `payoutFeeText`, which got there first. */
export const NO_FEE_TEXT = "No fee";

export type FeeState = "charged" | "none" | "unknown";

/**
 * Which of the three states a raw backend fee value is in.
 *
 * Anything non-numeric (null, undefined, "", "n/a") is UNKNOWN rather than
 * zero — a parse failure is not a promise that the transfer is free.
 */
export function feeState(raw: string | number | null | undefined): FeeState {
  if (raw === null || raw === undefined) return "unknown";
  const text = String(raw).trim();
  if (!text) return "unknown";
  const n = Number(text.replace(/,/g, ""));
  if (!Number.isFinite(n)) return "unknown";
  return n === 0 ? "none" : "charged";
}

/**
 * The fee string to render.
 *
 * `formatted` is the caller's own already-formatted figure (e.g. the output
 * of `formatConvertAmount` or `money`) and is used only for the CHARGED
 * state. `whenUnknown` is the honest fallback — "Shown once confirmed",
 * "Set by the bank scheme · shown on review" — never a number.
 */
export function feeDisclosureText(params: {
  raw: string | number | null | undefined;
  formatted: string | null | undefined;
  whenUnknown: string;
}): string {
  switch (feeState(params.raw)) {
    case "none":
      return NO_FEE_TEXT;
    case "charged":
      return params.formatted?.trim() || params.whenUnknown;
    default:
      return params.whenUnknown;
  }
}

/**
 * Fee row plus the total actually leaving the account, in the
 * `ep-money-review` layout shared by the payout, send, book-transfer, and
 * bulk review steps.
 *
 * `total` is omitted when the backend has not given us one — the total is
 * never derived here, because "amount + fee" is only right on rails where
 * the fee is charged on top, and guessing wrong understates what the user
 * is about to spend.
 */
export default function FeeDisclosureRows({
  fee,
  total,
  totalLabel = "Total deducted",
  totalWhenUnknown,
}: {
  /** Already resolved through {@link feeDisclosureText}. */
  fee: string;
  /** Backend-provided total, already formatted. Null = not known yet. */
  total?: string | null;
  totalLabel?: string;
  /** Shown in place of a missing total, e.g. "Shown once confirmed". */
  totalWhenUnknown?: string | null;
}) {
  const totalText = total?.trim() || totalWhenUnknown?.trim() || "";
  return (
    <>
      <div className="ep-money-review__row">
        <span className="ep-money-review__k">Fee</span>
        <span className="ep-money-review__v ep-money-review__v--mono">{fee}</span>
      </div>
      {totalText ? (
        <div className="ep-money-review__row ep-money-review__row--emphasis">
          <span className="ep-money-review__k">{totalLabel}</span>
          <span className="ep-money-review__v ep-money-review__v--mono">{totalText}</span>
        </div>
      ) : null}
    </>
  );
}
