import React from "react";

/**
 * The Mboka mark's two paths, exactly as exported in the approved landing
 * design (viewBox 0 0 44 44) — not the dashboard's MbokaMark component,
 * whose chamfer coordinates differ slightly. Kept local to this page so the
 * landing design stays pixel-exact without touching the shared brand mark
 * used elsewhere in the app.
 */
export function MbokaGlyphPaths({ color }: { color: string }) {
  return (
    <>
      <path d="M17.8 17.8H35.1V35.1H17.8Z" fill={color} fillOpacity={0.45} />
      <path d="M8.9 8.9H26.3V17.8L20.1 26.3H8.9Z" fill={color} />
    </>
  );
}

export default function MbokaGlyph({
  size = 32,
  plate,
  color = "#fff",
  rx = 11,
}: {
  size?: number;
  /** Rounded-square backing colour; omit for a plateless glyph. */
  plate?: string;
  color?: string;
  rx?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" style={{ flexShrink: 0 }} aria-hidden>
      {plate ? <rect width={44} height={44} rx={rx} fill={plate} /> : null}
      <MbokaGlyphPaths color={color} />
    </svg>
  );
}
