# Scripts

Empty, deliberately.

## Why there is nothing here

Images live in Cloudflare R2 ([ADR-0028](../docs/adr/0028-images-live-in-cloudflare-r2.md)), reached
only through `server/catalog/object-store.ts`. Four scripts written against the retired Vercel Blob
store were deleted as that move completed:

- **`upload-images.ts`** — uploaded local folders to Blob for seeding. Superseded: uploads go through the object-store seam, and images are normalised on the way in ([ADR-0026](../docs/adr/0026-images-are-delivered-through-the-optimizer.md)), which this predated.
- **`backfill-blob-images.ts`** — re-encoded stored originals in place. Its premise is gone twice over: the old store cannot be read while blocked, and nothing new is being written there.
- **`cleanup-orphan-blobs.ts`** — deleted unreferenced blobs to reclaim storage. Pointless against a store being abandoned, and R2's allowance is ten times larger. Its one hard-won idea — that the keep-set is the **union across every database sharing the store**, or you delete the other environment's live images — is recorded in [PR-106] and worth re-reading before writing anything similar for R2.
- **`migrate-blob-store.ts`** — copied blobs between stores and repointed the eight URL columns. Deleted with `@vercel/blob` once the old store began answering `403` to its own contents: with the bytes unreadable there was nothing left to migrate, only rows still holding a dead URL. [OPERATIONS.md](../docs/OPERATIONS.md) has the query that finds those, and the remedy (re-upload through the admin UI).

A one-off task belongs in a data migration if production needs it, and in a throwaway otherwise —
[Invariant 7](../CLAUDE.md) is the rule about which.
