"use client";

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Mobile-parity section title row (Geist 16 bold + optional brand action). */
export default function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <div className="ep-section-header">
      <h2 className="ep-section-header__title">{title}</h2>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="ep-section-header__action">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
