# TRD — org payouts

- **Status:** 🔨 In progress — PRs 1–3 and the handlers behind 4–8 landed (PR-67); the screens themselves outstanding
- **Domain:** payouts *(new)*, checkout
- **Phase:** 7 — Promotions & settlement
- **Verified:** 2026-08-16
- **References:** [spec.md](spec.md), [promotions/trd.md](../promotions/trd.md), [ADR-0019](../../adr/0019-discount-is-one-winning-offer.md), [ADR-0020](../../adr/0020-money-bearing-records-never-cascade.md), [ADR-0004](../../adr/0004-money-as-integer-paise.md), [ADR-0012](../../adr/0012-modules-are-vertical-slices-by-domain.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A ledger written at the moment an order becomes paid, holding one entry per organisation per order with the commission rate frozen onto it, fully editable by the platform, readable by the organisation it concerns, and backed by a change history that records every create, edit and removal. Settlements group entries and carry a status the platform sets by hand.

The line that decides where editing stops is **payment, not creation**. Before an entry has been paid out there is no external fact to contradict, so editing it is correcting the platform's own arithmetic and full CRUD is right. After money has left the bank, the entry is evidence of a transfer that actually happened; editing it destroys the only property a payout system exists to provide, which is that the ledger and the bank statement agree. A correction after payment is therefore a new entry.

This is the same rule as an invoice: edit the draft freely, issue a credit note against the sent one. It gives the platform unrestricted maintenance over everything still in flight — which is where essentially all operational work happens — and immutability only where it is protecting something.

## Technical decisions

- **D1** — A new `server/payouts/` domain. It owns the ledger and settlement aggregates and reads order and discount data through checkout's public surface. It is not analytics, which is read-only aggregation over other domains' tables; this domain writes rows nothing else may write.
- **D2** — The commission base is the organisation's goods value less the discount that organisation funded — not what the buyer paid. On ₹1,000 of goods with ₹150 funded by the organisation and ₹50 by the platform, the buyer pays ₹800 and the base is ₹850. At 15% the commission is ₹127.50, the organisation is owed ₹722.50, and the platform keeps ₹77.50 — its commission less what it chose to fund. Basing commission on the ₹800 instead would quietly make the organisation co-fund the platform's campaign, which is the defect this decision exists to prevent.
- **D2a** — The platform's funded share is floored at zero, which makes the arrangement deliberately asymmetric. Reverse the figures above — the organisation offering 20% against the platform's 15% — and the organisation bears the whole ₹200, the platform funds nothing, the base is ₹800, and the platform earns its full ₹120 at its own rate. A deeper organisation discount reduces what the platform earns in rupees, because the base shrank; it never obliges the platform to contribute. The platform tops up to a better offer, it does not match a better one.
- **D3** — The funding split it depends on is produced by [promotions](../promotions/) D10 under [ADR-0019](../../adr/0019-discount-is-one-winning-offer.md), where a check constraint asserts the two parts sum to the buyer's discount. Settlement arithmetic is therefore never reconstructed from prices; it reads a split that the database has already guaranteed reconciles.
- **D4** — Rates are basis points, and the applicable rate is copied onto the record at the time it is written. Storing only a reference would let a later rate change rewrite history, which R4 forbids. Basis points rather than a percentage keeps the money path integral ([ADR-0004](../../adr/0004-money-as-integer-paise.md)).
- **D4a** — An organisation's rate is its default; category overrides live in a rule table holding the organisation, a nullable category, and a rate. This is the same shape as promotions D2 for the same reason — a future dimension is a nullable foreign key rather than a redesign — and the rule restricts deletion of the category it names, since a cascade here would silently move an organisation onto a different rate.
- **D4b** — Resolution walks a product's category and then its ancestors, nearest first, and takes the first rule found; with none, the organisation's default applies. This is unambiguous because `Product.categoryId` is single-valued, so an item has one ancestry and therefore one rate. Nearest-wins is what makes a rate on a parent category mean "unless a child says otherwise" without any precedence field to configure.
- **D4c** — Because rates resolve per item, one organisation's share of one order can carry several. The entry therefore holds the totals and a child row per order line carries that line's base, rate and commission. Splitting into one entry per rate was rejected: the entry is the unit of settlement and the unit the per-order view reads, and fragmenting it to preserve a single rate column would complicate both to simplify neither. The consequence is that "the organisation's rate" is no longer a property of an entry, only of a line — which is honest, and is what R18 exists to display.
- **D5** — Entries are written from the paid transition in `server/checkout/order.service.ts`, which is already the single place an order becomes paid and already the place side effects belong. Writing them at order creation would put unpaid and expired orders into a payout.
- **D6** — Entries are mutable rows with a lifecycle state, not immutable facts. The state — draft, settled, reversed — is what gates editing, so "can I change this" is answered by data rather than by a rule living in a service. Entries also carry a kind and a signed payable, so a manual reimbursement or a post-payment correction is an ordinary row rather than a special case.
- **D7** — A settlement claims entries by stamping them, and the balance owed is the sum of entries not claimed by a paid settlement. Two figures are exposed because they differ and both matter: what is unclaimed, and what is owed. A settlement is free-form over any unsettled entries — it carries no period and no schedule, because a transfer is decided by the platform when it suits, and a period column would only be a description of which entries happened to be selected.
- **D8** — Editing is refused once an entry's settlement is paid, and a settlement's amount and reference are refused once it is paid. Both are enforced in the service, not only in the UI, since the alternative is a correct-looking screen over a record that no longer matches the bank. Reversal remains available and is itself recorded.
- **D9** — Every mutation writes to the existing `AdminLog` — before and after values, actor, timestamp — rather than to a bespoke history table. It already exists for exactly this, and a second audit mechanism would drift from the first. The entry's own history view is a query against it.
- **D9a** — Removal is a soft delete. A hard delete would drop money out of a balance leaving nothing to explain the change, which is the one outcome a payout record cannot afford; a soft-deleted entry stops counting and stays readable.
- **D9b** — An entry records whether it has been manually edited, so a figure that no longer derives from its order is visibly not derived. Recomputing from the order is an explicit action that warns before overwriting such an entry, rather than a silent reconciliation job.
- **D10** — Campaign cost per offer is derived from the per-order discount records rather than duplicated onto the ledger, since those records already carry both the offer and the platform's funded share. The ledger stays the settlement view; the discount records stay the attribution detail.
- **D11** — Shipping is excluded from both the base and the payable. Couriers are booked and paid on the platform's account, so passing shipping through the ledger in both directions would add two offsetting figures and no information.
- **D12** — An entry whose platform-funded discount exceeds its commission is a negative-margin order and is flagged on write rather than found later by inspection. This is a real outcome of letting the platform outbid an organisation's offer, so it is surfaced by construction.
- **D13** — The organisation's view is a projection of the same rows the platform reads, not a second calculation. Recomputing an organisation's earnings from prices for its own screen is how two audiences come to see two numbers for one order; the projection reads `payable` and its lines exactly as written.
- **D13a** — That projection **discloses the platform's funded share**, rather than hiding it. Hiding it was the first instinct and is wrong twice over. It does not work: an organisation can see its own storefront price and knows its own offer, so it can compute the difference in a moment. And it removes the one fact that makes the commission base legible — without it, an organisation credited on ₹1,700 for goods a buyer paid ₹1,600 for is looking at an unexplained gap, which reads as an error rather than as the platform having spent ₹100 to move its stock. Shown plainly it is good news about the platform investing in that organisation.
- **D13b** — A consequence of D13a worth stating: the organisation's order view and its payout view must agree, and both may name the buyer's price. Had the top-up stayed hidden, neither could have shown what the buyer actually paid without exposing it by subtraction — an awkward constraint that disclosure removes entirely.
- **D14** — The organisation's surface is read-only, enforced in its own handlers rather than by omitting buttons. `orgId` comes from the route and is checked against membership, never read from a body or a query parameter — the same rule promotions D13 applies to offers, and the one that keeps one organisation out of another's ledger.

## Packages
None.

## UI approach
Two audiences, one set of numbers. At ~360px the platform's organisation list is a single column of cards, each showing the organisation's name and its owed balance as the primary figure, with the unclaimed figure secondary — the two are never shown as one number.

An organisation's detail view stacks its unsettled entries as cards, one per order, each reading buyer paid, organisation payable, commission and campaign cost in that order, so the last line explains the gap between the first two. A negative-margin entry carries a warning-token badge on the card rather than colour alone; a manually edited one says so on the card, since a figure that no longer derives from its order should not look like one that does.

Editing is a full-screen form on a phone rather than an inline field, because the figures interlock and a partially visible form invites a half-made correction. A paid entry opens the same form read-only with a single action offering a correcting entry, so the route to fixing it is visible at the moment the edit is refused rather than explained in an error. Each entry carries its change history behind a disclosure, newest first. Creating a settlement is a docked primary action above the tab bar; recording payment is a form with amount, date and reference. Entry tables widen at `md:` and scroll horizontally within their own container rather than widening the page.

The organisation's own screen lives in its portal and leads with the figure it came for — what it is owed — with the unsettled amount beneath it. An order reads down as a short derivation rather than a table: goods, its own offer, the platform's contribution where there was one, commission with its rate, and the payable in a heavier weight at the foot. That order is deliberate, so the last line is explained by the ones above it instead of needing a caption. Settlement history is a list of paid amounts with dates and references, and its applicable rates sit behind a link rather than on the summary, since a rate is checked occasionally and read once. Nothing here is a control: no forms, no status pickers, no edit affordances to grey out.

## Data model
`[MIGRATION]`. Organisations gain a default commission rate in basis points, defaulted to 1500 and backfilled to 1500 on existing rows, plus a commission rule table holding the organisation, a nullable category and a rate. A ledger entry table holds the organisation, order, kind, lifecycle state, goods value, both funded discounts, commission base, commission, signed payable, a negative-margin flag, a manually-edited flag, a soft-delete timestamp, and a nullable settlement reference; an entry line table holds the order line, its base, its resolved rate and its commission. A settlement table holds the organisation, amount, status, reference, paid timestamp, note, and the users who created and last changed it — no period, per D7.

**Nothing in this domain cascades.** Every foreign key out of a payout record restricts, so deleting an organisation, an order, an offer, or a rated category is refused while a payout record points at it — the same guarantee that keeps a sold product from being deleted out from under its order history. A payout record is evidence that money is owed or has moved; it must outlive any tidying of the rows it happens to reference. One consequence to accept deliberately: `orderService.deleteOrder` becomes unusable on any order that has reached a ledger entry, which is correct, and points at cancellation rather than deletion being the operation actually wanted there.

## API / contract changes
None crossing the browser boundary for buyers. New admin handlers for the ledger views and settlement lifecycle, and read-only organisation handlers scoped by route and membership; nothing in [CONTRACTS.md](../../CONTRACTS.md) changes shape.

## Test plan
Per [TESTING.md](../../TESTING.md), this is money-path arithmetic and carries those targets.
- The commission base excludes the platform's funded discount and includes the organisation's, over the worked figures in D2.
- Payable plus commission less platform-funded discount equals the buyer's payment for those lines, as a property.
- The platform's funded share floors at zero when the organisation's offer is the deeper one, and the platform still earns its full rate on the reduced base (D2a).
- A multi-organisation order produces one entry per organisation, partitioned with nothing shared or double-counted.
- An expired unpaid order produces no entry.
- Changing an organisation's rate, or a category's, leaves prior entries and their lines unchanged.
- Rate resolution takes the nearest ancestor category carrying a rule, and the organisation's default when no ancestor does.
- An order whose lines resolve to different rates produces one entry whose commission is the sum of its lines, each carrying its own rate.
- Deleting a category that carries a commission rule is refused, and no organisation's effective rate moves as a result.
- A reversal entry offsets its original to zero.
- An unsettled entry accepts edits, moves the balance, and records before and after values with an actor.
- An entry under a paid settlement refuses edits, at the service and not merely in the UI.
- A soft-deleted entry leaves every balance as if it were absent, and remains readable.
- Recomputing from the order refuses to silently overwrite a manually edited entry.
- Claiming, cancelling and paying a settlement move the two balances as specified.
- Deleting an organisation, an order, or an offer referenced by a payout record is refused rather than cascading.
- Negative margin is flagged when the platform's funded discount exceeds its commission.
- The organisation's projection of an order equals the platform's payable for it, to the paise, over the same fixtures.
- The projection names the platform's funded share wherever one exists, and omits the section entirely where none does.
- An organisation reading another organisation's ledger, balance or settlements is refused at the handler, not merely absent from the interface.
- Every organisation-facing payout handler refuses a write, including one aimed at its own records.
- Rounding: commission on an odd base never leaves a stray paise between payable, commission and buyer payment.

## Delivery (PRs)
1. Organisation default rate, the commission rule table, and the pure rate resolver with its ancestry walk. Inert; nothing reads it.
2. Ledger entry and entry-line schema, and the pure settlement calculator, with its tests. Nothing writes entries.
3. Entries written from the paid transition, including the negative-margin flag. The ledger starts filling.
4. Platform ledger views — per organisation and per order, with the campaign cost line.
5. Entry maintenance: create, edit, soft-delete, recompute-from-order, and the change history over `AdminLog`.
6. Settlement lifecycle and its administration.
7. Campaign cost per offer, read from the discount records.
8. The organisation's read-only earnings, balance, settlement history and rates, in its portal.

PR 3 is the first that writes data. PRs 1 and 2 are inert; 4, 7 and 8 are read surfaces over what 3 produces; 5 and 6 are the maintenance surfaces and depend on 4 existing to edit from. PR 8 comes last of the read surfaces deliberately — it is the one an outside party sees, so it should read figures the platform has already been living with rather than debut alongside them.

## Questions closed (2026-08-15)
- **Q1** — Yes: rates vary by category within an organisation. Answered by D4a, D4b and D4c. The consequence worth noting is that a rate stops being a property of an organisation-and-order and becomes a property of a line, which is why entries gained child rows.
- **Q2** — Free-form. The platform settles whatever is unsettled, whenever it suits; no period is stored, per D7.
