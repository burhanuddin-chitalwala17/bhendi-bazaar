/**
 * Whether this destructive seed may run against the configured database
 * (CLAUDE.md Invariant 7).
 *
 * `prisma/seed.ts` deletes every table, so it refuses unless the target has been
 * named as a seed target. The decision is pure and lives here so it can be
 * tested; the seed calls it as its first statement, so the protection still
 * holds when someone types `npx prisma db seed` directly — a wrapper script
 * would not.
 *
 * Hostname alone cannot decide this: Prisma Postgres serves development and
 * production from the same `db.prisma.io`, so allowing that host would allow
 * production. Nor is a local host a blank cheque — this machine's Postgres also
 * holds unrelated work databases — so a local target must additionally be a
 * database *named* in the allowlist. Everything else must be named exactly by
 * `SEED_ALLOWED_DATABASE_URL`. Every check is an allowlist: an unrecognised URL
 * is refused, because a denylist fails open on the one host nobody listed.
 */

export const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** The only local databases this destructive seed may target. */
export const LOCAL_SEED_DATABASES = new Set(["bhendi_bazaar_dev"]);

export interface SeedEnv {
  DATABASE_URL?: string;
  SEED_ALLOW_DESTRUCTIVE?: string;
  SEED_ALLOWED_DATABASE_URL?: string;
  /** Vercel sets these on every build and runtime, local machines do not. */
  VERCEL?: string;
  VERCEL_ENV?: string;
  CI?: string;
  NODE_ENV?: string;
  /** So `process.env` is assignable without a cast at the call site. */
  [key: string]: string | undefined;
}

/** Why this seed must not run, or null when it may. */
export function seedTargetRefusal(env: SeedEnv): string | null {
  // Checked first and unconditionally. `SEED_ALLOWED_DATABASE_URL` names one
  // database by its exact URL, which is enough to distinguish two databases on
  // one host — but it is only ever as safe as "nobody set it in Vercel", and a
  // rule people must remember is not a control. A deployed environment is
  // detectable, so detect it: this can only ever refuse more, never allow more.
  if (env.VERCEL || env.VERCEL_ENV || env.CI || env.NODE_ENV === "production") {
    return (
      "Refusing to seed: this looks like a deployed or CI environment " +
      `(${["VERCEL", "VERCEL_ENV", "CI"].filter((key) => env[key as keyof SeedEnv]).join(", ") ||
        "NODE_ENV=production"}). ` +
      "This seed deletes every table and is development-only — reference data " +
      "production needs ships as a data migration instead."
    );
  }

  if (!env.DATABASE_URL) {
    return "DATABASE_URL is not set — refusing to seed.";
  }

  // Wiping is a second intent, deliberately separate from seeding.
  if (env.SEED_ALLOW_DESTRUCTIVE !== "1") {
    return "This seed deletes every table. Re-run with SEED_ALLOW_DESTRUCTIVE=1 if that is what you want.";
  }

  let url: URL;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    return "DATABASE_URL is not a parseable URL — refusing to seed.";
  }

  if (env.SEED_ALLOWED_DATABASE_URL && env.SEED_ALLOWED_DATABASE_URL === env.DATABASE_URL) {
    return null;
  }

  if (LOCAL_DB_HOSTS.has(url.hostname)) {
    const database = url.pathname.replace(/^\//, "");
    if (LOCAL_SEED_DATABASES.has(database)) {
      return null;
    }
    return (
      `Refusing to seed: "${database}" on ${url.hostname} is not an allowlisted seed target. ` +
      "This machine's local Postgres hosts databases this seed must never wipe; " +
      `only ${[...LOCAL_SEED_DATABASES].join(", ")} may be seeded here.`
    );
  }

  return (
    `Refusing to seed: "${url.hostname}" is not a local database, and DATABASE_URL does not match ` +
    "SEED_ALLOWED_DATABASE_URL. Set SEED_ALLOWED_DATABASE_URL to the exact development " +
    "connection string in your local .env — never in a deployment environment."
  );
}

/** Throws unless the configured database may be wiped and re-seeded. */
export function assertSeedTargetIsAllowed(env: SeedEnv = process.env): void {
  const refusal = seedTargetRefusal(env);
  if (refusal) throw new Error(refusal);
}
