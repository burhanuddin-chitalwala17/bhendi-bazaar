# Specs

- **Verified:** 2026-08-03

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
| [server-side-pricing-authority](server-side-pricing-authority/) | The charged amount is determined by the store from its own catalogue | 2 | checkout, payments | 📝 Draft |
| [payment-confirmation](payment-confirmation/) | An order is paid when the gateway says so, for the right amount | 2 | payments, checkout | 📝 Draft |
| [inventory-reservation](inventory-reservation/) | Stock counts mean something; the last unit sells once | 2 | checkout, catalog | 📝 Draft |
| [money-as-paise](money-as-paise/) | Every amount displayed, stored, charged, and reported is exact | 2 | cross-domain | 📝 Draft |
| [product-weight-and-rates](product-weight-and-rates/) | A product's weight is recorded and prices its shipping | 3 | catalog, shipping | 📝 Draft |
| [shipping-fulfilment](shipping-fulfilment/) | A paid order becomes a real, trackable parcel | 3 | shipping | 📝 Draft — **blocked on a product decision** |

### Sequencing

Within Phase 2, [money-as-paise](money-as-paise/) should land before [server-side-pricing-authority](server-side-pricing-authority/), since recomputation logic written against floats would need rewriting. [payment-confirmation](payment-confirmation/) needs pricing authority first, so that the amount it matches against is trustworthy.

Phase 3 is strictly ordered: [product-weight-and-rates](product-weight-and-rates/) before [shipping-fulfilment](shipping-fulfilment/). Booking real parcels at default weights turns a pricing error into courier invoices that do not match what customers paid.

[shipping-fulfilment](shipping-fulfilment/) carries an open product decision — whether to book real shipments or stop quoting live rates — stated in its `spec.md`. It is the one item here that cannot be resolved by engineering judgement.
