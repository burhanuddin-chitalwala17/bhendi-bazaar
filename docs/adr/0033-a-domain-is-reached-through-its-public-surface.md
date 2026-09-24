# ADR-0033: A domain is reached through its declared public surface

- **Date:** 2026-09-23
- **Status:** Accepted

## Context

[ADR-0012](0012-modules-are-vertical-slices-by-domain.md) made `server/` thirteen bounded contexts, and [CLAUDE.md](../../CLAUDE.md) has said since then that "a domain calls another domain's public surface, never its internals." Nothing defined *surface*, and nothing checked it. Measured on 2026-09-23: **42 cross-domain imports across 25 edges, of which 13 reach a `*.repository` directly.**

```
payments/payment.service.ts       -> checkout/order.repository
payouts/ledger.service.ts         -> catalog/org.repository, catalog/category.repository,
                                     promotions/promotion.repository
bidding/bidding.service.ts        -> catalog/product.repository, catalog/org.member.repository
promotions/admin.promotion.service -> catalog/org.repository, catalog/product.repository
```

A repository reached from outside its domain bypasses the service that owns the rules for that
table. `payouts` reading `checkout/order.repository` means an order's visibility rules
(`VISIBLE_ORDER_WHERE`, applied *inside* the repositories per
[checkout-abandonment](../specs/checkout-abandonment/)) hold only because `payouts` happens to
call a method that carries them — not because anything says it must.

The rest of the cross-domain traffic is **not** a violation, and this is the part the old
wording got wrong. `catalog/product.visibility`, `promotions/price-context`,
`catalog/product.sale-gate`, `bidding/bidding-lock` are *designed* to be called from other
domains — [ADR-0018](0018-one-effective-price-function.md) requires every priced surface to
call the same resolver, and [ADR-0029](0029-a-product-leaves-sale-by-archiving-not-deletion.md)
requires every buyer-facing read to spread the same `where` fragment. Those are shared
contracts. The failure was that they were indistinguishable from an internal: both are just a
file in a directory, so "don't import internals" could not be followed or checked.

## Decision

1. **Every domain's surface is declared, in one place, as data.** `PUBLIC_SURFACE` in
   `tests/unit/module-boundaries.test.ts` names what each domain exports; everything else is
   internal. The declaration *is* the contract, so "may I import this?" is readable rather
   than inferred.
2. **A barrel (`server/<domain>/index.ts`) is the intended end state and is deliberately not
   done yet.** Thirteen new files re-exporting existing modules can introduce import cycles
   and change bundling, and shipping that inside an enforcement change is how a gate arrives
   broken. The declaration gives the same enforcement today at no runtime risk; the barrel is
   a follow-up that can then delete the declaration.
3. **A repository is never public.** A domain that needs another's data calls its service. If
   no service method fits, the owning domain grows one; that is the domain deciding what it
   will answer, which is the point of the boundary.
4. **`server/shared/` is exempt** — it is the shared kernel by definition, and pretending
   otherwise would mean re-exporting Prisma through thirteen indexes.
5. **Type-only imports are exempt.** They are erased at compile time, carry no behaviour, and
   forbidding them would push shapes into `shared/` where they do not belong.
6. **`tests/unit/module-boundaries.test.ts` enforces it, as a ratchet.** The 13 existing
   violations are allowlisted *with the reason each has not been fixed*; the list may shrink and
   never grow. A gate that fails on day one with thirteen errors gets suppressed —
   [TESTING.md](../TESTING.md) records that happening to lint here.

## Alternatives considered

- **Write the rule down more clearly and rely on review.** This is what we had. The rule was
  already written, in the always-loaded file, and thirteen violations accumulated under it. A
  rule a person must remember is not a control — the same reasoning as
  [Invariant 7](../../CLAUDE.md).
- **ESLint `no-restricted-imports` with path zones.** The conventional answer, and genuinely
  close: it reports at the call site, in the editor, before the test runs. Rejected for the same
  reason [ADR-0031](0031-one-components-home-organised-by-domain.md) rejected it — lint carries
  `continue-on-error: true` in CI here, so a lint-only rule is advisory. Worth revisiting the
  moment lint blocks, and then this test can go.
- **Fix all thirteen now, gate with no allowlist.** Rejected as scope. Several are genuine
  design questions — whether `payouts` should read orders at all, or receive a settlement view
  pushed by `checkout` — and answering them inside a cleanup PR is how a cleanup becomes a
  month. The ratchet makes the debt visible and bounded instead.
- **Let each domain export a named barrel per consumer** (`catalog/for-payouts.ts`). Rejected:
  it scales with the square of the domain count and encodes the caller into the callee, which is
  the audience-grouping mistake [ADR-0012](0012-modules-are-vertical-slices-by-domain.md) and
  [ADR-0031](0031-one-components-home-organised-by-domain.md) both already rejected.

## Consequences

- ✅ "May I import this?" has a mechanical answer, and a new domain gets a boundary for free.
- ✅ The intentional shared seams become explicit: listing `product.visibility` as public
  *states* that it is a contract, rather than leaving it to look like a leak.
- ⚠️ Thirteen allowlisted violations, each of which is real coupling. The allowlist is the
  backlog.
- ⚠️ The surface lives in a test rather than beside the code it describes, which is the wrong
  place for a contract. That is the debt the barrel follow-up pays off.
