# ADR-0083: A source file stays under 25 KB, and larger ones only shrink

- **Date:** 2026-11-24
- **Status:** Accepted

## Context

A session reads a whole file to change one line of it, so a file's size is a cost paid on every touch.
`file-cohesion` limits how many domains a file reaches, but nothing limited its size: eleven files under `src/`
and `server/` had passed 25 KB (about 6k tokens a read), the largest `server/catalog/product.repository.ts` at
53 KB. Size also tracks the thing cohesion is after — each of those files holds two to four jobs.

## Decision

1. No source file under `src/`, `server/` or `worker/` is over 25 KB, checked by `tests/unit/file-size.test.ts`.
2. The eleven files over it are pinned in `PINNED` at their size, rounded up to the KB, with the line each should
   split along. A pinned file may shrink, never grow past its ceiling; an entry leaves when its file is under the
   limit (ADR-0056).
3. A new entry or a raised ceiling is a review finding (`/bb-review` lists `PINNED`).

## Alternatives

- **A line-count limit.** Rejected: tokens follow bytes, and a line count punishes formatting rather than content.
- **20 KB.** Rejected for now: 21 files over it, and an allowlist that long is a suppression file. Lower it once the
  pinned eleven are split.
- **Split the eleven now.** Rejected here: each is a behaviour-preserving refactor that deserves its own unit and
  review; the ratchet makes sure they do not get worse meanwhile.

## Consequences

- ✅ New code arrives in files a session can read cheaply; the eleven cannot grow.
- ✅ Each pinned entry is a ready-made refactor brief.
- ⚠️ A fix in a pinned file larger than the rounding room must first take the room from the named split.
