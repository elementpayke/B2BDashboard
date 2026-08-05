"use client";

import { useEffect, useState } from "react";

/** Breakpoints aligned with the B2B dashboard responsive contract. */
export const BP = {
  mobile: 640,
  tablet: 1024,
  desktop: 1024,
  large: 1440,
} as const;

export type Breakpoint = "mobile" | "tablet" | "desktop" | "large";

export function getBreakpoint(width: number): Breakpoint {
  if (width < BP.mobile) return "mobile";
  if (width < BP.tablet) return "tablet";
  if (width < BP.large) return "desktop";
  return "large";
}

/** Compact chrome (drawer + bottom nav) below desktop. */
export function isCompactWidth(width: number): boolean {
  return width < BP.desktop;
}

export type ViewportState = {
  width: number;
  breakpoint: Breakpoint;
  /** < 1024 — drawer sidebar + bottom tab bar */
  isCompact: boolean;
  /** < 640 — stacked cards, one-column forms, priority home layout */
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLarge: boolean;
};

function fromWidth(width: number, forceMobile?: boolean): ViewportState {
  if (forceMobile) {
    return {
      width: BP.mobile - 1,
      breakpoint: "mobile",
      isCompact: true,
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isLarge: false,
    };
  }
  const breakpoint = getBreakpoint(width);
  return {
    width,
    breakpoint,
    isCompact: isCompactWidth(width),
    isMobile: width < BP.mobile,
    isTablet: width >= BP.mobile && width < BP.tablet,
    isDesktop: width >= BP.desktop,
    isLarge: width >= BP.large,
  };
}

/**
 * SSR-safe viewport hook. Defaults to desktop to avoid compact flash on
 * large screens; compact clients correct on the first paint after mount.
 */
export function useViewport(forceMobile?: boolean): ViewportState {
  const [vp, setVp] = useState<ViewportState>(() =>
    fromWidth(
      typeof window !== "undefined" ? window.innerWidth : BP.desktop,
      forceMobile,
    ),
  );

  useEffect(() => {
    if (forceMobile) {
      setVp(fromWidth(0, true));
      return;
    }
    const update = () => setVp(fromWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [forceMobile]);

  return vp;
}
