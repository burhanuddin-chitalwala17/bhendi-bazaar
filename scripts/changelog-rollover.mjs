// Keeps docs/CHANGELOG.md to the running month. A closed month is summarised in docs/CHANGELOG-HISTORY.md by Claude
// first, then this script drops its entries (git keeps them) and records the highest PR number used (ADR-0072).
//
//   node scripts/changelog-rollover.mjs          drop closed months, print each month dropped
//   node scripts/changelog-rollover.mjs --check  print closed months still in CHANGELOG.md, exit 1 if any
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENTRY = /^## (?:\[PR-\d+\] )?(\d{4}-\d{2})-\d{2}\b/;
const PR = /^## \[PR-(\d+)\]/gm;
export const LAST_PR = /^- \*\*Last PR number:\*\* PR-(\d+)$/m;

export function splitChangelog(text) {
  const preamble = [];
  const entries = [];
  let current = null;
  for (const line of text.split("\n")) {
    const month = line.match(ENTRY)?.[1];
    if (month) {
      current = { month, lines: [line] };
      entries.push(current);
    } else if (/^#{1,2} /.test(line)) {
      current = null;
      preamble.push(line);
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  return { preamble, entries };
}

const trim = (lines) => lines.join("\n").replace(/\n+$/, "");

export function rollover(root, today = new Date()) {
  const thisMonth = today.toISOString().slice(0, 7);
  const file = join(root, "docs/CHANGELOG.md");
  const historyFile = join(root, "docs/CHANGELOG-HISTORY.md");
  const { preamble, entries } = splitChangelog(readFileSync(file, "utf8"));
  const closed = [...new Set(entries.map((e) => e.month).filter((m) => m < thisMonth))].sort();
  return {
    closed,
    apply() {
      const history = readFileSync(historyFile, "utf8");
      const missing = closed.filter((m) => !history.includes(`## ${m}`));
      if (missing.length) throw new Error(`summarise ${missing.join(", ")} in CHANGELOG-HISTORY.md before dropping them`);
      const dropped = entries.filter((e) => e.month < thisMonth);
      const numbers = dropped.flatMap((e) => [...trim(e.lines).matchAll(PR)].map((m) => Number(m[1])));
      const last = Math.max(Number(history.match(LAST_PR)?.[1] ?? 0), ...numbers);
      writeFileSync(historyFile, history.replace(LAST_PR, `- **Last PR number:** PR-${last}`));
      const kept = entries.filter((e) => e.month >= thisMonth).map((e) => trim(e.lines));
      writeFileSync(file, `${trim(preamble)}\n\n${kept.join("\n\n")}\n`);
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(import.meta.url), "../..");
  const { closed, apply } = rollover(root);
  if (process.argv.includes("--check")) {
    if (closed.length) console.log(closed.join(" "));
    process.exit(closed.length ? 1 : 0);
  }
  apply();
  for (const month of closed) console.log(month);
}
