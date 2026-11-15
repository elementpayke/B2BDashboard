"use client";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { AUTH_INDIGO, AUTH_INK } from "./authStyles";

/**
 * Segmented one-time-code input.
 *
 * A single text box asks the user to track their own position in a six digit
 * string. Boxes make the expected length visible before they start typing and
 * show progress as they go.
 *
 * Behaviour people expect from this control, each of which is a bug if missing:
 *  - typing advances, Backspace on an empty box steps back and clears
 *  - arrow keys move without editing, Home/End jump to the ends
 *  - pasting the whole code fills every box, wherever the caret is, and
 *    tolerates the "123 456" formatting authenticator apps display
 *  - iOS/Android SMS autofill works, via a single `one-time-code` field
 *
 * Accessibility: the boxes are one labelled group, not six unlabelled inputs.
 * Screen readers announce the group's label and the progress, so a blind user
 * is not told "edit text, blank" six times with no idea how many remain.
 */

export const OTP_LENGTH = 6;

function sanitise(raw: string, length: number): string {
  return raw.replace(/\D/g, "").slice(0, length);
}

export default function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  length = OTP_LENGTH,
  label,
  describedBy,
  autoFocus = false,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Fired once the last box is filled — lets the form auto-submit. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  length?: number;
  label: string;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(() => {
    const clean = sanitise(value, length);
    return Array.from({ length }, (_, i) => clean[i] ?? "");
  }, [value, length]);

  const filled = digits.filter(Boolean).length;

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const commit = useCallback(
    (next: string, focusIndex: number) => {
      const clean = sanitise(next, length);
      onChange(clean);
      const target = Math.max(0, Math.min(length - 1, focusIndex));
      requestAnimationFrame(() => refs.current[target]?.focus());
      if (clean.length === length) onComplete?.(clean);
    },
    [length, onChange, onComplete],
  );

  function handleChange(index: number, raw: string) {
    const typed = sanitise(raw, length);
    if (!typed) return;
    // Typing into a box replaces that position; a multi-character value means
    // the field was autofilled or pasted, so spread it from here.
    const next = digits.slice();
    typed.split("").forEach((d, offset) => {
      if (index + offset < length) next[index + offset] = d;
    });
    commit(next.join(""), index + typed.length);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = digits.slice();
      if (next[index]) {
        // Clear the current box but stay put, so a correction is one keystroke.
        next[index] = "";
        commit(next.join(""), index);
      } else {
        next[Math.max(0, index - 1)] = "";
        commit(next.join(""), index - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      refs.current[Math.max(0, index - 1)]?.focus();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      refs.current[Math.min(length - 1, index + 1)]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      refs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      refs.current[length - 1]?.focus();
    }
  }

  function handlePaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    // Authenticator apps show "123 456"; sanitise strips the space so pasting
    // what the user sees works rather than silently dropping half the code.
    const pasted = sanitise(e.clipboardData.getData("text"), length);
    if (!pasted) return;
    e.preventDefault();
    const next = digits.slice();
    pasted.split("").forEach((d, offset) => {
      if (index + offset < length) next[index + offset] = d;
    });
    commit(next.join(""), index + pasted.length);
  }

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      style={{ display: "flex", gap: "8px", marginTop: "6px" }}
    >
      {digits.map((digit, i) => {
        const active = Boolean(digit);
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            // One real one-time-code field: duplicating the token on all six
            // makes some password managers fill only the first box.
            autoComplete={i === 0 ? "one-time-code" : "off"}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={length}
            value={digit}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-label={`Digit ${i + 1} of ${length}`}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={(e) => handlePaste(i, e)}
            onFocus={(e) => e.target.select()}
            style={{
              width: "100%",
              minWidth: 0,
              height: "56px",
              textAlign: "center",
              fontSize: "22px",
              fontWeight: 600,
              fontFamily: "'DM Mono', monospace",
              color: AUTH_INK,
              borderRadius: "12px",
              borderWidth: "1.5px",
              borderStyle: "solid",
              borderColor: invalid
                ? "rgba(229,72,77,0.55)"
                : active
                  ? AUTH_INDIGO
                  : "rgba(19,17,38,0.11)",
              background: invalid ? "#FFF8F8" : "#FFFFFF",
              outline: "none",
              boxSizing: "border-box",
              WebkitAppearance: "none",
              transition: "border-color 120ms ease",
            }}
          />
        );
      })}
      {/* Progress for screen readers only; sighted users see the filled boxes. */}
      <span
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        {filled === length ? "Code complete" : `${filled} of ${length} digits entered`}
      </span>
    </div>
  );
}
