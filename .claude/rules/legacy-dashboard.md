---
paths:
  - "components/DashboardApp.tsx"
  - "app/globals.css"
  - "components/mockData.ts"
---
# Legacy dashboard shell

- `DashboardApp.tsx` is one 7k-line client component; screens switch on `state.screen` and modals on `state.modal`. Read only the region you need (grep for the screen name) — don't load the whole file.
- Prefer extracting over growing it: new screen logic goes in `features/<domain>/` and is rendered from here. Use `/migrate-legacy-screen` for a full move.
- `globals.css` `.ep-*` rules are frozen: fix bugs in place, but don't add new namespaces or rules for new UI — use Tailwind token utilities in new components instead. Delete a screen's `.ep-*` block once nothing references it (grep first).
- Theme vars are applied inline on `<html>` by `applyThemeVars` from `LIGHT`/`DARK` (re-exported from the generated tokens). Never add colour literals here; change `design/tokens.json`.
