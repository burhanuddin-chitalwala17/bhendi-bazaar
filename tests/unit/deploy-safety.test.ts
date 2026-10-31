/**
 * Deploy safety (docs/GTM-READINESS.md B2, B8). The workflows hold every production credential,
 * so what a step can see, which code it runs, and the order things ship in are checked here
 * rather than trusted to review.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { check } from "../../scripts/audit-prod.mjs";

const ROOT = resolve(__dirname, "../..");
const WORKFLOWS = join(ROOT, ".github/workflows");
const workflowFiles = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
const workflows = workflowFiles.map((f) => ({ file: f, text: readFileSync(join(WORKFLOWS, f), "utf8") }));
const ci = readFileSync(join(WORKFLOWS, "ci.yml"), "utf8");
const staging = readFileSync(join(WORKFLOWS, "staging-worker.yml"), "utf8");

/** Lines that are not comments, so a comment explaining the rule does not trip it. */
const code = (text: string) => text.split("\n").filter((l) => !/^\s*#/.test(l));

describe("workflows", () => {
  it("finds the workflows at all", () => {
    expect(workflowFiles).toEqual(expect.arrayContaining(["ci.yml", "staging-worker.yml"]));
  });

  it("never hands a step every secret", () => {
    const offenders = workflows.flatMap(({ file, text }) =>
      code(text).filter((l) => /toJSON\(\s*secrets\s*\)/.test(l)).map((l) => `${file}: ${l.trim()}`),
    );
    expect(offenders).toEqual([]);
  });

  it("pins every action to a commit SHA", () => {
    const uses = workflows.flatMap(({ file, text }) =>
      code(text).flatMap((l) => {
        const m = l.match(/^\s*-?\s*uses:\s*(\S+)/);
        return m ? [`${file}: ${m[1]}`] : [];
      }),
    );
    expect(uses.length).toBeGreaterThan(5);
    expect(uses.filter((u) => !/@[0-9a-f]{40}$/.test(u))).toEqual([]);
  });

  it("pins the Vercel CLI", () => {
    expect(ci).toMatch(/npm install --global vercel@\d+\.\d+\.\d+\s*$/m);
    expect(ci).not.toMatch(/vercel@(latest|\^|~)|npx vercel(?!@\d)/);
  });

  it("is read-only by default", () => {
    for (const { text } of workflows) expect(text).toMatch(/^permissions:\n\s+contents: read$/m);
  });

  it("deploys only after the browser journeys pass on the same commit", () => {
    const job = ci.slice(ci.indexOf("\n  deploy:"), ci.indexOf("\n  deploy-worker:"));
    expect(job).toMatch(/^\s+needs: \[[^\]]*(?:^|[\s,[])e2e(?=[\s,\]])[^\]]*\]/m);
    const e2e = ci.slice(ci.indexOf("\n  e2e:"), ci.indexOf("\n  deploy:"));
    expect(e2e).not.toMatch(/^\s{4}if:/m);
    expect(e2e).toMatch(/run: npx playwright test\s*$/m);
  });

  it("starts the worker only after the web deploy has migrated the schema", () => {
    const job = ci.slice(ci.indexOf("\n  deploy-worker:"));
    expect(job).toMatch(/^\s+needs: \[[^\]]*(?:^|[\s,[])deploy(?=[\s,\]])[^\]]*\]/m);
  });

  it("names every variable in .env.worker.example for both workers", () => {
    const names = readFileSync(join(ROOT, ".env.worker.example"), "utf8")
      .split("\n")
      .map((l) => l.match(/^\s*([A-Z][A-Z0-9_]*)=/)?.[1])
      .filter((n): n is string => Boolean(n));
    expect(names.length).toBeGreaterThan(20);
    for (const n of names) {
      expect(ci).toContain(`WORKER_ENV_${n}: \${{ secrets.WORKER_ENV_${n} }}`);
      expect(staging).toContain(`WORKER_STAGING_ENV_${n}: \${{ secrets.WORKER_STAGING_ENV_${n} }}`);
    }
    // And nothing beyond it, so the example stays the one list.
    const passed = (text: string, prefix: string) =>
      [...text.matchAll(new RegExp(`^\\s+${prefix}([A-Z0-9_]+): \\$\\{\\{ secrets\\.`, "gm"))]
        .map((m) => m[1])
        .filter((n) => n !== "FILE");
    expect(passed(ci, "WORKER_ENV_").sort()).toEqual([...names].sort());
    expect(passed(staging, "WORKER_STAGING_ENV_").sort()).toEqual([...names].sort());
  });
});

describe("dependencies", () => {
  const atLeast = (version: string, floor: [number, number, number]) => {
    const parts = version.split("-")[0].split(".").map(Number);
    for (let i = 0; i < 3; i++) if (parts[i] !== floor[i]) return parts[i] > floor[i];
    return true;
  };
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"));

  // GHSA-2464-fhr4-w9xw (unauthenticated RCE via Image Optimization) and its siblings are fixed in 16.4.1.
  it("locks next past the critical advisories, pinned exactly, with its lint config alongside", () => {
    const locked = lock.packages["node_modules/next"].version;
    expect(atLeast(locked, [16, 4, 1])).toBe(true);
    expect(pkg.dependencies.next).toBe(locked);
    expect(pkg.devDependencies["eslint-config-next"]).toBe(locked);
  });

  it("blocks CI on a high or critical advisory in production dependencies", () => {
    const test = ci.slice(ci.indexOf("\n  test:"), ci.indexOf("\n  e2e:"));
    const start = test.indexOf("- name: Audit production dependencies");
    expect(start).toBeGreaterThan(-1);
    const step = test.slice(start, test.indexOf("- name:", start + 1));
    expect(step).toMatch(/^\s+run: node scripts\/audit-prod\.mjs\s*$/m);
    expect(step).not.toMatch(/continue-on-error/);
  });

  describe("scripts/audit-prod.mjs", () => {
    const advisory = (severity: string, id = "GHSA-aaaa-bbbb-cccc") => ({
      pkg: { via: [{ severity, title: "t", source: 1, url: `https://github.com/advisories/${id}` }] },
    });
    const today = "2026-10-31";

    it("refuses an unlisted high or critical advisory and lets a moderate one through", () => {
      expect(check(advisory("high"), {}, today)).toHaveLength(1);
      expect(check(advisory("critical"), {}, today)).toHaveLength(1);
      expect(check(advisory("moderate"), {}, today)).toEqual([]);
    });

    it("accepts a listed one only with a reason and an unexpired date", () => {
      const ok = { "GHSA-aaaa-bbbb-cccc": { reason: "no fix released", expires: "2026-11-30" } };
      expect(check(advisory("high"), ok, today)).toEqual([]);
      expect(check(advisory("high"), { "GHSA-aaaa-bbbb-cccc": { reason: "", expires: "2026-11-30" } }, today)).toHaveLength(1);
      expect(check(advisory("high"), { "GHSA-aaaa-bbbb-cccc": { reason: "x", expires: "2026-10-01" } }, today)).toHaveLength(1);
    });

    it("refuses an entry that no longer matches anything, so the list only shrinks", () => {
      const stale = { "GHSA-zzzz-zzzz-zzzz": { reason: "x", expires: "2026-11-30" } };
      expect(check({}, stale, today)).toHaveLength(1);
    });
  });
});

describe("vercel.json", () => {
  it("runs functions in Mumbai, beside the database", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8"));
    expect(config.regions).toEqual(["bom1"]);
  });
});

describe("infra/worker/compose-env.sh", () => {
  const run = (env: Record<string, string>, prefix = "WORKER_ENV_") =>
    spawnSync("bash", [join(ROOT, "infra/worker/compose-env.sh"), prefix], {
      env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", ...env },
      encoding: "utf8",
    });

  it("writes each named variable over the base file, skipping unset secrets", () => {
    const out = run({
      BASE_ENV_FILE: "DATABASE_URL=old\nAPP_ENV=production",
      WORKER_ENV_DATABASE_URL: "new",
      WORKER_ENV_CREDENTIAL_KEYS: "k=1",
      WORKER_ENV_RESEND_API_KEY: "",
      WORKER_ENV_FILE: "not a variable",
      WORKER_STAGING_ENV_DATABASE_URL: "staging",
    });
    expect(out.status).toBe(0);
    expect(out.stdout.trim().split("\n").sort()).toEqual(["APP_ENV=production", "CREDENTIAL_KEYS=k=1", "DATABASE_URL=new"]);
  });

  it("leaves the base file whole when a value carries regex characters", () => {
    const out = run({ BASE_ENV_FILE: "APP_ENV=production", WORKER_ENV_KEY: "line one\nmatch(this" });
    expect(out.stdout).toContain("APP_ENV=production");
  });

  it("keeps the staging prefix apart from production", () => {
    const out = run({ WORKER_ENV_DATABASE_URL: "prod", WORKER_STAGING_ENV_DATABASE_URL: "dev" }, "WORKER_STAGING_ENV_");
    expect(out.stdout.trim()).toBe("DATABASE_URL=dev");
  });

  it("exits cleanly with nothing set, so the caller's own DATABASE_URL error is the one shown", () => {
    const out = run({});
    expect(out.status).toBe(0);
    expect(out.stdout).toBe("");
  });
});
