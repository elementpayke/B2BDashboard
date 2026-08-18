"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BP } from "@/lib/responsive";

export type ChoicePickerOption = {
  value: string;
  label: string;
  leading?: ReactNode;
};

export type ChoicePickerProps = {
  id: string;
  label: string;
  value: string;
  options: ChoicePickerOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  searchable?: boolean;
  placeholder?: string;
  title?: string;
};

const POPOVER_MIN = 160;
const POPOVER_GAP = 6;

function useCompactPicker() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const update = () => setCompact(window.innerWidth < BP.desktop);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return compact;
}

function popoverStyle(rect: DOMRect): CSSProperties {
  const spaceBelow = window.innerHeight - rect.bottom - POPOVER_GAP;
  const spaceAbove = rect.top - POPOVER_GAP;
  const placeAbove = spaceBelow < POPOVER_MIN && spaceAbove > spaceBelow;
  const available = placeAbove ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(96, Math.min(320, available, window.innerHeight * 0.4));
  const width = Math.max(rect.width, 220);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  if (placeAbove) {
    return {
      position: "fixed",
      top: "auto",
      bottom: window.innerHeight - rect.top + POPOVER_GAP,
      left,
      width,
      maxHeight,
      zIndex: 120,
    };
  }
  return {
    position: "fixed",
    top: rect.bottom + POPOVER_GAP,
    bottom: "auto",
    left,
    width,
    maxHeight,
    zIndex: 120,
  };
}

export default function ChoicePicker({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  loading = false,
  loadingLabel = "Loading…",
  searchable,
  placeholder = "Search…",
  title,
}: ChoicePickerProps) {
  const compact = useCompactPicker();
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const selected = options.find((opt) => opt.value === value);
  const showSearch = searchable ?? options.length > 8;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHighlight(0);
      return;
    }
    const updatePos = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect || compact) return;
      setPanelStyle(popoverStyle(rect));
    };
    updatePos();

    const focusables = () => {
      const panel = panelRef.current;
      if (!panel) return [];
      const nested = [
        ...panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([role="option"]), [href], input:not([disabled])',
        ),
      ];
      return panel.tabIndex >= 0 ? [panel, ...nested] : nested;
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => {
      if (showSearch) searchRef.current?.focus();
      else panelRef.current?.focus();
    }, 20);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [compact, open, showSearch]);

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (event: ReactKeyboardEvent) => {
    const list = filtered;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, list.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setHighlight(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setHighlight(Math.max(0, list.length - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const choice = list[highlight];
      if (choice) pick(choice.value);
    }
  };

  const activeId = filtered[highlight] ? `${listId}-opt-${highlight}` : undefined;

  const optionButtons = filtered.length === 0 ? (
    <p className="ep-choice-empty">No matching options</p>
  ) : (
    filtered.map((opt, i) => (
      <button
        key={opt.value}
        id={`${listId}-opt-${i}`}
        type="button"
        role="option"
        tabIndex={-1}
        aria-selected={opt.value === value}
        className={`ep-choice-option${opt.value === value ? " ep-choice-option--active" : ""}${i === highlight ? " ep-choice-option--hl" : ""}`}
        onMouseEnter={() => setHighlight(i)}
        onClick={() => pick(opt.value)}
      >
        {opt.leading}
        <span>{opt.label}</span>
      </button>
    ))
  );

  const searchField = showSearch ? (
    <input
      ref={searchRef}
      className="ep-money-input ep-choice-sheet__search"
      value={query}
      onChange={(e) => {
        setQuery(e.target.value);
        setHighlight(0);
      }}
      onKeyDown={onListKeyDown}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  ) : null;

  const panel = open
    ? createPortal(
        compact ? (
          <div className="ep-choice-overlay" onMouseDown={() => setOpen(false)}>
            <div
              ref={panelRef}
              className="ep-choice-sheet"
              role="dialog"
              tabIndex={showSearch ? -1 : 0}
              aria-labelledby={`${id}-sheet-title`}
              aria-activedescendant={activeId}
              onMouseDown={(event) => event.stopPropagation()}
              onKeyDown={onListKeyDown}
            >
              <div className="ep-choice-sheet__grabber" aria-hidden />
              <div className="ep-choice-sheet__header">
                <h3 id={`${id}-sheet-title`}>{title || label}</h3>
                <button type="button" className="ep-choice-sheet__close" onClick={() => setOpen(false)} aria-label="Close">
                  ✕
                </button>
              </div>
              {searchField}
              <div className="ep-choice-sheet__list" role="listbox" id={listId} aria-labelledby={id} aria-activedescendant={activeId}>
                {optionButtons}
              </div>
            </div>
          </div>
        ) : (
          <div className="ep-choice-popover-root">
            <div className="ep-choice-overlay ep-choice-overlay--ghost" onMouseDown={() => setOpen(false)} />
            <div
              ref={panelRef}
              className="ep-choice-popover"
              style={panelStyle}
              role="listbox"
              tabIndex={showSearch ? -1 : 0}
              id={listId}
              aria-labelledby={id}
              aria-activedescendant={activeId}
              onMouseDown={(event) => event.stopPropagation()}
              onKeyDown={onListKeyDown}
            >
              {searchField}
              <div className="ep-choice-popover__list">{optionButtons}</div>
            </div>
          </div>
        ),
        document.body,
      )
    : null;

  return (
    <div className="ep-choice">
      <label className="ep-money-label" htmlFor={id}>
        {label}
      </label>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="ep-money-input ep-choice__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${loading ? loadingLabel : selected?.label || placeholder}`}
        disabled={disabled || loading}
        onClick={() => {
          if (disabled || loading) return;
          setOpen((v) => !v);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="ep-choice__value">
          {selected?.leading}
          <span>{loading ? loadingLabel : selected?.label || placeholder}</span>
        </span>
        <span className="ep-choice__chevron" aria-hidden>
          ▾
        </span>
      </button>
      {panel}
    </div>
  );
}
