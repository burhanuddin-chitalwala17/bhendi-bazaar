import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { poolMax } from "@server/shared/pool-size";
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
    // Lower it (3-5) once DATABASE_URL is the pooled string (GTM B12); unset keeps today's numbers.
    max: poolMax(process.env.DATABASE_POOL_MAX, process.env.NODE_ENV === "production" ? 10 : 3),
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

// Re-exported so existing importers keep one path; the function lives in json.ts (no pool).
export { toJsonColumn } from "@server/shared/json";
