import React from "react";

type Props = {
  label: string;
  color: string;
  soft: string;
  icon?: string;
  /** When true, include a text-adjacent cue so status isn't color-only */
  showDot?: boolean;
  size?: "sm" | "md";
};

export default function StatusBadge({
  label,
  color,
  soft,
  icon,
  showDot = true,
  size = "sm",
}: Props) {
  return (
    <span
      className={`ep-activity__badge ep-activity__badge--${size}`}
      style={{
        background: soft,
        color,
        position: "relative",
      }}
    >
      {icon ? (
        <span className="ep-activity__badge-icon" aria-hidden>{icon}</span>
      ) : showDot ? (
        <span className="ep-activity__badge-dot" aria-hidden />
      ) : null}
      <span className="ep-activity__sr">Status: </span>
      {label}
    </span>
  );
}
