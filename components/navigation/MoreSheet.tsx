"use client";

import { useEffect, useRef } from "react";
import {
  isNavigationItemActive,
  MOBILE_MORE_NAV_ITEMS,
} from "@/lib/navigation/navConfig";

type MoreSheetProps = {
  open: boolean;
  screen: string;
  businessName: string;
  role?: string;
  themeIcon: string;
  onClose: () => void;
  onNavigate: (screen: string) => void;
  onOpenBulk: () => void;
  onOpenTopUp: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
};

export default function MoreSheet({
  open,
  screen,
  businessName,
  role,
  themeIcon,
  onClose,
  onNavigate,
  onOpenBulk,
  onOpenTopUp,
  onToggleTheme,
  onLogout,
}: MoreSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    sheet?.querySelector<HTMLElement>("button")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !sheet) return;
      const focusable = Array.from(
        sheet.querySelectorAll<HTMLElement>("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="ep-more-overlay" onMouseDown={onClose}>
      <div
        id="ep-mobile-more"
        ref={sheetRef}
        className="ep-more-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ep-more-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ep-more-sheet__grabber" aria-hidden />
        <div className="ep-more-sheet__header">
          <div>
            <span className="ep-more-sheet__eyebrow">Workspace</span>
            <h2 id="ep-more-title">More</h2>
          </div>
          <button type="button" onClick={onClose} className="ep-more-sheet__close" aria-label="Close">
            ✕
          </button>
        </div>

        <nav className="ep-more-sheet__nav" aria-label="Secondary navigation">
          {MOBILE_MORE_NAV_ITEMS.map((item) => {
            const active = isNavigationItemActive(item.key, screen);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                className={active ? "ep-more-sheet__item ep-more-sheet__item--active" : "ep-more-sheet__item"}
                aria-current={active ? "page" : undefined}
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
                {item.key === "reports" ? (
                  <span className="ep-more-sheet__soon">Soon</span>
                ) : (
                  <span aria-hidden>›</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="ep-more-sheet__actions" aria-label="Money actions">
          <button type="button" className="ep-more-sheet__item" onClick={onOpenTopUp}>
            <span aria-hidden>＋</span>
            <span>Top up</span>
            <span aria-hidden>›</span>
          </button>
          <button type="button" className="ep-more-sheet__item" onClick={onOpenBulk}>
            <span aria-hidden>⇉</span>
            <span>Bulk payouts</span>
            <span className="ep-more-sheet__soon">Soon</span>
          </button>
        </div>

        <div className="ep-more-sheet__profile">
          <span className="ep-sidebar__avatar" aria-hidden>
            {(businessName || "?").slice(0, 2).toUpperCase()}
          </span>
          <div className="ep-sidebar__identity">
            <div className="ep-sidebar__business">{businessName || "Loading…"}</div>
            <div className="ep-sidebar__role">{role || ""}</div>
          </div>
          <button type="button" onClick={onToggleTheme} className="ep-more-sheet__utility">
            <span aria-hidden>{themeIcon}</span>
            <span className="ep-activity__sr">Toggle theme</span>
          </button>
          <button type="button" onClick={onLogout} className="ep-more-sheet__utility">
            <span aria-hidden>⏻</span>
            <span className="ep-activity__sr">Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
