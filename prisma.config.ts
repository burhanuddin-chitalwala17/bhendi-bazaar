// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
  datasource: {
    /**
     * Migrations run against a *direct* connection, not the pooler.
     *
     * Prisma Migrate takes `pg_advisory_lock` so two deploys cannot migrate at
     * once, and an advisory lock is session-scoped. A transaction pooler
     * (`pooled.db.prisma.io`) gives each statement whichever backend session is
     * free, so the lock is taken on one session and looked for on another — it
     * can never be acquired, and `migrate deploy` dies on the 10s timeout with
     * P1002. The pooled URL stays correct for the running app, where many short
     * serverless connections are the point.
     *
     * MIGRATE_DATABASE_URL is the direct string (`db.prisma.io`, no `pooled.`),
     * set in the deployment environment. Unset locally, where DATABASE_URL is
     * already a direct connection.
     */
    url: process.env.MIGRATE_DATABASE_URL || env("DATABASE_URL"),
  },
});
