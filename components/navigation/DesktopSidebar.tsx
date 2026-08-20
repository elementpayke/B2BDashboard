"use client";

import MbokaLogo from "@/components/brand/MbokaLogo";
import {
  DASHBOARD_NAV_ITEMS,
  DESKTOP_NAV_GROUPS,
  isNavigationItemActive,
} from "@/lib/navigation/navConfig";

type DesktopSidebarProps = {
  screen: string;
  businessName: string;
  role?: string;
  themeIcon: string;
  onHome: () => void;
  onNavigate: (screen: string) => void;
  onToggleTheme: () => void;
  onLogout: () => void;
};

export default function DesktopSidebar({
  screen,
  businessName,
  role,
  themeIcon,
  onHome,
  onNavigate,
  onToggleTheme,
  onLogout,
}: DesktopSidebarProps) {
  return (
    <aside className="ep-sidebar" aria-label="Main navigation">
      <button onClick={onHome} className="ep-sidebar__brand" aria-label="Mboka home">
        <MbokaLogo size={32} sub="Business" />
      </button>

      <nav className="ep-sidebar__nav">
        {DESKTOP_NAV_GROUPS.map((group) => {
          const items = DASHBOARD_NAV_ITEMS.filter((item) => item.group === group);
          return (
            <div className="ep-sidebar__section" key={group}>
              <div className="ep-sidebar__group">{group}</div>
              {items.map((item) => {
                const active = isNavigationItemActive(item.key, screen);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onNavigate(item.key)}
                    className={`ep-sidebar__nav-btn${active ? " ep-sidebar__nav-btn--active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="ep-sidebar__nav-icon" aria-hidden>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                    {item.key === "reports" ? (
                      <span className="ep-sidebar__soon">Soon</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="ep-sidebar__profile">
        <span className="ep-sidebar__avatar" aria-hidden>
          {(businessName || "?").slice(0, 2).toUpperCase()}
        </span>
        <div className="ep-sidebar__identity">
          <div className="ep-sidebar__business">{businessName || "Loading…"}</div>
          <div className="ep-sidebar__role">{role || ""}</div>
        </div>
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="ep-sidebar__utility"
        >
          {themeIcon}
        </button>
        <button onClick={onLogout} aria-label="Log out" className="ep-sidebar__utility">
          ⏻
        </button>
      </div>
    </aside>
  );
}
