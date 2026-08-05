import React from "react";

type Props = {
  label: string;
  color: string;
  soft: string;
  /** When true, include a text-only cue so status isn't color-only */
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
  const pad = size === "md" ? "6px 12px" : "4px 11px";
  const fontSize = size === "md" ? "12px" : "11px";
  return (
    <span
      aria-label={`Status: ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize,
        fontWeight: 700,
        padding: pad,
        borderRadius: "999px",
        background: soft,
        color,
        width: "fit-content",
        whiteSpace: "nowrap",
      }}
    >
      {showDot ? (
        <span
          aria-hidden
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "currentColor",
            flexShrink: 0,
          }}
        />
      ) : null}
      {label}
    </span>
  );
}
