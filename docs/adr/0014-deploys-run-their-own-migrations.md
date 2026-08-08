# ADR-0014: Deploys run their own migrations

- **Date:** 2026-08-09
- **Status:** Accepted
- **Context:** Every `[MIGRATION]` release depended on a human running `npx prisma migrate deploy` against the right database at the right moment, and the CHANGELOG had to carry a reminder in every such entry. On a solo project the human and the deployer are the same person on different days: the failure mode is not ignorance but timing — code that expects a column going live minutes before the column exists. The pipeline gap was already tracked (Phase 4, "prisma migrate deploy in the pipeline") but nothing enforced it.
- **Decision:**
  1. `vercel.json` sets `"buildCommand": "npx prisma migrate deploy && next build"` — every Vercel build applies pending migrations to that environment's `DATABASE_URL` before compiling, and a failed migration fails the build.
  2. Consequently a merge to `main` **is** a production schema change, and a Preview build migrates whatever database the Preview environment points at. Both are accepted, not accidents.
  3. Manual `migrate deploy` remains only for local runs against a deployed database.
- **Alternatives considered:**
  - **Keep migrating manually** (status quo, and the textbook caution — "don't run migrations in the build"). Rejected: the caution guards against concurrent builds racing and against a build that migrates but then fails to ship. With one developer, sequential deploys, and `migrate deploy`'s forward-only, apply-in-order semantics (it never resets or drops), the race is theoretical while the schema-drift outage it prevents had to be actively managed on every `[MIGRATION]` release.
  - **A separate CI migration step before deploy.** The honest long-term shape, but there is no CI pipeline yet (Phase 4 not started); building one to host a single command inverts the effort. When blocking CI exists, moving the command there supersedes this ADR naturally.
  - **Prisma's own migrate-on-connect / runtime application.** Rejected: migrations at request time in a serverless runtime means N cold instances racing, and a failed migration surfaces as a customer-facing error instead of a failed build.
- **Consequences:**
  - ✅ Code and schema can no longer go live out of step; the CHANGELOG's per-entry "run migrate deploy" reminders become historical.
  - ✅ A destructive or broken migration stops the build instead of shipping code that 500s against the old schema.
  - ⚠️ Merging to `main` mutates the production schema with no separate confirmation step — a destructive migration must be caught at review, not at deploy.
  - ⚠️ Preview builds migrate the Preview database; if Preview ever points at a shared or production database, this becomes dangerous and the environment wiring must change first.
  - ⚠️ Build minutes now include a database round-trip; an unreachable database fails the build even for a docs-only change.
