/**
 * Invariant 7: prisma/seed.ts deletes every table, so it must refuse any target
 * that has not been named as a seed target.
 *
 * This test exists because the invariant was documented long before it was
 * implemented, and an untested guard is indistinguishable from a missing one.
 * Every case below is a way production data could be destroyed.
 */
import { describe, it, expect } from "vitest";
import { seedTargetRefusal, type SeedEnv } from "../../prisma/seed-guard";

const LOCAL = "postgres://user@localhost:5432/bhendi_bazaar_dev";
const PROD = "postgres://user:pw@db.prisma.io:5432/c3098705b9662aaaed520c22b20f3e19";
const OFFICE = "postgres://user@localhost:5432/core_engine_db";

/** The one combination that is allowed, as a baseline the cases vary from. */
const allowed: SeedEnv = { DATABASE_URL: LOCAL, SEED_ALLOW_DESTRUCTIVE: "1" };

describe("seedTargetRefusal", () => {
  it("allows the allowlisted local development database", () => {
    expect(seedTargetRefusal(allowed)).toBeNull();
  });

  it("refuses a cloud database, destructive flag or not", () => {
    expect(seedTargetRefusal({ ...allowed, DATABASE_URL: PROD })).toContain("not a local database");
    expect(seedTargetRefusal({ DATABASE_URL: PROD })).not.toBeNull();
  });

  it("refuses another database on this machine's own Postgres", () => {
    // localhost is not a blank cheque: unrelated work databases live there too.
    expect(seedTargetRefusal({ ...allowed, DATABASE_URL: OFFICE })).toContain("core_engine_db");
  });

  it("refuses without the destructive flag, even on the right database", () => {
    expect(seedTargetRefusal({ DATABASE_URL: LOCAL })).toContain("SEED_ALLOW_DESTRUCTIVE");
    expect(seedTargetRefusal({ DATABASE_URL: LOCAL, SEED_ALLOW_DESTRUCTIVE: "true" })).not.toBeNull();
  });

  describe("in a deployed environment, nothing is enough", () => {
    // The strongest case: someone sets every variable that would allow a wipe
    // locally. Detection of the environment itself must still refuse.
    const armed: SeedEnv = {
      DATABASE_URL: PROD,
      SEED_ALLOW_DESTRUCTIVE: "1",
      SEED_ALLOWED_DATABASE_URL: PROD,
    };

    it.each([
      ["VERCEL", { VERCEL: "1" }],
      ["VERCEL_ENV", { VERCEL_ENV: "production" }],
      ["a preview deployment", { VERCEL_ENV: "preview" }],
      ["CI", { CI: "true" }],
      ["NODE_ENV=production", { NODE_ENV: "production" }],
    ])("refuses when %s is set", (_label, marker) => {
      const refusal = seedTargetRefusal({ ...armed, ...marker });
      expect(refusal).toContain("deployed or CI environment");
    });

    it("refuses even pointed at the local database", () => {
      expect(seedTargetRefusal({ ...allowed, VERCEL: "1" })).toContain("deployed or CI");
    });
  });

  it("an exactly-named cloud development database is allowed, and only that one", () => {
    const devCloud = "postgres://user:pw@db.prisma.io:5432/853a23bf2ee1a573add54d7a3";
    expect(
      seedTargetRefusal({
        DATABASE_URL: devCloud,
        SEED_ALLOW_DESTRUCTIVE: "1",
        SEED_ALLOWED_DATABASE_URL: devCloud,
      })
    ).toBeNull();
    // Same host, different database — the whole point of matching the full URL.
    expect(
      seedTargetRefusal({
        DATABASE_URL: PROD,
        SEED_ALLOW_DESTRUCTIVE: "1",
        SEED_ALLOWED_DATABASE_URL: devCloud,
      })
    ).toContain("does not match");
  });

  it("refuses an unset or unparseable DATABASE_URL rather than guessing", () => {
    expect(seedTargetRefusal({ SEED_ALLOW_DESTRUCTIVE: "1" })).toContain("not set");
    expect(
      seedTargetRefusal({ DATABASE_URL: "not-a-url", SEED_ALLOW_DESTRUCTIVE: "1" })
    ).toContain("not a parseable URL");
  });

  it("fails closed on an unrecognised host — a denylist would fail open here", () => {
    for (const host of ["db.prisma.io", "ep-cool-name.neon.tech", "some-new-provider.io"]) {
      expect(
        seedTargetRefusal({
          DATABASE_URL: `postgres://u:p@${host}:5432/app`,
          SEED_ALLOW_DESTRUCTIVE: "1",
        })
      ).not.toBeNull();
    }
  });
});
