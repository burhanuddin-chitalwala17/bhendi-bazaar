# Scripts

| Script | What it does |
|---|---|
| `migrate-blob-store.ts` | Copies blobs out of the retired Vercel Blob store and repoints the database ([OPERATIONS.md](../docs/OPERATIONS.md#moving-to-a-different-blob-store)) |

## Why there is only one

Images live in Cloudflare R2 ([ADR-0028](../docs/adr/0028-images-live-in-cloudflare-r2.md)). Three scripts written against Vercel Blob were deleted when that landed:

- **`upload-images.ts`** — uploaded local folders to Blob for seeding. Superseded: uploads now go through `server/catalog/object-store.ts`, and images are normalised on the way in ([ADR-0026](../docs/adr/0026-images-are-delivered-through-the-optimizer.md)), which this predated.
- **`backfill-blob-images.ts`** — re-encoded stored originals in place. Its premise is gone twice over: the old store cannot be read while blocked, and nothing new is being written there.
- **`cleanup-orphan-blobs.ts`** — deleted unreferenced blobs to reclaim storage. Pointless against a store being abandoned, and R2's allowance is ten times larger. Its one hard-won idea — that the keep-set is the **union across every database sharing the store**, or you delete the other environment's live images — is recorded in [PR-106] and worth re-reading before writing anything similar for R2.

`migrate-blob-store.ts` stays only as long as the old store holds something not reproducible from local originals. Delete it, and `@vercel/blob` with it, once the catalogue is confirmed intact on R2.
