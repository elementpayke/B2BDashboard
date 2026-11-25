import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MBOKA_PROXY_ALLOWED_PREFIXES, mbokaProxyTarget } from "./mbokaProxyAllowlist";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".data") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

function prefixesIn(source: string): string[] {
  const found: string[] = [];
  const call =
    /(?:apiEnvelope|apiUpload|apiDownloadBlob)(?:<[^>(\n]+>)?\(\s*["'`][A-Z]+["'`]\s*,\s*["'`]([^"'`]+)["'`]/g;
  for (const match of source.matchAll(call)) {
    const segment = match[1].replace(/^\//, "").split(/[/?]/)[0];
    if (segment && !segment.includes("$")) found.push(segment);
  }
  const template =
    /(?:apiEnvelope|apiUpload|apiDownloadBlob)(?:<[^>(\n]+>)?\(\s*["'`][A-Z]+["'`]\s*,\s*`\/([^/${?]+)/g;
  for (const match of source.matchAll(template)) found.push(match[1]);
  return found;
}

describe("Mboka BFF allowlist", () => {
  it("allows the prefixes the dashboard calls and blocks everything else", () => {
    expect(mbokaProxyTarget(["v1", "transactions"], "?limit=10")).toBe(
      "/api/v1/transactions?limit=10",
    );
    expect(mbokaProxyTarget(["webhooks", "kyb"], "")).toBeNull();
    expect(mbokaProxyTarget(["v1", "webhooks", "orders"], "")).toBeNull();
    expect(mbokaProxyTarget(["admin", "users"], "")).toBeNull();
  });

  it("fails when a service calls a prefix that is not on the allowlist", () => {
    const root = process.cwd();
    const files = [...walk(path.join(root, "lib")), ...walk(path.join(root, "app"))];
    const allowed = new Set<string>(MBOKA_PROXY_ALLOWED_PREFIXES);
    const missing: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const prefix of prefixesIn(source)) {
        if (!allowed.has(prefix)) missing.push(`${path.relative(root, file)} -> ${prefix}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
