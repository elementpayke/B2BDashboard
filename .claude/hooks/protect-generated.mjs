#!/usr/bin/env node
// PreToolUse(Edit|Write|MultiEdit): generated files are outputs, never inputs.
// Exit 2 blocks the edit and tells Claude what to change instead.
import { relative } from "node:path";

const input = JSON.parse(await new Promise((r) => {
  let d = "";
  process.stdin.on("data", (c) => (d += c)).on("end", () => r(d || "{}"));
}));
const file = input.tool_input?.file_path;
if (!file) process.exit(0);
const rel = relative(process.env.CLAUDE_PROJECT_DIR || process.cwd(), file);

const GENERATED = [
  [/^lib\/api\/generated\//, "lib/api/generated/ is generated from lib/api/openapi.json. Run `npm run api:spec` (or `-- --file …`) then `npm run api:gen`. If the backend contract is wrong, fix it in Mboka-Backend."],
  [/^lib\/api\/openapi\.json$/, "lib/api/openapi.json is a snapshot of the Mboka spec. Refresh it with `npm run api:spec`, don't hand-edit."],
  [/^lib\/theme\/tokens\.generated\.ts$/, "Generated from design/tokens.json. Edit design/tokens.json; the PostToolUse hook regenerates this file."],
  [/^app\/tokens\.generated\.css$/, "Generated from design/tokens.json. Edit design/tokens.json; the PostToolUse hook regenerates this file."],
];

for (const [re, why] of GENERATED) {
  if (re.test(rel)) {
    console.error(`Blocked: ${rel} is a generated file. ${why}`);
    process.exit(2);
  }
}
