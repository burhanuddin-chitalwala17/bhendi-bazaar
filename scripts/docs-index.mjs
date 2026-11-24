// The index tables in docs/adr/README.md and docs/specs/README.md, generated from the
// files they index, and the counts in ARCHITECTURE.md (scripts/docs-counts.mjs). A hand-typed copy of a header
// is a copy that drifts (ADR-0009);
// `docs:check` fails when the committed tables differ from what this renders.
//
//   node scripts/docs-index.mjs          rewrite the tables in place
//   node scripts/docs-index.mjs --check  exit 1 if any table is stale
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyCounts } from "./docs-counts.mjs";

const start = (name) => `<!-- generated:${name}:start -->`;
const end = (name) => `<!-- generated:${name}:end -->`;

function header(text, key) {
  const match = text.match(new RegExp(`^- \\*\\*${key}:\\*\\* ?(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

export function renderAdrIndex(root) {
  const dir = join(root, "docs/adr");
  const rows = readdirSync(dir)
    .filter((f) => /^\d{4}-.*\.md$/.test(f))
    .sort()
    .map((f) => {
      const text = readFileSync(join(dir, f), "utf8");
      const title = text.match(/^# ADR-\d{4}: (.*)$/m)?.[1] ?? f;
      return `| [${f.slice(0, 4)}](${f}) | ${title} | ${header(text, "Status")} | ${header(text, "Date")} |`;
    });
  return ["| ADR | Title | Status | Date |", "|-----|-------|--------|------|", ...rows].join("\n");
}

function specEntries(root) {
  const base = join(root, "docs/specs");
  const entries = [];
  for (const feature of readdirSync(base, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue;
    const dir = join(base, feature.name);
    if (existsSync(join(dir, "spec.md"))) entries.push({ name: feature.name, path: `${feature.name}/`, file: join(dir, "spec.md"), nested: false });
    for (const sub of readdirSync(dir, { withFileTypes: true })) {
      if (!sub.isDirectory()) continue;
      const file = join(dir, sub.name, "spec.md");
      if (existsSync(file)) entries.push({ name: `${feature.name}/${sub.name}`, path: `${feature.name}/${sub.name}/`, file, nested: true });
    }
  }
  return entries.map((e) => {
    const text = readFileSync(e.file, "utf8");
    const summary = header(text, "Summary");
    if (!summary) throw new Error(`${e.file} has no "- **Summary:**" header line; the specs index is generated from it.`);
    const phase = header(text, "Phase").match(/^(\d+)/)?.[1] ?? "—";
    return { ...e, summary, phase, domain: header(text, "Domain") || "—", status: header(text, "Status") || "—" };
  });
}

const byPhaseThenName = (a, b) => {
  const pa = a.phase === "—" ? Infinity : Number(a.phase);
  const pb = b.phase === "—" ? Infinity : Number(b.phase);
  return pa - pb || a.name.localeCompare(b.name);
};

function specTable(entries) {
  const rows = entries.sort(byPhaseThenName).map((e) => `| [${e.name}](${e.path}) | ${e.summary} | ${e.phase} | ${e.domain} | ${e.status} |`);
  return ["| Feature | Summary | Phase | Domain | Status |", "|---|---|---|---|---|", ...rows].join("\n");
}

export function renderSpecsIndex(root) {
  return specTable(specEntries(root).filter((e) => !e.nested));
}

export function renderSubfeaturesIndex(root) {
  return specTable(specEntries(root).filter((e) => e.nested));
}

/** Every generated block: which file it lives in and what it should contain. */
export function indexTargets(root) {
  return [
    { file: "docs/adr/README.md", name: "adr-index", render: renderAdrIndex },
    { file: "docs/specs/README.md", name: "specs-index", render: renderSpecsIndex },
    { file: "docs/specs/README.md", name: "subfeatures-index", render: renderSubfeaturesIndex },
  ].map((t) => {
    const text = readFileSync(join(root, t.file), "utf8");
    const s = text.indexOf(start(t.name));
    const e = text.indexOf(end(t.name));
    if (s === -1 || e === -1) throw new Error(`${t.file} is missing the ${t.name} markers.`);
    const current = text.slice(s + start(t.name).length, e).trim();
    return { ...t, current, expected: t.render(root) };
  });
}

export function applyIndexes(root) {
  const changed = [];
  for (const t of indexTargets(root)) {
    if (t.current === t.expected) continue;
    const path = join(root, t.file);
    const text = readFileSync(path, "utf8");
    const s = text.indexOf(start(t.name)) + start(t.name).length;
    const e = text.indexOf(end(t.name));
    writeFileSync(path, `${text.slice(0, s)}\n${t.expected}\n${text.slice(e)}`);
    changed.push(`${t.file} (${t.name})`);
  }
  return changed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  if (process.argv.includes("--check")) {
    const stale = indexTargets(root).filter((t) => t.current !== t.expected).map((t) => `${t.file} (${t.name})`);
    if (stale.length) {
      console.error(`Stale index tables — run \`npm run docs:index\`:\n${stale.map((s) => `  ${s}`).join("\n")}`);
      process.exit(1);
    }
    console.log("Index tables are current.");
  } else {
    const changed = [...applyIndexes(root), ...applyCounts(root)];
    console.log(changed.length ? `Rewrote:\n${changed.map((c) => `  ${c}`).join("\n")}` : "Index tables already current.");
  }
}
