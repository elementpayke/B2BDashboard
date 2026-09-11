/**
 * Sync theme CSS variables onto `document.documentElement`.
 *
 * Dashboard / Landing apply tokens as inline styles on a local root. Portals
 * (ChoicePicker sheets) mount under `document.body` and otherwise keep the
 * light `:root` defaults — white sheets on a dark app. Writing the active
 * palette to `<html>` makes overlays inherit the same theme.
 */
export function applyThemeVars(
  vars: Record<string, string>,
  theme: "light" | "dark" = "light",
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    if (key.startsWith("--")) root.style.setProperty(key, value);
  }
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function clearThemeVars(keys: string[]): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of keys) {
    if (key.startsWith("--")) root.style.removeProperty(key);
  }
  delete root.dataset.theme;
  root.style.removeProperty("color-scheme");
}
