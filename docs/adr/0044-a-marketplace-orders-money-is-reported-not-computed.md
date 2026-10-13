# ADR-0044: A marketplace order's money is reported, not computed

- **Date:** 2026-09-29
- **Status:** Accepted

## Context

[Invariant 1](../../CLAUDE.md) says the server is the sole authority on money: every amount is
recomputed server-side from the catalogue, and a figure arriving in a request is untrusted input
to be discarded. [Invariant 2](../../CLAUDE.md) says payment state changes only on a verified
gateway signal. Both were written because a browser had been trusted with a number.

A marketplace order breaks the premise rather than the rule. Amazon runs its own checkout, takes
its own money and tells us afterwards what happened. We did not compute that amount and cannot:
the buyer may have used a coupon we never saw, paid a shipping fee we do not set, or bought at a
price the platform discounted on its own account. There is no catalogue row to recompute from
that would produce the number that actually changed hands.

Read carelessly, that looks like an exception to Invariant 1, and an exception in the one area
the project has been strictest about is how a rule stops meaning anything.

## Decision

1. **A marketplace order's amounts are recorded as reported, never recomputed.** What the
   platform says the buyer paid is what we store, because it is the only thing that is true.
2. **This is Invariant 2's shape, not an exception to Invariant 1.** Invariant 1 forbids trusting
   a number from *a request we serve*. A marketplace order arrives over a connector we
   authenticated, from a party that holds the money — the same standing as a verified gateway
   signal. The authority moved because the checkout moved.
3. **The price we publish to a channel is a publication, not a charge.** It goes through the one
   price function with the channel as an argument
   ([ADR-0018](0018-one-effective-price-function.md) decision 2 takes the clock the same way).
   It says what we asked for. It never claims to be what was received.
4. **A reported amount never enters the payouts ledger.** The platform pays the shop directly and
   nothing passes through us, so there is nothing owed and nothing to settle. Marketplace orders
   are reporting; the ledger stays what it is, a record of money we held.
5. **A reported amount is never a reason to move stock on its own.** The order event triggers the
   same conditional decrement every other trigger calls
   ([Invariant 6](../../CLAUDE.md)); it does not write a quantity itself.
6. **Every figure derived from reported amounts carries its provenance and its freshness.** A
   consolidated total names the channels it covers and when each last reported, because a
   confidently wrong sum is worse than a gap.

## Alternatives considered

- **Recompute the marketplace amount from our catalogue and flag a mismatch.** The instinct that
  keeps Invariant 1 literally intact. Rejected because the mismatch is the normal case, not the
  exceptional one — platform-funded discounts, their shipping, their coupons — so the flag would
  fire on most orders and be ignored within a week, which is worse than not having it.
- **Refuse to store marketplace amounts at all and report unit counts only.** Genuinely safe, and
  it was close. Rejected because the shop's own question is "what did I make", and a dashboard
  that counts garments and will not mention money is not the product being subscribed to.
- **Take a commission on marketplace sales and reconcile to the paisa.** The revenue-maximising
  option, and the owner has ruled it out in favour of a flat subscription. Worth recording that
  it was also the expensive one: invoicing from reported data would demand every platform's fees,
  returns and adjustments be reconciled before charging anyone, and billing a shop wrongly is a
  different order of harm from showing them a stale figure.
- **Treat a marketplace order as an ordinary order with a different payment method.** Rejected:
  it would put those amounts into the payouts ledger, where they would represent money we owe and
  do not hold.

## Consequences

- ✅ The invariant survives with its reasoning intact, and the marketplace path is decided rather
  than discovered by whoever writes it.
- ✅ Because no commission is taken, a wrong reported figure misleads a dashboard and can never
  mis-charge anyone, which drops the accuracy bar from auditable to useful.
- ✅ The payouts ledger keeps one meaning.
- ⚠️ Two kinds of order now exist in the reporting surfaces, and any screen that adds them up has
  to say which kinds it counted.
- ⚠️ "Reported" is a weaker guarantee than the rest of the system offers, and the temptation will
  be to quietly treat those numbers as settled. The freshness requirement in decision 6 is the
  only thing standing against that, and it has to be enforced in the read models rather than
  remembered.
