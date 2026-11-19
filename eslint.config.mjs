import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import storybook from "eslint-plugin-storybook";

// Where new, token-based code lives. Design-system rules are errors here.
// Legacy code (DashboardApp, .ep-* screens) gets them as warnings so the
// debt is visible without blocking unrelated work; migrate a screen into one
// of these folders and the rules start enforcing.
const DESIGN_SYSTEM_FILES = [
  "components/ui/**/*.{ts,tsx}",
  "components/patterns/**/*.{ts,tsx}",
  "features/**/*.{ts,tsx}",
  "lib/api/**/*.{ts,tsx}",
];

const TESTS = ["**/*.test.{ts,tsx}", "**/*.stories.{ts,tsx}"];

// Pre-design-system components that happen to live in components/ui. They
// still use .ep-* classes and inline styles, so they get the legacy (warning)
// rules until rebuilt on the primitives. Remove an entry when you migrate it.
const LEGACY_UI = [
  "components/ui/ActivityList.tsx",
  "components/ui/ChoicePicker.tsx",
  "components/ui/ComingSoonPanel.tsx",
  "components/ui/CountrySelect.tsx",
  "components/ui/SectionHeader.tsx",
  "components/ui/StatusBadge.tsx",
];

const HARDCODED_STYLE = [
  {
    selector: "Literal[value=/#[0-9a-fA-F]{3,8}\\b/], TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]",
    message: "Hard-coded hex colour. Use a token: Tailwind class (bg-primary, text-muted-foreground…) or var(--token). Add new colours to design/tokens.json.",
  },
  {
    selector: "Literal[value=/\\b(rgba?|hsla?)\\(/], TemplateElement[value.raw=/\\b(rgba?|hsla?)\\(/]",
    message: "Hard-coded colour function. Use a token from design/tokens.json.",
  },
  {
    selector:
      "JSXAttribute[name.name='style'] Property[key.name=/^(color|background|backgroundColor|borderColor|fontSize|fontFamily|fontWeight|borderRadius|boxShadow|padding|margin|gap)$/]",
    message: "Static visual styling in style={{}}. Use Tailwind token classes; keep style={{}} for truly dynamic values (widths from data, transforms).",
  },
  {
    selector:
      "Literal[value=/\\b(bg|text|border|ring|outline|fill|stroke|shadow|rounded|from|via|to)-\\[(#|rgb|hsl|\\d+(\\.\\d+)?px)/]",
    message: "Arbitrary Tailwind value bypasses the design tokens. Use a scale step (text-sm, rounded-xl…) or add a token.",
  },
];

const LITERAL_QUERY_KEYS = [
  {
    selector: "Property[key.name='queryKey'] > ArrayExpression > Literal:first-child",
    message: "Build query keys from QK in lib/api/queryKeys.ts — a mistyped literal silently matches nothing.",
  },
  {
    selector:
      "CallExpression[callee.property.name=/^(setQueryData|getQueryData|setQueriesData|getQueriesData)$/] > ArrayExpression:first-child > Literal:first-child",
    message: "Build query keys from QK in lib/api/queryKeys.ts — a mistyped literal silently matches nothing.",
  },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...storybook.configs["flat/recommended"],

  globalIgnores([
    ".next/**",
    ".claude/**",
    "node_modules/**",
    "storybook-static/**",
    "coverage/**",
    "lib/api/generated/**",
    "lib/theme/tokens.generated.ts",
    "next-env.d.ts",
  ]),

  // Baseline for the whole repo. Rules the legacy code breaks today are
  // warnings so `npm run lint` passes; ratchet them to "error" as code is
  // cleaned up. Don't add new violations.
  {
    rules: {
      "no-restricted-syntax": ["error", ...LITERAL_QUERY_KEYS],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@next/next/no-img-element": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // React Compiler-era hook rules the legacy screens break today (setState in
  // effects, ref reads during render…): warnings in legacy code, errors in
  // new code (below). rules-of-hooks stays an error everywhere.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },

  // Legacy UI: design-system rules as warnings (visible debt, not blocking).
  {
    files: ["components/**/*.{ts,tsx}", "app/**/*.tsx"],
    ignores: [...DESIGN_SYSTEM_FILES, ...TESTS],
    rules: {
      "no-restricted-syntax": ["warn", ...HARDCODED_STYLE, ...LITERAL_QUERY_KEYS],
    },
  },
  {
    files: LEGACY_UI,
    rules: {
      "no-restricted-syntax": ["warn", ...HARDCODED_STYLE, ...LITERAL_QUERY_KEYS],
    },
  },

  // New code: design-system rules are errors.
  {
    files: DESIGN_SYSTEM_FILES,
    ignores: [...TESTS, ...LEGACY_UI],
    rules: {
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/refs": "error",
      "react-hooks/immutability": "error",
      "no-restricted-syntax": ["error", ...HARDCODED_STYLE, ...LITERAL_QUERY_KEYS],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/mockData", "**/mockData/**"],
              message: "Mock fixtures are for stories/tests only. Live UI reads the API and fails closed.",
            },
          ],
        },
      ],
    },
  },

  // Tests and stories may use literal keys and fixtures freely.
  {
    files: TESTS,
    rules: { "no-restricted-syntax": "off" },
  },
]);
