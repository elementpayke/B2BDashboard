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
    fontFamily: "Geist,'DM Sans',sans-serif",
    ...vars,
  };
  const themeIcon = theme === "dark" ? "\u2600" : "\u263E";

  const lcCountryChips = CURRENCIES.slice(0, 6).map((c: { iso: string; code: string }, i: number) => ({
    flagUrl: flagUrl(c.iso),
    code: c.code,
    select: selectLcCountry(i),
    selected: i === lcCountryIdx,
  }));
  const lcOut =
    (parseFloat(lcAmt.replace(/,/g, "") || "0") * 131.64).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    }) +
    " " +
    CURRENCIES[lcCountryIdx % 6].code;
  const lcRate = "1 USD = 131.64 " + CURRENCIES[lcCountryIdx % 6].code;
  const allCountryFlags = CURRENCIES.map((c: { iso: string; code: string }) => ({
    flagUrl: flagUrl(c.iso),
    code: c.code,
  }));
  const landingFeatures = [
    { letter: "A", title: "Global accounts & IBANs", desc: "Get a EUR IBAN, UK sort code and US ACH details in your business name." },
    { letter: "P", title: "Instant payouts", desc: "Pay vendors and teams to mobile money, banks and wallets across 20+ countries in minutes." },
    { letter: "S", title: "Stablecoin engine", desc: "USDC and USDT on Base and Polygon power settlement under the hood." },
    { letter: "T", title: "Multi-currency treasury", desc: "Hold and swap between fiat and digital assets with a 90-second rate lock." },
    { letter: "C", title: "Virtual cards", desc: "USD virtual cards for team spend with limits and freeze controls." },
    { letter: "E", title: "Enterprise controls", desc: "Role-based access, approval workflows, tiered KYB limits, full audit trail." },
  ];
  const engineRails = [
    { tone: "indigo", label: "Collect", tag: "fiat in" },
    { tone: "bright", label: "Settle", tag: "~seconds" },
    { tone: "soft", label: "Convert", tag: "mid-market" },
    { tone: "on", label: "Payout", tag: "fiat out" },
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
    <div style={rootStyle} className="ep-landing">
      <div data-screen-label="Landing" className="ep-landing__page">
        <header className="ep-landing-header">
          <div className="ep-landing-header-inner">
            <a href="#top" className="ep-landing-brand" aria-label="ElementPay home">
              <span className="ep-landing-mark" aria-hidden>
                E
              </span>
              <span className="ep-landing-brand__name">ElementPay</span>
            </a>

            <nav className="ep-landing-nav" aria-label="Primary">
              <button type="button" className="ep-landing-nav__link" onClick={scrollTo("features")}>
                Features
              </button>
              <button type="button" className="ep-landing-nav__link" onClick={scrollTo("engine")}>
                Stablecoin engine
              </button>
              <button type="button" className="ep-landing-nav__link" onClick={scrollTo("coverage")}>
                Coverage
              </button>
            </nav>

            <div className="ep-landing-cta">
              <button
                type="button"
                className="ep-only-compact ep-touch ep-landing-icon-btn"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-controls="ep-landing-mobile-menu"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
              >
                <span aria-hidden>{menuOpen ? "✕" : "☰"}</span>
              </button>
              <button
                type="button"
                className="ep-touch ep-landing-icon-btn ep-landing-icon-btn--round"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              >
                <span aria-hidden>{themeIcon}</span>
              </button>
              <button type="button" onClick={goLogin} className="ep-landing-btn ep-landing-btn--ghost ep-hide-mobile">
                Log in
              </button>
              <button type="button" onClick={enterApp} className="ep-landing-btn ep-landing-btn--primary">
                Dashboard
              </button>
            </div>
          </div>

          {menuOpen ? (
            <div id="ep-landing-mobile-menu" className="ep-only-compact ep-landing-mobile-menu">
              {[
                ["Features", "features"],
                ["Stablecoin engine", "engine"],
                ["Coverage", "coverage"],
              ].map(([label, id]) => (
                <button key={id} type="button" className="ep-landing-mobile-menu__link" onClick={scrollTo(id)}>
                  {label}
                </button>
              ))}
              <button type="button" className="ep-landing-mobile-menu__link ep-landing-mobile-menu__link--accent" onClick={goLogin}>
                Log in
              </button>
              <button type="button" className="ep-landing-btn ep-landing-btn--primary ep-landing-mobile-menu__cta" onClick={enterApp}>
                Open the dashboard
              </button>
            </div>
          ) : null}
        </header>

        <main id="top">
          <section className="ep-landing-hero ep-grid-hero" aria-labelledby="ep-landing-hero-title">
            <div className="ep-landing-hero__copy">
              <span className="ep-landing-pill">
                <span className="ep-landing-pill__dot" aria-hidden />
                Now in Private Beta
              </span>
              <h1 id="ep-landing-hero-title" className="ep-landing-hero__title">
                Move business money
                <br />
                at{" "}
                <span className="ep-landing-hero__highlight">internet speed</span>
              </h1>
              <p className="ep-landing-hero__lede">
                IBANs, stablecoin settlement, payouts to 20+ countries, and treasury in one platform for businesses across
                Africa and beyond.
              </p>
              <div className="ep-landing-hero__actions">
                <button type="button" onClick={enterApp} className="ep-landing-btn ep-landing-btn--primary ep-landing-btn--lg">
                  Open the dashboard
                </button>
                <button type="button" onClick={scrollTo("engine")} className="ep-landing-btn ep-landing-btn--ghost ep-landing-btn--lg">
                  See how it works
                </button>
              </div>
              <p className="ep-landing-hero__trust">No credit card required · SOC 2 in progress · 256-bit encryption</p>
            </div>

            <aside className="ep-landing-converter" aria-labelledby="ep-landing-converter-title">
              <p id="ep-landing-converter-title" className="ep-landing-converter__title">
                See what your money becomes
              </p>
              <p className="ep-landing-converter__sub">Live mid-market rates, updated every 30 seconds.</p>
              <div className="ep-landing-converter__row">
                <input
                  value={lcAmt}
                  onChange={setLcAmt}
                  inputMode="decimal"
                  aria-label="Amount in USD"
                  className="ep-landing-converter__input"
                  autoComplete="off"
                />
                <span className="ep-landing-converter__ccy" aria-hidden>
                  USD
                </span>
              </div>
              <div
                className="ep-chip-row ep-chip-row--scroll ep-scroll-hint ep-landing-converter__chips"
                role="group"
                aria-label="Destination currency"
              >
                {lcCountryChips.map((lc) => (
                  <button
                    key={lc.code}
                    type="button"
                    onClick={lc.select}
                    className={`ep-chip ep-landing-chip${lc.selected ? " ep-landing-chip--selected" : ""}`}
                    aria-pressed={lc.selected}
                  >
                    <span className="ep-flag" style={{ backgroundImage: `url(${lc.flagUrl})` }} aria-hidden />
                    <span>{lc.code}</span>
                  </button>
                ))}
              </div>
              <div className="ep-landing-converter__result">
                <span className="ep-landing-converter__out">{lcOut}</span>
                <span className="ep-landing-converter__rate">{lcRate}</span>
              </div>
              <dl className="ep-landing-converter__meta">
                <div>
                  <dt className="ep-sr-only">Fee</dt>
                  <dd>Fee 0.20%</dd>
                </div>
                <div>
                  <dt className="ep-sr-only">Arrival</dt>
                  <dd>Arrives ~2 min</dd>
                </div>
                <div>
                  <dt className="ep-sr-only">Rate lock</dt>
                  <dd>Rate lock 90s</dd>
                </div>
              </dl>
            </aside>
          </section>

          <section id="coverage" className="ep-landing-coverage" aria-labelledby="ep-landing-coverage-title">
            <h2 id="ep-landing-coverage-title" className="ep-landing-coverage__title">
              Payouts live in 20+ countries
            </h2>
            <ul className="ep-landing-coverage__list">
              {allCountryFlags.map((f) => (
                <li key={f.code} className="ep-landing-coverage__item">
                  <span className="ep-flag ep-landing-coverage__flag" style={{ backgroundImage: `url(${f.flagUrl})` }} aria-hidden />
                  <span>{f.code}</span>
                </li>
              ))}
            </ul>
          </section>

          <section id="features" className="ep-landing-section" aria-labelledby="ep-landing-features-title">
            <span className="ep-landing-eyebrow">Features</span>
            <h2 id="ep-landing-features-title" className="ep-landing-section__title">
              Everything your finance team needs
            </h2>
            <p className="ep-landing-section__lede">
              One platform to replace your patchwork of banking portals, payment processors and spreadsheets.
            </p>
            <div className="ep-grid-features ep-landing-features">
              {landingFeatures.map((ft) => (
                <article key={ft.letter} className="ep-landing-feature">
                  <span className="ep-landing-feature__icon" aria-hidden>
                    {ft.letter}
                  </span>
                  <h3 className="ep-landing-feature__title">{ft.title}</h3>
                  <p className="ep-landing-feature__desc">{ft.desc}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="engine" className="ep-landing-section ep-landing-section--engine" aria-labelledby="ep-landing-engine-title">
            <span className="ep-landing-eyebrow">The core engine</span>
            <h2 id="ep-landing-engine-title" className="ep-landing-section__title ep-landing-section__title--tight">
              Stablecoins under the hood.
              <br />
              Fiat at the edges.
            </h2>
            <div className="ep-grid-2 ep-landing-engine">
              <p className="ep-landing-engine__copy">
                Every cross-border payment routes through our stablecoin settlement layer. Money enters as KES, NGN, EUR or
                USD, moves as USDC or USDT, and lands as local currency on the other side.
              </p>
              <ol className="ep-landing-rails" aria-label="Settlement flow">
                {engineRails.map((rl, i) => (
                  <li key={rl.label} className={`ep-landing-rails__item${i === engineRails.length - 1 ? " ep-landing-rails__item--last" : ""}`}>
                    <span className={`ep-landing-rails__dot ep-landing-rails__dot--${rl.tone}`} aria-hidden />
                    <b>{rl.label}</b>
                    <span className="ep-landing-rails__tag">{rl.tag}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="ep-grid-4 ep-landing-stats">
              {engineStats.map((es) => (
                <div key={es.label} className="ep-landing-stat">
                  <span className="ep-landing-stat__value">{es.value}</span>
                  <span className="ep-landing-stat__label">{es.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="ep-landing-cta-band" aria-labelledby="ep-landing-cta-title">
            <h2 id="ep-landing-cta-title" className="ep-landing-cta-band__title">
              Ready to modernize your
              <br />
              business payments?
            </h2>
            <p className="ep-landing-cta-band__lede">
              Join the businesses already moving money faster, cheaper and more securely.
            </p>
            <button type="button" onClick={enterApp} className="ep-landing-btn ep-landing-btn--bright ep-landing-btn--lg">
              Open the dashboard
            </button>
          </section>
        </main>

        <footer className="ep-landing-footer">
          <p>© 2026 ElementPay · Move business money at internet speed</p>
        </footer>
      </div>
    </div>
  );
}
