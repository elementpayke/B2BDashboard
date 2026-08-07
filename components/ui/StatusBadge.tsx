import React from "react";

type Props = {
  label: string;
  color: string;
  soft: string;
  /** When true, include a text-adjacent cue so status isn't color-only */
  showDot?: boolean;
  size?: "sm" | "md";
};

export default function StatusBadge({
  label,
  color,
  soft,
  showDot = true,
  size = "sm",
}: Props) {
  const sizeClass = size === "md" ? " ep-activity-status--md" : "";
  return (
    <span
      className={`ep-activity-status${sizeClass}`}
      aria-label={`Status: ${label}`}
      style={{
        background: soft,
        color,
      }}
    >
      {showDot ? <span className="ep-activity-status__dot" aria-hidden /> : null}
      <span className="ep-activity-status__label">{label}</span>
    </span>
  );
}
