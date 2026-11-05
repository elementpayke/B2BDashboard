/** First path segments the dashboard is allowed to proxy to Mboka. */
export const MBOKA_PROXY_ALLOWED_PREFIXES = ["v1", "api-keys", "businesses"] as const;

const BLOCKED_SEGMENTS = new Set(["webhooks", "..", "."]);

export function mbokaProxyTarget(path: string[], search: string): string | null {
  if (path.length === 0) return null;
  if (path.some((segment) => BLOCKED_SEGMENTS.has(segment))) return null;
  const prefix = path[0];
  if (!MBOKA_PROXY_ALLOWED_PREFIXES.includes(prefix as (typeof MBOKA_PROXY_ALLOWED_PREFIXES)[number])) {
    return null;
  }
  return `/api/${path.join("/")}${search}`;
}
