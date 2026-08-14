"use client";
import React, { useId } from "react";

/**
 * Mboka "Chamfer" symbol — two blocks cut on the same 45° angle, overlapping.
 *
 * Geometry is copied verbatim from the brand kit (brand-chamfer/*.svg); the
 * back block always sits at 45% opacity of the front, which is what reads as
 * two markets rather than one shape. Do not equalise them.
 *
 * Colour comes from the theme tokens rather than the kit's literal hexes,
 * because the tokens already carry the kit's values on both surfaces:
 * --indigo is #3B2ED3 on light and #7C6FFF ("indigo lift") on dark, and
 * --indigo-on is the matching foreground.
 *
 * Motion: the kit ships three state-change animations. Its animated SVG
 * exports arrived with their SMIL stripped, so the behaviours are reproduced
 * here as CSS on the inline mark (see .ep-mark-* in globals.css). They fire
 * only on state change and fall back to the static mark under
 * prefers-reduced-motion — a mark that moves on every screen stops meaning
 * anything.
 */
export type MbokaMotion = "static" | "inflight" | "settlement" | "routing";

/**
 * brand   — indigo plate, light foreground. Default.
 * mono    — plateless, inherits currentColor. For one-colour contexts.
 * inverse — light plate, ink foreground. For indigo/photographic grounds.
 */
export type MbokaTone = "brand" | "mono" | "inverse";

export type MbokaMarkProps = {
  size?: number;
  motion?: MbokaMotion;
  tone?: MbokaTone;
  /** Accessible name; pass null for decorative marks beside a visible wordmark. */
  title?: string | null;
  className?: string;
};

const FRONT = "M9 9H26V20L20 26H9Z";
const BACK = "M24 18H35V35H18V24Z";
const SEAM = "M20 26L26 20";
/** Routing keeps the blocks tighter so the orbiting providers stay clear of them. */
const ROUTING_FRONT = "M13 13H26V21L21 26H13Z";
const ROUTING_BACK = "M24 20H31V31H19V25Z";

function toneColors(tone: MbokaTone) {
  if (tone === "mono") return { plate: "none", fg: "currentColor" };
  if (tone === "inverse") return { plate: "var(--indigo-on)", fg: "var(--indigo)" };
  return { plate: "var(--indigo)", fg: "var(--indigo-on)" };
}

export default function MbokaMark({
  size = 32,
  motion = "static",
  tone = "brand",
  title = "Mboka",
  className,
}: MbokaMarkProps) {
  const clipId = useId();
  const { plate, fg } = toneColors(tone);
  const decorative = title === null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 44 44"
      width={size}
      height={size}
      className={`ep-mark ep-mark--${motion}${className ? ` ${className}` : ""}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      {decorative ? null : <title>{title}</title>}
      {plate === "none" ? null : <rect width="44" height="44" rx="11" fill={plate} />}

      {motion === "inflight" ? (
        <>
          <defs>
            <clipPath id={clipId}>
              <path d={FRONT} />
              <path d={BACK} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <path className="ep-mark__front" d={FRONT} fill={fg} fillOpacity="0.34" />
            <path className="ep-mark__back" d={BACK} fill={fg} fillOpacity="0.34" />
            {/* Band crosses on the chamfer angle — the group is what moves, so
                the rect keeps its 45° rotate attribute. */}
            <g className="ep-mark__band">
              <rect
                x="0"
                y="-14"
                width="13"
                height="72"
                fill={fg}
                transform="rotate(45 6.5 22)"
              />
            </g>
          </g>
        </>
      ) : motion === "routing" ? (
        <>
          {/* Providers rotate behind a block that never moves — reliability is
              the point. */}
          <g className="ep-mark__orbit">
            <circle cx="22" cy="7.5" r="2.1" fill={fg} fillOpacity="0.75" />
            <circle cx="36.5" cy="22" r="2.1" fill={fg} fillOpacity="0.4" />
            <circle cx="22" cy="36.5" r="2.1" fill={fg} fillOpacity="0.4" />
            <circle cx="7.5" cy="22" r="2.1" fill={fg} fillOpacity="0.4" />
          </g>
          <path d={ROUTING_BACK} fill={fg} fillOpacity="0.45" />
          <path d={ROUTING_FRONT} fill={fg} />
        </>
      ) : (
        <>
          <path className="ep-mark__back" d={BACK} fill={fg} fillOpacity="0.45" />
          <path className="ep-mark__front" d={FRONT} fill={fg} />
          {motion === "settlement" ? (
            <path
              className="ep-mark__seam"
              d={SEAM}
              stroke={fg}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0"
            />
          ) : null}
        </>
      )}
    </svg>
  );
}
