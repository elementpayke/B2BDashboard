---
paths:
  - "components/**/*.tsx"
  - "features/**/*.tsx"
  - "app/**/*.tsx"
---
# UI rules

- Start from the catalogue: `components/ui/*` and `components/patterns/*` (Storybook MCP `list-all-documentation` when Storybook is running). Extend a primitive with a variant before creating a new component.
- Styling = Tailwind token utilities. Tailwind's default scales are removed; only these exist (see `design/BRAND.md` for when to use which):
  - Colour: `background foreground card popover primary(-foreground) secondary muted muted-foreground subtle-foreground placeholder accent(-foreground) link destructive(-text/-tint) warning(-text/-tint) success(-tint) info(-tint) positive border input input-background ring overlay overlay-doc surface-3 ink-panel(-foreground) brand-* chart-*`. Text on a tint uses the `-text` shade (`text-destructive-text`, `text-warning-text`); the plain one is for fills, borders and icons.
  - Type (by role): `text-overline-sm label caption dense body body-lg lead title headline page-sm stat amount page hero`. Leading: `leading-tight heading snug body relaxed`. Tracking: `tracking-display heading title normal label overline`.
  - Radius: `rounded-xs` chips · `sm` tiles · `md` inputs · `lg` CTAs · `xl` inner cards/stat tiles · `2xl` panels · `3xl` modals · `pill`.
  - Shadow: `shadow-focus` (keyboard focus) `float` (menus) `modal` `card` (virtual cards only) `selection` `nav-active` `hairline`. Panels use borders, not shadows.
  - Motion: `duration-150/200/250` + `ease-standard` (`ease-spring` for pop-ins only, `ease-sheet` for sheets); honour `motion-reduce:`.
  - Breakpoint: only `desktop:` (900px). Below it = mobile layout. Wide tables: `min-w-table` inside `overflow-x-auto`.
  - Fonts: `font-display` (headings, buttons) `font-body` `font-mono` (money, account numbers, hashes).
- Need a value that doesn't exist? Add it to `design/tokens.json` (`/update-tokens`), don't inline it.
- Tailwind preflight is off globally (legacy safety). The root element of every new component/screen carries `data-slot="<name>"`, which opts it and its children into the scoped reset in app/globals.css (no stray margins / button borders).
- Compose classes with `cn()` from `@/lib/utils`; variants with `cva`.
- One `primary` Button per view. Destructive actions confirm in a `<Dialog>` first.
- Accessibility: every control labelled (`<Field>`), icons `aria-hidden` with text alternatives, status not colour-only, focus visible (`focus-visible:shadow-focus`), 44px targets, Esc closes overlays. `text-placeholder` (3.07:1) is never used for real content.
- Responsive: mobile-first; check 390px and 1280px. Below `desktop` (900px) the shell is drawer + bottom nav and dialogs become bottom sheets automatically.
- Every new primitive/pattern gets a `*.stories.tsx` (light + dark via the toolbar) and a test for behaviour.
- New screens go in `features/<domain>/`; add the folder to `@source` in `app/globals.css` if it's new, and to `tsconfig.strict.json`.
- In legacy files (`.ep-*`, inline styles) match the surrounding code for small fixes, but build anything new with primitives.
