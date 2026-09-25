# Spec — worker-foundation

- **Summary:** The place where slow work goes: a queue in our Postgres, a worker we own, health in admin, a machine rebuilt by a script
- **Status:** ✅ Accepted — 2026-09-26
- **Domain:** cross-domain (`server/shared/jobs/`, `worker/`)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-09-25
- **References:** [trd.md](trd.md), [ADR-0038](../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0037](../../adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md), [ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md), [OPERATIONS.md](../../OPERATIONS.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

The place where slow work goes. A job the site writes down is picked up within a minute by a program that runs all the time on a machine we administer, runs it with no time limit, retries it if it fails, and reports its own health. No product feature lives here; every later feature adds a job to it.

## Why

Enhancing a photo, re-encoding a video, reading ten images for attributes, publishing to Instagram and syncing a marketplace are all slower than a web request may be, and all must outlive the browser tab that asked for them. [ADR-0038](../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md) decided the shape: a queue in our own database and a worker we own. This feature builds that shape once, with nothing in it, so that the uncertain steps — the account, the machine, the deploy, the budgets — are discovered on a no-op job rather than on the first feature that needs them.

## Requirements

- **R1** — A job the site writes starts within a minute, at any hour, with the browser gone.
- **R2** — A job is written in the same transaction as the record it concerns. A rolled-back record leaves no job; a committed job always has its record.
- **R3** — A failed job retries on a schedule, then parks where an operator can see it, read why it failed, and run it again. Nothing fails silently and nothing is lost.
- **R4** — Only a bounded number of jobs run at once for any one organisation. One seller's bulk upload cannot starve another.
- **R5** — The worker's health is visible in admin: when it was last seen, how many jobs wait, how many have failed. "Not seen for forty minutes" is a fact on a page, not a mystery.
- **R6** — There is a production worker on the production database and a staging worker on the dev database. The staging one runs only while someone is testing.
- **R7** — Losing the machine loses no data, and one script rebuilds it in under fifteen minutes. The machine holds nothing that is not also in Postgres or the object store.
- **R8** — The worker's own database traffic fits the operations budget: idle chatter under a declared ceiling per day, measured, not estimated ([ADR-0038](../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md) D8).
- **R9** — Schedules can run on the worker. The daily platform cron is retired only after the worker's own schedule has been observed firing on the same work.
- **R10** — No host name, vendor variable or plan limit appears in application code; the machine is a deployment fact recorded in operations ([ADR-0037](../../adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)).
- **R11** — Every operator action on a job — re-run, cancel — is recorded ([ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md)).

## Product acceptance

- **A1** — A no-op job is written from a page, the tab is closed, and the job is done within a minute.
- **A2** — A transaction that writes a record and a job, then fails, leaves neither.
- **A3** — The worker is killed mid-job; the job runs again and its effect happens exactly once.
- **A4** — The machine is deleted; the script rebuilds it and waiting jobs resume with nothing lost.
- **A5** — Stopping the worker turns its admin card red within ten minutes; starting it turns it green.
- **A6** — A day of idle worker is measured under the declared operations ceiling.
- **A7** — The same container runs on a laptop against the local database with no changes.
- **A8** — Twenty jobs for one organisation and one for another: the second organisation's job does not wait for the twenty.

## Out of scope (this feature)

- Any real job. Image enhancement, video transcoding, pre-rendering and the retirement sweep each arrive with their own spec and register a handler here.
- Pushing results to an open browser page. Pages poll for now.
- Self-hosting the database on the same machine — decided against for now; see the journey notes in [BACKLOG.md](../../BACKLOG.md).
