# Contracts — social

- **Verified:** 2026-11-25
- **Covers:** `server/social/*.types.ts`

The social shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## social-selling/post-composer

A post as the composer edits it (`server/social/post.types.ts`, D1, D3). **`PostDraftDTO`**: `id`, `version`
(what the next save must carry), `state` (`POST_STATE`), `caption`, `mediaIds` (ordered), `productIds`,
`destinations` (`POST_DESTINATION_KIND`s picked), `scheduledAt` (ISO or null) and `updatedAt` (ISO).
`POST /api/org/{orgId}/posts` takes `postDraftSchema` (`src/lib/validation/schemas/post.schema.ts`) and answers
201 `{ post }`; `PUT /api/org/{orgId}/posts/{id}` takes `postDraftSaveSchema` (the same fields and `version`) and
answers `{ post }`, or 409 when the version is stale or the post is no longer a draft, after which
`GET …/posts/{id}` answers the stored `{ post }`. `POST …/posts/{id}/duplicate` answers 201 `{ post }`, a new draft.
A picture not ready in the shop's library is 400 on `mediaIds`, another shop's product 400 on `productIds`.
Every route needs Social selling.
