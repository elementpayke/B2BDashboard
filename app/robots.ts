import type { MetadataRoute } from "next";

/**
 * A single universal rule covers every crawler, including AI answer-engine
 * bots (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, …) — there's no
 * reason to treat them differently from search crawlers here since the goal
 * is being found, not excluded. Only the authenticated app surface and API
 * routes are disallowed; the marketing landing page at "/" stays open.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
        "/team",
        "/mfa",
        "/dev",
        "/api",
      ],
    },
    sitemap: "https://mboka.finance/sitemap.xml",
  };
}
