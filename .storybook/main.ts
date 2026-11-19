import type { StorybookConfig } from "@storybook/nextjs-vite";

// Storybook is the component catalogue for humans AND agents:
// `@storybook/addon-mcp` serves http://localhost:6006/mcp (see .mcp.json) so
// Claude can list existing components and read their docs before building,
// instead of inventing a new one.
const config: StorybookConfig = {
  stories: [
    "../components/ui/**/*.stories.@(ts|tsx)",
    "../components/patterns/**/*.stories.@(ts|tsx)",
    "../features/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-mcp"],
  framework: { name: "@storybook/nextjs-vite", options: {} },
  staticDirs: ["../public"],
  core: { disableTelemetry: true },
};

export default config;
