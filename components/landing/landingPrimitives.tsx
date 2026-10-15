"use client";
import React, { useEffect, useRef, useState } from "react";
import { flagCdnUrl } from "./landingTokens";

/** Shared pieces used across the landing page's hero, capability cards, and
 * talk-to-us sections. Split out so no single file has to carry the whole
 * page (components/Landing.tsx + LandingCapabilities.tsx + LandingTalkToUs.tsx
 * all import from here). */

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/** Fades up 36px over .8s on first intersection — skips elements already in
 * the viewport on mount, matching the design's IntersectionObserver spec. */
export function Reveal({
  children,
  as: Tag = "div",
  style,
  ...rest
}: {
  children: React.ReactNode;
  as?: keyof React.JSX.IntrinsicElements;
  style?: React.CSSProperties;
  [key: string]: any;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(true);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion) {
      // Respect a live preference change too, not just its value at mount —
      // otherwise a below-fold element can stay at opacity 0 until it
      // scrolls into view and the IntersectionObserver fires.
      setVisible(true);
      return;
    }
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already in view
    setVisible(false);
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          setVisible(true);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reducedMotion]);

  const Comp = Tag as any;
  return (
    <Comp
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(36px)",
        transition: "opacity .8s cubic-bezier(.2,.8,.2,1), transform .8s cubic-bezier(.2,.8,.2,1)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

export function FlagImg({
  iso,
  width = 18,
  height = 13,
  radius = 3,
}: {
  iso: string;
  width?: number;
  height?: number;
  radius?: number;
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundImage: `url(${flagCdnUrl(iso)})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        flexShrink: 0,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
      }}
      aria-hidden
    />
  );
}

export function PillChip({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 13px 9px 10px",
        borderRadius: 999,
        background: "var(--panel)",
        color: "var(--ink)",
        border: "1px solid var(--border)",
        boxShadow: "0 14px 30px -16px rgba(19,17,38,0.4)",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

export const USDT_COIN = (
  <svg width="1em" height="1em" viewBox="0 0 100 100" style={{ flexShrink: 0, display: "block" }} aria-hidden>
    <circle cx="50" cy="50" r="50" fill="#26A17B" />
    <path
      d="M27 26H73V37H56V45C68 46 76 49 76 52.5C76 56 68 59 56 60V78H44V60C32 59 24 56 24 52.5C24 49 32 46 44 45V37H27Z"
      fill="#FFFFFF"
    />
    <ellipse cx="50" cy="52.5" rx="21" ry="4.2" fill="#26A17B" />
  </svg>
);

export const USDC_COIN = (
  <svg width="1em" height="1em" viewBox="0 0 100 100" style={{ flexShrink: 0, display: "block" }} aria-hidden>
    <circle cx="50" cy="50" r="50" fill="#2775CA" />
    <path d="M38 22a30 30 0 0 0 0 56M62 22a30 30 0 0 1 0 56" stroke="#FFFFFF" strokeWidth="5" fill="none" strokeLinecap="round" />
    <text x="50" y="64" textAnchor="middle" fontFamily="Space Grotesk,sans-serif" fontWeight={700} fontSize="40" fill="#FFFFFF">
      $
    </text>
  </svg>
);
