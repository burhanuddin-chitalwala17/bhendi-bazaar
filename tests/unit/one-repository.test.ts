// Invariant 5: a table is reached through exactly one repository (ADR-0003). It had no test;
// on 2026-10-02 nineteen files outside a repository called `prisma.<model>` directly, a shipping
// webhook among them writing `prisma.order`. All were moved the same day, so the first rule holds
// outright. The second is a ratchet (docs/TESTING.md): four tables still have two writers.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(relative(ROOT, path));
  }
  return out;
}

const DIRECT_CALL = /\bprisma\.[a-z][A-Za-z]*\.(?:find|create|update|delete|upsert|count|aggregate|groupBy)/;

/** Files that call Prisma directly today, each with why it has not moved. Emptied on 2026-10-02. */
const ALLOWED_VIOLATIONS: Record<string, string> = {};

const WRITE = /\b(?:prisma|tx|client|db)\.([a-z][A-Za-z]*)\.(?:create|createMany|update|updateMany|delete|deleteMany|upsert)\b/g;

/**
 * Tables more than one repository writes today — the hard block Invariant 5 names, and how one
 * row comes to have two shapes. Each needs a decision, not a move: most are a storefront
 * repository beside an `admin.*` one, which CLAUDE.md's "no admin domain" sanctions.
 */
const MULTI_WRITER: Record<string, string> = {
  productStock:
    "catalog (product, admin.product, org.address) and checkout's in-transaction decrement (Invariant 6).",
  user: "identity's profile and admin.user repositories.",
  orgMember: "catalog's org and org.member repositories.",
  order: "checkout's order and admin.order repositories.",
};

describe("one aggregate, one repository (Invariant 5)", () => {
  const files = [...sourceFiles(join(ROOT, "src")), ...sourceFiles(join(ROOT, "server"))].filter(
    (f) => !/\.repository\.ts$/.test(f),
  );
  const offenders = files.filter((f) => DIRECT_CALL.test(readFileSync(f, "utf8")));

  it("scans the source it claims to check", () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it("no new file reaches Prisma outside a repository", () => {
    expect(
      offenders.filter((f) => !(f in ALLOWED_VIOLATIONS)),
      "Call the table's repository, through its domain's service. A route handler never calls Prisma.",
    ).toEqual([]);
  });

  it("the allowlist only shrinks: a fixed file leaves it", () => {
    expect(Object.keys(ALLOWED_VIOLATIONS).filter((f) => !offenders.includes(f))).toEqual([]);
  });
});

describe("one table, one writing repository (Invariant 5)", () => {
  const repositories = [...sourceFiles(join(ROOT, "server"))].filter((f) => /\.repository\.ts$/.test(f));
  const writers = new Map<string, Set<string>>();
  for (const file of repositories) {
    for (const [, table] of readFileSync(file, "utf8").matchAll(WRITE)) {
      writers.set(table, (writers.get(table) ?? new Set()).add(file));
    }
  }
  const multi = [...writers].filter(([, files]) => files.size > 1).map(([table]) => table);

  it("finds the writes it guards", () => {
    expect(writers.size).toBeGreaterThan(20);
  });

  it("no new table gains a second writer", () => {
    expect(multi.filter((t) => !(t in MULTI_WRITER))).toEqual([]);
  });

  it("the list only shrinks: a table back to one writer leaves it", () => {
    expect(Object.keys(MULTI_WRITER).filter((t) => !multi.includes(t))).toEqual([]);
  });
});
