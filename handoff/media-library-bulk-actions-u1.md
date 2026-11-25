# Handoff — media-library/bulk-actions U1 (bulk routes)

- **Status:** In progress — stopped for an account switch, no code written yet
- **Last pushed sha:** (see `git log origin/claude/media-library-build -1`)
- **Goal:** TRD Delivery U1: schemas (`ids` ≤100, de-duplicated), `retireMany`, `setTagMany`, `downloadLinks` (500 MB cap, `ZIP_LIMIT_BYTES`), `findManyForOrg`, `addTag` widened to exclude RETIRED, three `orgMediaApiClient` methods, `docs/contracts/catalog.md` lines. No UI. Closes A3 (server half), A4, A5, A6; Q3, Q4, Q5, Q10 (Q11 filename part).

## Done
- Read spec, decisions, TRD, viewer U3 handoff. Branch fast-forwarded to d160044e; `npm ci` done; repo unshallowed.

## Findings so far (read before coding)
- `presignDownload` (`server/catalog/object-store.ts:268`) signs with a fixed `DOWNLOAD_TTL_SECONDS = 300` (5 min). TRD D4 wants 15 min for bulk links → add an optional `ttlSeconds` param (default 300) and pass `15 * 60` from bulk.
- `downloadFilename(orgCode, assetId, mimeType)` and `downloadLink` live in `server/catalog/media-download.ts`; put `downloadLinks` + `ZIP_LIMIT_BYTES` there (or a new `media-bulk.ts`), and `retireMany` / `setTagMany` in a new `server/catalog/media-bulk.ts` that calls `mediaAssetService.retire` / `setTag` per id. Re-export through `mediaAssetService` the way `downloadLink` is (line 14 / 251) — keep the service byte-neutral-ish (pinned at 27 KB, currently 26.8 KB).
- `media-asset.repository.ts` is 29216 B, pinned at 29 KB (29696 B): ~480 B headroom for `findManyForOrg` (select id, kind, state, objectKey, bytes, mimeType; `where { id: { in }, orgId, state: { not: PENDING } }`) and the `addTag` widening (`state: { not: MediaAssetState.RETIRED }` at line ~545). If over, trim a comment in that file rather than re-pinning.
- Single-asset patterns: `retire` (service:307) throws `NotFoundError` / `ConflictError`, returns early for already RETIRED → retireMany must read the row first to count `alreadyRetired`. `setTag` service:276; repo `setTag` is the CAS loop (repo:555).
- Route patterns: `src/app/api/org/[orgId]/media/[assetId]/tags/route.ts` (withOrg + schema.parse). New routes: `media/retire`, `media/tags`, `media/download-links` under `src/app/api/org/[orgId]/media/` — note `[assetId]` sibling dynamic segment; static segments win in Next routing.
- Schemas go in `src/lib/validation/schemas/media-library.schema.ts`: `ids: z.array(z.string().min(1).max(64)).min(1).max(100).transform(dedupe)`.
- 422 over the cap: `DomainError(msg, { status: 422 })` with details `{ totalBytes, limitBytes }` — check `DomainError`'s details option in `server/shared/domain-error.ts`.

## Next steps
1. Failing tests first: unit `tests/unit/media-bulk-schema.test.ts` (101 refused, dedupe); integration `tests/integration/media-bulk.test.ts` per TRD Test plan (A4 retire 5/2 used + renditions, A6 other org notFound, A5 tag mix, remove CAS, A3 download-links 422 / own rows only / `noFile: link`). Names carry `(spec A<n>)`.
2. Implement repo, module, service re-exports, three routes, `orgMediaApiClient` methods (route-reachability gate needs the caller), `docs/contracts/catalog.md`.
3. `npm run docs:index`; gate; integration; mutations: the `>` in the 500 MB comparison and the `orgId` in `findManyForOrg` / `addTag` where.
4. Q3, Q4, Q5, Q10 → `implemented (unit 1)` in decisions.md; /bb-review in a fresh subagent; commit `catalog: bulk retire, tag and download-links routes [CONTRACT]`; push; handoff Done with notes for U2.

## Resume
```
npm ci; git fetch --unshallow   # if shallow
env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate
service postgresql start; createdb -U postgres bhendi_bazaar_ci  # password 'postgres'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bhendi_bazaar_ci npx prisma migrate deploy
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bhendi_bazaar_ci npm run test:integration
/bb-build media-library/bulk-actions unit 1
```
