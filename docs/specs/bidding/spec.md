# Spec — bidding

- **Status:** ✅ Implemented — PR-89
- **Domain:** bidding *(new)*, catalog, checkout, payouts
- **Phase:** 8 — Bidding
- **Verified:** 2026-09-09
- **References:** [trd.md](trd.md), [org-payouts](../org-payouts/), [ADR-0004](../../adr/0004-money-as-integer-paise.md), [ADR-0007](../../adr/0007-conditional-stock-decrement.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is

A selling organisation can put one of its products up for timed bidding and get back a link to share. While bidding runs the product stays browsable but cannot be bought normally. When the clock runs out the platform sees who bid what, sells the item directly, and records the price it actually sold for.

## Why

The reason is distribution. A bidding link is a reason to share a product that a product page is not: it has a deadline, a visible contest, and a number that moves. For a store whose customers arrive through WhatsApp, an auction is a marketing event that happens to also set a price.

This deliberately does not automate the sale. The platform already speaks to buyers directly for anything unusual, and for a handful of one-off items a conversation closes better than a checkout link. What is missing is not a payment flow but the record: who bid, how much, and what it finally sold for.

## Requirements

### Creating a bidding event

- **R1** — An organisation creates a bidding event from its own console, choosing exactly one product per event.
- **R1a** — Where that product has size or colour options, the event names the one being auctioned and the bidding page states it. One event is one item, so which item it is cannot be left open.
- **R2** — Creation captures a start time, an end time, a starting bid, the maximum a single bid may raise the price by, and the amounts on the quick-bid buttons.
- **R3** — While setting the starting bid, the creator sees the product's current selling price, so the opening number is set knowingly rather than from memory.
- **R4** — That selling price is kept with the event permanently. Repricing the product afterwards never changes what the event says the item was worth when it opened.
- **R5** — Quick-bid amounts are chosen by the organisation, not fixed by the platform. A ₹200 item and a ₹20,000 item do not share an increment.
- **R6** — A single bid may raise the price by at most the maximum the organisation set. A bidder wanting to go higher bids again.
- **R7** — A product can be under only one bidding event at a time.
- **R8** — An event cannot be opened on a product with nothing in stock.
- **R9** — Creating an event yields a shareable link, ready to send without further steps.
- **R10** — Once the first bid is placed, the event's terms cannot be changed. A bidder commits money against a stated deadline and a stated cap, and those must still hold afterwards.
- **R11** — An event can still be cancelled outright, which returns the product to normal sale and tells everyone who bid.

### Money

- **R12** — Bidders see and enter whole rupees; every amount is stored and compared as exact paise.
- **R13** — A bid is the current highest plus an increase — never a free-standing figure. The increase is at least the smallest quick-bid amount and at most the organisation's maximum.
- **R14** — The first bid on an event is the starting bid.

### The bidding page

- **R15** — The page shows the product as a buyer would see it, the highest bid so far, the time remaining, the quick-bid buttons, and a field for a custom increase.
- **R16** — The identity of the highest bidder is never shown. Only the amount is public.
- **R17** — Time remaining is counted against the platform's clock, not the visitor's device.
- **R18** — The page reads correctly before the event starts, while it runs, and after it ends. A finished event shows a closed page — never a missing one, because the link keeps circulating long after.
- **R19** — Shared into a messaging app, the link previews as the product with its end time and the price so far, so the share itself carries the offer.
- **R20** — The product's usual price is shown alongside the bidding, so a visitor can see what the contest is against.

### Placing a bid

- **R21** — A signed-in bidder is identified from their account and asked for nothing further.
- **R22** — A guest bids by giving a name and a contact number. An email address is invited, never required.
- **R22a** — Where a guest leaves the email blank, the form says plainly what that costs — that there will be no way to tell them if someone outbids them — at the moment they are choosing, not afterwards.
- **R23** — A placed bid is confirmed on the spot, and the bidder can immediately bid again.
- **R24** — A bid worked out against a price that has since moved is refused and the current price shown, never quietly placed at a figure the bidder did not intend.
- **R25** — Members of the organisation selling the item cannot bid on it.
- **R26** — No bid is accepted once the end time has passed, whatever the visitor's page still shows.
- **R27** — Every bid placed is kept. Nothing is removed while an event is running.
- **R28** — When a bid takes the lead, whoever previously led is told they have been overtaken and can bid again — wherever they can be reached. A bidder who gave no email cannot be, which is exactly the cost R22a puts in front of them beforehand. Being unreachable never affects the bid itself: it stands, and it still wins if nobody beats it.

### Buying is suspended, browsing is not

- **R29** — A product under a live event stays listed and searchable exactly as before.
- **R30** — Its buy and add-to-cart actions are unavailable, and the page says why and links to the bidding.
- **R31** — The refusal holds for every route to a purchase, including one requested directly rather than through the interface. Removing a button is not the control.
- **R32** — Whether an item is up for bidding is decided as it is asked, and a product carries no standing mark that it is. Nothing about a product's own record changes when an event opens or closes.
- **R33** — Normal selling resumes by itself once the event ends with no bids, is cancelled, or its sale is completed.

### After the clock runs out

- **R34** — An event ends at its end time whether or not anyone is looking, and shows as ended the next time it is.
- **R35** — An event that closes with no bids returns the product to sale and needs no further action.
- **R36** — The selling organisation sees what its item fetched. It never sees who bid, at any point.
- **R37** — The platform sees every bid with the bidder's amount and contact details, ordered highest first.
- **R38** — The platform completes the sale directly with the winning bidder, off the platform. No delivery address is asked for or kept anywhere: payment, delivery and any remaining detail are settled in that conversation, which is why the organisation can be told an amount without being told a person.
- **R39** — Where the highest bidder does not go through with it, the platform continues down the list.
- **R39a** — Where nobody goes through with it, the event is recorded as unsold and the product returns to sale exactly as though it had never been bid on. An event that ends with bids does not oblige a sale.
- **R40** — The platform records the completed sale: which bidder bought it, and for how much.
- **R41** — Recording the sale reduces stock and returns the product to normal display.
- **R42** — The recorded amount is what the organisation is owed, and reaches its payout record as such.
- **R43** — Recording a sale is attributable — who confirmed it, when, against which bid, and why the amount differs from that bid where it does.
- **R44** — Because the money moves outside the platform, the figure the organisation is paid on is one a person enters. That is a deliberate trust position for now, and the record has to be good enough to answer a dispute months later.

## Product acceptance

- **A1** — On a ~360px phone, an organisation can open an event on a product and come away with a link, without a desktop.
- **A2** — On the same phone, a visitor with no account can find the link, read the item, see the time left, and bid in a single pass.
- **A3** — Two people bidding at the same moment produce one leader and one bidder told the price moved. Neither sees a wrong number and no two bids ever stand at the same amount.
- **A4** — A bid submitted as the clock hits zero is refused, and the page shows as closed on the next load.
- **A5** — With an event running, the product is still reachable from search and listings, and every attempt to buy it fails — including one made directly against the API rather than through the site.
- **A6** — A device with a badly wrong clock still shows the correct time remaining.
- **A7** — Being overtaken produces an email that brings the previous leader back to the page. A guest who left the email blank saw, before bidding, that this would not reach them — and their bid is otherwise treated no differently.
- **A8** — The link pasted into WhatsApp previews with the product, its end time, and the price so far.
- **A9** — After a sale is recorded, the organisation can see the amount and cannot see the buyer, stock has gone down by one, and the product sells normally again.
- **A10** — An event that closes with nobody bidding leaves the product exactly as it was.
- **A11** — An event that ends with bids but no completed sale can be recorded as unsold, after which the product sells normally again and every bid stays on record.
- **A12** — An event on a product with colour or size options states the exact one on the bidding page, and nowhere in the system is a delivery address stored against a bid or a sale.

## Hazards the TRD must address

These are known problems, not solutions. Naming them here so the technical approach cannot quietly skip one.

- **H1** — Two bids arriving together. The winner must be decided by the database, not by reading the current price and then writing a higher one. Two bids must never come to rest at the same amount.
- **H2** — The end boundary. A bid in flight as the clock expires must be settled against the platform's clock at the moment it is written, not against what the page believed.
- **H3** — Two events opened on one product at once, from two tabs or two people.
- **H4** — A purchase completing at the instant an event opens, or an event opening on a product already in someone's cart.
- **H5** — **There is no purchase gate today.** Adding to cart checks nothing, and stock is enforced in only one place: the transaction that creates the order. Suspending sale therefore has to hold at that same point, or it does not hold at all.
- **H6** — **Nothing runs on a schedule here, by choice.** Ending is observed rather than triggered, so every place an event can be looked at has to agree on whether it has ended, and no correctness may rest on a job having run.
- **H7** — **Settlement is by hand, and the payment integration cannot currently issue a standalone payment link** — it only works against an order that already exists. The record written when a sale is confirmed should be shaped so that automating this later adds to it rather than replaces it.
- **H8** — Rate limiting is not available: the implementation is deliberately parked while the cache is unwired. The cap on how far one bid can raise the price is therefore the only thing standing between the page and a bidder acting in bad faith.

## Out of scope (this feature)

- Automated checkout for the winner, payment links, claim windows, and passing on to the next bidder without a person. Deferred by decision — see H7.
- Barring bidders who have failed to complete a purchase before.
- More than one unit per event, and more than one winner.
- Offering the item to losing bidders afterwards.
- Alerts for events that have not started yet.
- Extending the end time when a bid lands in the final seconds.
- A hidden floor below which the item will not sell, distinct from the starting bid.
- Live updating of the price without a reload.
- Rate limiting the bidding endpoint — belongs to [rate-limiting](../rate-limiting/).

