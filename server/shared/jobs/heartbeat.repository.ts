import { states } from "pg-boss";
import { prisma } from "@server/shared/prisma";
import { JOBS_FAILED_QUEUE, JOBS_QUEUE, JOBS_SCHEMA } from "./jobs.config";

export interface HeartbeatInput {
  environment: string;
  version: string;
}

/**
 * The one writer and reader of `WorkerHeartbeat` (ADR-0003). The beat is one statement on
 * purpose: counts and row in a single billed operation (ADR-0038 D8).
 */
export const heartbeatRepository = {
  async beat(input: HeartbeatInput): Promise<void> {
    await prisma.$executeRawUnsafe(
      // pg-boss keeps a completed job in the job table for its retention period, which is longer
      // than the day counted here, so one table answers.
      `INSERT INTO "WorkerHeartbeat" ("environment", "version", "lastSeenAt", "waiting", "active", "failed", "completedDay")
       SELECT $1, $2, now(),
         (SELECT count(*)::int FROM ${JOBS_SCHEMA}.job WHERE name = $3 AND state IN ($5, $6)),
         (SELECT count(*)::int FROM ${JOBS_SCHEMA}.job WHERE name = $3 AND state = $7),
         (SELECT count(*)::int FROM ${JOBS_SCHEMA}.job WHERE name = $4 AND state IN ($5, $6)),
         (SELECT count(*)::int FROM ${JOBS_SCHEMA}.job WHERE name = $3 AND state = $8 AND completed_on > now() - interval '24 hours')
       ON CONFLICT ("environment") DO UPDATE SET
         "version" = EXCLUDED."version",
         "lastSeenAt" = EXCLUDED."lastSeenAt",
         "waiting" = EXCLUDED."waiting",
         "active" = EXCLUDED."active",
         "failed" = EXCLUDED."failed",
         "completedDay" = EXCLUDED."completedDay"`,
      input.environment,
      input.version,
      JOBS_QUEUE,
      JOBS_FAILED_QUEUE,
      states.created,
      states.retry,
      states.active,
      states.completed,
    );
  },
  async read(environment: string) {
    return prisma.workerHeartbeat.findUnique({ where: { environment } });
  },
};
