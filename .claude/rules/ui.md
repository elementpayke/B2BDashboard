---
paths:
  - "components/**/*.tsx"
  - "features/**/*.tsx"
  - "app/**/*.tsx"
---
# UI rules

- Start from the catalogue: `components/ui/*` and `components/patterns/*` (Storybook MCP `list-all-documentation` when Storybook is running). Extend a primitive with a variant before creating a new component.
- Styling = Tailwind token utilities. Colour names (all that exist): `background foreground card popover primary secondary muted muted-foreground subtle-foreground accent accent-foreground link destructive(-tint) warning(-tint) success(-tint) border input input-background ring overlay surface-3 ink-panel(-foreground) brand-*`. Type: `text-2xs xs sm base lg xl 2xl 3xl`. Radius: `rounded-sm md lg xl 2xl full`. Fonts: `font-display` (headings, buttons) `font-body` `font-mono` (money, account numbers, hashes).
- Need a value that doesn't exist? Add it to `design/tokens.json` (`/update-tokens`), don't inline it.
- Tailwind preflight is off globally (legacy safety). The root element of every new component/screen carries `data-slot="<name>"`, which opts it and its children into the scoped reset in app/globals.css (no stray margins / button borders).
- Compose classes with `cn()` from `@/lib/utils`; variants with `cva`.
- One `primary` Button per view. Destructive actions confirm in a `<Dialog>` first.
- Accessibility: every control labelled (`<Field>`), icons `aria-hidden` with text alternatives, status not colour-only, focus visible, 44px targets, Esc closes overlays.
- Responsive: mobile-first; check 390px and ≥1024px. Dialogs become bottom sheets on mobile automatically.
- Every new primitive/pattern gets a `*.stories.tsx` (light + dark via the toolbar) and a test for behaviour.
- New screens go in `features/<domain>/`; add the folder to `@source` in `app/globals.css` if it's new, and to `tsconfig.strict.json`.
- In legacy files (`.ep-*`, inline styles) match the surrounding code for small fixes, but build anything new with primitives.
