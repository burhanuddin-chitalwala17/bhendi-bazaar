# Spec — org payouts

- **Status:** 🔨 In progress — ledger, settlement and org-facing API landed (PR-67); console screens outstanding
- **Domain:** payouts *(new)*, checkout
- **Phase:** 7 — Promotions & settlement
- **Verified:** 2026-08-16
- **References:** [trd.md](trd.md), [promotions](../promotions/), [ADR-0004](../../adr/0004-money-as-integer-paise.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
A payout system recording what each selling organisation has earned, what the platform kept, and what is still owed — fully maintainable by the platform, readable by the organisation it concerns, with every change captured.

## Why
The store currently keeps every rupee it collects and holds no record of what any organisation is owed. That was tenable when the marketplace had one organisation; with several it means the amount owed exists only as an ad-hoc query nobody has written, computed differently each time it is asked.

It becomes untenable the moment offers exist. Once the platform and an organisation can both discount the same item, "what did this order earn" stops being a subtraction and becomes a question about who paid for the discount. That answer has to be recorded when the order is paid, not reconstructed months later from prices and rates that have since changed.

This is deliberately not a payments integration. Money moves by bank transfer as it does today; what is missing is the record that says how much, and whether it has gone.

## Requirements

### The record
- **R1** — Every paid order produces a ledger entry for each organisation whose goods it contains.
- **R2** — An entry records the goods' value, the discount the organisation funded, the discount the platform funded, the rate applied to each item, the commission taken, and the amount payable.
- **R3** — An entry is written when the order is paid, never when it is placed. An order that is never paid never appears.
- **R4** — Every rate is recorded as it stood when the entry was written, so changing a rate afterwards cannot alter a past settlement by itself.
- **R5** — The platform can create an entry by hand, for anything the order flow does not produce — a reimbursement, a penalty, a negotiated adjustment.

### Maintaining it
- **R6** — Until an entry has been paid out, the platform can edit any figure on it or remove it. Corrections are made in place, not by posting offsetting rows.
- **R7** — Once an entry has been paid out, its figures are fixed. A correction after that point is a new entry, because the transfer it records really did happen at that amount and the record has to keep matching the bank.
- **R8** — Every create, edit, removal and status change is captured — what changed, from what to what, by whom, and when — and is readable from the record itself.
- **R9** — An entry edited by hand is distinguishable from one still reflecting its order. Correcting a payout never edits the order's own history.
- **R10** — An entry can be recomputed from its order on demand, and the platform is warned before this discards a manual correction.
- **R11** — A removed entry stops counting toward any balance but leaves its history behind. Removal never silently changes what an organisation is owed with no record of why.

### The rates
- **R12** — The platform sets each organisation's commission rate individually. Rates differ between organisations by design.
- **R13** — Within an organisation, the platform can set a different rate for a particular category. A category's rate applies to its sub-categories unless one of those sets its own.
- **R14** — Exactly one rate applies to any given item, and which one is determined without ambiguity. Where no category rate covers an item, the organisation's own rate applies.
- **R15** — Commission is charged on what the organisation's goods earned after its own discounts, and before any discount the platform chose to fund.
- **R16** — The platform funds a discount only to the extent it exceeds the organisation's own. Where the organisation's offer is the deeper one, the platform contributes nothing and still earns its full rate on the reduced amount.
- **R17** — A discount the platform funds is visible as a cost against the order, so the platform can see why an order returned less than its rate implies.
- **R18** — Where an order's items carried different rates, the platform can see which rate applied to what. A single commission figure is never presented as though one rate produced it.

### The settlement
- **R19** — The platform can settle any unsettled entries at any time, in whatever grouping it chooses. Settlements are tied to no period and no schedule.
- **R20** — A settlement records what was paid, when, and against which reference.
- **R21** — A settlement's status is set by hand. Nothing marks itself paid.
- **R22** — A settlement can be edited freely while it is unpaid.
- **R23** — A settlement that is cancelled returns its entries to unsettled, intact.
- **R24** — Once recorded as paid, a settlement's amount and reference are fixed, for the reason in R7. It can still be reversed, which is itself a recorded act.
- **R25** — Every change is attributable to the person who made it.

### The views
- **R26** — For each organisation, the platform can see the amount not yet claimed by a settlement and the amount still owed, and these are distinguishable.
- **R27** — For a single order, the platform can see what the buyer paid, what the organisation is owed, the commission, and the campaign cost that separates them.
- **R28** — The platform can see what a given offer has cost it across every order it touched.
- **R29** — An order where the platform's funded discount exceeded its commission is visible as such, rather than averaging into a total.

### What an organisation sees
- **R30** — An organisation can see its own earnings for an order: what its goods were worth, what its own offer cost it, what the platform contributed, the rate applied to each item, the commission taken, and what it is owed.
- **R31** — The platform's contribution is shown rather than hidden. An organisation credited on more than the buyer paid must be able to see why, or the figure looks like an error.
- **R32** — An organisation can see its balance and its settlement history — what is owed, what has been paid, when, and against which reference.
- **R33** — An organisation can see the commission rates that apply to it, including any category rates, without asking.
- **R34** — An organisation's view is read-only. Editing an entry or a settlement is the platform's alone.
- **R35** — An organisation sees only its own records. Never another organisation's figures, and never a platform-wide total.
- **R36** — What an organisation is shown reconciles exactly with what the platform sees for the same order. One set of numbers, two audiences.

### What must not disappear
- **R37** — Deleting an organisation, an order, an offer, or a category never removes or orphans a payout record, and never silently changes a rate already applied. Where a payout record exists, the deletion is refused.

## Product acceptance
- **A1** — An order paid with goods from two organisations produces two ledger entries, and neither includes the other's goods.
- **A2** — An order that expires unpaid produces no ledger entry.
- **A3** — Raising an organisation's rate, or a category's, leaves every previously recorded entry unchanged.
- **A3a** — An order containing two of an organisation's items from categories carrying different rates shows both rates and which item each applied to, not one averaged figure.
- **A3b** — An item in a sub-category with no rate of its own is charged at the nearest ancestor category's rate, and at the organisation's rate when no ancestor sets one.
- **A4** — With a platform offer of 20% against an organisation's 15%, the entry shows the organisation bearing 15% and the platform 5%.
- **A5** — With those reversed — the organisation at 20%, the platform at 15% — the entry shows the organisation bearing 20%, the platform bearing nothing, and the platform's full rate charged on the reduced amount.
- **A6** — An unpaid entry can be edited, the organisation's balance moves accordingly, and the change appears in that entry's history naming who made it.
- **A7** — A paid-out entry refuses editing and offers a correcting entry instead.
- **A8** — Marking a settlement paid moves its entries out of the unsettled balance and leaves the owed balance at zero.
- **A9** — Cancelling a settlement returns its entries to the unsettled balance intact.
- **A10** — A single campaign's total cost is readable in one place, across all orders it discounted.
- **A11** — An order that cost the platform more than it earned appears in a view that names it.
- **A12** — Attempting to delete an organisation that has payout records is refused, and the records remain.
- **A13** — Attempting to delete a category that carries a commission rate is refused; no organisation's rate changes as a side effect.
- **A14** — An organisation signed into its own portal sees, for one order, the same payable the platform sees — to the paise.
- **A15** — Where the platform funded part of a discount, the organisation's view names that contribution rather than leaving an unexplained gap between the buyer's price and its own credit.
- **A16** — An organisation cannot reach another organisation's ledger, balance or settlements, including by editing the URL.
- **A17** — An organisation cannot change an entry, a settlement, or a status, through the interface or the handlers behind it.

## Out of scope (this feature)
- Transferring money. No gateway, no bank integration, no automated disbursement.
- Tax, GST treatment, and invoice generation.
- Shipping revenue and courier cost. The platform books and pays carriers, so shipping stays outside the organisation's ledger entirely.
- Refund and cancellation reversals. The entry shape carries a kind so reversals fit later; the flow itself is Phase 5.
- Any organisation-facing dispute or adjustment-request flow. An organisation reads its ledger; querying a figure happens off-system for now.
