# ADR-0025: Order codes are random, not sequential

- **Date:** 2026-09-16
- **Status:** Accepted

## Context

An order carries two identifiers. `Order.id` is a `cuid` and is what appears in URLs; it was never guessable and is not in question here. `Order.code` is the human-facing reference — the thing printed on an invoice, quoted in an email, and typed into the guest lookup form — and it has been minted as `BB-1001`, `BB-1002`, and so on, by reading the highest existing code and adding one.

Three pressures meet on that decision. A running counter is a read-then-write against a `@unique` column, so two checkouts in the same moment produce the same code and one of them dies on a constraint violation — the same class of mistake the project already ruled out for stock ([ADR-0007](0007-conditional-stock-decrement.md)), sitting on a different column. A counter is also a public statement of business volume: two orders placed a week apart tell any customer, or any competitor posing as one, exactly how much the store sold in between. And [checkout-abandonment](../specs/checkout-abandonment/) makes both worse, because abandoned checkouts now create orders that consume codes, raising both the collision rate and the apparent volume.

## Decision

1. `Order.code` is generated from randomness in process, with no read of existing rows. Its shape is a `BB-` prefix and eight characters from a Crockford-style alphabet that omits `I`, `L`, `O`, `U`, `0` and `1`, so a code read aloud or copied by hand has no ambiguous characters and no accidental words.
2. Generation performs no query, so it cannot race. The `@unique` constraint remains the authority; a collision is retried, and a retry that also collides is a fault worth raising rather than absorbing.
3. There is exactly one generator, in one place. The second, differently-shaped generator that sat unused beside it is deleted rather than left as a choice.
4. Existing codes are not rewritten. Validation and lookup accept both the old numeric shape and the new one, because a code already in a customer's inbox is a promise the store made.
5. A code is a reference, not a credential. It is not an authorisation to view an order on its own, and nothing is relaxed elsewhere on the strength of codes now being unguessable.

## Alternatives considered

**A Postgres `SEQUENCE` with `nextval()`.** The textbook fix, and the one a reasonable person reaches for first: it is atomic, so it removes the race outright, and it keeps the tidy ascending codes that people like reading. Rejected because it solves only the smaller half of the problem. The sequence is still a public counter, so the volume leak survives intact, and abandoned checkouts still burn numbers — meaning the ordering it appears to promise is not even true. It also adds a schema object and a migration to preserve a property we have just decided we do not want.

**Keep the counter and serialise it with a lock or a retry loop.** Cheapest in lines changed, and needs no migration. Rejected because it makes every checkout contend on one row at exactly the moment the store is busiest, which is to say it converts a rare error into a reliable slowdown, and it still leaks volume.

**Use `Order.id` as the human reference and drop `code` entirely.** Genuinely tempting — one identifier is simpler than two, and the `cuid` is already unguessable. Rejected because a `cuid` is twenty-five characters of mixed case and cannot be read over a phone, typed from a printed invoice, or quoted in a support conversation without error. The two identifiers exist because they serve two different readers; collapsing them would serve the machine and abandon the person.

**Do nothing.** The race has not visibly fired yet. Rejected because its likelihood scales with success, and because abandonment is about to multiply the orders being created — the moment it does fire is the moment the store is busiest, and the symptom is a failed checkout for a customer who was trying to pay.

## Consequences

✅ Two checkouts in the same instant both succeed; the failure mode that appears only under load is gone before it appears.

✅ Order codes stop reporting sales volume to anyone holding two of them.

✅ Generation stops touching the database at all, removing a query from the checkout transaction.

✅ One generator where there were two, so there is nothing to drift.

⚠️ Codes no longer sort or compare meaningfully. Anything that wanted "the order after this one" must ask `createdAt`, and any operational habit of reading recency out of a code stops working.

⚠️ Two code shapes exist in the data permanently. Validation, lookup and any future parsing must accept both, and a regex written against only the new shape will silently fail to find old orders.

⚠️ A random code is slightly harder to read back over the phone than `BB-1042`, even with the ambiguous characters removed. The alphabet choice is what keeps that cost small.
