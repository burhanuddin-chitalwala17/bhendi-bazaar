// Invariant 5: a table is reached through exactly one repository (ADR-0003). It had no test;
// on 2026-10-02 nineteen files outside a repository called `prisma.<model>` directly, a shipping
// webhook among them writing `prisma.order`. All were moved the same day. On 2026-10-04 the scan
// widened from `prisma.` to every client handle — `tx.` had let the order transaction and the
// shipping restock write four tables from a service — and `ProductStock` and `Order` each went
// to one writer, as `user` and `orgMember` did the same day. One ratchet remains
// (docs/TESTING.md): the `admin.*` repositories that still write.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (/\.tsx?$/.test(entry) && !entry.endsWith(".d.ts")) out.push(relative(ROOT, path));
  }
  return out;
}

/**
 * Any Prisma model operation through any handle a client travels under. `$transaction` is not a
 * model operation and does not match: a service may open a transaction and hand `tx` to
 * repository commands — what it may not do is `tx.<model>.<op>` itself.
 */
const CLIENT = "(?:prisma|tx|db|client)";
const MODEL_CALL = new RegExp(
  `\\b${CLIENT}\\.([a-z][A-Za-z]*)\\.(?:find\\w*|create\\w*|update\\w*|delete\\w*|upsert|count|aggregate|groupBy)\\b`,
  "g",
);
const WRITE = new RegExp(
  `\\b${CLIENT}\\.([a-z][A-Za-z]*)\\.(?:create|createMany|createManyAndReturn|update|updateMany|delete|deleteMany|upsert)\\b`,
  "g",
);

/** Files that call Prisma directly today, each with why it has not moved. Emptied on 2026-10-02. */
const ALLOWED_VIOLATIONS: Record<string, string> = {};

/**
 * Tables more than one repository writes today — the hard block Invariant 5 names, and how one
 * row comes to have two shapes. Four on 2026-10-02 (`productStock`, `order`, `user`,
 * `orgMember`); emptied on 2026-10-04. A new entry needs a decision, not a move.
 */
const MULTI_WRITER: Record<string, string> = {};

/**
 * `admin.*` files are the console's reads on an aggregate (CLAUDE.md: there is no admin domain,
 * an admin listing is a query). A write there is a second writer by construction — it is how
 * `Order` had two until 2026-10-04. These still write; each leaves when its commands move to the
 * aggregate's repository.
 */
const ADMIN_WRITERS: Record<string, string> = {};

const isRepository = (f: string) => /\.repository\.ts$/.test(f);
const matches = (f: string, re: RegExp) => [...readFileSync(f, "utf8").matchAll(re)];

const all = [...sourceFiles(join(ROOT, "src")), ...sourceFiles(join(ROOT, "server"))];

describe("one aggregate, one repository (Invariant 5)", () => {
  const files = all.filter((f) => !isRepository(f));
  const offenders = files.filter((f) => matches(f, MODEL_CALL).length > 0);

  it("scans the source it claims to check", () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it("no file reaches a Prisma model outside a repository — on `prisma`, `tx` or any other handle", () => {
    expect(
      offenders.filter((f) => !(f in ALLOWED_VIOLATIONS)),
      "Call the table's repository, through its domain's service, passing `tx` if you hold one. " +
        "A route handler never calls Prisma; a service never calls `tx.<model>`.",
    ).toEqual([]);
  });

  it("the allowlist only shrinks: a fixed file leaves it", () => {
    expect(Object.keys(ALLOWED_VIOLATIONS).filter((f) => !offenders.includes(f))).toEqual([]);
  });
});

describe("one table, one writing repository (Invariant 5)", () => {
  const writers = new Map<string, Set<string>>();
  for (const file of all.filter(isRepository)) {
    for (const [, table] of matches(file, WRITE)) {
      writers.set(table, (writers.get(table) ?? new Set()).add(file));
    }
  }
  const multi = [...writers].filter(([, files]) => files.size > 1).map(([table]) => table);

  it("finds the writes it guards", () => {
    expect(writers.size).toBeGreaterThan(20);
    // The two tables this gate was widened for, each now written from exactly one file.
    expect([...(writers.get("productStock") ?? [])]).toEqual(["server/catalog/stock.repository.ts"]);
    expect([...(writers.get("order") ?? [])]).toEqual(["server/checkout/order.repository.ts"]);
  });

  it("no new table gains a second writer", () => {
    expect(multi.filter((t) => !(t in MULTI_WRITER))).toEqual([]);
  });

  it("the list only shrinks: a table back to one writer leaves it", () => {
    expect(Object.keys(MULTI_WRITER).filter((t) => !multi.includes(t))).toEqual([]);
  });
});

describe("an admin.* file does not write (no admin domain)", () => {
  const adminFiles = all.filter((f) => /(^|\/)admin\.[^/]*$/.test(f));
  const writing = adminFiles.filter((f) => matches(f, WRITE).length > 0);

  it("finds the admin files it is about", () => {
    expect(adminFiles.length).toBeGreaterThan(5);
  });

  it("no new admin.* file writes a table", () => {
    expect(
      writing.filter((f) => !(f in ADMIN_WRITERS)),
      "An admin.* module is the console's view of an aggregate. Its commands belong on the " +
        "aggregate's repository — `admin.order.repository` became read-only this way.",
    ).toEqual([]);
  });

  it("the list only shrinks: an admin file that stopped writing leaves it", () => {
    expect(Object.keys(ADMIN_WRITERS).filter((f) => !writing.includes(f))).toEqual([]);
  });
});
