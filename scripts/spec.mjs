// The mechanical half of a spec's life, so a session spends no turns on it (ADR-0081).
//
//   npm run spec:new -- <feature>[/<subfeature>] [--domain <d>] [--phase <p>]
//       scaffolds spec.md, decisions.md and trd.md from scripts/templates/spec/ and regenerates the indexes.
//   npm run spec:status -- <feature>[/<subfeature>] <Status>
//       sets Status in spec.md and trd.md together. Implemented also deletes every file but spec.md and decisions.md
//       and rewrites every link into them as a pinned `<sha>:path` ref to the last commit that had them (ADR-0073),
//       refusing first if any Q id they cite is missing from decisions.md (ADR-0084).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { foreignNamesFrom, qGaps, ships } from "./main-ready.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const TEMPLATES = join(ROOT, "scripts/templates/spec");
const today = () => new Date().toISOString().slice(0, 10);

/** @param {string} text @param {{ feature: string, domain?: string, phase?: string, date: string, depth: number }} ctx */
export function fillTemplate(text, { feature, domain, phase, date, depth }) {
  const adr = `${"../".repeat(depth + 1)}adr/`;
  let out = text.replaceAll("<feature>", feature).replaceAll("YYYY-MM-DD", date).replaceAll("../../adr/", adr);
  // Without a value the template's own placeholder stays: it says what belongs there.
  if (domain) out = out.replace(/^- \*\*Domain:\*\* .*$/m, `- **Domain:** ${domain}`);
  if (phase) out = out.replace(/^- \*\*Phase:\*\* .*$/m, `- **Phase:** ${phase}`);
  return out;
}

export { ships };

/**
 * What retiring a shipped feature deletes: everything but what must stay true, why, and child specs (ADR-0084).
 * @param {string[]} entries @param {(name: string) => boolean} [isChildSpec]
 */
export const retiredFiles = (entries, isChildSpec = () => false) =>
  entries.filter((f) => f !== "spec.md" && f !== "decisions.md" && !isChildSpec(f));

export function setStatus(text, status) {
  if (!/^- \*\*Status:\*\* .*$/m.test(text)) throw new Error("no `- **Status:**` line");
  return text.replace(/^- \*\*Status:\*\* .*$/m, `- **Status:** ${status}`);
}

/** Rewrites markdown links whose target resolves to one of `gone` as a pinned ref; returns the new text. */
export function pinLinks(text, fileDir, gone, sha) {
  return text.replace(/(!?)\[([^\]]+)\]\(([^)#\s]+)(#[^)\s]*)?(\s+"[^"]*")?\)/g, (whole, bang, label, target) => {
    if (/^[a-z]+:/i.test(target)) return whole;
    const abs = relative(ROOT, resolve(fileDir, target));
    return gone.some((g) => abs === g || abs.startsWith(`${g}/`)) ? `${label} (\`${sha.slice(0, 8)}:${abs}\`)` : whole;
  });
}

function walkMarkdown(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".git") || e === ".next" || e === "archive") continue;
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walkMarkdown(f, out);
    else if (f.endsWith(".md")) out.push(f);
  }
  return out;
}

const filesUnder = (p) => (statSync(p).isDirectory() ? readdirSync(p).flatMap((e) => filesUnder(join(p, e))) : [p]);

function indexes() {
  execFileSync("node", [join(ROOT, "scripts/docs-index.mjs")], { stdio: "ignore" });
}

function specNew(args) {
  const opt = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const domain = opt("domain");
  const phase = opt("phase");
  const name = args[0];
  if (!name || !/^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(name)) throw new Error("name is kebab-case, optionally parent/child");
  const dir = join(ROOT, "docs/specs", name);
  if (existsSync(dir)) throw new Error(`docs/specs/${name} already exists`);
  if (name.includes("/") && !existsSync(dirname(dir))) throw new Error(`parent feature docs/specs/${dirname(name)} does not exist`);
  mkdirSync(dir, { recursive: true });
  const ctx = { feature: name.split("/").pop(), domain, phase, date: today(), depth: name.split("/").length };
  for (const f of ["spec.md", "decisions.md", "trd.md"]) {
    writeFileSync(join(dir, f), fillTemplate(readFileSync(join(TEMPLATES, f), "utf8"), ctx));
  }
  indexes();
  console.log(["spec.md", "decisions.md", "trd.md"].map((f) => `docs/specs/${name}/${f}`).join("\n"));
}

function specStatus(args) {
  const [name, ...rest] = args;
  const status = rest.join(" ").trim();
  if (!name || !status) throw new Error("usage: spec:status <feature> <Status>");
  const dir = join(ROOT, "docs/specs", name);
  const spec = join(dir, "spec.md");
  if (!existsSync(spec)) throw new Error(`docs/specs/${name}/spec.md not found`);
  const buildDocs = ships(status)
    ? retiredFiles(readdirSync(dir), (f) => existsSync(join(dir, f, "spec.md"))).map((f) => join(dir, f))
    : [];
  const rel = buildDocs.map((f) => relative(ROOT, f));
  // Refuse before writing anything, so a refused run leaves every file as it was.
  if (rel.length && execFileSync("git", ["status", "--porcelain", "--", ...rel], { cwd: ROOT, encoding: "utf8" }).trim()) {
    throw new Error(`commit ${rel.join(", ")} first: the pinned ref must point at a commit that has them`);
  }
  if (rel.length) {
    const decisions = join(dir, "decisions.md");
    const tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n");
    const citing = buildDocs.flatMap(filesUnder).filter((f) => /\.(md|html)$/.test(f)).map((f) => readFileSync(f, "utf8"));
    // The feature's own name before a Q id is still this log's id.
    const foreign = foreignNamesFrom(tracked);
    foreign.delete(name.split("/").pop());
    const gaps = qGaps(citing, existsSync(decisions) ? readFileSync(decisions, "utf8") : null, foreign);
    if (gaps.length) {
      throw new Error(
        `${rel.join(", ")} cite ${gaps.join(", ")}, which decisions.md does not hold; its reasoning would go with them. ` +
          "Add each to decisions.md, or write another log's id as `<feature> Qn`, then run this again.",
      );
    }
  }
  writeFileSync(spec, setStatus(readFileSync(spec, "utf8"), status));
  const done = [`docs/specs/${name}/spec.md → ${status}`];

  if (buildDocs.length) {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
    for (const f of buildDocs) rmSync(f, { recursive: true });
    for (const md of walkMarkdown(ROOT)) {
      const text = readFileSync(md, "utf8");
      const next = pinLinks(text, dirname(md), rel, sha);
      if (next !== text) {
        writeFileSync(md, next);
        done.push(`${relative(ROOT, md)}: links pinned to ${sha.slice(0, 8)}`);
      }
    }
    done.push(...rel.map((r) => `${r} deleted`));
    // pinLinks reads markdown only; a citation from code is listed for a hand-written pin.
    const cited = spawnSync("git", ["grep", "-l", "-F", ...rel.flatMap((r) => ["-e", r]), "--", ".", ":!*.md"], { cwd: ROOT, encoding: "utf8" }).stdout.trim();
    if (cited) done.push(`still cited by path from (pin to ${sha.slice(0, 8)}:<path> by hand):\n  ${cited.split("\n").join("\n  ")}`);
  } else {
    const trd = join(dir, "trd.md");
    if (existsSync(trd)) {
      writeFileSync(trd, setStatus(readFileSync(trd, "utf8"), status));
      done.push(`docs/specs/${name}/trd.md → ${status}`);
    }
  }
  indexes();
  console.log(done.join("\n"));
  console.log("BACKLOG.md's phase row is prose: update it by hand if this changes where the phase stands.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    if (cmd === "new") specNew(args);
    else if (cmd === "status") specStatus(args);
    else throw new Error("usage: spec.mjs new|status …");
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
