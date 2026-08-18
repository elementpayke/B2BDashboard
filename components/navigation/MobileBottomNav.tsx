"use client";

import {
  isMoreNavigationActive,
  isNavigationItemActive,
  MOBILE_PRIMARY_NAV_ITEMS,
} from "@/lib/navigation/navConfig";

type MobileBottomNavProps = {
  screen: string;
  moreOpen: boolean;
  onNavigate: (screen: string) => void;
  onOpenMore: () => void;
};

export default function MobileBottomNav({
  screen,
  moreOpen,
  onNavigate,
  onOpenMore,
}: MobileBottomNavProps) {
  return (
    <nav className="ep-bottom-nav" aria-label="Primary mobile navigation">
      {MOBILE_PRIMARY_NAV_ITEMS.map((item) => {
        const active = isNavigationItemActive(item.key, screen);
        return (
          <button
            key={item.key}
            type="button"
            data-active={active ? "true" : "false"}
            onClick={() => onNavigate(item.key)}
            aria-current={active ? "page" : undefined}
          >
            <span className="ep-bottom-nav__icon" aria-hidden>
              {item.icon}
            </span>
            <span className="ep-bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        data-active={isMoreNavigationActive(screen, moreOpen) ? "true" : "false"}
        onClick={onOpenMore}
        aria-expanded={moreOpen}
        aria-controls="ep-mobile-more"
      >
        <span className="ep-bottom-nav__icon" aria-hidden>
          ⋯
        </span>
        <span className="ep-bottom-nav__label">More</span>
      </button>
    </nav>
  );
}
