#!/usr/bin/env node
// Generates the token outputs from design/tokens.json (the single source of truth).
//
//   node scripts/build-tokens.mjs          → write outputs
//   node scripts/build-tokens.mjs --check  → exit 1 if outputs are stale (CI)
//
// Outputs (never edit by hand — a PreToolUse hook blocks it):
//   lib/theme/tokens.generated.ts   typed constants for TS/inline-style consumers
//   app/tokens.generated.css        :root CSS variables + Tailwind v4 @theme

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "design/tokens.json");
const OUT_TS = join(root, "lib/theme/tokens.generated.ts");
const OUT_CSS = join(root, "app/tokens.generated.css");

const tokens = JSON.parse(readFileSync(SRC, "utf8"));

/** Resolve `{a.b.c}` aliases against the token tree (recursively). */
function resolve(value, seen = []) {
  if (typeof value !== "string") return value;
  const m = /^\{([^}]+)\}$/.exec(value);
  if (!m) return value;
  const path = m[1];
  if (seen.includes(path)) throw new Error(`Circular token alias: ${[...seen, path].join(" → ")}`);
  let node = tokens;
  for (const key of path.split(".")) {
    node = node?.[key];
    if (node === undefined) throw new Error(`Unknown token alias {${path}}`);
  }
  if (!node || typeof node !== "object" || !("$value" in node)) {
    throw new Error(`Alias {${path}} does not point at a token`);
  }
  return resolve(node.$value, [...seen, path]);
}

/** `{theme.<t>.<key>}` inside a composite (shadow colour) → `var(--key)`, so it follows the active theme. */
const THEME_REF = /^\{theme\.[^.}]+\.([^}]+)\}$/;
const themeRefs = [];
function colorRef(value) {
  const m = typeof value === "string" ? THEME_REF.exec(value) : null;
  if (m) {
    themeRefs.push(m[1]);
    return `var(--${m[1]})`;
  }
  return resolve(value);
}

/** DTCG value → CSS string, by $type. */
function toCss(type, raw) {
  if (type === "shadow" && typeof raw !== "string") {
    const layers = Array.isArray(raw) ? raw : [raw];
    return layers
      .map((l) => `${l.inset ? "inset " : ""}${l.offsetX} ${l.offsetY} ${l.blur} ${l.spread} ${colorRef(l.color)}`)
      .join(", ");
  }
  const v = resolve(raw);
  if (type === "fontFamily" && Array.isArray(v)) return v.map((f) => (/\s/.test(f) ? `'${f}'` : f)).join(", ");
  if (type === "cubicBezier" && Array.isArray(v)) return `cubic-bezier(${v.join(", ")})`;
  if (typeof v === "object") throw new Error(`Unsupported composite token value: ${JSON.stringify(v)}`);
  return v;
}

/** Flatten a token group to { key: cssValue }, skipping $-metadata. Nested groups are prefixed (`sequential.1` → `seq-1` via `rename`). */
function group(node, inheritedType, prefix = "", rename = (k) => k) {
  const out = {};
  const type = node.$type ?? inheritedType;
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || !child || typeof child !== "object") continue;
    if ("$value" in child) out[prefix + key] = toCss(child.$type ?? type, child.$value);
    else Object.assign(out, group(child, type, prefix + rename(key) + "-", rename));
  }
  return out;
}

const cssVars = (obj, prefix = "") => Object.fromEntries(Object.entries(obj).map(([k, v]) => [`--${prefix}${k}`, v]));
const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const camelKeys = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [camel(k), v]));

const brand = group(tokens.color.brand, tokens.color.$type);
const feedback = group(tokens.color.feedback, tokens.color.$type);
// categorical.N → N, sequential.N → seq-N, flat keys stay.
const chart = group(tokens.chart, undefined, "", (k) => (k === "categorical" ? "" : k === "sequential" ? "seq" : k));
for (const k of Object.keys(chart)) if (k.startsWith("-")) { chart[k.slice(1)] = chart[k]; delete chart[k]; }
const fontFamily = group(tokens.font.family);
const fontSize = group(tokens.font.size);
const lineHeight = group(tokens["line-height"]);
const letterSpacing = group(tokens["letter-spacing"]);
const space = group(tokens.space);
const radius = group(tokens.radius);
const shadow = group(tokens.shadow);
const duration = group(tokens.duration);
const easing = group(tokens.easing);
const breakpoint = group(tokens.breakpoint);
const themes = {
  light: group(tokens.theme.light),
  dark: group(tokens.theme.dark),
  darkHighContrast: group(tokens.theme["dark-high-contrast"]),
  landingLight: group(tokens.theme["landing-light"]),
  landingDark: group(tokens.theme["landing-dark"]),
};
for (const key of themeRefs) {
  if (!(key in themes.light)) throw new Error(`Shadow colour {theme.*.${key}} → unknown theme key "${key}"`);
}

// Every Tailwind alias must point at a light-theme key, or utilities break silently.
const twColors = Object.fromEntries(
  Object.entries(tokens.tailwind.color).filter(([k]) => !k.startsWith("$")),
);
for (const [alias, key] of Object.entries(twColors)) {
  if (!(key in themes.light)) throw new Error(`tailwind.color.${alias} → unknown theme key "${key}"`);
}
for (const name of ["dark", "darkHighContrast", "landingLight", "landingDark"]) {
  for (const key of Object.keys(themes[name])) {
    if (!(key in themes.light) && !key.startsWith("landing-")) {
      throw new Error(`theme.${name}.${key} has no light-theme counterpart`);
    }
  }
}

const HEADER = "// GENERATED by scripts/build-tokens.mjs from design/tokens.json — DO NOT EDIT.\n// Change design/tokens.json and run `npm run tokens`.\n";
const json = (v) => JSON.stringify(v, null, 2);

const ts = `${HEADER}
/** Fixed brand palette (theme-independent). */
export const BRAND = ${json(camelKeys(brand))} as const;

/** Fixed light-canvas feedback colours (auth pages). */
export const FEEDBACK = ${json(camelKeys(feedback))} as const;

/** Fixed data-viz palette: "1"…"8" categorical, "seq-1"…"seq-6" sequential, positive/negative/neutral. */
export const CHART = ${json(chart)} as const;

export const FONT_FAMILY = ${json(fontFamily)} as const;
export const FONT_SIZE = ${json(fontSize)} as const;
export const LINE_HEIGHT = ${json(lineHeight)} as const;
export const LETTER_SPACING = ${json(letterSpacing)} as const;
export const SPACE = ${json(space)} as const;
export const RADIUS = ${json(radius)} as const;
export const SHADOW = ${json(shadow)} as const;
export const DURATION = ${json(duration)} as const;
export const EASING = ${json(easing)} as const;
export const BREAKPOINT = ${json(breakpoint)} as const;

/** Semantic theme CSS variables (\`--bg\`, \`--ink\`, …) per theme. */
export const THEME_LIGHT: Record<string, string> = ${json(cssVars(themes.light))};
export const THEME_DARK: Record<string, string> = ${json(cssVars(themes.dark))};
/** Layered over THEME_DARK when boosted contrast is on. */
export const THEME_DARK_HIGH_CONTRAST: Record<string, string> = ${json(cssVars(themes.darkHighContrast))};
export const THEME_LANDING_LIGHT: Record<string, string> = ${json(cssVars(themes.landingLight))};
export const THEME_LANDING_DARK: Record<string, string> = ${json(cssVars(themes.landingDark))};
`;

const block = (sel, vars, extra = "") =>
  `${sel} {\n${extra}${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}\n`;

const css = `/* GENERATED by scripts/build-tokens.mjs from design/tokens.json — DO NOT EDIT.
   Change design/tokens.json and run \`npm run tokens\`. */

/* Light defaults so tokens resolve everywhere (auth pages, printed docs,
   portals). DashboardApp / Landing write the active palette inline onto
   <html> via lib/theme/applyThemeVars, which wins over these. */
${block(":root", {
  ...cssVars(themes.light),
  ...cssVars(brand, "brand-"),
  ...cssVars(chart, "chart-"),
  ...cssVars(duration, "duration-"),
  ...cssVars(easing, "ease-"),
})}
/* Lets Storybook / static pages switch theme with data-theme alone. */
${block(':root[data-theme="dark"]', cssVars(themes.dark), "  color-scheme: dark;\n")}
/* Tailwind v4 theme. Defaults are wiped (--color-*: initial etc.) so ONLY
   brand tokens exist as utilities: bg-blue-500 / text-[13px]-style drift
   can't be expressed with a named class. Values reference the runtime vars,
   so utilities follow the active theme automatically. */
@theme inline {
  --color-*: initial;
${Object.entries(twColors).map(([a, k]) => `  --color-${a}: var(--${k});`).join("\n")}
  --color-transparent: transparent;
  --color-current: currentColor;
${Object.keys(brand).map((k) => `  --color-brand-${k}: var(--brand-${k});`).join("\n")}
${Object.keys(chart).map((k) => `  --color-chart-${k}: var(--chart-${k});`).join("\n")}

  --font-*: initial;
${Object.entries(fontFamily).map(([k, v]) => `  --font-${k}: ${v};`).join("\n")}

  --text-*: initial;
${Object.entries(fontSize).map(([k, v]) => `  --text-${k}: ${v};`).join("\n")}

  --radius-*: initial;
${Object.entries(radius).map(([k, v]) => `  --radius-${k}: ${v};`).join("\n")}

  --shadow-*: initial;
${Object.entries(shadow).map(([k, v]) => `  --shadow-${k}: ${v};`).join("\n")}

  --leading-*: initial;
${Object.entries(lineHeight).map(([k, v]) => `  --leading-${k}: ${v};`).join("\n")}

  --tracking-*: initial;
${Object.entries(letterSpacing).map(([k, v]) => `  --tracking-${k}: ${v};`).join("\n")}

  --ease-*: initial;
${Object.entries(easing).map(([k, v]) => `  --ease-${k}: ${v};`).join("\n")}

  /* One breakpoint: below it is the mobile layout (drawer, bottom nav, sheets). */
  --breakpoint-*: initial;
  --breakpoint-desktop: ${breakpoint.desktop};
  --container-table: ${breakpoint["table-min"]};
  --container-content: ${breakpoint["content-max"]};
}
`;

const outputs = [
  [OUT_TS, ts],
  [OUT_CSS, css],
];

if (process.argv.includes("--check")) {
  const stale = outputs.filter(([p, c]) => !existsSync(p) || readFileSync(p, "utf8") !== c);
  if (stale.length) {
    console.error(
      `Design tokens are stale: ${stale.map(([p]) => p.replace(root + "/", "")).join(", ")}\nRun \`npm run tokens\` and commit the result.`,
    );
    process.exit(1);
  }
  console.log("Design tokens up to date.");
} else {
  for (const [p, c] of outputs) writeFileSync(p, c);
  console.log(`Wrote ${outputs.map(([p]) => p.replace(root + "/", "")).join(", ")}`);
}
