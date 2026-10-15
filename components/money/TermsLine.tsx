"use client";

/**
 * Per-transaction limits and fee status under the amount field — the two
 * things people otherwise discover only when a transfer is rejected.
 */
export default function TermsLine({
  id,
  limits,
  error,
  fee,
}: {
  id: string;
  limits?: string | null;
  error?: string | null;
  fee?: string | null;
}) {
  if (!limits && !error && !fee) return null;
  return (
    <span id={id} className={`ep-terms-line${error ? " ep-terms-line--error" : ""}`} role={error ? "alert" : undefined}>
      {error ? (
        <span className="ep-terms-line__err">{error}</span>
      ) : limits ? (
        <span>{limits}</span>
      ) : null}
      {fee && !error ? <span className="ep-terms-line__fee">Fee · {fee}</span> : null}
    </span>
  );
}

