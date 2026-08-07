# TRD — organisations and membership

- **Status:** Draft
- **Domain:** catalog, identity
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-08
- **References:** [spec.md](spec.md), [../data-model.md](../data-model.md), [../consumer-inventory.md](../consumer-inventory.md), [../portal-split.md](../portal-split.md), [ADR-0003](../../../adr/0003-one-repository-per-aggregate.md), [ADR-0012](../../../adr/0012-modules-are-vertical-slices-by-domain.md), [CONTRACTS.md](../../../CONTRACTS.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Two changes that look like one. `Seller` becomes `Org` — mechanical, 566 references, no behaviour
difference. And `ORG_MEMBER` appears — new behaviour, no existing code to convert. They ship as separate
PRs precisely because they are so different in character: a rename is reviewed by confirming nothing
changed, and new behaviour is reviewed by confirming something did. Combining them produces a diff where
neither review is possible.

The rename goes first and alone. Nothing depends on membership existing yet, and every later subfeature
depends on the vocabulary being settled, so doing it first means nothing is written twice.

## Technical decisions
- **D1 — `Seller` → `Org`, as one mechanical PR touching nothing else.** 566 references across 57 files ([../consumer-inventory.md](../consumer-inventory.md) §6). Two parts are not find-and-replace: `Product.sellerId` and `Shipment.sellerId` are foreign keys, so the column rename is a migration; and `Shipment.sellerId` is additionally the wrong question, since a shipment's origin becomes `orgAddressId` — that half belongs to [../stock-locations-and-allocation](../stock-locations-and-allocation/) and is deliberately *not* done here.
- **D2 — `ORG_MEMBER` is a table, not a role column on `User`.** A role on the user cannot express "owner of A, staff at B". The membership is the aggregate that carries the role, with `@@unique([userId, orgId])` satisfying R4 in the database rather than a service check.
- **D3 — `onDelete: Cascade` on both sides of the membership.** A membership is meaningless without either end, and deleting one end must remove the link rather than the other party — which is what R5 asks for. This is the one place cascade is right; contrast `ORDER_ITEM.productId`, where it would destroy history.
- **D4 — The role is stored and nothing branches on it.** `"owner"` and `"staff"` as a declared union in one place ([CLAUDE.md](../../../../CLAUDE.md) — no magic strings). Authorization on membership belongs to [../portal-separation](../portal-separation/); shipping a role that nothing reads is deliberate, so the later authorization change is additive rather than a schema change.
- **D5 — `Org` keeps the existing `code` (`SEL-001`) and its generator.** Renaming the entity is enough churn; regenerating vendor codes would invalidate anything printed, exported or referenced externally, for no gain. The prefix reads as legacy and that is acceptable.
- **D6 — Membership is read from the database on every request that needs it, never from the session token.** A JWT minted at sign-in would keep asserting a membership after it was revoked. `src/lib/auth-config.ts:94-99` already fetches `role` at token time, which is fine for a platform role that rarely changes and wrong for a membership that a team page can revoke mid-session. Consequence: the org portal costs one membership query per request, which is the correct trade and is stated so the caching temptation is a conscious decision later rather than an accident now.
- **D7 — The domain stays `catalog`.** `Org` replaces `Seller`, which lives in `server/catalog/` ([ADR-0012](../../../adr/0012-modules-are-vertical-slices-by-domain.md)), and moving it while renaming it would put two unrelated changes in one diff. `ORG_MEMBER` joins `User` to `Org` and so straddles `identity` and `catalog`; it is owned by `catalog` because the org is the aggregate root and one repository owns an aggregate ([ADR-0003](../../../adr/0003-one-repository-per-aggregate.md)). Revisit if membership grows behaviour of its own.

## Packages
None.

## Data model
**[MIGRATION]** — two, in the delivery order below.

| Migration | Change |
|---|---|
| Rename | `Seller` → `Org`; `Product.sellerId` → `orgId`; `Shipment.sellerId` → `orgId`; indexes renamed with their columns. No data movement, no nullable columns, reversible. |
| Membership | `OrgMember` (id, `userId` FK, `orgId` FK, `role`, timestamps), `@@unique([userId, orgId])`, `@@index([orgId])`. Purely additive; nothing reads it on arrival. |

Prisma emits a rename as drop-and-create unless the migration SQL is edited to `ALTER TABLE … RENAME`.
Left as generated it would **drop the sellers table and its foreign keys**, so the generated SQL must be
inspected and corrected before it is applied anywhere. This is the single highest-risk step in the
subfeature and the reason the rename is its own PR.

## API / contract changes
**[CONTRACT]** — every DTO carrying a seller changes shape: `ProductDetails`, `ProductForTable`,
`CartItem`, `ShippingGroup`, and both `Seller` declarations in `src/domain/seller.ts`. Route paths do
**not** move here — `/api/admin/sellers` becomes `/api/admin/orgs` in this PR, but the split to
`/api/org/[orgId]/…` belongs to [../portal-separation](../portal-separation/).
[CONTRACTS.md](../../../CONTRACTS.md) moves in the same PR.

## Test plan
Per [TESTING.md](../../../TESTING.md). A rename's test plan is mostly the absence of change.

- **Before and after the rename**, the seeded product, shipment and vendor counts are identical, and a product still resolves its vendor. This is the check that the migration renamed rather than recreated.
- **Membership uniqueness** — a second membership for the same user and org is rejected by the database, not by a prior read.
- **Cascade** — deleting a user removes their memberships and leaves the org and its products; deleting an org removes memberships and leaves the users.
- **Vocabulary** — a repository-wide assertion that `seller` appears in no source file, in the manner of `tests/unit/form-error-display.test.ts`. It is the only way a 57-file rename stays done.

## Delivery (PRs)
| PR | Scope | Behaviour |
|---|---|---|
| 1 | `Seller` → `Org` rename, with hand-corrected migration SQL | none — verified by identical counts |
| 2 | `OrgMember` table, repository, and the role union | none — nothing reads it yet |

PR 1 is reversible only by a second rename, so it lands on its own and gets confirmed against the
deployed database before PR 2 begins.

## Open questions
Must be closed before Draft → Accepted.

- Does an organisation need a slug for future public vendor pages, or is `code` sufficient? Adding one later means backfilling from names, which is the same slug problem [ADR-0015 material](../../../CHANGELOG.md) already cost once.
- Should the platform admin list of organisations show member counts? It needs a join that nothing else needs, and it is the sort of thing added cheaply now and expensively later.
- Is `contactPerson` on the existing vendor record redundant once memberships exist, or is it a business contact distinct from any user account?
