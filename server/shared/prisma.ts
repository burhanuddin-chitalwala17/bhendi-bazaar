import { Prisma, PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// The pool is cached alongside the client, not just the client. Caching only the
// client means every hot reload builds a new Pool whose connections are never
// released, so a dev session slowly exhausts the server's connection limit.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === "production" ? 10 : 3,
    idleTimeoutMillis: 10_000,
    // Fail fast instead of hanging when the pool is saturated.
    connectionTimeoutMillis: 10_000,
  });

// PRISMA_LOG_QUERIES=1 prints every SQL statement — the measuring instrument for
// the billed-operations work. Dev-only diagnostics; never set in a deployment.
const logQueries = process.env.PRISMA_LOG_QUERIES === "1";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log: logQueries
      ? [{ emit: "event", level: "query" }, "error", "warn"]
      : ["error", "warn"],
  });

if (logQueries && !globalForPrisma.prisma) {
  (prisma as PrismaClient<{ log: [{ emit: "event"; level: "query" }] }>).$on(
    "query",
    (e) => console.log(`prisma:query ${e.query}`)
  );
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
  globalForPrisma.prisma = prisma;
}

/**
 * A typed value bound for a Prisma `Json` column. The JSON round-trip is what Prisma
 * does to the value anyway, and it strips `undefined` members exactly as
 * serialisation will — so the type says `InputJsonValue` because the value now
 * genuinely is one, rather than a cast asserting it.
 */
export function toJsonColumn<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}
