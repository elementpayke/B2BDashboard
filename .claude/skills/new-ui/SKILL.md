---
name: new-ui
description: Build a new dashboard screen, section or reusable component on the Mboka design system (tokens, components/ui primitives, Storybook, tests). Use for any new UI work, including "add a page", "build a panel/modal/form", or a design handoff to implement.
argument-hint: "[what to build]"
---

Build: $ARGUMENTS

1. **Inventory first.** List what exists: `ls components/ui components/patterns features`. If Storybook is running, use the Storybook MCP (`list-all-documentation`, then `get-documentation` for candidates). Reuse or add a *variant* to an existing primitive before creating a component. Read `design/BRAND.md` for voice, money and status rules.
2. **Place it.**
   - Reusable, domain-free → `components/ui/` (primitive) or `components/patterns/` (composition).
   - Domain screen/feature → `features/<domain>/` (`features/README.md`). New folder? add it to `@source` in `app/globals.css` and to `tsconfig.strict.json`.
3. **Data.** Read through TanStack Query with `QK` keys and the typed `mboka` client (see `.claude/rules/api.md`); use `/wire-endpoint` if the endpoint isn't wired yet. Model loading (Skeleton), empty and error (EmptyState, fail closed) explicitly.
4. **Build** with Tailwind token utilities only. Money → `<Amount>`, status → `<Badge>`, inputs → `<Field>`+`<Input>`, overlays → `<Dialog>`. Mobile-first; 44px targets.
5. **Story + test.** `*.stories.tsx` covering default, loading, empty, error and a dark-theme check; a `*.test.tsx` (jsdom) for behaviour and a11y wiring (roles, labels, aria-invalid).
6. **Verify with evidence:**
   - `npx vitest run <your tests>` and `npm run typecheck` and `npx eslint <files>` → paste the summary lines.
   - Screenshot the result (Playwright MCP against `npm run dev` or Storybook) at 390px and 1280px, light and dark, and compare against the design/handoff. Fix spacing/hierarchy issues you can see.
7. Run `/brand-review` on the diff if the change is user-facing and sizeable.
