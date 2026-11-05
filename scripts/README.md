# Scripts

- **`backfill-media-assets.ts`** — brings every image already stored under the media library's record (`server/catalog/media-backfill.ts` does the work; the script is the CLI). Dry run by default, `--write` to apply; idempotent. [OPERATIONS.md](../docs/OPERATIONS.md) has when to run it.
- **`flipkart-listing-probe.ts`** — which of Flipkart's listing calls a shop's connection may use: status and field names per call, never the token. Read-only on Flipkart; it may renew the stored token. Written for the 404 the first live Flipkart read hit (channel-import, 2026-10-21).
- **`docs-index.mjs`** — renders the index tables in `docs/adr/README.md` and `docs/specs/README.md` from the files they index; `npm run docs:index` rewrites, `--check` reports. `tests/unit/docs-integrity.test.ts` runs the check as a gate, so a hand-edited row cannot survive CI.

## Exporting pg-boss's schema

The queue's schema is a Prisma migration, not something the library applies at runtime
([ADR-0038](../docs/adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md) D1). It was produced by calling pg-boss's exported `getConstructionPlans("pgboss")` once
and writing the result into `prisma/migrations/20260926100000_worker_foundation/migration.sql`.
Upgrading pg-boss: call `getMigrationPlans("pgboss", <current version>)` the same way and put the
output in a new migration. No script is kept for a step that runs once per library upgrade.

## `survey-catalogue.sql` — reading the live catalogue before migrating it

`SELECT` only; it writes nothing, locks nothing and prints no credential. It exists because the
listing-vocabulary migration cannot be designed against the dev database: that one was seeded
from the old product form, so it shows what the seed invented rather than what the shop actually
typed.

```bash
psql "$(grep -oE '^DATABASE_URL="[^"]+"' .env.prod | sed 's/^DATABASE_URL="//; s/"$//')" \
  -f scripts/survey-catalogue.sql > /tmp/catalogue-survey.txt
```

Seven questions, each feeding a decision the migration has to make: how much there is, what the
category tree looks like and what hangs off each node, what `sizes` and `colors` actually hold
per category, how many of the stored colours the vocabulary already knows the word for, how many
products a colour-axis migration would produce, how many products vary on both at once, and what
`ProductStock` holds — the one part that cannot be derived, because one stock number covers every
colour today and splitting it is a decision rather than a sum.

Delete it once the migration has run. It answers a question asked once.

## Why there is nothing else here

Images live in Cloudflare R2 ([ADR-0028](../docs/adr/0028-images-live-in-cloudflare-r2.md)), reached
only through `server/catalog/object-store.ts`. Four scripts written against the retired Vercel Blob
store were deleted as that move completed:

- **`upload-images.ts`** — uploaded local folders to Blob for seeding. Superseded: uploads go through the object-store seam, and images are normalised on the way in ([ADR-0026](../docs/adr/0026-images-are-delivered-through-the-optimizer.md)), which this predated.
- **`backfill-blob-images.ts`** — re-encoded stored originals in place. Its premise is gone twice over: the old store cannot be read while blocked, and nothing new is being written there.
- **`cleanup-orphan-blobs.ts`** — deleted unreferenced blobs to reclaim storage. Pointless against a store being abandoned, and R2's allowance is ten times larger. Its one hard-won idea — that the keep-set is the **union across every database sharing the store**, or you delete the other environment's live images — is recorded in [PR-106] and worth re-reading before writing anything similar for R2.
- **`migrate-blob-store.ts`** — copied blobs between stores and repointed the eight URL columns. Deleted with `@vercel/blob` once the old store began answering `403` to its own contents: with the bytes unreadable there was nothing left to migrate, only rows still holding a dead URL. [OPERATIONS.md](../docs/OPERATIONS.md) has the query that finds those, and the remedy (re-upload through the admin UI).

A one-off task belongs in a data migration if production needs it, and in a throwaway otherwise —
[Invariant 7](../CLAUDE.md) is the rule about which.
