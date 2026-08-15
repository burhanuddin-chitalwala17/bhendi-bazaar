# TRD — promotions

- **Status:** 🔨 In progress — PRs 1–5 landed (PR-67); 6–7 (offer administration screens) outstanding
- **Domain:** promotions *(new)*, catalog, checkout
- **Phase:** 7 — Promotions & settlement
- **Verified:** 2026-08-16
- **References:** [spec.md](spec.md), [org-payouts/trd.md](../org-payouts/trd.md), [ADR-0018](../../adr/0018-one-effective-price-function.md), [ADR-0019](../../adr/0019-discount-is-one-winning-offer.md), [ADR-0020](../../adr/0020-money-bearing-records-never-cascade.md), [ADR-0002](../../adr/0002-server-holds-pricing-authority.md), [ADR-0004](../../adr/0004-money-as-integer-paise.md), [ADR-0012](../../adr/0012-modules-are-vertical-slices-by-domain.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
One promotion aggregate with three independent axes — who funds it, how it activates, and what it covers — evaluated by a pure function that turns a set of priced lines into a set of per-line discount amounts. The same function runs at display time and inside the order transaction, so the price advertised and the price charged cannot diverge.

The discount is computed per line and stored per line. That single decision is what lets partial coupon coverage, the funding split between platform and organisation, and per-item refunds all fall out of one mechanism rather than three.

The seam already exists: `server/checkout/pricing.ts` assembles totals with a constant zero discount and names the coupon case in its own comment. This feature fills that in.

## Technical decisions

- **D1** — A new `server/promotions/` domain per [ADR-0012](../../adr/0012-modules-are-vertical-slices-by-domain.md). It is not catalog (an offer is not a product fact) and not checkout (checkout composes it). Its public surface is a resolver plus a pure calculator; checkout calls both.
- **D2** — *Who funds it* and *how it activates* are enum columns — each is genuinely two-valued and will stay so. *What it covers* is rows in a child table with real foreign keys, one nullable column per dimension. A polymorphic `targetType` string was rejected: it has no referential integrity, a deleted category leaves an id that silently stops matching, and it is exactly the magic string the root [CLAUDE.md](../../../CLAUDE.md) forbids. Adding a future dimension is one nullable column and one branch in the matcher.
- **D3** — Zero target rows means "everything in scope". Targeting only ever narrows, so there is no `ALL` member to declare or maintain.
- **D3a** — Because of D3, a target row must **restrict** deletion of the category or product it names rather than cascading. Cascading would let deleting a category silently remove a promotion's only target — and a promotion with no targets applies to everything, so a routine catalogue tidy-up would turn a category-specific offer into a store-wide one. Restrict is also what `Category` already uses for its products, so the catalogue's delete behaviour stays consistent. More broadly, nothing a discount or payout record points at may be cascade-deleted: the order discount records restrict their promotion and their order for the same reason [org-payouts](../org-payouts/) restricts everything.
- **D4** — Percentages are stored in basis points, amounts in paise ([ADR-0004](../../adr/0004-money-as-integer-paise.md)). No rate or amount on the money path is a float. A third value type expresses a fixed selling price, which is what today's per-product markdown means and what a percentage cannot represent.
- **D5** — Automatic offers are evaluated **per line** and may carry no basket-level condition; coupon offers are evaluated **per order** and may. This is forced, not chosen: an automatic offer sets the price shown on a product page, and a product page cannot know the basket. It also means two automatic offers can legitimately apply to one order on different lines.
- **D6** — A scope's total discount is allocated across its lines by largest-remainder rounding, so per-line shares sum to the scope total exactly. Proportional-then-round drifts, and a drifting total is a defect under [ADR-0004](../../adr/0004-money-as-integer-paise.md), not a tolerance.
- **D7** — Offers compete rather than compound: a line's discount is the largest single applicable offer, never a sequence of them. Compounding would let a deep markdown take a further campaign discount on top, which is how a margin goes negative unobserved.
- **D8** — Interaction between an automatic offer and a coupon is a per-line maximum of the two. Spec R10 and R14 are then properties of that expression rather than separate branches, and partial coverage needs no special case.
- **D9** — `Product.salePrice` is removed and becomes an organisation-funded, automatically-applied, product-targeted offer with a fixed selling price. Keeping it as a base-price change was rejected once the funding split was specified: a markdown is an organisation's own offer, and an offer outside the comparison cannot be weighed against a platform offer or attributed to whoever paid for it.
- **D10** — Every reduction is recorded with its funding divided in two: the organisation bears its own best offer, the platform bears only the remainder needed to reach what the buyer got. A database check constraint asserts the two parts sum to the buyer's discount, so no settlement can be computed from a split that does not reconcile. Rationale and worked figures: [org-payouts/trd.md](../org-payouts/trd.md).
- **D11** — Coupon usage limits are enforced with a conditional update inside the order transaction, matching [ADR-0007](../../adr/0007-conditional-stock-decrement.md) — the check is the write's `where` clause, and a zero row count means exhausted. Read-then-write oversells a limited coupon exactly as it oversells stock. The counter is released where stock is released, in `expireAndRestock`.
- **D12** — The active offer set is loaded once per request and matched in memory, never queried per product. Live offers are a small set, and D5 puts this read on every listing render.
- **D13** — Organisation coupon codes must begin with that organisation's existing code. This makes collisions impossible by construction rather than by an error message, and makes partial coverage self-explaining: a code that names its organisation answers "why did this only apply to some items" without a support message. Codes go live without platform approval, including for self-signed-up organisations: the prefix removes the collision and confusion risks, and an organisation discounting its own goods cannot cost the platform money, because commission is charged on what those goods earned after the organisation's own discount ([org-payouts](../org-payouts/) D2).
- **D13a** — The per-organisation depth ceiling constrains an organisation's **own** offers only, and is checked per offer. It is a guard against an organisation mis-keying its own margin away — a real hazard with self-serve signup — not a platform protection, since an organisation's discount shrinks the platform's commission proportionally and can never drive it negative. Platform offers on that organisation's goods are unconstrained by it: that is the platform spending its own money, funded per D10.
- **D14** — Order-time re-resolution against the clock throws a specific expiry error rather than relying on the existing displayed-total guard in `server/checkout/order.service.ts`, which would report an expired coupon as a price change.
- **D15** — Offer resolution is cached no longer than a request. Prices now change on a clock, so any cache outliving an offer boundary would serve a price the server will refuse.

## Packages
None.

## UI approach
At ~360px the cart lists items in a single column; a discounted item shows its reduced price with the original struck through beneath it, and a compact offer badge on the line rather than beside it. Below the list sits a savings total and one line telling the buyer a coupon can be applied at checkout — text, not an input.

Checkout keeps the same line treatment and adds the code field above the summary, full-width, using the shared input so the 16px mobile base is preserved. An applied coupon renders as a block naming the code, the amount, and a coverage line ("covers 2 of 3 items"); covered lines carry the badge and uncovered lines carry nothing, so the eye reads coverage from the list rather than from prose. Rejections and better-offer-already-running messages appear inline against the field through the existing error envelope ([ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md)). The admin and organisation offer forms are single-column at base with the date range stacked, widening to two columns at `md:`.

## Data model
`[MIGRATION]`. A promotion aggregate with its funding scope, activation kind, code, value, window, stop switch and usage counters; a target child table with nullable foreign keys to category and product; a per-order discount record carrying the funding split and a check constraint that it reconciles; a per-line allocated discount column on the order line. `Product.salePrice` is backfilled into product-targeted offers and then dropped. Organisations gain a maximum discount depth.

The backfill cannot invent an end date for markdowns that never had one. It sets a far-future end and lists those offers for review rather than choosing a business deadline in a migration.

No foreign key in this feature cascades (D3a): targets restrict their category and product, and the per-order discount records restrict their promotion and their order.

## API / contract changes
Yes — `[CONTRACT]`. A quote endpoint returns applicable offers, per-line discount amounts, and rejection reasons. Order creation accepts an optional coupon code — a string, never an amount. Product and cart DTOs gain the offer-adjusted price alongside the original, and lose `salePrice`.

## Test plan
Per [TESTING.md](../../TESTING.md), this sits on the money path and carries its targets.
- Allocation sums to the scope total exactly, across awkward divisions and single-paise remainders.
- A line's charged price never exceeds its displayed price, as a property over generated baskets.
- Best-offer selection: platform beats organisation, organisation beats platform, ties, and neither present.
- The funding split reconciles to the buyer's discount in every one of those cases.
- Category targeting reaches descendants; an offer on a leaf does not reach its siblings.
- A coupon covering no basket item is refused rather than applied at zero.
- A coupon worth less than a running offer changes no line.
- A usage-limited coupon redeems exactly its limit under concurrent placement.
- An expired offer at order time produces the expiry error, not the price-change error.
- An organisation-scoped offer leaves another organisation's lines untouched.
- Deleting a targeted category is refused, and no offer's coverage widens as a result.
- A discount amount in a request body is ignored.

## Delivery (PRs)
1. Schema, resolver and pure calculator with the allocator and the funding split. Nothing calls it; verifiable entirely through tests.
2. Checkout applies automatic offers, writes the discount records, increments conditionally, releases on expiry. Buyers see a discount at checkout they did not see on the product page — the safe direction.
3. Displayed prices move to the shared price function across listings, product page and cart. This is also where the eight sites that currently disagree about a sale price are consolidated.
4. Coupon quote endpoint and the checkout field, with coverage and rejection messaging. `[CONTRACT]`.
5. `Product.salePrice` backfilled into offers, product form repointed, columns dropped. `[MIGRATION]`.
6. Platform offer administration.
7. Organisation offer administration, scoped by route and membership.

PR 2 is the first to change what a buyer is charged. PR 3 is the riskiest and deliberately follows it, so the storefront never advertises a price checkout would refuse.

## Questions closed (2026-08-15)
- **Q1** — The question was posed wrongly. It asked whether the depth ceiling applies per offer or to the combined effect on a line, but D7 makes offers compete rather than stack, so no line ever carries a combination and there is nothing to add up. What actually remained was whether the ceiling binds the platform as well as the organisation; it does not. Answered by D13a.
- **Q2** — No approval. Organisations are self-serve and their codes go live immediately, per D13.
