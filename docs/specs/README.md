# Specs

- **Verified:** 2026-08-26

Feature-based specs. **One folder per feature**, `kebab-case`, named for the feature — no numbering. Each holds a `spec.md` (requirements and product approach) and a `trd.md` (technical approach and decisions, no code), plus any supporting artifacts.

This is the home for per-feature detail. The phased status map is [../BACKLOG.md](../BACKLOG.md); decisions are in [../adr/](../adr/).

## Convention ([ADR-0010](../adr/0010-spec-convention.md))

- **Folder per feature**, kebab-case, no numbers. One feature per folder.
- **`spec.md`** = requirements and product approach **only** — no technical approach, package choices, or data-model decisions.
- **`trd.md`** = technical approach and decisions; **no code**, only references to *existing* code to justify a decision ([ADR-0009](../adr/0009-docs-reference-code-never-copy-it.md)).
- **≤100 readable lines** each. *Readable content* = body prose (sentences, bullets); **excludes** front-matter, headings, tables, fenced blocks, link-only lines, and blanks. Over the cap → split into subfeatures, each with its own `spec.md`, plus a short overview in the parent.
- **Supporting artifacts** live in the folder, named for their purpose (`rate-comparison.md`, `weight-audit.md`); never named `spec` or `trd`; not line-capped.
- **Cross-reference by relative path and feature name.** Numbering is never used.
- **Header on each:** `Status · Domain · Phase · Verified · References`.
- Scaffold with `/bb-sdlc spec-start <feature-name>`.

A spec describes a **requirement** — what must be true. It is not a defect report: a known defect either becomes a spec (because meeting the requirement needs design) or a PR (because an ADR already states the rule). Nothing in here is a bug list, and nothing here should need deleting once the work lands — the requirement remains true afterwards, and `Status` moves to Implemented.

## Features

| Feature | Requirement | Phase | Domain | Status |
|---|---|---|---|---|
| [bulk-catalog-upload](bulk-catalog-upload/spec.md) | Org owners create their catalogue from a spreadsheet + local photos; admins likewise for categories | 6 | catalog | Implemented |
| [server-side-pricing-authority](server-side-pricing-authority/) | The charged amount is determined by the store from its own catalogue | 2 | checkout, payments | ✅ Implemented — PR-38 |
| [payment-confirmation](payment-confirmation/) | An order is paid when the gateway says so, for the right amount | 2 | payments, checkout | ✅ Implemented — PR-39 |
| [inventory-reservation](inventory-reservation/) | Stock counts mean something; the last unit sells once | 2 | checkout, catalog | ✅ Implemented — PR-40 |
| [money-as-paise](money-as-paise/) | Every amount displayed, stored, charged, and reported is exact | 2 | cross-domain | ✅ Implemented — PR-37 |
| [product-weight-and-rates](product-weight-and-rates/) | A product's weight is recorded and prices its shipping | 3 | catalog, shipping | 📝 Draft |
| [multi-vendor-marketplace](multi-vendor-marketplace/) | Three audiences — buyers, selling organisations, platform owners — each with their own portal | 3 | cross-domain | 📝 Draft — **parent of 9 subfeatures** |
| [shipping-fulfilment](shipping-fulfilment/) | A paid order becomes a real, trackable parcel | 3 | shipping | 📝 Draft — **blocked on a product decision** |
| [rate-limiting](rate-limiting/) | Sensitive endpoints are rate limited in production, and an environment that can't enforce says so at deploy time | 4 | cross-domain | 📝 Draft |
| [product-video](product-video/) | A product page shows video alongside its photographs, in an order the seller composes | 6 | catalog, checkout | 📝 Draft — no open questions |
| [promotions](promotions/) | The platform and each organisation can run time-boxed offers, applied automatically or by coupon code | 7 | promotions, catalog, checkout | 🔨 In progress — PR-67 |
| [org-payouts](org-payouts/) | What each organisation has earned, what the platform kept, and what is still owed | 7 | payouts, checkout | 🔨 In progress — PR-67 |
| [transactional-email](transactional-email/spec.md) | One notification capability the whole store sends through — buyers, organisations and the platform each hear what concerns them | 8 | notifications | 📝 Draft — TRD pending a spike |

### Subfeatures

[multi-vendor-marketplace](multi-vendor-marketplace/) is the one parent folder here. It grew out of a single question about shipping origin and turned into nine subfeatures, because the data-model work and the portal work are the same change seen from two sides. Its `spec.md` is the programme overview; each subfeature carries its own `spec.md`, and a `trd.md` is written when that subfeature is picked up rather than all nine up front.

### Sequencing

Within Phase 2, [money-as-paise](money-as-paise/) should land before [server-side-pricing-authority](server-side-pricing-authority/), since recomputation logic written against floats would need rewriting. [payment-confirmation](payment-confirmation/) needs pricing authority first, so that the amount it matches against is trustworthy.

Phase 3 is strictly ordered: [product-weight-and-rates](product-weight-and-rates/) before [multi-vendor-marketplace](multi-vendor-marketplace/) before [shipping-fulfilment](shipping-fulfilment/). Booking real parcels at default weights turns a pricing error into courier invoices that do not match what customers paid, and booking them from a guessed origin does the same for the pickup leg.

[multi-vendor-marketplace](multi-vendor-marketplace/) also depends on [inventory-reservation](inventory-reservation/) from Phase 2, which is the one cross-phase dependency here: it moves the stock guard's target, so the guard has to exist first. Its `trd.md` D7 records why the guard is not simply written in its final place.

[transactional-email](transactional-email/) sits after [org-payouts](org-payouts/), not beside it: two of the four occasions it must carry — an organisation hearing that its goods sold, and hearing that it has been paid — are events the ledger and settlement produce. Its `trd.md` is deliberately unwritten; the delivery and idempotency questions want a `/bb-brainstorm` first.

Phase 7 is a pair: [promotions](promotions/) must land before [org-payouts](org-payouts/). The ledger's arithmetic reads a discount's funding split, so the thing that produces the split has to exist before the thing that settles from it — and building the ledger first would mean writing entries whose discount attribution is a constant zero, then migrating them.

[shipping-fulfilment](shipping-fulfilment/) carries an open product decision — whether to book real shipments or stop quoting live rates — stated in its `spec.md`. It is the one item here that cannot be resolved by engineering judgement.
