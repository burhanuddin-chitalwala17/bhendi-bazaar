# TRD — worker-foundation

- **Status:** ✅ Implemented — PR-150, PR-154, PR-210 (2026-09-29)
- **Domain:** cross-domain (`server/shared/jobs/`, `worker/`)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-04
- **References:** [spec.md](spec.md), [ADR-0038](../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0037](../../adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md), [ADR-0014](../../adr/0014-deploys-run-their-own-migrations.md), [ADR-0036](../../adr/0036-a-files-reasons-to-change-are-a-decision.md), [INTEGRATIONS.md](../../INTEGRATIONS.md) (Prisma Postgres, Vercel)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

pg-boss owns a `pgboss` schema in the application's Postgres, applied by a Prisma migration rather than at runtime. One seam, `server/shared/jobs/`, is the only importer of the library: it exposes a typed enqueue that takes the caller's Prisma transaction, and a handler registry. A second entrypoint, `worker/`, builds the same server code into a container that registers every domain's handlers and runs them. The container is deployed by the existing GitHub Actions pipeline to a machine provisioned from a script in `infra/worker/`.

## Technical decisions

- **D1 — The queue schema is a Prisma migration, generated once from pg-boss's own SQL export**, and pg-boss runs with runtime migration disabled. The `pgboss` schema is not listed in the Prisma schema; a test proves Prisma Migrate reports no drift with it present, closing [ADR-0038](../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)'s open consequence. Requires the role to create a schema, confirmed in PR 1 against the dev database first.
- **D2 — `server/shared/jobs/` is the seam and the registry.** `enqueue(tx, job)` uses pg-boss's Prisma adapter so the job commits with the caller's transaction (spec R2). A job type is declared once with a Zod payload schema; the worker parses every payload before running it, because a job body is untrusted input like any request body ([CLAUDE.md](../../../CLAUDE.md) Invariant 4). No other module imports pg-boss.
- **D3 — One queue, one poll loop, types dispatched inside the job.** Per-org fairness is pg-boss groups keyed by org id with a declared group concurrency (spec R4, A8). Notify is on over one dedicated direct connection with a five-minute backstop poll; the pool is sized at three. The configuration is one declared object that is both what pg-boss receives and what a unit test reads; the test computes the idle chatter from it against the declared daily ceiling (spec R8) and asserts that every interval the library exposes is set explicitly, so a shortened timer or an omitted one that would fall back to a library default fails CI before it costs money.
  *Amended 2026-11-04 (ops review):* pg-boss's listener wakes every loop on the queue, so one job cost an empty fetch per idle loop (measured: 8 statements per job). `jobs.work.ts` makes a new job wake one idle loop, and a loop that takes a job wakes one idle sibling, so a burst still spreads (measured: 4 per job, 40 jobs in 1.5 s at about 2 each). It overrides one pg-boss method; `tests/unit/jobs-wake.test.ts` fails if an upgrade moves what that relies on.
- **D4 — The worker is a composition root.** `worker/main.ts` imports each domain's `*.jobs.ts` and registers them; it is the one file allowed to reach every domain, declared here as [ADR-0036](../../adr/0036-a-files-reasons-to-change-are-a-decision.md) requires. Handlers live in their domains and call services, never repositories of other domains.
- **D5 — Heartbeat is a row, read by admin.** The row also carries how many jobs finished in the 24 hours before the beat, counted in the same statement, because a card showing only waiting, running and failed read as idle right after work was done. Every five minutes the worker upserts one row per environment with its version and the queue's counts; an admin card reads it through the seam. Red past ten minutes (spec A5). Failed jobs are pg-boss's dead-letter queue, listed on the same card with a re-run action that writes an audit entry (spec R11).
- **D6 — The site uses the pooled connection string; the worker uses the direct one.** Notify needs a session, and the direct allowance is five ([INTEGRATIONS.md](../../INTEGRATIONS.md)); the site's functions must not compete for them. Both are read through the application's own variable names ([ADR-0037](../../adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md) D4).
- **D7 — One image, built in CI, pushed to the GitHub container registry, pulled by the machine.** The deploy job already in `.github/workflows/ci.yml` gains a step that, after the site deploys, connects over SSH and restarts the compose stack on the new tag. Secrets reach the machine as an environment file written by that step from repository secrets, never baked into the image.
- **D8 — The machine is a script.** `infra/worker/provision.sh` and a cloud-init file install Docker, turn on unattended security updates, close every inbound port but SSH by key, set log rotation and the compose stack as a restart-always service. Idempotent; re-running on a fresh VM is the rebuild (spec R7, A4). The current provider and its idle-reclaim rule are documented in [OPERATIONS.md](../../OPERATIONS.md), not in the script's logic.
- **D9 — Staging is the same image with a different environment file**, started by hand and stopped after use (spec R6), so it spends no operations while idle.
- **D10 — The reconcile cron moves last.** The worker gains the reconciliation schedule in PR 3; the Vercel cron entry is deleted only after the worker's run is observed in the ledger for a week (spec R9).
- **D11 — Recent jobs are read from the queue table when admin asks, never stored and never on the page by default.** The card's list opens on a tap and fetches the newest twenty on both queues through an admin route; a count says a job is stuck, the list says which and why. One query per open keeps the dashboard's own cost at the heartbeat row.

## Packages

`pg-boss`, recorded in [DEPENDENCIES.md](../../DEPENDENCIES.md). Nothing else; ffmpeg and similar arrive with the specs that need them.

## UI approach

One admin card, server-rendered: last seen, waiting, failed, a re-run action per failed job. Phone-sized like the rest of admin.

## Data model

[MIGRATION] The `pgboss` schema, unmanaged by Prisma; a `WorkerHeartbeat` table in the public schema.

## API / contract changes

None public. The admin card's DTO is internal.

## Test plan

Per [TESTING.md](../../TESTING.md): unit — payload parsing refuses a malformed job, the idle-chatter ceiling from configured intervals (mutation-tested by shortening one), group concurrency config; integration — enqueue rolls back with the transaction, a killed job re-runs once with an idempotent effect, Prisma Migrate reports no drift beside the `pgboss` schema; operational — a day of measured operations on the dev database recorded in the CHANGELOG entry (spec A6).

## Delivery (PRs)

1. Seam, migration, registry, `npm run worker` locally, a no-op job and its admin card. No machine yet; A1, A2, A3 proven locally.
2. Image, provisioning script, deploy step, production worker live, heartbeat green. A4 to A7.
3. Reconciliation schedule on the worker; cron retired after observation.

## Open questions

None. The machine's home region is Mumbai, matching the database (owner, 2026-09-25; recorded in [OPERATIONS.md](../../OPERATIONS.md)). Oracle's free ARM shape is frequently out of capacity there; the free AMD shape with 1 GB is sufficient for this worker if so.
