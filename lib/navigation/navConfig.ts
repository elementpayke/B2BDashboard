export type DashboardScreen =
  | "home"
  | "wallets"
  | "accountDetail"
  | "transactions"
  | "invoices"
  | "reports"
  | "cards"
  | "verification"
  | "team"
  | "developer";

export type NavigationItem = {
  key: Exclude<DashboardScreen, "accountDetail">;
  label: string;
  icon: string;
  group: "Overview" | "Money" | "Commerce" | "Insights" | "Workspace";
  mobilePrimary?: boolean;
};

export const DASHBOARD_NAV_ITEMS: NavigationItem[] = [
  { key: "home", label: "Home", icon: "⌂", group: "Overview", mobilePrimary: true },
  { key: "wallets", label: "Accounts", icon: "▦", group: "Money", mobilePrimary: true },
  {
    key: "transactions",
    label: "Transactions",
    icon: "≣",
    group: "Money",
    mobilePrimary: true,
  },
  { key: "invoices", label: "Invoices", icon: "▤", group: "Commerce", mobilePrimary: true },
  { key: "reports", label: "Reports", icon: "↗", group: "Insights" },
  { key: "verification", label: "Verification", icon: "✓", group: "Workspace" },
  { key: "team", label: "Team", icon: "◉", group: "Workspace" },
  { key: "developer", label: "Developers", icon: "⌘", group: "Workspace" },
  { key: "cards", label: "Cards", icon: "▰", group: "Workspace" },
];

export const DESKTOP_NAV_GROUPS = [
  "Overview",
  "Money",
  "Commerce",
  "Insights",
  "Workspace",
] as const;

export const MOBILE_PRIMARY_NAV_ITEMS = DASHBOARD_NAV_ITEMS.filter(
  (item) => item.mobilePrimary,
);

export const MOBILE_MORE_NAV_ITEMS = DASHBOARD_NAV_ITEMS.filter(
  (item) => !item.mobilePrimary,
);

export function isNavigationItemActive(itemKey: string, screen: string): boolean {
  if (itemKey === "wallets") {
    return screen === "wallets" || screen === "accountDetail";
  }
  return itemKey === screen;
}

export function isMoreNavigationActive(screen: string, moreOpen = false): boolean {
  return moreOpen || MOBILE_MORE_NAV_ITEMS.some((item) => isNavigationItemActive(item.key, screen));
}
