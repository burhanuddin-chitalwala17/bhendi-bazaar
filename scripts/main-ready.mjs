// main holds only finished work and the reasoning behind it (ADR-0084): a shipped spec folder keeps spec.md and
// decisions.md, nothing unshipped and no session notes reach main. Self-contained, so the pre-push hook can run
// the copy inside the commit it judges.
//
//   npm run check:main-ready              judge the working tree
//   node scripts/main-ready.mjs --rev <sha>  judge a commit's tree (what .githooks/pre-push runs)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";

export const SPECS = "docs/specs/";
const KEPT = new Set(["spec.md", "decisions.md"]);

/** Same rule as scripts/spec.mjs `ships`: only a status beginning with Implemented ships. */
export const ships = (status) => /^(✅\s*)?Implemented\b/i.test(status.trim());

export const statusOf = (specText) => specText.match(/^- \*\*Status:\*\* ?(.*)$/m)?.[1].trim() ?? "";

/** Ids that have a row (`| Q3 |`) or a parked line (`- Q3 —`) in a decisions log. */
export function definedQIds(decisionsText) {
  return new Set([...decisionsText.matchAll(/^(?:\|\s*|-\s+)(Q\d+)\b/gm)].map((m) => m[1]));
}

/**
 * Q ids a text cites as its own feature's. A run (`Q2, Q5–Q7`) after `parent`, after another feature's or domain's
 * name (`shipping Q32`) or after a link out of the folder (`[x](../spec.md) Q2`) belongs to that log, not this one.
 */
export function citedQIds(text, foreignNames = new Set()) {
  const out = new Set();
  for (const m of text.matchAll(/\bQ\d+(?:\s*(?:,|–|-|and|or|&)\s*Q\d+)*\b/g)) {
    const before = text.slice(Math.max(0, m.index - 120), m.index);
    if (/(?:\bparent|\]\(\.\.\/[^)]*\))[\s(]*$/i.test(before)) continue;
    const word = before.match(/([A-Za-z][\w-]*)[\s(]*$/)?.[1]?.toLowerCase();
    if (word && foreignNames.has(word)) continue;
    // A range cites every id inside it.
    for (const part of m[0].matchAll(/Q(\d+)(?:\s*[–-]\s*Q(\d+))?/g)) {
      const from = Number(part[1]);
      const to = part[2] ? Number(part[2]) : from;
      for (let n = from; n <= Math.min(to, from + 200); n++) out.add(`Q${n}`);
    }
  }
  return out;
}

/** Cited ids that decisions.md does not define, sorted by number: reasoning that would be lost with its source. */
export function qGaps(citingTexts, decisionsText, foreignNames) {
  const defined = decisionsText == null ? new Set() : definedQIds(decisionsText);
  const cited = new Set(citingTexts.flatMap((t) => [...citedQIds(t, foreignNames)]));
  return [...cited].filter((q) => !defined.has(q)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

/** Names that, written before a Q id, mark it as another log's: every spec folder segment and server domain. */
export function foreignNamesFrom(paths) {
  const names = new Set();
  for (const p of paths) {
    if (p.startsWith(SPECS)) p.slice(SPECS.length).split("/").slice(0, -1).forEach((s) => names.add(s));
    const domain = p.match(/^server\/([a-z-]+)\//)?.[1];
    if (domain) names.add(domain);
  }
  return names;
}

/** Spec directories (relative, no trailing slash) mapped to the files directly inside them. */
export function specFolders(paths) {
  const folders = new Map();
  for (const p of paths) {
    if (!p.startsWith(SPECS)) continue;
    const dir = posix.dirname(p);
    if (dir + "/" === SPECS) continue;
    if (!folders.has(dir)) folders.set(dir, []);
    folders.get(dir).push(posix.basename(p));
  }
  return folders;
}

const feature = (dir) => dir.slice(SPECS.length);

/**
 * Everything on this tree that main may not hold, each with how to fix it. `paths` are repo-relative files;
 * `read` returns one's text.
 */
export function findOffenders(paths, read) {
  const offenders = [];
  for (const p of paths) {
    const segments = p.split("/");
    if (segments.slice(0, -1).includes("handoff") || (/handoff/i.test(segments.at(-1)) && p.endsWith(".md"))) {
      offenders.push({ path: p, problem: "session notes", fix: "delete it; a handoff lives on its feature branch and ends with the build" });
    }
  }
  for (const p of paths) {
    if (p.startsWith(SPECS) && !p.slice(SPECS.length).includes("/") && p !== `${SPECS}README.md`) {
      offenders.push({ path: p, problem: "a loose file in docs/specs/", fix: "move it into its feature folder or delete it" });
    }
  }
  for (const [dir, files] of specFolders(paths)) {
    if (!files.includes("spec.md")) {
      offenders.push({ path: `${dir}/`, problem: `holds ${files.join(", ")} but no spec.md`, fix: "a folder holds a spec or only child spec folders; delete the stray files" });
      continue;
    }
    const status = statusOf(read(`${dir}/spec.md`));
    if (!ships(status)) {
      offenders.push({
        path: `${dir}/`,
        problem: `Status "${status || "(none)"}" does not ship`,
        fix: `keep it on its feature branch until \`npm run spec:status -- ${feature(dir)} Implemented\`; remove the folder from the branch merging to main`,
      });
      continue;
    }
    for (const f of files.filter((f) => !KEPT.has(f))) {
      offenders.push({
        path: `${dir}/${f}`,
        problem: "a shipped feature keeps spec.md and decisions.md only",
        fix: `\`npm run spec:status -- ${feature(dir)} "${status}"\` retires it`,
      });
    }
  }
  return offenders;
}

export function report(offenders) {
  if (!offenders.length) return "main-ready: the tree holds only finished work.";
  return [
    `main-ready: ${offenders.length} thing(s) main may not hold (ADR-0084):`,
    ...offenders.map((o) => `  ${o.path}\n      ${o.problem} — ${o.fix}`),
  ].join("\n");
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

// realpath: the hook runs a copy under the temp dir, which on macOS is a symlink.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // The hook runs a copy extracted from the pushed commit, so the repository is the caller's, not this file's.
  const cwd = git(process.cwd(), "rev-parse", "--show-toplevel").trim();
  const at = process.argv.indexOf("--rev");
  const rev = at >= 0 ? process.argv[at + 1] : null;
  const lines = (s) => s.split("\n").filter(Boolean);
  const paths = rev
    ? lines(git(cwd, "ls-tree", "-r", "--name-only", rev))
    : lines(git(cwd, "ls-files", "--cached", "--others", "--exclude-standard")).filter((p) => existsSync(join(cwd, p)));
  const read = rev ? (p) => git(cwd, "show", `${rev}:${p}`) : (p) => readFileSync(join(cwd, p), "utf8");
  const offenders = findOffenders(paths, read);
  (offenders.length ? console.error : console.log)(report(offenders));
  process.exit(offenders.length ? 1 : 0);
}
