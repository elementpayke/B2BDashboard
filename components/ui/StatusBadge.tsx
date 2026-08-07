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
  return (
    <span
      className={`ep-activity__badge ep-activity__badge--${size}`}
      aria-label={`Status: ${label}`}
      style={{
        background: soft,
        color,
      }}
    >
      {showDot ? <span className="ep-activity__badge-dot" aria-hidden /> : null}
      {label}
    </span>
  );
}
