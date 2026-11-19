---
name: brand-review
description: Independent review of a UI diff against the Mboka brand and design-system rules (tokens, primitives, money/status display, copy, accessibility, responsiveness). Use before opening a PR with user-facing changes.
argument-hint: "[base ref, default origin/main]"
context: fork
agent: design-reviewer
---

Review the UI changes on this branch against the Mboka design system. Base ref: `$ARGUMENTS` (if empty, use `origin/main`).

Get the diff with `git diff <base>...HEAD -- '*.tsx' '*.ts' '*.css' design/`. Read `design/BRAND.md`, `design/tokens.json` and `.claude/rules/ui.md` first, then check each changed UI file for:

1. Off-token styling: hex/rgba, static `style={{}}`, arbitrary Tailwind values, one-off font sizes/radii.
2. Primitive bypass: hand-rolled buttons, inputs, modals/overlays, money formatting, status pills where `components/ui` has one.
3. Brand: money in `<Amount>` (mono, tabular, `—` when unknown), one primary action per view, copy voice (BRAND.md), no "CCTP"/bridge jargon, no fake data.
4. Accessibility: labels, roles, focus, status not colour-only, 44px targets, dialog titles/descriptions.
5. States: loading, empty, error (fail closed) present for async UI.
6. Responsive: anything that breaks at 390px.

If a dev server or Storybook is running, take Playwright screenshots of the changed views (light + dark, 390px + 1280px) and include what you see.

Report only concrete findings, each with `file:line`, the rule broken, and the fix. Skip style nitpicks the rules don't cover. If clean, say so.
