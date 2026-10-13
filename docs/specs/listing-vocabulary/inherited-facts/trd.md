# TRD — listing vocabulary / inherited facts

- **Summary:** An ordered list of levels asked on save, each stored value carrying which level answered, and a brand-level correction previewed from the same query that performs it
- **Status:** ✅ Implemented — PR-227, PR-253 (2026-10-04)
- **Domain:** catalog
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-10-02
- **References:** [spec.md](spec.md), [parent trd](../trd.md), [seller-profile](../../seller-profile/), [ADR-0032](../../../adr/0032-records-people-authored-are-retired-not-deleted.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

One function walks an ordered list of levels — family, brand, shop defaults — takes the first
answer and records which level gave it. It runs on save and never on read, so a product read is
one row and what gets published is reproducible from that row alone.

## Prior art

**Parent-to-child inheritance with per-value override** is what Akeneo and Pimcore both do, so
the model is standard. **We depart on when it resolves.** Both resolve at read time; we fill at
write time and treat the product as the source of truth.

Two reasons, and the second is the stronger. What is published must be reproducible from one row,
because a listing sent to a marketplace is a fact about a moment and re-deriving it later from a
brand that has since changed would produce a different answer. And spec R6 makes a brand change
an explicit, confirmed, previewed operation — which is exactly what read-time resolution exists
to avoid needing. Once the change is explicit, resolving on read buys nothing and costs a join on
every product read.

**Asking several levels in order** is Chain of Responsibility, as layered configuration does
everywhere — environment over file over default. **We follow it**: precedence lives in the order
of a list rather than inside branching code, and it works for every fact without being written
once per fact.

## Technical decisions

- **D1 — The fill step is an ordered list of levels, asked in turn.** Family, brand, shop
  defaults. Adding a level is inserting an entry. A fallback chain written per fact would be
  repeated once per fact and would discard which level answered, which spec R3 needs.
- **D2 — It runs on save, and nothing is consulted on read.** A product read is one row, so there
  is nothing to batch and nothing to cache. This is also what makes spec R7 true without an order
  snapshot: an order reads a product that does not move.
- **D3 — The origin is stored in the same entry as the value**, not as a parallel flag. One flag
  per fact would be one column per fact, which is the shape the parent's D2 rejects; and two
  separate stores can disagree about which answers the shop owns, which is spec R5's whole
  dependency.
- **D4 — Editing a value sets its origin to the product, in the same write.** Not a separate
  update that can fail on its own. Spec R4's "editing clears the mark" is therefore not an extra
  step that can be skipped by a code path that forgot it.
- **D5 — The preview and the update come from one query, and the level is a parameter.** The
  count shown to the shop and the rows changed are the same predicate, evaluated twice, not two
  predicates that agree today. One implementation serves family, brand and defaults, because
  spec R5 applies to all three and a per-level copy is three chances to differ. Follows
  [seller-profile](../../seller-profile/) A4a, which had the same problem.
- **D6 — A retired brand still fills.** `Brand.retiredAt` hides it from pickers, never from the
  fill step ([ADR-0032](../../../adr/0032-records-people-authored-are-retired-not-deleted.md));
  and since values are already on the product, spec R8 holds even for a brand gone from every
  list.
- **D7 — An order needs no new snapshot.** It already keeps the name, image and price it was
  placed with, which is everything it displays. Stored facts do not move unless somebody runs
  D5's update, and that is a confirmed action rather than a side effect. Worth stating because the
  obvious answer to spec R7 is to add a snapshot, and the snapshot would be dead weight.

## Packages

None.

## UI approach

A filled-in field says so beneath itself in quiet text — "from your brand Noor" — and stays
editable; editing overrides it and clears the mark (spec R3, R4). The mark is text, not only a
colour or an icon, because it has to survive being read on a phone in daylight and by somebody
who does not know the convention.

The brand-level correction is a confirmation naming the count, not a toast after the fact: the
shop sees "this will change 104 products" and chooses. Mobile-first per
[ADR-0015](../../../adr/0015-mobile-first-design.md); the confirmation is a dialog with its own
phone form, and its primary action is not hidden below the fold.

## Data model

No new tables. The origin rides in the stored fact's entry (D3), so the columns added by
[categories](../categories/) and [variants](../variants/) are sufficient.

## API / contract changes

[CONTRACT]. Product DTOs gain the origin alongside each stored fact; the brand-correction preview
and apply are two calls over one predicate. `docs/CONTRACTS.md` moves in the same PR.

## Test plan

The fill step is pure, so its table is unit tests: each level answering, each absent, all absent,
and a retired brand still answering. D4 is tested by editing a value and
asserting the origin moved in the same write. D5's preview and apply run against one fixture per level,
because the failure worth catching is the two disagreeing — and it is mutation-tested by changing
one of the two predicates and watching it go red. Spec A5 is tested by placing an order, changing
the brand, running the correction, and asserting the order is unchanged.

## Delivery (PRs)

1. The fill step and its level list — pure, no schema change, no caller.
2. Wired into the write paths; origin stored and returned in the DTO.
3. The filled-in marks on the form.
4. The brand-level correction with its preview.

## Open questions

None. The fill order is settled by spec R1 and the open questions that bore on this part are
closed in [categories](../categories/trd.md) and [variants](../variants/trd.md).
