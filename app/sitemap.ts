import type { MetadataRoute } from "next";

/**
 * Just the landing page for now — it's the only public, content-bearing
 * route. Auth flow pages (/login, /signup, …) and the app itself are
 * disallowed in robots.ts and have no standalone SEO value, so they're
 * deliberately left out rather than padded in here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://mboka.finance",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
