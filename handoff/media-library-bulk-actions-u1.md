# Handoff — media-library/bulk-actions U1 (bulk routes)

- **Status:** In progress — code, tests and gates green; /bb-review pending
- **Last pushed sha:** (see `git log origin/claude/media-library-build -1`)
- **Goal:** TRD Delivery U1: schemas (`ids` ≤100, de-duplicated), `retireMany`, `setTagMany`, `downloadLinks` (500 MB cap, `ZIP_LIMIT_BYTES`), `findManyForOrg`, `addTag` widened to exclude RETIRED, three `orgMediaApiClient` methods, `docs/contracts/catalog.md` lines. No UI. Closes A3 (server half), A4, A5, A6; Q3, Q4, Q5, Q10 (Q11 filename part).

## Done
- `presignDownload(pathname, filename, ttlSeconds = 300)`; bulk passes 900 s.
- `server/catalog/media-bulk.service.ts` (`mediaBulkService.retireMany | setTagMany | downloadLinks`, `ZIP_LIMIT_BYTES`). A separate `*.service` (precedent: `product-bulk.service.ts`) rather than re-exports through `mediaAssetService`: it calls `mediaAssetService.retire`, so a re-export would be a cycle, and the service file has ~200 B left under its pin.
- Repo: `findManyForOrg`, `addTag` excludes RETIRED. Repo is 29661 B, pin 29696 B.
- `DomainError` gained a generic `details` option; `toErrorResponse` passes it through (used by the 422 zip refusal). Recorded in `docs/CONTRACTS.md`.
- DTOs `MediaBulkRetireOutcome`, `MediaBulkTagOutcome`, `MediaDownloadLinksDto`, `NO_FILE_REASON` in `media-library.types.ts`.
- Routes `media/retire`, `media/tags`, `media/download-links` (POST, `withOrg`, FREE in feature registry); `orgMediaApiClient.retireMany | setTagMany | downloadLinks`.
- Tests: `tests/unit/media-bulk-schema.test.ts`, `tests/integration/media-bulk.test.ts`, object-store TTL case, media-tags-repository updated.
- Mutations (all red, restored): `>`→`>=` on the cap; `orgId` and PENDING out of `findManyForOrg`; `orgId` and RETIRED out of `addTag`.
- Gate green; integration 761 passed / 7 skipped (join-equivalence needs a populated catalogue).
- decisions.md: Q3, Q4, Q5, Q10 → implemented (unit 1).

## Next steps
1. /bb-review in a fresh subagent; fix findings.
2. Commit `catalog: bulk retire, tag and download-links routes [CONTRACT]`; push; Status Done with notes for U2.

## Resume (macOS)
```
export PATH=$HOME/.nvm/versions/node/v22.23.3/bin:$PATH   # vitest needs Node ≥ 21 (Map.groupBy)
export DATABASE_URL=postgresql://$(whoami)@localhost:5432/bhendi_bazaar_ci   # user must be in the URL
npx prisma generate && npx prisma migrate deploy
env -u NEXT_PUBLIC_APP_URL -u NEXTAUTH_URL npm run gate
npm run test:integration
```
