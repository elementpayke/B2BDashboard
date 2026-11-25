"use client";

/**
 * Per-transaction limits, fee status, and total deducted under the amount
 * field — the things people otherwise discover only when a transfer is
 * rejected, or on the statement afterwards.
 *
 * `fee` and `total` are strings the caller has already resolved through
 * `feeDisclosureText` / its own money formatter, so a zero fee arrives here
 * as "No fee" rather than as a value this component has to interpret. See
 * `components/money/FeeDisclosure.tsx` for the three fee states.
 */
export default function TermsLine({
  id,
  limits,
  error,
  fee,
  total,
  totalLabel = "Total",
}: {
  id: string;
  limits?: string | null;
  error?: string | null;
  fee?: string | null;
  /** What actually leaves the account, when the backend has quoted it. */
  total?: string | null;
  totalLabel?: string;
}) {
  if (!limits && !error && !fee && !total) return null;
  return (
    <span id={id} className={`ep-terms-line${error ? " ep-terms-line--error" : ""}`} role={error ? "alert" : undefined}>
      {error ? (
        <span className="ep-terms-line__err">{error}</span>
      ) : limits ? (
        <span>{limits} per transaction</span>
      ) : null}
      {fee && !error ? <span className="ep-terms-line__fee">Fee · {fee}</span> : null}
      {total && !error ? (
        <span className="ep-terms-line__fee">
          {totalLabel} · {total}
        </span>
      ) : null}
    </span>
  );
}
