// The commit subject is the project's record (ADR-0078), so its shape is checked where it is written (ADR-0081).
// Run by .githooks/commit-msg; `npm install` points git at that folder.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PASS_THROUGH = /^(Merge |Revert "|fixup! |squash! |amend! )/;
const SHAPE = /^[A-Za-z][A-Za-z0-9 /,-]{0,39}: \S/;

/** Returns why the message is refused, or null. `staged` is `git diff --cached --name-status` output. */
export function checkMessage(message, staged) {
  const subject = message.split("\n").find((l) => l.trim() && !l.startsWith("#"))?.trim() ?? "";
  if (PASS_THROUGH.test(subject)) return null;
  if (!SHAPE.test(subject)) return `subject must read "<area>: <what changed>" — got "${subject}"`;
  if (subject.length > 120) return `subject is ${subject.length} characters; keep it under 120 and put detail in the body`;
  const lines = staged.split("\n").filter(Boolean);
  if (lines.some((l) => /^A\s+prisma\/migrations\/\d[^/]*\/migration\.sql$/.test(l)) && !subject.includes("[MIGRATION]")) {
    return "a migration folder is added: flag the subject [MIGRATION]";
  }
  if (lines.some((l) => /^M\s+docs\/CONTRACTS?(\.md|\/)/.test(l)) && !subject.includes("[CONTRACT]")) {
    return "the contracts changed: flag the subject [CONTRACT]";
  }
  return null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const message = readFileSync(process.argv[2], "utf8");
  const staged = execFileSync("git", ["diff", "--cached", "--name-status"], { encoding: "utf8" });
  const why = checkMessage(message, staged);
  if (why) {
    console.error(`commit-msg: ${why} (ADR-0078).`);
    process.exit(1);
  }
}
