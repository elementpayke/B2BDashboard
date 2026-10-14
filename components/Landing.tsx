"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MbokaGlyph, { MbokaGlyphPaths } from "@/components/landing/MbokaGlyph";
import HeroGlobe from "@/components/landing/HeroGlobe";
import LandingCapabilities from "@/components/landing/LandingCapabilities";
import LandingTalkToUs from "@/components/landing/LandingTalkToUs";
import { FlagImg, PillChip, USDC_COIN, USDT_COIN, useReducedMotion } from "@/components/landing/landingPrimitives";
import {
  HERO_SCENES,
  HERO_SCENE_MS,
  LANDING_DARK,
  LANDING_LIGHT,
  MARQUEE_CURRENCIES,
} from "@/components/landing/landingTokens";

/**
 * Mboka marketing landing page — ported from the approved design handoff
 * (design_handoff_landing_page/landing.html + landing.js). Pixel/copy/colour
 * parity is intentional; see that handoff's README for the full spec this
 * mirrors (tokens, animation timings, exact copy).
 */

// ---------------------------------------------------------------------------
// Hero scene 0 — fanned virtual cards
// ---------------------------------------------------------------------------

const FAN_CARDS = [
  { left: "2%", top: "6%", bg: "#131126", fg: "#FFFFFF", title: "Software", num: "•••• 9982", anim: "lp-fanA", delay: "0s" },
  { left: "16%", top: "24%", bg: "#FFB224", fg: "#131126", title: "Team trips", num: "•••• 1120", anim: "lp-fanB", delay: ".12s" },
  { left: "30%", top: "42%", bg: "#3B2ED3", fg: "#FFFFFF", title: "Marketing Ads", num: "•••• 4471", anim: "lp-fanC", delay: ".24s" },
];

function HeroSceneCards() {
  return (
    <div style={{ position: "absolute", inset: 0, animation: "lp-hs-in .6s cubic-bezier(.2,.8,.2,1) both" }}>
      {FAN_CARDS.map((c) => (
        <div
          key={c.title}
          style={{
            position: "absolute",
            left: c.left,
            top: c.top,
            width: "66%",
            animation: `${c.anim} .8s ${c.delay} cubic-bezier(.2,.9,.3,1.2) both`,
            transformOrigin: "50% 100%",
          }}
        >
          <div
            style={{
              position: "relative",
              aspectRatio: "1.586",
              borderRadius: 17,
              overflow: "hidden",
              background: c.bg,
              color: c.fg,
              boxShadow: "0 26px 46px -24px rgba(10,8,40,0.55)",
            }}
          >
            <svg viewBox="0 0 160 101" fill="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.12 }} aria-hidden>
              <path d="M97 45H173V121H97Z" fill="currentColor" fillOpacity={0.45} />
              <path d="M58 6H134V44.9L107 82H58Z" fill="currentColor" />
            </svg>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 0% 0%,rgba(255,255,255,0.22),transparent 55%)" }} />
            <div style={{ position: "relative", height: "100%", boxSizing: "border-box", padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <svg width={18} height={18} viewBox="0 0 44 44" fill="none" style={{ flexShrink: 0 }} aria-hidden>
                  <MbokaGlyphPaths color="currentColor" />
                </svg>
                <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>MBOKA</span>
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <b style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 19, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1, whiteSpace: "nowrap" }}>{c.title}</b>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: "0.12em", opacity: 0.82 }}>{c.num}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
      <div style={{ position: "absolute", left: 0, bottom: "4%", animation: "lp-flow-l .6s .7s both" }}>
        <PillChip>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#5ED6B4",
              color: "#131126",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
            }}
          >
            ✓
          </span>
          Card issued in 4 seconds
        </PillChip>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero scene 1 — globe
// ---------------------------------------------------------------------------

function HeroSceneGlobe({ active }: { active: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, animation: "lp-hs-in .6s cubic-bezier(.2,.8,.2,1) both" }}>
      <HeroGlobe active={active} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "1%",
          display: "flex",
          justifyContent: "center",
          animation: "lp-hs-in .6s 1s both",
          fontFamily: "'Space Grotesk',sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--muted)",
          whiteSpace: "nowrap",
        }}
      >
        Local accounts in 18+ currencies.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero scene 2 — collections / payouts flow
// ---------------------------------------------------------------------------

type FlowRowData = { iso: string; amt: string; rail: string; top: string; side: "l" | "r"; delay: number; dotDelay: number };

const FLOW_IN: FlowRowData[] = [
  { iso: "ke", amt: "+ KES 84,000", rail: "M-Pesa", top: "18%", side: "l", delay: 0.2, dotDelay: 0.4 },
  { iso: "us", amt: "+ $2,400", rail: "ACH", top: "42%", side: "l", delay: 0.4, dotDelay: 0.65 },
  { iso: "ng", amt: "+ ₦1.25M", rail: "Bank", top: "66%", side: "l", delay: 0.6, dotDelay: 0.9 },
];
const FLOW_OUT: FlowRowData[] = [
  { iso: "gh", amt: "GHS 9,800", rail: "MoMo", top: "18%", side: "r", delay: 1.1, dotDelay: 1.1 },
  { iso: "cn", amt: "¥ 52,000", rail: "Bank", top: "42%", side: "r", delay: 1.3, dotDelay: 1.35 },
  { iso: "ug", amt: "UGX 3.1M", rail: "MTN", top: "66%", side: "r", delay: 1.5, dotDelay: 1.6 },
];

function FlowRow({ row }: { row: FlowRowData }) {
  const incoming = row.amt.startsWith("+");
  return (
    <>
      <div
        style={{
          position: "absolute",
          [row.side === "l" ? "left" : "right"]: 0,
          top: row.top,
          animation: `${row.side === "l" ? "lp-flow-l" : "lp-flow-r"} .6s ${row.delay}s cubic-bezier(.2,.8,.2,1) both`,
        }}
      >
        <PillChip>
          <FlagImg iso={row.iso} />
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: incoming ? "#0E9A70" : "var(--ink)" }}>{row.amt}</span>
            <span style={{ fontSize: 10, color: "var(--muted2)", fontWeight: 600 }}>{row.rail}</span>
          </span>
        </PillChip>
      </div>
      <div
        style={{
          position: "absolute",
          left: row.side === "l" ? "34%" : "56%",
          width: "10%",
          top: `calc(${row.top} + 20px)`,
          height: 2,
          background: "repeating-linear-gradient(90deg,var(--border) 0 4px,transparent 4px 8px)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: -3,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: incoming ? "#5ED6B4" : "#FFB224",
            animation: `lp-travel 1.6s ${row.dotDelay}s linear infinite`,
          }}
        />
      </div>
    </>
  );
}

function HeroSceneFlow() {
  return (
    <div style={{ position: "absolute", inset: 0, animation: "lp-hs-in .6s cubic-bezier(.2,.8,.2,1) both" }}>
      {FLOW_IN.map((r) => (
        <FlowRow key={r.iso + r.top} row={r} />
      ))}
      {FLOW_OUT.map((r) => (
        <FlowRow key={r.iso + r.top} row={r} />
      ))}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "42%",
          transform: "translate(-50%,-50%)",
          width: "15%",
          aspectRatio: "1",
          borderRadius: "24%",
          background: "#3B2ED3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 20px 40px -14px rgba(59,46,211,0.8)",
          animation: "lp-breathe 2.4s ease-in-out infinite",
        }}
      >
        <svg width={34} height={34} viewBox="0 0 44 44" fill="none" style={{ flexShrink: 0 }} aria-hidden>
          <MbokaGlyphPaths color="#FFFFFF" />
        </svg>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "6%",
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "'Space Grotesk',sans-serif",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--muted)",
          padding: "0 4%",
        }}
      >
        <span>Collections in</span>
        <span>Payouts out</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero scene 3 — coins
// ---------------------------------------------------------------------------

function HeroSceneCoins() {
  return (
    <div style={{ position: "absolute", inset: 0, animation: "lp-hs-in .6s cubic-bezier(.2,.8,.2,1) both" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "44%",
          width: "62%",
          aspectRatio: "1",
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          border: "1.5px dashed var(--border)",
          animation: "lp-spin 18s linear infinite",
        }}
      >
        <span style={{ position: "absolute", left: "50%", top: -6, width: 12, height: 12, borderRadius: "50%", background: "#FFB224" }} />
        <span style={{ position: "absolute", left: -6, top: "50%", width: 10, height: 10, borderRadius: "50%", background: "#7C6FFF" }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: "22%",
          top: "20%",
          ["--lp-r" as any]: "-10deg",
          animation: "lp-bob 3.2s ease-in-out infinite",
          filter: "drop-shadow(0 26px 30px rgba(10,8,40,0.4))",
        }}
      >
        <div style={{ animation: "lp-coin-spin 5s .3s ease-in-out infinite", width: 150, height: 150, fontSize: 150 }}>{USDT_COIN}</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: "46%",
          top: "38%",
          ["--lp-r" as any]: "8deg",
          animation: "lp-bob 3.2s -1.6s ease-in-out infinite",
          filter: "drop-shadow(0 26px 30px rgba(10,8,40,0.4))",
        }}
      >
        <div style={{ animation: "lp-coin-spin 5s 2.8s ease-in-out infinite", width: 130, height: 130, fontSize: 130 }}>{USDC_COIN}</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "4%", display: "flex", justifyContent: "center", animation: "lp-hs-in .6s .8s both" }}>
        <PillChip>
          <span style={{ width: 20, height: 20, fontSize: 20 }}>{USDT_COIN}</span>
          <span>USDT</span>
          <span style={{ color: "var(--muted2)" }}>→</span>
          <FlagImg iso="ke" />
          <span>KES</span>
          <span style={{ color: "#0E9A70", fontFamily: "'DM Mono',monospace" }}>settled 4s</span>
        </PillChip>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Landing() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [scene, setScene] = useState(0);
  const reducedMotion = useReducedMotion();

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  /** Returning users: login first so stale cookies never paint /dashboard anonymously. */
  const openDashboard = () => router.push("/login?next=%2Fdashboard");

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setScene((s) => (s + 1) % HERO_SCENES.length), HERO_SCENE_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const vars = theme === "dark" ? LANDING_DARK : LANDING_LIGHT;
  const themeIcon = theme === "dark" ? "☀" : "☾";

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <div
      data-screen-label="Landing"
      style={{ minHeight: "100vh", background: "var(--landing-bg)", color: "var(--ink)", fontFamily: "'DM Sans',sans-serif", ...vars } as React.CSSProperties}
    >
      <style jsx global>{`
        @keyframes lp-hs-in {
          from { opacity: 0; transform: translateY(16px) scale(.97); }
          to { opacity: 1; transform: none; }
        }
        @keyframes lp-fanA { from { opacity: 0; transform: translateY(40px) rotate(0); } to { opacity: 1; transform: rotate(-10deg); } }
        @keyframes lp-fanB { from { opacity: 0; transform: translateY(40px) rotate(0); } to { opacity: 1; transform: rotate(-2deg); } }
        @keyframes lp-fanC { from { opacity: 0; transform: translateY(40px) rotate(0); } to { opacity: 1; transform: rotate(7deg); } }
        @keyframes lp-flow-l { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: none; } }
        @keyframes lp-flow-r { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: none; } }
        @keyframes lp-travel { 0% { left: 0; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
        @keyframes lp-bob { 0%, 100% { transform: translateY(0) rotate(var(--lp-r, 0deg)); } 50% { transform: translateY(-10px) rotate(var(--lp-r, 0deg)); } }
        @keyframes lp-coin-spin { 0% { transform: rotateY(0); } 100% { transform: rotateY(360deg); } }
        @keyframes lp-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes lp-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes lp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .lp-talk-tile:hover { transform: translateX(6px); }
        @media (max-width: 899px) {
          .lp-nav-desktop, .lp-talk-desktop { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mboka-landing * { animation: none !important; transition: none !important; }
        }
      `}</style>

      <div className="mboka-landing">
        {/* ---------------- Header ---------------- */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "var(--landing-bg)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderBottom: "1px solid var(--glass-border)",
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "0 clamp(16px,4vw,24px)",
              height: 66,
              display: "flex",
              alignItems: "center",
              gap: "clamp(12px,3vw,26px)",
            }}
          >
            <a
              href="#top"
              aria-label="Mboka home"
              style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, color: "inherit", textDecoration: "none" }}
            >
              <MbokaGlyph size={32} plate="var(--indigo)" color="var(--indigo-on)" />
              <span style={{ letterSpacing: "0.05em", fontWeight: 600 }}>MBOKA</span>
            </a>

            <nav
              className="lp-nav-desktop"
              aria-label="Primary"
              style={{ display: "flex", gap: 20, fontSize: 13, fontWeight: 600, color: "var(--muted)", marginLeft: 8, flexWrap: "nowrap", overflow: "hidden", minWidth: 0, flex: "1 1 auto" }}
            >
              <a href="#cap-banking" onClick={scrollTo("cap-banking")} style={{ color: "inherit", textDecoration: "none", whiteSpace: "nowrap" }}>Global banking</a>
              <a href="#cap-cards" onClick={scrollTo("cap-cards")} style={{ color: "inherit", textDecoration: "none", whiteSpace: "nowrap" }}>Virtual cards</a>
              <a href="#cap-payments" onClick={scrollTo("cap-payments")} style={{ color: "inherit", textDecoration: "none", whiteSpace: "nowrap" }}>Payments</a>
              <a href="#cap-stable" onClick={scrollTo("cap-stable")} style={{ color: "inherit", textDecoration: "none", whiteSpace: "nowrap" }}>Stablecoins</a>
            </nav>

            <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
              <a
                href="#talk"
                onClick={scrollTo("talk")}
                className="lp-talk-desktop"
                style={{ display: "inline-flex", padding: "10px 16px", borderRadius: 999, color: "var(--ink)", fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}
              >
                Talk to us
              </a>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", cursor: "pointer", fontSize: 14 }}
              >
                {themeIcon}
              </button>
              <button
                type="button"
                onClick={openDashboard}
                style={{ padding: "11px 22px", borderRadius: 999, border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Open dashboard
              </button>
            </div>
          </div>
        </header>

        <main id="top">
          {/* ---------------- Hero ---------------- */}
          <section
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "clamp(36px,7vw,72px) clamp(16px,4vw,24px) 56px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,440px),1fr))",
              gap: "clamp(28px,5vw,48px)",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
              <h1
                style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(42px,5.6vw,76px)", fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1 }}
              >
                <span style={{ display: "block" }}>Your business,</span>
                <span style={{ display: "block", minHeight: "2em" }}>
                  <span key={scene} style={{ display: "inline-block", color: "var(--indigo-text)", animation: "lp-hs-in .55s cubic-bezier(.2,.8,.2,1) both" }}>
                    {HERO_SCENES[scene].word}
                    <span style={{ display: "inline-block", width: "0.26em", height: "0.26em", marginLeft: "0.1em", background: HERO_SCENES[scene].dot }} />
                  </span>
                </span>
              </h1>
              <p style={{ margin: 0, fontSize: 17, color: "var(--muted)", maxWidth: 440, lineHeight: 1.55 }}>
                Global banking, virtual cards, collections, payouts and stablecoins for businesses in the Global South.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={openDashboard}
                  style={{ padding: "15px 28px", borderRadius: 999, border: "none", background: "var(--indigo)", color: "var(--indigo-on)", fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14.5, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  Open the dashboard
                </button>
                <a
                  href="#cap-banking"
                  onClick={scrollTo("cap-banking")}
                  style={{ padding: "15px 28px", borderRadius: 999, border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--ink)", fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14.5, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  See what it does
                </a>
              </div>
            </div>

            <div style={{ width: "100%", maxWidth: 520, justifySelf: "center", display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ position: "relative", width: "100%", aspectRatio: "1/0.92" }}>
                {scene === 0 ? <HeroSceneCards /> : null}
                {scene === 1 ? <HeroSceneGlobe active={scene === 1} /> : null}
                {scene === 2 ? <HeroSceneFlow /> : null}
                {scene === 3 ? <HeroSceneCoins /> : null}
              </div>
            </div>
          </section>

          {/* ---------------- Flag marquee ---------------- */}
          <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "18px 0", background: "var(--surface2)", overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 10, width: "max-content", animation: "lp-marquee 40s linear infinite" }}>
              {[0, 1].map((dup) => (
                <React.Fragment key={dup}>
                  <span style={{ display: "flex", alignItems: "center", padding: "0 14px 0 24px", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted2)", whiteSpace: "nowrap", flexShrink: 0 }}>
                    Live in 20+ countries
                  </span>
                  {MARQUEE_CURRENCIES.map((c) => (
                    <div
                      key={`${dup}-${c.code}`}
                      style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--glass-border)", fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}
                    >
                      <FlagImg iso={c.iso} width={18} height={13} radius={2} />
                      {c.code}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Capability cards + talk-to-us + footer continue below */}
          <LandingCapabilities />
          <LandingTalkToUs />
        </main>

        <footer
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            fontSize: 12,
            color: "var(--muted2)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width={18} height={18} viewBox="0 0 44 44" fill="none" style={{ flexShrink: 0 }} aria-hidden>
              <MbokaGlyphPaths color="var(--ink)" />
            </svg>
            © 2026 Mboka
          </span>
          <span style={{ fontSize: 10.5 }}>A product of ElementPay</span>
        </footer>
      </div>
    </div>
  );
}
