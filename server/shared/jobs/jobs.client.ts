import { PgBoss } from "pg-boss";
import { JOBS_INTERVALS, JOBS_SCHEMA, JOBS_SWITCHES } from "./jobs.config";

/**
 * The web app's handle on the queue: enqueue inside its own transactions, read and re-run the
 * failed queue; never supervise, schedule or migrate (worker-foundation D2). It keeps a pool of
 * one because pg-boss's install check reads a `regclass` Prisma cannot deserialise; the pool
 * idles closed in seconds, and the enqueue itself runs on the caller's Prisma transaction.
 */
let client: Promise<PgBoss> | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function jobsClient(): Promise<PgBoss> {
  client ??= (async () => {
    const boss = new PgBoss({
      connectionString: required("DATABASE_URL"),
      max: 1,
      application_name: "web-jobs",
      schema: JOBS_SCHEMA,
      supervise: false,
      schedule: false,
      migrate: false,
      createSchema: JOBS_SWITCHES.createSchema,
      useListenNotify: false,
      queueCacheIntervalSeconds: 3600,
      monitorIntervalSeconds: JOBS_INTERVALS.monitorIntervalSeconds,
    });
    boss.on("error", (error) => console.error("[jobs] client error", error));
    await boss.start();
    return boss;
  })();
  return client;
}
