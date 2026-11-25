# CLAUDE.md — social domain

- **Verified:** 2026-11-25
- **Covers:** `server/social/**`

> Read the project-wide rules first: [`/CLAUDE.md`](../../CLAUDE.md). Requirements are in [docs/specs/social-selling/post-composer/](../../docs/specs/social-selling/post-composer/); every decision is in its `decisions.md`, and the architecture in [social-selling's trd.md](../../docs/specs/social-selling/trd.md).

## Purpose
A shop's posts: composed once from its library, its caption and the products it is about, then sent to any of its destinations. It knows no platform (social-selling Q7).

## Boundaries
**Owns:** `Post` and `PostDestination`. **Does not own:** pictures or products (catalog, read through `mediaAssetService` and `productService`), nor any platform: a destination's platform half arrives as a plug (post-composer D2) and its connection lives in `channels`. Other modules' settings for a post (comment-to-DM) are theirs, keyed by the post (Q6).

## Rules
- **A post names only its own shop's ready library assets and its own products**, checked on every save.
- **A save is a compare-and-set on `version`** (D3): a stale save writes nothing and is 409; the composer re-reads.
- **Shape is derived, never stored** (D1, spec R2).
- **A post is retired, never deleted** (ADR-0032): cancelled, kept.
- **Closed sets are the constants in `post.types.ts`**; the migration pins state and kind with CHECKs.

## Structure
| Path | Holds |
|---|---|
| `post.types.ts` | `POST_STATE`, `POST_DESTINATION_KIND`, `POST_DESTINATION_STATE`, limits, `PostDraftDTO`, words |
| `post.service.ts` | Drafts: create, get, autosave, duplicate |
| `post-caption.service.ts` | A post's caption from content: write, price changes, Update price (ai-images/social-posts D3, D4) |
| `post.repository.ts` | The one writer of `Post` |
| `post-destination.repository.ts` | The one writer of `PostDestination` |
