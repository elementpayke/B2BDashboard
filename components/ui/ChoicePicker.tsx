"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BP } from "@/lib/responsive";

export type ChoicePickerOption = {
  value: string;
  label: string;
  leading?: React.ReactNode;
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const selected = options.find((opt) => opt.value === value);
  const showSearch = searchable ?? options.length > 8;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHighlight(0);
      return;
    }
    const updatePos = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect || compact) return;
      const maxHeight = Math.min(320, window.innerHeight - rect.bottom - 12, 40 * window.innerHeight / 100);
      setPanelStyle({
        position: "fixed",
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 220),
        maxHeight: Math.max(160, maxHeight),
        zIndex: 120,
      });
    };
    updatePos();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => searchRef.current?.focus(), 20);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [compact, open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const choice = filtered[highlight];
      if (choice) pick(choice.value);
    }
  };

  const panel = open
    ? createPortal(
        compact ? (
          <div className="ep-choice-overlay" onMouseDown={() => setOpen(false)}>
            <div
              className="ep-choice-sheet"
              role="dialog"
              aria-labelledby={`${id}-sheet-title`}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="ep-choice-sheet__grabber" aria-hidden />
              <div className="ep-choice-sheet__header">
                <h3 id={`${id}-sheet-title`}>{title || label}</h3>
                <button type="button" className="ep-choice-sheet__close" onClick={() => setOpen(false)} aria-label="Close">
                  ✕
                </button>
              </div>
              {showSearch ? (
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
              ) : null}
              <div className="ep-choice-sheet__list" role="listbox" id={listId} aria-labelledby={id}>
                {filtered.length === 0 ? (
                  <p className="ep-choice-empty">No matching options</p>
                ) : (
                  filtered.map((opt, i) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={opt.value === value}
                      className={`ep-choice-option${opt.value === value ? " ep-choice-option--active" : ""}${i === highlight ? " ep-choice-option--hl" : ""}`}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => pick(opt.value)}
                    >
                      {opt.leading}
                      <span>{opt.label}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="ep-choice-popover-root">
            <div className="ep-choice-overlay ep-choice-overlay--ghost" onMouseDown={() => setOpen(false)} />
            <div
              className="ep-choice-popover"
              style={panelStyle}
              role="listbox"
              id={listId}
              aria-labelledby={id}
              onMouseDown={(event) => event.stopPropagation()}
            >
              {showSearch ? (
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
              ) : null}
              <div className="ep-choice-popover__list">
                {filtered.length === 0 ? (
                  <p className="ep-choice-empty">No matching options</p>
                ) : (
                  filtered.map((opt, i) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={opt.value === value}
                      className={`ep-choice-option${opt.value === value ? " ep-choice-option--active" : ""}${i === highlight ? " ep-choice-option--hl" : ""}`}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => pick(opt.value)}
                    >
                      {opt.leading}
                      <span>{opt.label}</span>
                    </button>
                  ))
                )}
              </div>
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
