# features/

New dashboard screens and their feature-specific components, one folder per domain:

```
features/
  reports/
    ReportsScreen.tsx          ← entry rendered by the dashboard shell
    VolumeChart.tsx            ← feature-only components
    useReports.ts              ← queries (QK keys + typed mboka client)
    ReportsScreen.test.tsx
    ReportsScreen.stories.tsx
```

Rules (enforced by ESLint and `tsconfig.strict.json` for this folder):
- Build from `components/ui` + `components/patterns` with Tailwind token utilities — no hex/rgba, no static `style={{}}`.
- Data through TanStack Query with `QK` keys; services/normalizers stay in `lib/services`.
- Promote a component to `components/patterns` once a second feature needs it.

Migrating a screen out of `components/DashboardApp.tsx`? Use `/migrate-legacy-screen <name>` in Claude Code.
