"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { flagUrl, CURRENCIES, LIGHT, DARK, DARK_HC_OVERRIDES } from "./mockData";

export default function Landing() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lcAmt, setLcAmtState] = useState("1,000");
  const [lcCountryIdx, setLcCountryIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  const setLcAmt = (e: React.ChangeEvent<HTMLInputElement>) => setLcAmtState(e.target.value);
  const selectLcCountry = (i: number) => () => setLcCountryIdx(i);
  const enterApp = () => router.push("/dashboard");
  const goLogin = () => router.push("/login");

  const vars = theme === "dark" ? { ...DARK, ...DARK_HC_OVERRIDES } : LIGHT;
  const rootStyle: React.CSSProperties = {
    minHeight: "100vh",
    position: "relative",
    background: "var(--bg)",
    color: "var(--ink)",
    fontFamily: "'DM Sans',sans-serif",
    ...vars,
  };
  const themeIcon = theme === "dark" ? "\u2600" : "\u262e";

  const lcCountryChips = CURRENCIES.slice(0, 6).map((c: any, i: number) => ({
    flagUrl: flagUrl(c.iso),
    code: c.code,
    select: selectLcCountry(i),
    bg: i === lcCountryIdx ? "var(--indigo-tint)" : "var(--surface2)",
    border: i === lcCountryIdx ? "var(--indigo)" : "transparent",
  }));
  const lcOut =
    (parseFloat(lcAmt.replace(/,/g, "") || "0") * 131.64).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    }) +
    " " +
    CURRENCIES[lcCountryIdx % 6].code;
  const lcRate = "1 USD = 131.64 " + CURRENCIES[lcCountryIdx % 6].code;
  const allCountryFlags = CURRENCIES.map((c: any) => ({ flagUrl: flagUrl(c.iso), code: c.code }));
  const landingFeatures = [
    { letter: "A", title: "Global accounts & IBANs", desc: "Get a EUR IBAN, UK sort code and US ACH details in your business name." },
    { letter: "P", title: "Instant payouts", desc: "Pay vendors and teams to mobile money, banks and wallets across 20+ countries in minutes." },
    { letter: "S", title: "Stablecoin engine", desc: "USDC and USDT on Base and Polygon power settlement under the hood." },
    { letter: "T", title: "Multi-currency treasury", desc: "Hold and swap between fiat and digital assets with a 90-second rate lock." },
    { letter: "C", title: "Virtual cards", desc: "USD virtual cards for team spend with limits and freeze controls." },
    { letter: "E", title: "Enterprise controls", desc: "Role-based access, approval workflows, tiered KYB limits, full audit trail." },
  ];
  const engineRails = [
    { dot: "var(--indigo)", label: "Collect", tag: "fiat in" },
    { dot: "#2151F5", label: "Settle", tag: "~seconds" },
    { dot: "#8247E5", label: "Convert", tag: "mid-market" },
    { dot: "#fff", label: "Payout", tag: "fiat out" },
  ];
  const engineStats = [
    { value: "20+", label: "countries live" },
    { value: "3m 41s", label: "avg settlement" },
    { value: "98.6%", label: "success rate" },
    { value: "2", label: "chains" },
  ];

  const scrollTo = (id: string) => () => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div style={rootStyle}>
      <div data-screen-label="Landing" style={{ minHeight: "100vh" }}>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "var(--surface)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderBottom: "1px solid var(--glass-border)",
          }}
        >
          <div className="ep-landing-header-inner">
            <div className="ep-landing-brand">
              <span
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "10px",
                  background: "var(--indigo)",
                  color: "var(--indigo-on)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'DM Mono',monospace",
                  fontSize: "14px",
                }}
              >
                E
              </span>
              <span className="ep-landing-brand__name">ElementPay</span>
            </div>

            <nav className="ep-landing-nav" aria-label="Primary">
              <button type="button" onClick={scrollTo("features")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", font: "inherit", padding: 0 }}>
                Features
              </button>
              <button type="button" onClick={scrollTo("engine")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", font: "inherit", padding: 0 }}>
                Stablecoin engine
              </button>
              <button type="button" onClick={scrollTo("coverage")} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", font: "inherit", padding: 0 }}>
                Coverage
              </button>
            </nav>

            <div className="ep-landing-cta">
              <button
                type="button"
                className="ep-only-compact ep-touch"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-label="Open menu"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--surface2)",
                  color: "var(--ink)",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >
                {menuOpen ? "✕" : "☰"}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  border: "1px solid var(--border)",
                  background: "var(--surface2)",
                  color: "var(--ink)",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                {themeIcon}
              </button>
              <button
                type="button"
                onClick={goLogin}
                className="ep-landing-open ep-hide-mobile"
                style={{
                  padding: "11px 18px",
                  borderRadius: "999px",
                  border: "1.5px solid var(--border)",
                  background: "var(--surface2)",
                  color: "var(--ink)",
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  minHeight: "44px",
                }}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={enterApp}
                className="ep-landing-open"
                style={{
                  padding: "11px 14px",
                  borderRadius: "999px",
                  border: "none",
                  background: "var(--indigo)",
                  color: "var(--indigo-on)",
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  minHeight: "44px",
                  whiteSpace: "nowrap",
                }}
              >
                Dashboard
              </button>
            </div>
          </div>

          {menuOpen ? (
            <div
              className="ep-only-compact"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                padding: "8px 16px 16px",
                borderTop: "1px solid var(--glass-border)",
              }}
            >
              {[
                ["Features", "features"],
                ["Stablecoin engine", "engine"],
                ["Coverage", "coverage"],
              ].map(([label, id]) => (
                <button
                  key={id}
                  type="button"
                  onClick={scrollTo(id)}
                  style={{
                    textAlign: "left",
                    minHeight: "44px",
                    padding: "12px 8px",
                    background: "none",
                    border: "none",
                    color: "var(--ink)",
                    fontWeight: 600,
                    fontSize: "15px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={goLogin}
                style={{
                  textAlign: "left",
                  minHeight: "44px",
                  padding: "12px 8px",
                  background: "none",
                  border: "none",
                  color: "var(--indigo-text)",
                  fontWeight: 700,
                  fontSize: "15px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Log in
              </button>
            </div>
          ) : null}
        </header>

        <section className="ep-landing-hero ep-grid-hero">
          <div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                fontWeight: 700,
                padding: "8px 16px",
                borderRadius: "999px",
                background: "var(--indigo-tint)",
                color: "var(--indigo-text)",
                marginBottom: "20px",
              }}
            >
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--indigo)" }} />
              Now in Private Beta
            </span>
            <h1
              style={{
                margin: 0,
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize: "clamp(28px,6vw,52px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                lineHeight: 1.08,
                overflowWrap: "anywhere",
              }}
            >
              Move business money
              <br />
              at{" "}
              <span
                style={{
                  background: "var(--indigo)",
                  color: "var(--indigo-on)",
                  padding: "1px 12px 5px",
                  borderRadius: "14px",
                  display: "inline-block",
                }}
              >
                internet speed
              </span>
            </h1>
            <p style={{ fontSize: "15px", color: "var(--muted)", margin: "20px 0 28px", maxWidth: "460px", lineHeight: 1.6 }}>
              IBANs, stablecoin settlement, payouts to 20+ countries, and treasury in one platform for businesses across Africa and beyond.
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={enterApp}
                style={{
                  padding: "14px 24px",
                  minHeight: "48px",
                  borderRadius: "999px",
                  border: "none",
                  background: "var(--indigo)",
                  color: "var(--indigo-on)",
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontWeight: 700,
                  fontSize: "14.5px",
                  cursor: "pointer",
                }}
              >
                Open the dashboard
              </button>
              <button
                type="button"
                onClick={scrollTo("engine")}
                style={{
                  padding: "14px 24px",
                  minHeight: "48px",
                  borderRadius: "999px",
                  border: "1.5px solid var(--border)",
                  background: "var(--surface2)",
                  color: "var(--ink)",
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontWeight: 700,
                  fontSize: "14.5px",
                  cursor: "pointer",
                }}
              >
                See how it works
              </button>
            </div>
            <div style={{ fontSize: "11.5px", color: "var(--muted2)", marginTop: "16px" }}>
              No credit card required · SOC 2 in progress · 256-bit encryption
            </div>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "24px", padding: "22px" }}>
            <h3 style={{ margin: "0 0 4px", fontFamily: "'Space Grotesk',sans-serif", fontSize: "16px" }}>
              See what your money becomes
            </h3>
            <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "16px" }}>
              Live mid-market rates, updated every 30 seconds.
            </div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <input
                value={lcAmt}
                onChange={setLcAmt}
                inputMode="decimal"
                aria-label="Amount in USD"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "12px 14px",
                  minHeight: "48px",
                  borderRadius: "14px",
                  border: "1.5px solid var(--input-border)",
                  background: "var(--input-bg)",
                  fontFamily: "'DM Mono',monospace",
                  fontSize: "16px",
                  color: "var(--ink)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <span
                style={{
                  padding: "12px 14px",
                  borderRadius: "14px",
                  background: "var(--surface2)",
                  fontFamily: "'DM Mono',monospace",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                USD
              </span>
            </div>
            <div className="ep-chip-row ep-chip-row--scroll" style={{ marginBottom: "14px" }}>
              {lcCountryChips.map((lc: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={lc.select}
                  className="ep-chip"
                  style={{
                    border: `1.5px solid ${lc.border}`,
                    background: lc.bg,
                    color: "var(--ink)",
                  }}
                >
                  <span className="ep-flag" style={{ backgroundImage: `url(${lc.flagUrl})` }} aria-hidden />
                  <span>{lc.code}</span>
                </button>
              ))}
            </div>
            <div style={{ background: "var(--indigo)", color: "var(--indigo-on)", borderRadius: "16px", padding: "18px", textAlign: "center" }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: "clamp(20px,5vw,26px)", fontWeight: 500, display: "block" }}>
                {lcOut}
              </span>
              <span style={{ fontSize: "11px", opacity: 0.75, fontFamily: "'DM Mono',monospace" }}>{lcRate}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "8px",
                flexWrap: "wrap",
                fontSize: "10.5px",
                color: "var(--muted2)",
                marginTop: "10px",
                fontFamily: "'DM Mono',monospace",
              }}
            >
              <span>Fee 0.20%</span>
              <span>Arrives ~2 min</span>
              <span>Rate lock 90s</span>
            </div>
          </div>
        </section>

        <div
          id="coverage"
          style={{
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            padding: "22px 16px",
            background: "var(--surface2)",
          }}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--muted2)",
              marginBottom: "14px",
            }}
          >
            Payouts live in 20+ countries
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", maxWidth: "1000px", margin: "0 auto" }}>
            {allCountryFlags.map((f: any, i: number) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "9px 14px",
                  borderRadius: "999px",
                  background: "var(--surface)",
                  border: "1.5px solid var(--glass-border)",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                <span className="ep-flag" style={{ width: "20px", height: "15px", backgroundImage: `url(${f.flagUrl})` }} aria-hidden />
                {f.code}
              </div>
            ))}
          </div>
        </div>

        <section id="features" className="ep-landing-section">
          <span
            style={{
              display: "inline-block",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--indigo-text)",
              background: "var(--indigo-tint)",
              padding: "6px 14px",
              borderRadius: "999px",
            }}
          >
            Features
          </span>
          <h2
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: "clamp(22px,4vw,34px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: "14px 0 8px",
            }}
          >
            Everything your finance team needs
          </h2>
          <p style={{ color: "var(--muted)", fontSize: "15px", maxWidth: "560px" }}>
            One platform to replace your patchwork of banking portals, payment processors and spreadsheets.
          </p>
          <div className="ep-grid-features" style={{ marginTop: "28px" }}>
            {landingFeatures.map((ft: any, i: number) => (
              <div
                key={i}
                style={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "20px",
                  padding: "22px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "14px",
                    background: "var(--indigo)",
                    color: "var(--indigo-on)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Space Grotesk',sans-serif",
                    fontWeight: 800,
                    fontSize: "16px",
                  }}
                >
                  {ft.letter}
                </span>
                <b style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "15px" }}>{ft.title}</b>
                <span style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>{ft.desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="engine" className="ep-landing-section" style={{ paddingTop: 0 }}>
          <span
            style={{
              display: "inline-block",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--indigo-text)",
              background: "var(--indigo-tint)",
              padding: "6px 14px",
              borderRadius: "999px",
            }}
          >
            The core engine
          </span>
          <h2
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: "clamp(22px,4vw,34px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: "14px 0 20px",
            }}
          >
            Stablecoins under the hood.
            <br />
            Fiat at the edges.
          </h2>
          <div className="ep-grid-2" style={{ alignItems: "center" }}>
            <p style={{ color: "var(--muted)", fontSize: "15px", lineHeight: 1.7, margin: 0 }}>
              Every cross-border payment routes through our stablecoin settlement layer. Money enters as KES, NGN, EUR or USD, moves as USDC or USDT, and lands as local currency on the other side.
            </p>
            <div style={{ background: "var(--ink-panel)", borderRadius: "22px", padding: "20px", color: "#fff" }}>
              {engineRails.map((rl: any, i: number) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 0",
                    borderBottom: i < engineRails.length - 1 ? "1px dashed rgba(255,255,255,0.15)" : "none",
                    fontSize: "12.5px",
                  }}
                >
                  <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: rl.dot }} />
                  <b>{rl.label}</b>
                  <span style={{ marginLeft: "auto", color: "var(--ink-panel-text)", fontFamily: "'DM Mono',monospace", fontSize: "11px" }}>
                    {rl.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="ep-grid-4" style={{ marginTop: "28px" }}>
            {engineStats.map((es: any, i: number) => (
              <div
                key={i}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "18px",
                  padding: "18px",
                  textAlign: "center",
                }}
              >
                <b
                  style={{
                    fontFamily: "'Space Grotesk',sans-serif",
                    fontSize: "clamp(22px,4vw,32px)",
                    fontWeight: 800,
                    color: "var(--indigo-text)",
                    display: "block",
                  }}
                >
                  {es.value}
                </b>
                <span style={{ fontSize: "11.5px", color: "var(--muted2)", fontWeight: 600 }}>{es.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="ep-landing-cta-band" style={{ background: "var(--ink-panel)", color: "#fff", textAlign: "center" }}>
          <h2
            style={{
              fontFamily: "'Space Grotesk',sans-serif",
              fontSize: "clamp(22px,4vw,36px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              margin: 0,
            }}
          >
            Ready to modernize your
            <br />
            business payments?
          </h2>
          <p style={{ color: "var(--ink-panel-text)", margin: "12px 0 26px" }}>
            Join the businesses already moving money faster, cheaper and more securely.
          </p>
          <button
            type="button"
            onClick={enterApp}
            style={{
              padding: "14px 28px",
              minHeight: "48px",
              borderRadius: "999px",
              border: "none",
              background: "var(--indigo-bright)",
              color: "var(--indigo-on)",
              fontFamily: "'Space Grotesk',sans-serif",
              fontWeight: 700,
              fontSize: "14.5px",
              cursor: "pointer",
            }}
          >
            Open the dashboard
          </button>
        </section>

        <footer style={{ borderTop: "1px solid var(--border)", padding: "24px 16px", textAlign: "center", fontSize: "12px", color: "var(--muted2)" }}>
          © 2026 ElementPay · Move business money at internet speed
        </footer>
      </div>
    </div>
  );
}
