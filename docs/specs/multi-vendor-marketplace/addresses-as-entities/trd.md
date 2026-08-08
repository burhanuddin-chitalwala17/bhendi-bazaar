# TRD — addresses as entities

- **Status:** ✅ Implemented — PR-41
- **Domain:** identity, *(shared)*
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-10
- **References:** [spec.md](spec.md), [../data-model.md](../data-model.md), [ADR-0003](../../../adr/0003-one-repository-per-aggregate.md), [CONTRACTS.md](../../../CONTRACTS.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Two tables where one blob was: `Address` is a postal fact with no owner-specific data, and `UserAddress` is a person's relationship to one — label, recipient, phone. The split is what lets `stock-locations-and-allocation` later hang `ORG_ADDRESS` off the same postal table without a polymorphic owner column ([../data-model.md](../data-model.md)).

A survey of the production blobs preceded the design (four shape variants; `label`/`isDefault` living top-level in some rows and under `metadata` in others; two rows missing recipient and phone) — the migration handles what exists, not what the type claimed.

## Technical decisions
- **D1 — `Address` lives in `server/shared/`, `UserAddress` in `identity`.** Address is about to have two owners' relationships pointing at it (buyers now, orgs in stock-locations); one repository per table (Invariant 5) means the postal table's writer must sit where both domains can reach it.
- **D2 — No uniqueness on `Address`.** Cross-user dedup was considered and dropped in the data-model session: free text does not normalise, `addressLine2`'s NULLs defeat the constraint, and a shared row forces copy-on-write on every edit. Two people at one address are two rows.
- **D3 — No `isDefault`, and no automatic selection.** Product decision (2026-08-08): the buyer picks an address at checkout, every time. This deletes the default-juggling in `useAddressManager` and `AuthenticatedAddress` (find-default, set-default, reassign-default-on-delete) rather than porting it.
- **D4 — Wire shape stays flat and keeps `mobile`.** The client's `DeliveryAddress` and the persisted `OrderAddress` snapshot both say `mobile`; the column says `phone` per the data model, and the repository maps. A wire rename would churn checkout for no behavioural gain. `id` on the wire is the `UserAddress` id.
- **D5 — Recipient, phone and state become required** — an address a courier cannot use is not an address. The two legacy rows missing them migrate with `''` rather than being dropped (losing a user's address is worse), and the schema forces completion on their next edit.
- **D6 — `landmark` is kept.** The design drafts omitted it; the production rows and `OrderAddress` both have it.
- **D7 — The blob survives one release as `Profile.legacyAddresses` (`@map("addresses")`), read by nothing.** Same pattern as every destructive step in this programme: additive first, drop after verification.
- **D8 — `Order.address` stays an embedded snapshot** — a delivered order's destination must not change when the address book does (same reasoning as price-on-order, ADR-0002).

## Packages
None.

## Data model
**[MIGRATION]** — `Address` + `UserAddress` tables, then a data lift inside the same migration: one SQL statement per table over `jsonb_array_elements(Profile.addresses)`, coalescing across the observed shape variants (`fullName|name`, `mobile|phone`, `label` top-level or under `metadata`). `isDefault` is deliberately not migrated (D3). Ids are `gen_random_uuid()` — nothing requires cuid format, only uniqueness.

## API / contract changes
**[CONTRACT]** — the address-book wire shape drops `metadata` (label and notes become top-level), and `POST /api/addresses` requires `fullName`, `mobile`, `state`. Checkout's `OrderAddress` snapshot is unchanged.

## Test plan
- The repository mapper: row → wire shape (phone→mobile, label/notes top-level), both directions.
- Schema: required fields enforced; the blank-optional cases (email, line2, landmark) accept `""` per the PR-22 rule.
- The migration's coalescing rules, pinned by tests that read the SQL and assert every observed variant key is coalesced (the SQL itself is database behaviour).
- Ownership: another user's address id is not readable, updatable, or deletable (not-found, never forbidden).

## Delivery (PRs)
One PR: the tables and the lift are useless without the reads, and the reads are wrong without the lift (the same D2-style reasoning as money-as-paise).

## Open questions
None — every decision above was taken in the data-model sessions of 2026-08-08, this TRD only records them.
