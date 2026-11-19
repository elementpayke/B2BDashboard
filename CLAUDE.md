@AGENTS.md

# Claude Code
- Hooks in `.claude/settings.json` run ESLint on every file you edit, block edits to generated files, regenerate tokens when `design/tokens.json` changes, and re-run typecheck before you finish. If a hook reports errors, fix them — don't work around the hook.
- Area rules load automatically from `.claude/rules/` (UI, API, legacy dashboard).
- Skills: `/new-ui` (screen or component), `/wire-endpoint`, `/migrate-legacy-screen`, `/update-tokens`, `/brand-review`.
- MCP (`.mcp.json`): Storybook (`npm run storybook` first) to find existing components; next-devtools for live build/runtime errors; Playwright to screenshot your UI change in light and dark before calling it done.
- Backend lookups follow "Backend reference" in AGENTS.md: `../Mboka-Backend` first (readable via `additionalDirectories`), then this repo's docs/spec snapshot, then GitHub `elementpayHQ/Mboka-Backend` via `gh`.
