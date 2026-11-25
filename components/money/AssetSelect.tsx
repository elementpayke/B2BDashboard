"use client";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import AssetMark from "@/components/money/AssetMark";

/**
 * Account picker that shows each asset's own mark.
 *
 * A native `<select>` cannot render an image in an option, so currencies were
 * identified by text alone — "USDT · Polygon · 840.50" next to
 * "Canadian Dollar (CAD) · 0.00" with nothing to tell them apart at a glance.
 * This is a listbox so every row can carry its flag or coin.
 *
 * Replacing a native control means re-earning what it gave for free, so:
 * Up/Down/Home/End move, Enter/Space select, Escape closes and returns focus,
 * typing jumps to a matching option, and the trigger is a real combobox with
 * `aria-expanded` / `aria-activedescendant`. Clicking away or tabbing out
 * closes it. Without those this would be a downgrade with nicer pictures.
 */

export type AssetSelectOption = {
  id: string;
  currency: string;
  label: string;
  /** Localized, display only — never parsed back into a number. */
  balanceLabel: string;
  /** Flag image for fiat with one country; null for shared/stablecoin. */
  flagUrl?: string | null;
  /** Settlement chain, badged onto a stablecoin's coin mark. */
  network?: string | null;
};

export default function AssetSelect({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  options: AssetSelectOption[];
  placeholder: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const typeahead = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  const selected = options.find((o) => o.id === value) ?? null;
  const selectedIndex = selected ? options.indexOf(selected) : -1;

  const close = useCallback(
    (refocus: boolean) => {
      setOpen(false);
      setActiveIndex(-1);
      if (refocus) triggerRef.current?.focus();
    },
    [],
  );

  // Pointer-down rather than click: a click listener fires after the option's
  // own handler, which would close and immediately reopen on the trigger.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  useEffect(() => {
    if (open && activeIndex >= 0) {
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex]);

  function openAt(index: number) {
    if (disabled || !options.length) return;
    setOpen(true);
    setActiveIndex(index < 0 ? Math.max(0, selectedIndex) : index);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.id);
    close(true);
  }

  function jumpToTyped(char: string) {
    const now = Date.now();
    // Reset the buffer after a pause so "us" then later "c" isn't read as "usc".
    typeahead.current =
      now - typeahead.current.at > 600
        ? { text: char, at: now }
        : { text: typeahead.current.text + char, at: now };
    const needle = typeahead.current.text.toLowerCase();
    const found = options.findIndex(
      (o) =>
        o.label.toLowerCase().startsWith(needle) ||
        o.currency.toLowerCase().startsWith(needle),
    );
    if (found >= 0) {
      setActiveIndex(found);
      if (!open) setOpen(true);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    const last = options.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        open ? setActiveIndex((i) => Math.min(last, i + 1)) : openAt(-1);
        break;
      case "ArrowUp":
        e.preventDefault();
        open ? setActiveIndex((i) => Math.max(0, i - 1)) : openAt(last);
        break;
      case "Home":
        if (open) { e.preventDefault(); setActiveIndex(0); }
        break;
      case "End":
        if (open) { e.preventDefault(); setActiveIndex(last); }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        open ? commit(activeIndex) : openAt(-1);
        break;
      case "Escape":
        if (open) { e.preventDefault(); close(true); }
        break;
      case "Tab":
        if (open) close(false);
        break;
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          jumpToTyped(e.key);
        }
    }
  }

  return (
    <div className="ep-asset-select" ref={rootRef}>
      <span className="ep-money-label" id={`${id}-label`}>
        {label}
      </span>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${id}-label ${id}`}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        className="ep-asset-select__trigger"
        disabled={disabled}
        onClick={() => (open ? close(false) : openAt(-1))}
        onKeyDown={onKeyDown}
      >
        {selected ? (
          <>
            <AssetMark
              code={selected.currency}
              flagUrl={selected.flagUrl}
              network={selected.network}
              className="ep-asset-select__mark"
              coinSize={26}
            />
            <span className="ep-asset-select__text">
              <span className="ep-asset-select__name">{selected.label}</span>
              {selected.balanceLabel !== "—" ? (
                <span className="ep-asset-select__balance">{selected.balanceLabel}</span>
              ) : null}
            </span>
          </>
        ) : (
          <span className="ep-asset-select__placeholder">{placeholder}</span>
        )}
        <span className="ep-asset-select__caret" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <ul className="ep-asset-select__list" id={listId} role="listbox" aria-labelledby={`${id}-label`}>
          {options.map((o, i) => (
            <li
              key={o.id}
              ref={(el) => {
                optionRefs.current[i] = el;
              }}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.id === value}
              data-active={i === activeIndex || undefined}
              className="ep-asset-select__option"
              onPointerDown={(e) => {
                e.preventDefault();
                commit(i);
              }}
              onPointerEnter={() => setActiveIndex(i)}
            >
              <AssetMark
                code={o.currency}
                flagUrl={o.flagUrl}
                network={o.network}
                className="ep-asset-select__mark"
                coinSize={26}
              />
              <span className="ep-asset-select__text">
                <span className="ep-asset-select__name">{o.label}</span>
                {o.balanceLabel !== "—" ? (
                  <span className="ep-asset-select__balance">{o.balanceLabel}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
