#!/usr/bin/env node
// Snapshot Mboka's OpenAPI spec into lib/api/openapi.json, trimmed to what the
// dashboard may call through the /api/mboka proxy.
//
//   npm run api:spec                       # from $MBOKA_API_BASE_URL/openapi.json (default http://localhost:8000)
//   npm run api:spec -- --file spec.json   # from a file, e.g. exported without running the server:
//     (cd ../Mboka-Backend && myenv/bin/python -c "import json; from app.main import app; print(json.dumps(app.openapi()))") > /tmp/spec.json
//
// Then `npm run api:gen` regenerates lib/api/generated/mboka.ts from the snapshot.
//
// Trimming rules:
//   - keep only paths under the proxy allowlist (lib/server/mbokaProxyAllowlist.ts)
//   - strip the backend's `/api` prefix: the proxy maps /api/mboka/<p> → backend /api/<p>,
//     so client paths read exactly like the existing `mbokaApi.get("/v1/…")` calls
//   - drop component schemas no kept path references (smaller diff, smaller types)

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "lib/api/openapi.json");

// Keep in sync with MBOKA_PROXY_ALLOWED_PREFIXES (a unit test enforces it).
const ALLOWED_PREFIXES = ["v1", "api-keys", "businesses"];
const BLOCKED_SEGMENTS = new Set(["webhooks"]);

const fileArg = process.argv.indexOf("--file");
let spec;
if (fileArg !== -1) {
  spec = JSON.parse(readFileSync(process.argv[fileArg + 1], "utf8"));
} else {
  const base = process.env.MBOKA_API_BASE_URL || "http://localhost:8000";
  const url = process.env.MBOKA_OPENAPI_URL || `${base.replace(/\/$/, "")}/openapi.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}. Is Mboka running? Or pass --file.`);
  spec = await res.json();
}

const paths = {};
for (const [path, item] of Object.entries(spec.paths ?? {})) {
  if (!path.startsWith("/api/")) continue;
  const rel = path.slice(4); // "/v1/…"
  const segments = rel.split("/").filter(Boolean);
  if (!ALLOWED_PREFIXES.includes(segments[0])) continue;
  if (segments.some((s) => BLOCKED_SEGMENTS.has(s))) continue;
  paths[rel] = item;
}

// Walk $refs from kept paths to find the schemas actually used.
const schemas = spec.components?.schemas ?? {};
const used = new Set();
const visit = (node) => {
  if (Array.isArray(node)) return node.forEach(visit);
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    if (k === "$ref" && typeof v === "string" && v.startsWith("#/components/schemas/")) {
      const name = v.slice("#/components/schemas/".length);
      if (!used.has(name)) {
        used.add(name);
        visit(schemas[name]);
      }
    } else visit(v);
  }
};
visit(paths);

// Drop example payloads: types only need schemas, and backend docs examples
// include secret-shaped placeholders (e.g. API keys) that trip secret
// scanners and have no business in the frontend repo.
const stripExamples = (node) => {
  if (Array.isArray(node)) return node.map(stripExamples);
  if (!node || typeof node !== "object") return node;
  return Object.fromEntries(
    Object.entries(node)
      .filter(([k]) => k !== "example" && k !== "examples")
      .map(([k, v]) => [k, stripExamples(v)]),
  );
};

const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const out = {
  openapi: spec.openapi,
  info: { ...spec.info, description: "Mboka API, trimmed to the dashboard proxy allowlist by scripts/fetch-openapi.mjs. Do not edit." },
  paths: stripExamples(sortObj(paths)),
  components: { schemas: stripExamples(sortObj(Object.fromEntries([...used].map((n) => [n, schemas[n]])))) },
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote lib/api/openapi.json — ${Object.keys(paths).length} paths, ${used.size} schemas.`);
