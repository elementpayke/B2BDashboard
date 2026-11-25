// Pure, server-safe (used by app/dashboard/[[...screen]]/page.tsx). The
// client-side sync hook lives in ./useDashboardUrlSync.ts.
import type { DashboardScreen } from "./navConfig";

/**
 * URL ↔ dashboard screen mapping. Gives every top-level screen a real,
 * shareable URL (`/dashboard/transactions`) while DashboardApp keeps its
 * in-memory `state.screen`. Screens that need context to render
 * (accountDetail, money flows) are deliberately not routable — the URL stays
 * on the screen they were opened from.
 */
export const DASHBOARD_ROUTES = {
  home: "/dashboard",
  wallets: "/dashboard/accounts",
  cards: "/dashboard/cards",
  transactions: "/dashboard/transactions",
  invoices: "/dashboard/invoices",
  reports: "/dashboard/reports",
  verification: "/dashboard/verification",
  team: "/dashboard/team",
  developer: "/dashboard/developers",
} as const satisfies Partial<Record<DashboardScreen, string>>;

export type RoutableScreen = keyof typeof DASHBOARD_ROUTES;

export function pathForScreen(screen: string): string | null {
  return (DASHBOARD_ROUTES as Record<string, string>)[screen] ?? null;
}

export function screenForPath(pathname: string): RoutableScreen | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  for (const [screen, path] of Object.entries(DASHBOARD_ROUTES)) {
    if (path === clean) return screen as RoutableScreen;
  }
  return null;
}

/** `[[...screen]]` segments → screen, or null for an unknown URL (→ 404). */
export function screenForSegments(segments: string[] | undefined): RoutableScreen | null {
  return screenForPath(`/dashboard${segments?.length ? `/${segments.join("/")}` : ""}`);
}
