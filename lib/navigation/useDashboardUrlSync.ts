"use client";

import { useEffect, useRef } from "react";
import { pathForScreen, screenForPath, type RoutableScreen } from "./dashboardRoutes";

/**
 * Keep the address bar in sync with `screen`, and follow Back/Forward.
 * Uses native history (supported by the Next 16 router — see
 * node_modules/next/dist/docs/01-app/02-guides/single-page-applications.md,
 * "Shallow routing on the client"), so switching screens never refetches or
 * remounts the dashboard.
 */
export function useDashboardUrlSync(screen: string, onNavigate: (screen: RoutableScreen) => void): void {
  const onNavigateRef = useRef(onNavigate);
  const syncedOnce = useRef(false);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
  });

  useEffect(() => {
    const path = pathForScreen(screen);
    if (path === null) return;
    const url = new URL(window.location.href);
    // Legacy deep links (?screen=…) are normalised into the path; replace
    // rather than push so Back doesn't bounce through the old URL.
    const replace = !syncedOnce.current || url.searchParams.has("screen");
    url.searchParams.delete("screen");
    const target = `${path}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    syncedOnce.current = true;
    if (target === current) return;
    if (replace) window.history.replaceState(null, "", target);
    else window.history.pushState(null, "", target);
  }, [screen]);

  useEffect(() => {
    const onPopState = () => {
      const next = screenForPath(window.location.pathname);
      if (next) onNavigateRef.current(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
}
