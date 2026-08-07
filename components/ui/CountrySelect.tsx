"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { countryName, searchCountries, type IsoCountry } from "@/lib/data/isoCountries";

const fieldLabel: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "700",
  color: "var(--muted2)",
  textTransform: "uppercase",
};

const fieldInput: React.CSSProperties = {
  width: "100%",
  marginTop: "6px",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1.5px solid var(--input-border)",
  background: "var(--input-bg)",
  outline: "none",
  fontSize: "13.5px",
  color: "var(--ink)",
  boxSizing: "border-box",
};

export type CountrySelectProps = {
  label: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  /** When true, selecting clears the open list (default). */
  required?: boolean;
};

export default function CountrySelect({
  label,
  value,
  onChange,
  placeholder = "Search country…",
  required,
}: CountrySelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const selectedLabel = value ? countryName(value) || value : "";

  const results = useMemo(() => searchCountries(query, 14), [query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function pick(c: IsoCountry) {
    onChange(c.code);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const choice = results[highlight];
      if (choice) pick(choice);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <label style={fieldLabel} htmlFor={listId}>
        {label}
      </label>
      <input
        id={listId}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${listId}-list`}
        aria-autocomplete="list"
        aria-required={required || undefined}
        autoComplete="off"
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setHighlight(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
          // Typing clears an invalid/stale free-text selection.
          if (value) onChange("");
        }}
        onKeyDown={onKeyDown}
        style={fieldInput}
      />
      {value && !open ? (
        <div style={{ marginTop: "4px", fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
          ISO · {value}
        </div>
      ) : null}
      {open ? (
        <ul
          id={`${listId}-list`}
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
            top: "100%",
            margin: "4px 0 0",
            padding: "6px",
            listStyle: "none",
            maxHeight: "220px",
            overflow: "auto",
            borderRadius: "14px",
            border: "1px solid var(--border)",
            background: "var(--modal-bg)",
            boxShadow: "0 18px 40px -18px rgba(19,17,38,0.45)",
          }}
        >
          {results.length === 0 ? (
            <li style={{ padding: "10px 12px", fontSize: "12.5px", color: "var(--muted)" }}>
              No matching country
            </li>
          ) : (
            results.map((c, i) => (
              <li key={c.code} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(c)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    cursor: "pointer",
                    background: i === highlight ? "var(--indigo-tint)" : "transparent",
                    color: "var(--ink)",
                    fontSize: "13px",
                    fontWeight: 600,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "10px",
                  }}
                >
                  <span>{c.name}</span>
                  <span style={{ color: "var(--muted2)", fontWeight: 700 }}>{c.code}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
