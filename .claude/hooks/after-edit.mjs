#!/usr/bin/env node
// PostToolUse(Edit|Write|MultiEdit): immediate, deterministic feedback.
//  - design/tokens.json  → regenerate token outputs (fails loudly on bad aliases)
//  - *.ts/tsx/js/mjs     → ESLint errors for that file (design-system + hook rules)
// Exit 2 sends stderr back to Claude so it fixes the problem in the same turn.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative } from "node:path";

const input = JSON.parse(await new Promise((r) => {
  let d = "";
  process.stdin.on("data", (c) => (d += c)).on("end", () => r(d || "{}"));
}));
const file = input.tool_input?.file_path;
if (!file || !existsSync(file)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const rel = relative(root, file);
if (rel.startsWith("..") || rel.startsWith("node_modules/") || rel.startsWith(".claude/worktrees/")) process.exit(0);

function run(cmd, args) {
  try {
    execFileSync(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    return null;
  } catch (err) {
    return `${err.stdout ?? ""}${err.stderr ?? ""}`.trim() || String(err);
  }
}

if (rel === "design/tokens.json") {
  const out = run("node", ["scripts/build-tokens.mjs"]);
  if (out) {
    console.error(`Token build failed after editing design/tokens.json:\n${out}`);
    process.exit(2);
  }
  process.exit(0);
}

if (/\.(ts|tsx|js|mjs)$/.test(rel)) {
  // --quiet: errors only. Legacy warnings are known debt, not this edit's job.
  const out = run("npx", ["eslint", "--quiet", "--no-warn-ignored", rel]);
  if (out) {
    console.error(`ESLint errors in ${rel} (see .claude/rules/ui.md / AGENTS.md):\n${out}`);
    process.exit(2);
  }
}
