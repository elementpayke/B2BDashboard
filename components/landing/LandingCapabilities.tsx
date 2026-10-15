import React from "react";
import PayoutsCalculator from "./PayoutsCalculator";
import { MbokaGlyphPaths } from "./MbokaGlyph";
import { FlagImg, PillChip, Reveal, USDC_COIN, USDT_COIN } from "./landingPrimitives";
import { flagCdnUrl } from "./landingTokens";

/**
 * The six capability cards ("01 · Global banking" … "06 · API") under
 * "Everything your finance team runs on." Exact copy/layout/colours from the
 * design handoff — see components/Landing.tsx for the page shell this
 * mounts into.
 */

const H3_STYLE: React.CSSProperties = {
  margin: 0,
  fontFamily: "'Space Grotesk',sans-serif",
  fontSize: "clamp(26px,3vw,38px)",
  fontWeight: 700,
  letterSpacing: "-0.04em",
  lineHeight: 1.04,
};

const EYEBROW_STYLE: React.CSSProperties = {
  fontFamily: "'DM Mono',monospace",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.06em",
  opacity: 0.75,
};

function MiniGlyph({ color }: { color: string }) {
  return (
    <svg width={18} height={18} viewBox="0 0 44 44" fill="none" style={{ flexShrink: 0 }} aria-hidden>
      <MbokaGlyphPaths color={color} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 01 · Global banking
// ---------------------------------------------------------------------------

const BANKING_FEATURES = [
  { title: "Get paid like a local", desc: "No wire fees, no week-long waits." },
  { title: "Hold and convert", desc: "Convert at live rates when you choose." },
  { title: "Statements on demand", desc: "Statements and proof of funds, ready to download." },
];

const MORE_CURRENCY_FLAGS = ["gb", "eu", "cn", "ng", "za", "ae", "in", "br"];

function BankAccountCard({
  iso,
  name,
  sub,
  code,
  rows,
  rotate,
  z,
  translateX,
  marginTop,
}: {
  iso: string;
  name: string;
  sub: string;
  code: string;
  rows: [string, string][];
  rotate: number;
  z?: number;
  translateX?: number;
  marginTop?: number;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: "#FFFFFF",
        color: "#131126",
        borderRadius: 22,
        padding: "18px 20px 8px",
        boxShadow: "0 34px 60px -30px rgba(10,8,40,0.6)",
        transform: `rotate(${rotate}deg)${translateX ? ` translateX(${translateX}px)` : ""}`,
        zIndex: z,
        marginTop,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12 }}>
        <div
          style={{
            width: 26,
            height: 19,
            borderRadius: 4,
            backgroundImage: `url(${flagCdnUrl(iso)})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            flexShrink: 0,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
          <b style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{name}</b>
          <span style={{ fontSize: 11, color: "#6B6880", whiteSpace: "nowrap" }}>{sub}</span>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontFamily: "'DM Mono',monospace",
            fontSize: 11.5,
            fontWeight: 500,
            padding: "4px 9px",
            borderRadius: 999,
            background: "#EDEBFB",
            color: "#3B2ED3",
          }}
        >
          {code}
        </span>
      </div>
      {rows.map(([label, value]) => (
        <div
          key={label}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "9px 0", borderTop: "1px solid #EEECF4" }}
        >
          <span style={{ fontSize: 11.5, color: "#6B6880", minWidth: 0 }}>{label}</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function CardBanking() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      <Reveal
        as="article"
        id="cap-banking"
        style={{
          flex: "1 1 100%",
          minWidth: "min(100%,300px)",
          background: "#3B2ED3",
          color: "#FFFFFF",
          borderRadius: 28,
          padding: "clamp(24px,3.4vw,40px)",
          overflow: "hidden",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 36 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,400px),1fr))", gap: 40, alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <span style={EYEBROW_STYLE}>01 · Global banking</span>
              <h3 style={{ ...H3_STYLE, fontSize: "clamp(30px,3.8vw,48px)", textWrap: "balance" } as React.CSSProperties}>
                A real local bank account in every market you trade with.
              </h3>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, opacity: 0.85, maxWidth: 480, textWrap: "pretty" } as React.CSSProperties}>
                Local bank accounts in 18+ currencies, each in your business name with its own account details.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))", gap: "16px 22px" }}>
                {BANKING_FEATURES.map((f) => (
                  <div key={f.title} style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.22)" }}>
                    <b style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15 }}>{f.title}</b>
                    <span style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.8 }}>{f.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ position: "relative", maxWidth: 420, width: "100%", justifySelf: "center", display: "flex", flexDirection: "column", gap: 14 }}>
              <BankAccountCard
                iso="ke"
                name="Kenya shilling account"
                sub="Local bank · Nairobi"
                code="KES"
                rotate={-1.5}
                z={2}
                rows={[
                  ["Account name", "ACME TRADING LTD"],
                  ["Account number", "0100 •••• 4471"],
                  ["Bank code", "01•"],
                  ["Branch code", "0••"],
                  ["SWIFT / BIC", "••••KENA"],
                ]}
              />
              <BankAccountCard
                iso="us"
                name="US dollar account"
                sub="US partner bank"
                code="USD"
                rotate={1.5}
                translateX={14}
                marginTop={-6}
                rows={[
                  ["Account name", "ACME TRADING LTD"],
                  ["Account number", "•••• 9982"],
                  ["ACH routing", "026•••••9"],
                  ["SWIFT / BIC", "••••US33"],
                ]}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  alignSelf: "flex-start",
                  padding: "9px 14px 9px 10px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.14)",
                  color: "#FFFFFF",
                  fontSize: 12.5,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ display: "flex" }}>
                  {MORE_CURRENCY_FLAGS.map((iso, i) => (
                    <span
                      key={iso}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        backgroundImage: `url(${flagCdnUrl(iso)})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        border: "2px solid #3B2ED3",
                        marginLeft: i === 0 ? 0 : -7,
                      }}
                    />
                  ))}
                </span>
                +16 more currencies
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 02 · Virtual cards
// ---------------------------------------------------------------------------

const CARD_FEATURES = [
  { title: "Ads, SaaS and suppliers", desc: "Meta, Google, AWS and overseas suppliers." },
  { title: "A card per team or vendor", desc: "As many cards as you need, in seconds." },
  { title: "Limits you control", desc: "Monthly or per-purchase, per card." },
  { title: "Freeze in one tap", desc: "Stop any card instantly." },
];

const CARD_TXNS: [string, string][] = [
  ["Meta Ads", "−$420.00"],
  ["Google Workspace", "−$72.00"],
  ["AWS", "−$180.40"],
];

function Toggle({ on }: { on: boolean }) {
  return (
    <span style={{ width: 34, height: 20, borderRadius: 999, background: on ? "#3B2ED3" : "#D9D6E4", position: "relative", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 2, [on ? "right" : "left"]: 2, width: 16, height: 16, borderRadius: "50%", background: "#FFFFFF" } as React.CSSProperties} />
    </span>
  );
}

function CardCards() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      <Reveal
        as="article"
        id="cap-cards"
        style={{
          flex: "1 1 100%",
          minWidth: "min(100%,300px)",
          background: "#FFB224",
          color: "#131126",
          borderRadius: 28,
          padding: "clamp(24px,3.4vw,40px)",
          overflow: "hidden",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))", gap: 40, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <span style={EYEBROW_STYLE}>02 · Virtual cards</span>
            <h3 style={{ ...H3_STYLE, textWrap: "balance" } as React.CSSProperties}>USD cards that pay for everything your business buys online.</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: "18px 24px" }}>
              {CARD_FEATURES.map((f) => (
                <div key={f.title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ width: 10, height: 10, marginTop: 6, background: "#131126", flexShrink: 0 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <b style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 15 }}>{f.title}</b>
                    <span style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.78 }}>{f.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: "relative", maxWidth: 440, width: "100%", justifySelf: "center", display: "flex", flexDirection: "column", gap: 0, order: -1 }}>
            <div style={{ width: "78%", transform: "rotate(-4deg)", position: "relative", zIndex: 1, marginBottom: "-18%" }}>
              <div style={{ position: "relative", aspectRatio: "1.586", borderRadius: 17, overflow: "hidden", background: "#131126", color: "#FFFFFF", boxShadow: "0 26px 46px -24px #131126CC" }}>
                <svg viewBox="0 0 160 101" fill="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.12 }} aria-hidden>
                  <path d="M97 45H173V121H97Z" fill="currentColor" fillOpacity={0.45} />
                  <path d="M58 6H134V44.9L107 82H58Z" fill="currentColor" />
                </svg>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 90% at 0% 0%,rgba(255,255,255,0.22),transparent 55%)" }} />
                <div style={{ position: "relative", height: "100%", boxSizing: "border-box", padding: "18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <MiniGlyph color="currentColor" />
                    <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>MBOKA</span>
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <b style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 19, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1, whiteSpace: "nowrap" }}>Marketing Ads</b>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, letterSpacing: "0.12em", opacity: 0.82 }}>•••• 4471</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ background: "#FFFFFF", color: "#131126", borderRadius: 22, padding: 16, boxSizing: "border-box", boxShadow: "0 30px 60px -30px rgba(19,17,38,0.45)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: "12%" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700 }}>
                    <span>Monthly limit</span>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5, whiteSpace: "nowrap" }}>$1,240 / $2,000</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: "#EEECF4", overflow: "hidden" }}>
                    <div style={{ width: "62%", height: "100%", background: "#3B2ED3" }} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0", borderTop: "1px solid #EEECF4", borderBottom: "1px solid #EEECF4" }}>
                  {CARD_TXNS.map(([label, value]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
                      <span>{label}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12.5, whiteSpace: "nowrap" }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, fontWeight: 700 }}>
                  <span>Online purchases</span>
                  <Toggle on />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, fontWeight: 700 }}>
                  <span>Freeze card</span>
                  <Toggle on={false} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 03 · Payments
// ---------------------------------------------------------------------------

const COLLECTIONS = [
  { iso: "ke", name: "Amani Traders", rail: "M-Pesa", amt: "+ KES 84,000" },
  { iso: "us", name: "Brightline LLC", rail: "ACH", amt: "+ $2,400.00" },
  { iso: "ng", name: "Kola Foods", rail: "Bank transfer", amt: "+ ₦1,250,000" },
];

const AVATAR_COLORS = ["#3B2ED3", "#FFB224", "#5ED6B4", "#FF6A55", "#131126"];

function PaymentsSubCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#FFFFFF", color: "#131126", borderRadius: 22, padding: 22, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <b style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 19, letterSpacing: "-0.02em" }}>{title}</b>
        <span style={{ fontSize: 13, lineHeight: 1.5, color: "#5C5973" }}>{desc}</span>
      </div>
      <div style={{ marginTop: "auto" }}>{children}</div>
    </div>
  );
}

function CardPayments() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      <Reveal
        as="article"
        id="cap-payments"
        style={{
          flex: "1 1 100%",
          minWidth: "min(100%,300px)",
          background: "#7C6FFF",
          color: "#131126",
          borderRadius: 28,
          padding: "clamp(24px,3.4vw,40px)",
          overflow: "hidden",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
            <span style={EYEBROW_STYLE}>03 · Payments</span>
            <h3 style={{ ...H3_STYLE, textWrap: "balance" } as React.CSSProperties}>Collect from anyone. Pay anyone. One person or five hundred.</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 14 }}>
            <PaymentsSubCard title="Collections" desc="M-Pesa, bank, card or stablecoins.">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {COLLECTIONS.map((row) => (
                  <div key={row.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FlagImg iso={row.iso} width={20} height={14} />
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                      <b style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</b>
                      <span style={{ fontSize: 11, color: "#6B6880" }}>{row.rail}</span>
                    </div>
                    <span style={{ flexShrink: 0, fontFamily: "'DM Mono',monospace", fontSize: 12.5, color: "#0E7A5A", whiteSpace: "nowrap" }}>{row.amt}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 20, height: 20, fontSize: 20, flexShrink: 0 }}>{USDT_COIN}</span>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                    <b style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Zuri Exports</b>
                    <span style={{ fontSize: 11, color: "#6B6880" }}>Stablecoins · USDT</span>
                  </div>
                  <span style={{ flexShrink: 0, fontFamily: "'DM Mono',monospace", fontSize: 12.5, color: "#0E7A5A", whiteSpace: "nowrap" }}>+ 5,000 USDT</span>
                </div>
              </div>
            </PaymentsSubCard>

            <PaymentsSubCard title="Payouts" desc="Mobile money and banks in 20+ countries.">
              <PayoutsCalculator />
            </PaymentsSubCard>

            <PaymentsSubCard title="Bulk payouts" desc="One file. A whole payroll, paid.">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "1.5px dashed #CFCBE0" }}>
                  <span
                    style={{
                      width: 28,
                      height: 34,
                      borderRadius: 4,
                      background: "#5ED6B4",
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      paddingBottom: 4,
                      boxSizing: "border-box",
                      fontSize: 8,
                      fontWeight: 800,
                    }}
                  >
                    CSV
                  </span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <b style={{ fontSize: 12.5 }}>october-payroll.csv</b>
                    <span style={{ fontSize: 11, color: "#6B6880" }}>250 recipients · 6 countries</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                    <span>248 paid</span>
                    <span style={{ color: "#6B6880" }}>2 pending</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: "#EEECF4", overflow: "hidden" }}>
                    <div style={{ width: "99%", height: "100%", background: "#131126" }} />
                  </div>
                </div>
                <div style={{ display: "flex" }}>
                  {AVATAR_COLORS.map((c, i) => (
                    <span key={c} style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: "2px solid #FFFFFF", marginLeft: i === 0 ? 0 : -8 }} />
                  ))}
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, alignSelf: "center" }}>+245</span>
                </div>
              </div>
            </PaymentsSubCard>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 04 · Stablecoins  +  05 · Reports & invoices (share one flex row)
// ---------------------------------------------------------------------------

const STABLE_PILLS = ["Receive", "Send", "Cash out to KES", "Buy with USD"];

function CardStableAndReports() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      <Reveal
        as="article"
        id="cap-stable"
        style={{
          flex: "1 1 380px",
          minWidth: "min(100%,300px)",
          background: "#131126",
          color: "#FFFFFF",
          borderRadius: 28,
          padding: "clamp(24px,3.4vw,40px)",
          overflow: "hidden",
          position: "relative",
          boxSizing: "border-box",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 22, height: "100%" }}>
          <div style={{ position: "absolute", right: -30, top: -30, width: 210, height: 210, pointerEvents: "none" }}>
            <div style={{ position: "absolute", right: 70, top: 40, transform: "rotate(-14deg)", filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.45))", width: 120, height: 120, fontSize: 120 }}>
              {USDT_COIN}
            </div>
            <div style={{ position: "absolute", right: 10, top: 90, transform: "rotate(10deg)", filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.45))", width: 110, height: 110, fontSize: 110 }}>
              {USDC_COIN}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: "62%", position: "relative" }}>
            <span style={EYEBROW_STYLE}>04 · Stablecoins</span>
            <h3 style={{ ...H3_STYLE, textWrap: "balance" } as React.CSSProperties}>Hold, send and receive USDT and USDC.</h3>
          </div>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, opacity: 0.82, maxWidth: 440, position: "relative" }}>
            Keep dollars on-chain. Cash out to any local account in seconds.
          </p>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,0.07)" }}>
              <span style={{ width: 32, height: 32, fontSize: 32 }}>{USDT_COIN}</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <b style={{ fontSize: 14 }}>USDT</b>
                <span style={{ fontSize: 11, opacity: 0.6 }}>Tron · Ethereum</span>
              </div>
              <span style={{ marginLeft: "auto", fontFamily: "'DM Mono',monospace", fontSize: 14, whiteSpace: "nowrap" }}>9,402.55</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 16, background: "rgba(255,255,255,0.07)" }}>
              <span style={{ width: 32, height: 32, fontSize: 32 }}>{USDC_COIN}</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <b style={{ fontSize: 14 }}>USDC</b>
                <span style={{ fontSize: 11, opacity: 0.6 }}>Base · Solana</span>
              </div>
              <span style={{ marginLeft: "auto", fontFamily: "'DM Mono',monospace", fontSize: 14, whiteSpace: "nowrap" }}>24,180.00</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {STABLE_PILLS.map((label) => (
                <span key={label} style={{ padding: "7px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.22)", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal
        as="article"
        id="cap-reports"
        style={{
          flex: "1 1 380px",
          minWidth: "min(100%,300px)",
          background: "#5ED6B4",
          color: "#131126",
          borderRadius: 28,
          padding: "clamp(24px,3.4vw,40px)",
          overflow: "hidden",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 22, height: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={EYEBROW_STYLE}>05 · Reports &amp; invoices</span>
            <h3 style={{ ...H3_STYLE, textWrap: "balance" } as React.CSSProperties}>Send invoices. See every dollar.</h3>
          </div>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, opacity: 0.82, maxWidth: 440 }}>
            Branded invoices, paid in any currency. Reports your accountant will like.
          </p>
          <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))", gap: 12, alignItems: "end" }}>
            <div
              style={{
                position: "relative",
                background: "#FFFFFF",
                borderRadius: 10,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                transform: "rotate(-2deg)",
                boxShadow: "0 24px 40px -24px rgba(19,17,38,0.5)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <svg width={16} height={16} viewBox="0 0 44 44" fill="none" style={{ flexShrink: 0 }} aria-hidden>
                  <MbokaGlyphPaths color="#3B2ED3" />
                </svg>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10.5, color: "#6B6880", whiteSpace: "nowrap" }}>INV-0142</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#6B6880" }}>Billed to</span>
                <b style={{ fontSize: 12.5 }}>Brightline LLC</b>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 11.5, borderTop: "1px solid #EEECF4", paddingTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>Retainer</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, whiteSpace: "nowrap" }}>$3,600</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ whiteSpace: "nowrap" }}>Hosting</span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11.5, whiteSpace: "nowrap" }}>$1,200</span>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #EEECF4", paddingTop: 8 }}>
                <b style={{ fontSize: 12.5 }}>Total</b>
                <b style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16 }}>$4,800</b>
              </div>
              <span
                style={{
                  position: "absolute",
                  right: 12,
                  top: 46,
                  padding: "4px 10px",
                  border: "2px solid #0E7A5A",
                  color: "#0E7A5A",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  transform: "rotate(-10deg)",
                }}
              >
                PAID
              </span>
            </div>
            <div style={{ background: "#131126", color: "#FFFFFF", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", opacity: 0.65 }}>Monthly volume</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <b style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, letterSpacing: "-0.02em" }}>$182k</b>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#5ED6B4" }}>+12%</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 72 }}>
                {[38, 52, 44, 66, 58, 80, 92].map((h, i) => (
                  <span
                    key={i}
                    style={{ flex: 1, height: `${h}%`, borderRadius: "4px 4px 0 0", background: i === 6 ? "#5ED6B4" : "rgba(255,255,255,0.22)" }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Mono',monospace", fontSize: 10, opacity: 0.55 }}>
                <span>Apr</span>
                <span>Oct</span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 06 · API
// ---------------------------------------------------------------------------

function CardApi() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      <Reveal
        as="article"
        id="cap-api"
        style={{
          flex: "1 1 100%",
          background: "#FFFFFF",
          color: "#131126",
          border: "1px solid #E6E2DA",
          borderRadius: 28,
          padding: "clamp(24px,3.4vw,40px)",
          overflow: "hidden",
          position: "relative",
          boxSizing: "border-box",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))",
          gap: 32,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={EYEBROW_STYLE}>06 · API</span>
          <h3 style={H3_STYLE}>Easy to integrate.</h3>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, opacity: 0.82, maxWidth: 400 }}>
            One API call per capability. Webhooks for every status change.
          </p>
        </div>
        <div style={{ background: "#131126", color: "#E8E6F5", borderRadius: 18, overflow: "hidden", boxShadow: "0 30px 50px -30px rgba(19,17,38,0.6)", transform: "rotate(1deg)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF6A55" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#FFB224" }} />
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#5ED6B4" }} />
            <span style={{ marginLeft: 10, fontFamily: "'DM Mono',monospace", fontSize: 11, opacity: 0.55 }}>payouts.sh</span>
          </div>
          <div style={{ padding: "16px 18px", fontFamily: "'DM Mono',monospace", fontSize: 12.5, lineHeight: 1.75, overflowX: "auto", whiteSpace: "pre" }}>
            <span style={{ color: "#7C6FFF" }}>POST</span> /v1/payouts{"\n"}
            {"{ "}"amount": 1000, "currency": "KES",{"\n"}
            {"  "}"rail": "mpesa", "to": "+254 7•• ••• 412" {"}"}
            {"\n"}
            <span style={{ color: "#5ED6B4" }}>→ 201 settled</span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function LandingCapabilities() {
  return (
    <section style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(48px,8vw,80px) clamp(12px,3vw,24px) 40px", display: "flex", flexDirection: "column", gap: 16 }}>
      <Reveal
        as="h2"
        style={{ margin: "0 0 20px", fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(30px,4.4vw,52px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, maxWidth: 720 }}
      >
        Everything your finance team runs on.
      </Reveal>
      <CardBanking />
      <CardCards />
      <CardPayments />
      <CardStableAndReports />
      <CardApi />
    </section>
  );
}
