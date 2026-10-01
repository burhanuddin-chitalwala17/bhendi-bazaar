# ADR-0047: A canonical fact is admitted by answerability, not by agreement

- **Date:** 2026-10-01
- **Status:** Accepted

## Context

[ADR-0042](0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md)
set the right criterion and gave it a title and a sentence that say something narrower. Its
decision 1 admits a field because "the person who made or bought the thing can answer it", which
is correct and is the criterion kept below. The same clause then adds that *"Amazon requires it"
is never a reason for a canonical field*, and the ADR is titled for the intersection. Read
strictly — which is how a rule gets read when somebody is deciding quickly — that excludes a fact
only one platform asks for, even one the shop can answer in its sleep.

Thirty-three real bulk-upload templates show what that exclusion would cost. Meesho's `Abayas`
node requires `Bust Size` and `Length Size`; Flipkart's `abaya-burqa` asks for neither. A shop
measuring an abaya can answer both without being told who is asking. Under the answerability
test they are canonical facts; under the intersection they are one platform's demand and would
have been left out, and the first abaya published to Meesho would have been rejected.

The asymmetry is the heart of it, and it was named by the owner rather than derived here: sending
a fact a platform ignores costs nothing, and omitting one a platform requires stops the listing.
The two errors are not the same size, so a criterion balanced between them is the wrong shape.

What ADR-0042 was defending against is still real and still has to be defended against. It named
the failure precisely: a record that accretes a column per platform until seventy fields exist,
nine apply, and nobody can say which are required. That outcome is prevented here by the
answerability test alone, which is what was doing the work in ADR-0042 as well. The intersection
was never the control; it was a second, cruder one standing next to the real one.

## Decision

1. **A fact is canonical if the shop can answer it from the product itself, without knowing
   which platform it is for.** This is ADR-0042's criterion, kept unchanged and now the only
   admission test.
2. **How many platforms ask for it is not part of the test.** One is enough, and none is enough.
   A platform's requirement is what draws attention to a fact; answerability is what admits it.
   This replaces ADR-0042's "'Amazon requires it' is never a reason for a canonical field."
3. **A fact the shop cannot answer from the product is a channel extra**, declared by that
   channel's adapter under ADR-0042 decisions 2 to 5, which stand. Flipkart's procurement type,
   shipping provider and three handling fees are of this kind, and they are settings a shop
   states once rather than questions asked per product.
4. **Where two facts are related, store the one that derives the other.** A measurement derives a
   size label; a label derives no measurement. So a garment's length and bust are stored and
   `Free` is computed, never the reverse. Thirteen of Meesho's nineteen nodes require a
   measurement, six require none, and **none requires a size label without also requiring
   measurements** — so the deriving fact is also the one asked for more often.
5. **A channel extra is admitted only when nothing else will do, and the burden is on the
   extra.** The listing form is one form. A per-platform section on it means the seller fills
   three forms, which is the cost this phase exists to remove, so an extra that could have been
   expressed as a canonical fact is a design error rather than a convenience.

## Alternatives considered

- **Leave ADR-0042 as it stands and treat the abaya measurements as Meesho extras.** The reading
  that follows from its text, and it fails on its own terms: a bust measurement is a fact about
  a garment, so putting it in Meesho's adapter means the same measurement is re-entered for
  Amazon when Amazon asks, and the product no longer holds what is true about it. It also starts
  the habit decision 5 forbids.
- **Supersede ADR-0042 entirely and take the union of what every platform requires.** This is
  the wide-record model ADR-0042 rejected, and the rejection was right. Without the
  answerability gate the model grows with every channel and nothing is ever safe to remove.
  Rejected, and decision 2 is deliberately narrow for this reason: it removes the agreement
  requirement and nothing else.
- **Record this in the spec rather than as an ADR.** Cheaper, and it loses the point. ADRs are
  what later work is read against, and the clause being corrected is in an ADR; a spec
  disagreeing with an accepted ADR is read as the spec being wrong.
- **Edit ADR-0042's decision 1 in place.** Forbidden here, and rightly: the reasoning that led to
  the intersection is worth keeping legible, because the failure it feared is the one decision 5
  still guards.

## Consequences

- ✅ A fact one platform requires and a shop can answer reaches the product model, so publishing
  fails for reasons outside our control rather than because the vocabulary was kept too narrow.
- ✅ The admission test is one question instead of two, and the question is about the product
  rather than about the platforms, so it can be answered without a template to hand.
- ✅ Storing the deriving fact means a platform asking the question a different way is a mapping
  change rather than a new field.
- ⚠️ The guard against the wide record is now a single test, applied by judgement, with nothing
  mechanical behind it. ADR-0042 had two and one of them was cruder but automatic.
- ⚠️ "Can the shop answer it" is a judgement that moves with how diligent the shop is. A fact
  answerable in principle and never answered in practice is worse than an absent one, because
  readiness will report it missing for ever.
- ⚠️ Two ADRs must now be read together for one decision, which is the standing cost of
  immutability and is why decision 2 names the clause it replaces.
