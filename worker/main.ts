/**
 * The worker: a second entrypoint that runs jobs the site writes (ADR-0038 D3).
 *
 * This file is a composition root — the one place allowed to reach every domain
 * (ADR-0036) — because its whole job is to register each domain's handlers and start the
 * queue. It holds no logic of its own; a handler lives in the domain that owns the work.
 */
// A script, not the Next.js runtime: the env file is loaded here, as the seed does. In the
// container there is none and the environment comes from compose; that is fine.
import "dotenv/config";
import { PgBoss } from "pg-boss";
import { appEnv } from "@server/shared/app-env";
import { resolveJob, registeredJobTypes } from "@server/shared/jobs/jobs.registry";
import { heartbeatRepository } from "@server/shared/jobs/heartbeat.repository";
import {
  HEARTBEAT_INTERVAL_SECONDS,
  JOBS_GROUP_CONCURRENCY,
  JOBS_INTERVALS,
  JOBS_LOCAL_CONCURRENCY,
  JOBS_NOTIFY_HEARTBEAT_MS,
  JOBS_POOL_MAX,
  JOBS_QUEUE,
  JOBS_SCHEMA,
  JOBS_SWITCHES,
} from "@server/shared/jobs/jobs.config";
// Job registrations. Each domain adds its `*.jobs.ts` here and nowhere else.
import "@server/shared/jobs/ping.job";

const VERSION = process.env.WORKER_VERSION ?? "dev";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function main() {
  const environment = appEnv();
  const boss = new PgBoss({
    connectionString: required("DATABASE_URL"),
    schema: JOBS_SCHEMA,
    max: JOBS_POOL_MAX,
    application_name: `worker-${environment}`,
    notifyHeartbeatIntervalMs: JOBS_NOTIFY_HEARTBEAT_MS,
    notifyHeartbeatTimeoutMs: JOBS_NOTIFY_HEARTBEAT_MS * 2,
    ...JOBS_SWITCHES,
    ...JOBS_INTERVALS,
  });

  boss.on("error", (error) => console.error("[worker] error", error));
  boss.on("warning", (warning) => console.warn("[worker] warning", warning.message));

  await boss.start();

  await boss.work(
    JOBS_QUEUE,
    {
      localConcurrency: JOBS_LOCAL_CONCURRENCY,
      groupConcurrency: JOBS_GROUP_CONCURRENCY,
      pollingIntervalSeconds: JOBS_INTERVALS.pollingIntervalSeconds,
      notifyPollingIntervalSeconds: JOBS_INTERVALS.notifyPollingIntervalSeconds,
    },
    // pg-boss hands a batch; batchSize is 1, so this is one job, but the type is honest.
    async (jobs) => {
      for (const job of jobs) {
        const { definition, payload } = resolveJob(job.data);
        await definition.handler({ jobId: job.id, payload });
      }
    },
  );

  const beat = async () => {
    try {
      await heartbeatRepository.beat({ environment, version: VERSION });
    } catch (error) {
      console.error("[worker] heartbeat failed", error);
    }
  };
  await beat();
  const heartbeat = setInterval(beat, HEARTBEAT_INTERVAL_SECONDS * 1000);

  console.log(
    `[worker] ${environment} ${VERSION} up; job types: ${registeredJobTypes().join(", ")}`,
  );

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal}, draining`);
    clearInterval(heartbeat);
    // Finish what is running, take nothing new; a job that outlives the grace period is
    // re-fetched after expiry, which is why every handler is idempotent (ADR-0038 D4).
    await boss.stop({ graceful: true, timeout: 30_000 });
    process.exit(0);
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("[worker] failed to start", error);
  process.exit(1);
});
