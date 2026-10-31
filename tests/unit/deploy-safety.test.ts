/**
 * Deploy safety (docs/GTM-READINESS.md B2, B8). The workflows hold every production credential,
 * so what a step can see, which code it runs, and the order things ship in are checked here
 * rather than trusted to review.
 */
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

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
  });

  it("is read-only by default", () => {
    for (const { text } of workflows) expect(text).toMatch(/^permissions:\n\s+contents: read$/m);
  });

  it("starts the worker only after the web deploy has migrated the schema", () => {
    const job = ci.slice(ci.indexOf("\n  deploy-worker:"));
    expect(job).toMatch(/^\s+needs: \[[^\]]*\bdeploy\b[^\]]*\]/m);
  });

  it("names every variable in .env.worker.example for both workers", () => {
    const names = readFileSync(join(ROOT, ".env.worker.example"), "utf8")
      .split("\n")
      .map((l) => l.match(/^\s*([A-Z][A-Z0-9_]*)=/)?.[1])
      .filter((n): n is string => Boolean(n));
    expect(names.length).toBeGreaterThan(5);
    for (const n of names) {
      expect(ci).toContain(`WORKER_ENV_${n}: \${{ secrets.WORKER_ENV_${n} }}`);
      expect(staging).toContain(`WORKER_STAGING_ENV_${n}: \${{ secrets.WORKER_STAGING_ENV_${n} }}`);
    }
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
      env: { PATH: process.env.PATH ?? "", ...env },
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
