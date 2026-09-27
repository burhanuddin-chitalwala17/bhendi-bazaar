/**
 * The queue is a table in our Postgres, written in the caller's transaction
 * (worker-foundation R2, A2; ADR-0038 D2), and its schema sits beside Prisma's without
 * Prisma noticing (ADR-0038's open consequence, closed here).
 *
 * Owns its fixtures: needs a migrated schema and nothing else, so it can run in CI's
 * throwaway database as well as locally.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { ZodError } from "zod";
import { isDisposableDb } from "../helpers/test-db";
import { JOBS_QUEUE, JOBS_SCHEMA } from "@server/shared/jobs/jobs.config";

const ROOT = resolve(__dirname, "../..");

describe.skipIf(!isDisposableDb)("enqueue inside a transaction (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let enqueue: typeof import("@server/shared/jobs").enqueue;
  let pingJob: typeof import("@server/shared/jobs/ping.job").pingJob;
  const marker = `jobs-enqueue-test-${Date.now()}`;

  const countMarked = async () => {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'note' = $2`,
      JOBS_QUEUE,
      marker,
    );
    return Number(rows[0].n);
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ enqueue } = await import("@server/shared/jobs"));
    ({ pingJob } = await import("@server/shared/jobs/ping.job"));
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      `DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'note' = $2`,
      JOBS_QUEUE,
      marker,
    );
  });

  it("commits the job with the transaction", async () => {
    const id = await prisma.$transaction((tx) => enqueue(tx, pingJob, { note: marker }));
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await countMarked()).toBe(1);
  });

  it("leaves no job when the transaction rolls back", async () => {
    const before = await countMarked();
    await expect(
      prisma.$transaction(async (tx) => {
        await enqueue(tx, pingJob, { note: marker });
        throw new Error("business rule failed after enqueue");
      }),
    ).rejects.toThrow(/business rule/);
    expect(await countMarked()).toBe(before);
  });

  it("refuses a payload the job's schema rejects, before touching the queue", async () => {
    const before = await countMarked();
    await expect(
      prisma.$transaction((tx) =>
        enqueue(tx, pingJob, { note: "x".repeat(201) } as { note: string }),
      ),
    ).rejects.toThrow(ZodError);
    expect(await countMarked()).toBe(before);
  });

  it("a beat records how much finished in the last day", async () => {
    const { heartbeatRepository } = await import("@server/shared/jobs/heartbeat.repository");
    const environment = `test-${Date.now().toString(36)}`;
    try {
      await heartbeatRepository.beat({ environment, version: "test" });
      const row = await heartbeatRepository.read(environment);
      expect(row).toMatchObject({ environment, version: "test" });
      expect(row?.completedDay).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(row?.completedDay)).toBe(true);
    } finally {
      await prisma.workerHeartbeat.deleteMany({ where: { environment } });
    }
  });

  it("is invisible to Prisma Migrate: the pgboss schema causes no drift", () => {
    // Exit code 0 means "no difference" between the live database and the datamodel.
    const status = (() => {
      try {
        execFileSync(
          "npx",
          ["prisma", "migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"],
          { cwd: ROOT, env: { ...process.env, MIGRATE_DATABASE_URL: process.env.DATABASE_URL }, stdio: "pipe" },
        );
        return 0;
      } catch (error) {
        return (error as { status?: number }).status ?? 1;
      }
    })();
    expect(status, "Prisma sees drift with the pgboss schema present; ADR-0038 assumed it would not").toBe(0);
  });
});
