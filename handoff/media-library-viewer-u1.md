# Handoff — media-library/viewer U1 (download route)

- **Status:** Done — commit 5ab6d8bd on `claude/media-library-build`.
- **Goal:** TRD Delivery U1: `presignDownload`, `mediaAssetService.downloadLink`, `GET|HEAD /api/org/[orgId]/media/[assetId]/download`, `orgMediaApiClient.canDownload`, the `docs/contracts/catalog.md` line. No UI.

## Done
- Route: GET 302 to a 300 s presigned R2 GET with a signed `response-content-disposition` (`<org code>-<asset id>.<ext>`), `Cache-Control: no-store`. HEAD answers the same status unredirected (Next's auto-HEAD would follow GET's redirect, so it is explicit).
- Refusals: 404 other org / unknown id / PENDING; 410 retired file swept; 422 VIDEO_EMBED.
- Logic in `server/catalog/media-download.ts`; `mediaAssetService.downloadLink` delegates in one line (`media-asset.service.ts` is pinned by `tests/unit/file-size.test.ts`).
- `feature-registry.test.ts` now scans HEAD; GET and HEAD lines registered `core: FREE`.
- Tests: `tests/unit/object-store.test.ts` (+2), `tests/unit/media-download.test.ts` (5), `tests/integration/media-download.test.ts` (7). Gate and integration suite green; seven guard mutations recorded in the commit body.
- /bb-review (fresh context): no blockers; six findings fixed. Q5 → implemented (unit 1). TRD D3 map gained jpg and gif.

## For U2 (download in the side sheet)
- Call `orgMediaApiClient.canDownload(orgId, assetId)` first (HEAD). It rejects with an `ApiError` whose `.status` is 404/410/422 and carries no message body — choose the ux toast by status.
- On success, navigate to `/api/org/${orgId}/media/${assetId}/download`. Add the href helper to `orgMediaApiClient` in U2 (not built in U1).
- Server copy constants `DOWNLOAD_FILE_GONE` / `DOWNLOAD_NO_FILE_FOR_YOUTUBE` are in `server/catalog/media-download.ts`; UI copy goes in `media-library-copy.ts` (`MEDIA_VIEWER_COPY`).
- Q8 and Q10 stay `decided` until U2 ships their UI.

## Surprises
- These containers export `NEXT_PUBLIC_APP_URL`/`NEXTAUTH_URL`; `tests/unit/open-shop-page.test.tsx` fails on a clean tree because of it. Run `env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate`.

## Resume
```
npm ci
git fetch --unshallow   # if shallow; docs-integrity needs history
service postgresql start
su postgres -c "createdb bhendi_bazaar_ci"; su postgres -c "psql -c \"ALTER USER postgres PASSWORD 'postgres'\""
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bhendi_bazaar_ci npx prisma migrate deploy
/bb-build media-library/viewer unit 2
```
