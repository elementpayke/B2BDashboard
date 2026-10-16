import React from "react";
import { supportWhatsAppHref } from "@/lib/support/contacts";

/**
 * "Talk to us" indigo CTA block. The design handoff's own README left the
 * booking link and message address as placeholders
 * (`#TODO-booking-link`, `mailto:TODO@mboka.com` in landing.js) — now real:
 * "Book a call" opens the Mboka Cal.com scheduling page, "Send an email"
 * opens the Mboka support mailbox (distinct from lib/support/contacts.ts'
 * info@elementpay.net, which is the in-app/dashboard Help channel), and
 * "WhatsApp us" reuses that same shared support number.
 */
const BOOK_A_CALL_HREF = "https://cal.com/elementpay/30min";
const SEND_EMAIL_ADDRESS = "support@mboka.finance";
const SEND_EMAIL_HREF = `mailto:${SEND_EMAIL_ADDRESS}?subject=Mboka%20%E2%80%94%20business%20inquiry`;
const WHATSAPP_HREF = supportWhatsAppHref("Hi Mboka — I'd like to talk about getting set up.");

function CalendarIcon({ color }: { color: string }) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
      <path d="M8 13.5h2M8 17h2M14 13.5h2M14 17h2" />
    </svg>
  );
}

function MailIcon({ color }: { color: string }) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
      <path d="m3.5 7 8.5 6.5L20.5 7" />
    </svg>
  );
}

function WhatsAppIcon({ color }: { color: string }) {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M12.04 2C6.58 2 2.14 6.44 2.14 11.9c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.004c5.46 0 9.9-4.44 9.9-9.9S17.5 2 12.04 2Zm5.64 14.38c-.2.54-1.16 1.06-1.57 1.1-.42.04-.82.19-2.77-.59-2.35-.93-3.84-3.25-3.95-3.4-.12-.16-.94-1.24-.94-2.36s.59-1.66.8-1.9c.2-.24.45-.3.6-.3h.45c.14.01.34-.05.53.41.21.48.68 1.66.74 1.78.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.13-.25.3-.36.4-.11.12-.24.25-.1.49.14.24.62 1.01 1.32 1.64.9.8 1.66 1.05 1.9 1.17.24.11.37.1.51-.06.13-.15.57-.67.73-.91.16-.24.32-.2.53-.12.22.08 1.36.64 1.6.76.24.12.39.18.45.28.06.1.06.56-.14 1.1Z" />
    </svg>
  );
}

function TalkTile({
  href,
  icon,
  iconBg,
  label,
  sublabel,
  variant,
}: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  sublabel?: string;
  variant: "solid" | "outline";
}) {
  const solid = variant === "solid";
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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
        {icon}
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <b style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>{label}</b>
        {sublabel ? (
          <span style={{ fontSize: 13, fontWeight: 600, opacity: solid ? 0.6 : 0.78, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {sublabel}
          </span>
        ) : null}
      </span>
      <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, flexShrink: 0 }}>→</span>
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
          <TalkTile href={BOOK_A_CALL_HREF} icon={<CalendarIcon color="#FFFFFF" />} iconBg="#3B2ED3" label="Book a call" variant="solid" />
          <TalkTile href={SEND_EMAIL_HREF} icon={<MailIcon color="#131126" />} iconBg="#FFB224" label="Send an email" sublabel={SEND_EMAIL_ADDRESS} variant="outline" />
          <TalkTile href={WHATSAPP_HREF} icon={<WhatsAppIcon color="#FFFFFF" />} iconBg="#25D366" label="WhatsApp us" variant="outline" />
        </div>
      </div>
    </section>
  );
}
