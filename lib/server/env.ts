// Server-only. Never import this from a "use client" module — the backend
// base URL is intentionally kept out of the browser bundle since every
// request goes through our own proxy routes instead of hitting it directly.
export function getMbokaApiBase(): string {
  return process.env.MBOKA_API_BASE_URL || "http://localhost:8000";
}
