// The production-dependency audit CI blocks on (docs/GTM-READINESS.md B1).
//
//   node scripts/audit-prod.mjs
//
// Fails on any high or critical advisory in a production dependency unless `audit-allowlist.json`
// names its GHSA id with a reason and an unexpired date (ADR-0056: a ratchet, never a bypass).
// A registry failure is retried once, then fails as a registry failure, never as a finding.
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const BLOCKING = new Set(["high", "critical"]);
const ROOT = resolve(import.meta.dirname, "..");

function audit() {
  try {
    return execFileSync("npm", ["audit", "--omit=dev", "--json"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
  } catch (error) {
    // npm exits non-zero whenever it finds anything; the JSON on stdout is still the answer.
    return error.stdout ?? "";
  }
}

function report() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt > 1) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10_000);
    let parsed;
    try {
      parsed = JSON.parse(audit());
    } catch {
      parsed = { error: { summary: "npm audit printed no JSON (no lockfile, or npm itself failed)" } };
    }
    if (!parsed.error && parsed.vulnerabilities) return parsed;
    const why = parsed.message || parsed.error?.summary || parsed.error?.detail || "no report";
    console.error(`npm audit gave no report (attempt ${attempt}): ${why}`);
  }
  console.error("::error::The advisory service did not answer twice. This is not a finding; re-run the job.");
  process.exit(2);
}

/** GHSA ids of the blocking advisories, with the packages they reach. */
export function blockingAdvisories(vulnerabilities) {
  const found = new Map();
  for (const [name, vuln] of Object.entries(vulnerabilities)) {
    for (const via of vuln.via) {
      if (typeof via !== "object" || !BLOCKING.has(via.severity)) continue;
      const id = via.url?.split("/").pop() ?? `${name}:${via.source}`;
      found.set(id, { ...(found.get(id) ?? { packages: [] }), title: via.title, severity: via.severity });
      found.get(id).packages.push(name);
    }
  }
  return found;
}

export function check(vulnerabilities, allowlist, today = new Date().toISOString().slice(0, 10)) {
  const problems = [];
  for (const [id, entry] of Object.entries(allowlist)) {
    if (!entry.reason?.trim()) problems.push(`audit-allowlist.json: ${id} has no reason`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? "")) problems.push(`audit-allowlist.json: ${id} has no expires date`);
    else if (entry.expires < today) problems.push(`audit-allowlist.json: ${id} expired on ${entry.expires}; fix it or re-decide`);
  }
  const found = blockingAdvisories(vulnerabilities);
  for (const [id, a] of found) {
    if (!allowlist[id]) problems.push(`${a.severity}: ${id} ${a.title} (${[...new Set(a.packages)].join(", ")})`);
  }
  // An entry nothing matches any more has done its job; the list only shrinks.
  for (const id of Object.keys(allowlist)) {
    if (!found.has(id)) problems.push(`audit-allowlist.json: ${id} no longer matches anything; remove it`);
  }
  return problems;
}

// Compared as URLs of the real path: a raw string comparison misses a path with a space or a
// symlink, skips this block and exits 0, which is a gate failing open.
const isEntry = process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
if (isEntry) {
  const allowlist = JSON.parse(readFileSync(resolve(ROOT, "audit-allowlist.json"), "utf8")).advisories;
  const problems = check(report().vulnerabilities, allowlist);
  if (problems.length) {
    for (const p of problems) console.error(`::error::${p}`);
    process.exit(1);
  }
  console.log("No unlisted high or critical advisory in production dependencies.");
}
