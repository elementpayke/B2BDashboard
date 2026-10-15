import React from "react";
import { MbokaGlyphPaths } from "./MbokaGlyph";
import { supportMailtoHref, supportWhatsAppHref } from "@/lib/support/contacts";

/**
 * "Talk to us" indigo CTA block. The design handoff's own README left the
 * booking link and message address as placeholders
 * (`#TODO-booking-link`, `mailto:TODO@mboka.com` in landing.js) pending real
 * values. There's no dedicated booking/calendar tool anywhere in this app,
 * so "Book a call" points at the same WhatsApp line the in-app Help modal
 * already uses (lib/support/contacts.ts) — the only real "talk to someone
 * live" channel that exists today. "Send a message" uses the same support
 * mailbox. Swap "Book a call" for a real scheduling link if/when one exists.
 */
const BOOK_A_CALL_HREF = supportWhatsAppHref("Hi, I'd like to talk to someone about Mboka for my business.");
const SEND_MESSAGE_HREF = supportMailtoHref("Mboka — business inquiry");

function TalkTile({
  href,
  iconBg,
  iconColor,
  label,
  variant,
}: {
  href: string;
  iconBg: string;
  iconColor: string;
  label: string;
  variant: "solid" | "outline";
}) {
  const solid = variant === "solid";
  return (
    <a
      href={href}
      className="lp-talk-tile"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        width: "100%",
        padding: "18px 20px",
        borderRadius: 22,
        border: solid ? "none" : "1.5px solid rgba(255,255,255,0.28)",
        background: solid ? "#FFFFFF" : "rgba(255,255,255,0.1)",
        color: solid ? "#131126" : "#FFFFFF",
        cursor: "pointer",
        textAlign: "left",
        textDecoration: "none",
        transition: "transform .25s cubic-bezier(.2,.9,.3,1.2)",
        boxSizing: "border-box",
      }}
    >
      <span style={{ width: 46, height: 46, borderRadius: 14, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width={24} height={24} viewBox="0 0 44 44" fill="none" aria-hidden>
          <MbokaGlyphPaths color={iconColor} />
        </svg>
      </span>
      <b style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em", flex: 1 }}>{label}</b>
      <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700 }}>→</span>
    </a>
  );
}

export default function LandingTalkToUs() {
  return (
    <section style={{ maxWidth: 1200, margin: "24px auto 60px", padding: "0 clamp(12px,3vw,24px)" }}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 32,
          background: "#3B2ED3",
          color: "#FFFFFF",
          padding: "clamp(28px,5vw,56px)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))",
          gap: "28px 48px",
          alignItems: "center",
        }}
      >
        <div style={{ position: "absolute", left: -60, bottom: -90, width: 260, height: 260, background: "#7C6FFF", opacity: 0.35, transform: "rotate(12deg)", borderRadius: 28 }} />
        <div style={{ position: "absolute", right: "30%", top: -70, width: 150, height: 150, background: "#FFB224", opacity: 0.9, transform: "rotate(-14deg)", borderRadius: 22 }} />

        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
          <h2
            id="talk"
            style={{ margin: 0, fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(44px,6.4vw,84px)", fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 0.92 }}
          >
            Talk
            <br />
            to us.
          </h2>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, maxWidth: 380, opacity: 0.88 }}>
            Tell us how your business moves money. We&rsquo;ll set up the right accounts.
          </p>
        </div>

        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12, maxWidth: 460, width: "100%", justifySelf: "end" }}>
          <TalkTile href={BOOK_A_CALL_HREF} iconBg="#3B2ED3" iconColor="#FFFFFF" label="Book a call" variant="solid" />
          <TalkTile href={SEND_MESSAGE_HREF} iconBg="#FFB224" iconColor="#131126" label="Send a message" variant="outline" />
        </div>
      </div>
    </section>
  );
}
