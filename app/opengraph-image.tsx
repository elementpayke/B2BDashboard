import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Mboka — Business banking, cards & payouts for Africa";

/**
 * Generated at request/build time via Satori (no external font fetch — the
 * bundled sans-serif renders fine at this weight/size and keeps generation
 * fast and dependency-free). Mirrors the landing page's indigo/bone palette
 * and mark geometry (components/landing/MbokaGlyph.tsx) rather than
 * reaching for an external image asset.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F6F4EF",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width={64} height={64} viewBox="0 0 44 44" fill="none">
            <rect width={44} height={44} rx={11} fill="#3B2ED3" />
            <path d="M17.8 17.8H35.1V35.1H17.8Z" fill="#fff" fillOpacity={0.45} />
            <path d="M8.9 8.9H26.3V17.8L20.1 26.3H8.9Z" fill="#fff" />
          </svg>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "0.05em", color: "#131126" }}>MBOKA</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 58, fontWeight: 700, color: "#131126", letterSpacing: "-0.03em", lineHeight: 1.08, maxWidth: 980 }}>
            Business banking, cards &amp; payouts for Africa
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#4C4A66", maxWidth: 920 }}>
            Local accounts, USD virtual cards, payouts and stablecoin settlement in one platform.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
