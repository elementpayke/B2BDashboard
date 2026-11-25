---
name: migrate-legacy-screen
description: Move one legacy dashboard screen out of components/DashboardApp.tsx and the .ep-* CSS onto the design system (features/<domain>, primitives, Tailwind tokens), with no behaviour change. Use when asked to migrate, refactor or "clean up" a dashboard screen.
argument-hint: "[screen name, e.g. reports]"
disable-model-invocation: true
---

Migrate the `$ARGUMENTS` screen. Goal: identical behaviour and data wiring, design-system UI, smaller DashboardApp.

1. **Map it.** In `components/DashboardApp.tsx` find where `screen === "$ARGUMENTS"` renders and every piece of state, query and handler it uses (grep; don't read the whole file). List the `.ep-*` classes it uses and where they're defined in `app/globals.css`. Note existing tests covering it.
2. **Plan** the props boundary: what the new `features/$ARGUMENTS/<Name>Screen.tsx` needs from the shell (callbacks, ids) vs. what it can own (its own queries via `QK`). Present the plan before large edits.
3. **Characterise first.** If the screen lacks tests, add a jsdom test asserting its key content/interactions against the *current* implementation, so the migration is checked.
4. **Rebuild** in `features/$ARGUMENTS/` with primitives + Tailwind tokens. Add the folder to `@source` in `app/globals.css` and to `tsconfig.strict.json`. Keep copy identical unless asked.
5. **Swap** the render in DashboardApp to the new component; delete the dead code and now-unused state.
6. **Delete CSS** blocks only after `grep -r "<class>"` shows no remaining users.
7. **Verify with evidence:** characterisation test + `npm run check` pass; Playwright screenshots of before/after (390px & 1280px, light & dark). Report line counts removed from DashboardApp.tsx and globals.css.
