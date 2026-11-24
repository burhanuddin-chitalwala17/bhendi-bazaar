// The counts ARCHITECTURE.md states, measured from the tree. `docs:index` rewrites them and `docs:check` fails when
// they differ, so a number is never typed by hand (ADR-0081).
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DOC = "docs/ARCHITECTURE.md";

function countFiles(root, dir, match) {
  let n = 0;
  const rec = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d)) {
      const f = join(d, e);
      statSync(f).isDirectory() ? rec(f) : match(f) && n++;
    }
  };
  rec(join(root, dir));
  return n;
}

/**
 * Each claim: a label, the pattern whose first group holds the number, and the number the tree has.
 * @returns {Array<[string, RegExp, number]>}
 */
export function architectureCounts(root) {
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  const isTest = (p) => /\.test\.tsx?$/.test(p);
  return [
    ["api handlers", /(?<=api\/)( +\d+)(\s+handlers)/, countFiles(root, "src/app/api", (p) => p.endsWith("route.ts"))],
    ["(main) pages", /(?<=\(main\)\s+storefront)( +\d+)( pages)/, countFiles(root, "src/app/(main)", (p) => p.endsWith("page.tsx"))],
    ["(admin) pages", /(?<=\(admin\)\s+console)( +\d+)( pages)/, countFiles(root, "src/app/(admin)", (p) => p.endsWith("page.tsx"))],
    ["(org) pages", /(?<=\(org\)\s+seller portal)( +\d+)( pages)/, countFiles(root, "src/app/(org)", (p) => p.endsWith("page.tsx"))],
    ["migrations", /(\d+)( migrations)/, readdirSync(join(root, "prisma/migrations")).filter((d) => /^\d/.test(d)).length],
    ["models", /(\d+)( models)/, (schema.match(/^model /gm) ?? []).length],
    ["enums", /(\d+)( enums)/, (schema.match(/^enum /gm) ?? []).length],
    ["test files", /(\d+)( Vitest files)/, countFiles(root, "tests", isTest)],
    ["unit test files", /(\d+)( of them under `tests\/unit\/`)/, countFiles(root, "tests/unit", isTest)],
  ];
}

/** Rewrites every stale count in place; returns the labels it changed. */
export function applyCounts(root) {
  const path = join(root, DOC);
  let text = readFileSync(path, "utf8");
  const changed = [];
  for (const [label, pattern, actual] of architectureCounts(root)) {
    const m = text.match(pattern);
    if (!m || Number(m[1]) === actual) continue;
    // A diagram number carries its padding: keep the column width, and at least one space before it.
    const next = m[1].startsWith(" ") ? ` ${actual}`.padStart(m[1].length, " ") : String(actual);
    text = text.replace(pattern, `${next}$2`);
    changed.push(`${DOC} (${label}: ${m[1].trim()} → ${actual})`);
  }
  if (changed.length) writeFileSync(path, text);
  return changed;
}
