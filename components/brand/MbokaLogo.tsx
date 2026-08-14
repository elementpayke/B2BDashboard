"use client";
import React from "react";
import MbokaMark, { type MbokaMotion, type MbokaTone } from "@/components/brand/MbokaMark";

/**
 * Primary lockup — Chamfer symbol plus the MBOKA wordmark.
 *
 * The kit ships the wordmark as outlined vector paths so its files render
 * without the font installed; here the font is already loaded app-wide, so the
 * wordmark is live text set to the kit's spec (Space Grotesk 600, uppercase,
 * +0.04em). That keeps it selectable, and it inherits colour instead of
 * needing a per-surface variant.
 *
 * Clear space equals one quarter of the mark's height on all sides — see
 * .ep-logo in globals.css. Minimum sizes: symbol 16px (use the favicon
 * variant below that), full lockup 96px wide.
 */
export type MbokaLogoProps = {
  /** Symbol height in px; the wordmark scales off it. */
  size?: number;
  motion?: MbokaMotion;
  tone?: MbokaTone;
  /** Small line under the wordmark, e.g. "Business". */
  sub?: string;
  /** Hide the wordmark — collapsed sidebar, avatars, tight chrome. */
  markOnly?: boolean;
  className?: string;
};

export default function MbokaLogo({
  size = 32,
  motion = "static",
  tone = "brand",
  sub,
  markOnly = false,
  className,
}: MbokaLogoProps) {
  return (
    <span className={`ep-logo${className ? ` ${className}` : ""}`} style={{ "--ep-logo-size": `${size}px` } as React.CSSProperties}>
      <MbokaMark size={size} motion={motion} tone={tone} title={markOnly ? "Mboka" : null} />
      {markOnly ? null : (
        <span className="ep-logo__text">
          <span className="ep-logo__word">Mboka</span>
          {sub ? <span className="ep-logo__sub">{sub}</span> : null}
        </span>
      )}
    </span>
  );
}
