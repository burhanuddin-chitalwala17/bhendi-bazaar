// Creates the next ADR from the template and regenerates the index, so numbering, filename and header
// are never typed by hand (ADR-0079). The prose is still written by the author.
//
//   npm run adr:new -- "Title in sentence case"                    → docs/adr/
//   npm run adr:new -- "Title" --dir server/shipping/adr           → a domain's own sequence
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

export function slugify(title) {
  return title.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function nextNumber(files) {
  const used = files.map((f) => Number(f.match(/^(\d{4})-/)?.[1])).filter((n) => n > 0);
  return String((used.length ? Math.max(...used) : 0) + 1).padStart(4, "0");
}

export function render(number, title, date) {
  return `# ADR-${number}: ${title}

- **Date:** ${date}
- **Status:** Proposed

## Context

<!-- Why this was needed: the problem and the pressure, 2–4 sentences. It is immutable, so it must read as well in a year. -->

## Decision

1. <!-- Numbered, specific enough to be checked. -->

## Alternatives

- <!-- Include the option a reasonable person would choose, and why it lost here. No rejected alternative, no decision. -->

## Consequences

- ✅ <!-- what gets easier -->
- ⚠️ <!-- what gets harder or riskier -->
`;
}

function main(argv) {
  const args = [...argv];
  const dirAt = args.indexOf("--dir");
  const dir = dirAt >= 0 ? args.splice(dirAt, 2)[1] : "docs/adr";
  const title = args.join(" ").trim();
  if (!title) {
    console.error('usage: npm run adr:new -- "Title" [--dir server/<domain>/adr]');
    process.exit(1);
  }
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) mkdirSync(abs, { recursive: true });
  const number = nextNumber(readdirSync(abs));
  const file = join(abs, `${number}-${slugify(title)}.md`);
  writeFileSync(file, render(number, title, new Date().toISOString().slice(0, 10)));
  if (dir === "docs/adr") execFileSync("node", [join(ROOT, "scripts/docs-index.mjs")], { stdio: "ignore" });
  console.log(relative(ROOT, file));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
