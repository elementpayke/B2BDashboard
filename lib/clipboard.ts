/**
 * Copy text to the clipboard, resolving true only when it actually landed.
 *
 * `navigator.clipboard` is missing on non-secure origins and some embedded
 * webviews, and can reject (permissions policy, Safari losing the gesture).
 * The legacy `execCommand("copy")` path still works in those places, so it is
 * the fallback rather than giving up silently.
 */
export async function copyText(value: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // fall through to the legacy path
    }
  }
  return legacyCopy(value);
}

function legacyCopy(value: string): boolean {
  if (typeof document === "undefined" || typeof document.execCommand !== "function") {
    return false;
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  // Off-screen but focusable; iOS needs it inside the viewport's layout.
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "-9999px";
  area.style.opacity = "0";
  const active = document.activeElement as HTMLElement | null;
  document.body.appendChild(area);
  area.focus();
  area.select();
  area.setSelectionRange(0, value.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  active?.focus?.();
  return ok;
}
