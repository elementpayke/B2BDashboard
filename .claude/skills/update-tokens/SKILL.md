---
name: update-tokens
description: Add or change a design token (colour, type size, radius, shadow, motion, breakpoint, chart colour) or rebrand. Edits design/tokens.json, regenerates outputs, and checks contrast and both themes. Use when a needed colour/size doesn't exist or the brand palette changes.
argument-hint: "[token change]"
---

Change: $ARGUMENTS

1. Read `design/tokens.json` and `design/BRAND.md`. Values marked PROPOSED came from the designer as gap-fills; DECIDED ones are the designed brand — don't change those without the user's say-so. Prefer reusing an existing token or aliasing one (`"{color.brand.indigo}"`) over adding a new value.
2. Semantic colours live under `theme.light` AND `theme.dark` (and `dark-high-contrast` if it affects borders/inputs) — add every new key to both. To expose it as a Tailwind utility, map it in `tailwind.color` using shadcn-style naming (`thing` / `thing-foreground`).
3. Text colours must meet WCAG AA (4.5:1, or 3:1 for ≥18px/bold-14px) on the surfaces they sit on, in both themes. Compute and state the ratios.
4. `npm run tokens` (the edit hook also does this), then `npm run tokens:check`, `npm run typecheck`, `npm test -- components/ui`.
5. Legacy `.ep-*` CSS and inline styles read the same CSS variables, so a value change ripples app-wide: list the surfaces affected (grep `var(--<name>)`) and screenshot Home + one modal in light and dark.
6. Update `design/BRAND.md` if the change alters usage guidance.
