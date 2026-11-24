// The mechanical half of a spec's life, so a session spends no turns on it (ADR-0081).
//
//   npm run spec:new -- <feature>[/<subfeature>] [--domain <d>] [--phase <p>]
//       scaffolds spec.md, decisions.md and trd.md from scripts/templates/spec/ and regenerates the indexes.
//   npm run spec:status -- <feature>[/<subfeature>] <Status>
//       sets Status in spec.md and trd.md together. Implemented also deletes trd.md and ux.md and rewrites every
//       link into them as a pinned `<sha>:path` ref to the last commit that had them (ADR-0073).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const TEMPLATES = join(ROOT, "scripts/templates/spec");
const today = () => new Date().toISOString().slice(0, 10);

export function fillTemplate(text, { feature, domain = "…", phase = "…", date, depth }) {
  const adr = `${"../".repeat(depth + 1)}adr/`;
  return text
    .replaceAll("<feature>", feature)
    .replaceAll("YYYY-MM-DD", date)
    .replace(/^- \*\*Domain:\*\* .*$/m, `- **Domain:** ${domain}`)
    .replace(/^- \*\*Phase:\*\* .*$/m, `- **Phase:** ${phase}`)
    .replaceAll("../../adr/", adr);
}

export function setStatus(text, status) {
  if (!/^- \*\*Status:\*\* .*$/m.test(text)) throw new Error("no `- **Status:**` line");
  return text.replace(/^- \*\*Status:\*\* .*$/m, `- **Status:** ${status}`);
}

/** Rewrites markdown links whose target resolves to one of `gone` as a pinned ref; returns the new text. */
export function pinLinks(text, fileDir, gone, sha) {
  return text.replace(/\[([^\]]+)\]\(([^)#\s]+)(#[^)]*)?\)/g, (whole, label, target) => {
    if (/^[a-z]+:/i.test(target)) return whole;
    const abs = relative(ROOT, resolve(fileDir, target));
    return gone.includes(abs) ? `${label} (\`${sha.slice(0, 8)}:${abs}\`)` : whole;
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
  writeFileSync(spec, setStatus(readFileSync(spec, "utf8"), status));
  const done = [`docs/specs/${name}/spec.md → ${status}`];

  const buildDocs = ["trd.md", "ux.md"].map((f) => join(dir, f)).filter(existsSync);
  if (/implemented/i.test(status) && buildDocs.length) {
    const rel = buildDocs.map((f) => relative(ROOT, f));
    if (execFileSync("git", ["status", "--porcelain", "--", ...rel], { cwd: ROOT, encoding: "utf8" }).trim()) {
      throw new Error(`commit ${rel.join(", ")} first: the pinned ref must point at a commit that has them`);
    }
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
    for (const f of buildDocs) rmSync(f);
    for (const md of walkMarkdown(ROOT)) {
      const text = readFileSync(md, "utf8");
      const next = pinLinks(text, dirname(md), rel, sha);
      if (next !== text) {
        writeFileSync(md, next);
        done.push(`${relative(ROOT, md)}: links pinned to ${sha.slice(0, 8)}`);
      }
    }
    done.push(...rel.map((r) => `${r} deleted`));
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
