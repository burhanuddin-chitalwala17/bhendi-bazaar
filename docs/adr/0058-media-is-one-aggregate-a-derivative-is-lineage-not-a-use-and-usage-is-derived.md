# ADR-0058: Media is one aggregate; a derivative is lineage, not a use; and usage is derived

- **Date:** 2026-10-05
- **Status:** Accepted

## Context

The [media library](../specs/media-library/) gave every stored image and every embedded video reference a record of its own (`MediaAsset`), so a shop can see what it has, reuse it, and retire it. Four of its technical decisions (D1, D6a, D7, D11) are the kind the next contributor will undo in good faith, because each rejects the conventional answer: separate tables per kind, a counter for "how many places use this", a new original per edit, and global deduplication. They shipped on 2026-09-26 and lived only in the TRD.

## Decision

1. **`MediaAsset` is the one aggregate for media, with one repository** — stored photographs, stored video, and embedded video references alike. The stored path's first segment names the owner (`org/<code>/…`), so ownership is in the key, not in a join.
2. **A rotate or crop produces a derived asset and never a new original.** The derivative records what it was made from (`derivedFrom`), so lineage is a chain of rows. The original is never overwritten, which is what makes "undo the crop" a lookup rather than a loss.
3. **A derivative is lineage, not a use.** "Is this asset used anywhere" asks about products, categories, banners and profiles that reference it — not about the crops made from it. A derived asset that nothing references is unused and may be swept, whatever it was cut from.
4. **Usage is a query, never a counter.** Product, slot, used/unused, source and date are predicates over the asset table and the columns that reference it, evaluated at read time. There is no `usageCount` column to drift.
5. **Deduplication is by content hash, within an org.** The browser hashes the downscaled file before asking for an upload URL; a matching asset in the same org is returned instead of a second copy. Two orgs uploading the same bytes get two assets.

## Alternatives considered

- **A table per kind** (`Image`, `Video`, `Embed`). The conventional modelling answer. Rejected: the library, the picker, the sweep and the takedown all treat them as one list; three tables means three of each.
- **A usage counter maintained on write.** Fast to read. Rejected: every referencing write in five domains would have to maintain it in the same transaction, and the first one that forgets makes "unused" a lie that deletes a live image. A query cannot be stale.
- **Global deduplication across orgs.** Saves bytes. Rejected: a shared object is a shared fate — one org's takedown would remove another's image, and ownership in the key (D1) would be false.
- **Edit in place.** Smaller store. Rejected: a crop that cannot be undone is a destructive operation on a photograph the shop paid to take.

## Consequences

- ✅ One list, one repository, one sweep; a new kind of media is a `kind` value, not a table.
- ✅ "Unused" is always true at the moment it is read, so the sweep is safe to run.
- ⚠️ Usage reads join several tables; the library pages are budgeted in `db-ops-budget` and memoised per request.
- ⚠️ Derivatives multiply storage. The sweep removes unreferenced ones; the original's storage is the price of undo.
