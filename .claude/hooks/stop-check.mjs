#!/usr/bin/env node
// Stop: don't let a turn end with a broken typecheck or stale generated files.
// Only runs when TS/token sources differ from HEAD, so Q&A turns stay instant.
// Exit 2 sends the errors back and Claude keeps working (Claude Code caps
// consecutive blocks, so this can't loop forever).
import { execFileSync } from "node:child_process";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const sh = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });

let changed;
try {
  changed = sh("git", ["status", "--porcelain", "--untracked-files=all"])
    .split("\n")
    .map((l) => l.slice(3).trim())
    .filter((p) => p && !p.startsWith(".claude/worktrees/"));
} catch {
  process.exit(0); // not a git checkout — nothing to compare against
}
if (!changed.some((p) => /\.(ts|tsx|mts)$/.test(p) || p === "design/tokens.json")) process.exit(0);

const checks = [
  ["Design tokens", "node", ["scripts/build-tokens.mjs", "--check"]],
  ["Typecheck", "npx", ["tsc", "--noEmit"]],
  ["Strict typecheck (new code)", "npx", ["tsc", "--noEmit", "-p", "tsconfig.strict.json"]],
];
const failures = [];
for (const [name, cmd, args] of checks) {
  try {
    sh(cmd, args);
  } catch (err) {
    const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim().split("\n").slice(0, 40).join("\n");
    failures.push(`## ${name} failed\n${out}`);
  }
}
if (failures.length) {
  console.error(`Not done yet — fix these before finishing:\n\n${failures.join("\n\n")}`);
  process.exit(2);
}
