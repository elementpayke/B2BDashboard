"use client";
import React, { useEffect, useRef, useState } from "react";
import { flagCdnUrl } from "./landingTokens";
import CoinMark from "@/components/brand/CoinMark";

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

/**
 * Coin marks live in `components/brand/CoinMark` so the landing page and the
 * product dashboard draw the identical artwork. Re-exported here as elements
 * to keep existing landing call sites unchanged.
 */
export const USDT_COIN = <CoinMark asset="USDT" size="1em" title={null} />;

export const USDC_COIN = <CoinMark asset="USDC" size="1em" title={null} />;
