"use client";

type RateRow = {
  pair: string;
  value: string;
};

export default function HeaderRates({ rates }: { rates: RateRow[] }) {
  const lead = rates[0];
  if (!lead) return null;

  return (
    <details className="ep-header-rates">
      <summary>
        <span className="ep-header-rates__pulse" aria-hidden />
        <span className="ep-header-rates__pair">{lead.pair}</span>
        <strong>{lead.value}</strong>
        <span className="ep-header-rates__chevron" aria-hidden>⌄</span>
      </summary>
      <div className="ep-header-rates__panel" aria-label="Live exchange rates">
        <span className="ep-header-rates__title">Live rates</span>
        {rates.map((rate) => (
          <div className="ep-header-rates__row" key={rate.pair}>
            <span>{rate.pair}</span>
            <strong>{rate.value}</strong>
          </div>
        ))}
        <span className="ep-header-rates__note">Indicative rates</span>
      </div>
    </details>
  );
}
