# Spec — winner-offer

- **Summary:** When an auction ends, the highest bidder is emailed an offer to accept or decline; accepting opens a checkout made for them at their bid, and a decline or silence passes the item down the list
- **Status:** Accepted
- **Domain:** bidding, checkout, payments, notifications
- **Phase:** 8 — Bidding
- **Verified:** 2026-09-28
- **References:** [../spec.md](../spec.md) (bidding), [trd.md](trd.md), [checkout-abandonment](../../checkout-abandonment/), [ADR-0023](../../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), [ADR-0005](../../../adr/0005-payment-state-server-only.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

The sale that bidding left to a conversation becomes a flow the platform runs itself. When an auction ends, the top bidder is emailed an offer. Accepting it opens a checkout made for that bidder alone, at the price they bid. Declining, staying silent, or not paying in time passes the offer to the next bidder, until someone buys or the list runs out.

## Why

Settling by hand worked for a handful of items, but it doesn't scale, and it leaves a winner waiting on someone to get in touch. An auction ends at a stated time, and bidders expect it to finish the same way, with a clear next step while they still want the item. The bidding spec deferred this on purpose (its H7) because the payment integration could only charge an existing order. This feature closes the gap by making the winner's purchase an ordinary order, so it collects an address, takes payment and ships like any other sale.

It reverses three of the bidding spec's out-of-scope items: automated checkout for the winner, claim windows, and passing to the next bidder without a person. It also reverses its R38, which kept the sale off the platform and stored no delivery address.

## Requirements

### The offer

- **R1** — When an auction ends with bids, the first offer goes out on its own, promptly. No person has to act first.
- **R2** — An offer goes to one person at a time. That person is the highest bidder not yet offered the item, counted by person, not by bid, so someone with several bids on the ladder is offered once.
- **R3** — Each person is offered the item at their own highest bid. Nobody is asked to pay a price someone else bid.
- **R4** — An offer comes as an email with two clear choices, accept and decline, and states the item, the exact option (size or colour), the price and the deadline.
- **R5** — A bidder the platform can't email is skipped, and the record says why. Guests who left the email blank and accounts without an email are both skipped this way.
- **R6** — Before bidding, a bidder with no email is told plainly that if they win, they can't be offered the item. The bidding spec's R22a warning grows to say so.
- **R7** — Following a link never decides anything on its own. The bidder confirms their choice on a page, so a mail program that opens links in advance can't accept or decline for them.
- **R8** — An offer link works only for its own offer, only once, and not after the offer has closed.

### The deadline

- **R9** — A bidder has 12 hours from the moment the offer is sent to accept and pay. There is one deadline, not one to reply and another to pay.
- **R10** — The deadline is part of the auction's stated terms. The bidding page says, before anyone bids, that the winner has 12 hours to confirm and pay or the item goes to the next highest bidder. Like the bidding spec's R10, it can't change once the first bid is placed.
- **R10a** — The bidding page makes it prominent, next to the price and the bid controls rather than in small print, that the winner pays shipping on top of the bid. The offer email says the same. A bid is never presented as the full cost of the item.
- **R11** — The offer email, the confirm page and the checkout all show the time left, counted against the platform's clock.
- **R12** — Declining, letting the deadline pass, or accepting without paying in time all end that person's offer, and the next offer follows without anyone acting.
- **R13** — Nothing can be started on an offer after its deadline: no accepting, no declining, and no opening a payment. A payment already under way when the deadline passes may finish, because refusing money a bidder has already sent turns a sale into a refund. Every check happens at the moment of acting, never against what a page last showed.

### The winner's checkout

- **R14** — Accepting opens a checkout made for this sale: one item, the auctioned option, the bid price, quantity one. The bidder can't change any of these.
- **R15** — It asks for a delivery address and takes payment as the normal checkout does, and a guest bidder can complete it without creating an account.
- **R15a** — Shipping is charged to the winner on top of the bid, worked out for their address exactly as it would be for a normal order. The checkout shows the bid and the shipping as separate lines before payment.
- **R16** — No coupon or offer applies. The bid already is the negotiated price.
- **R17** — Leaving the checkout unpaid doesn't cost the bidder the item before their deadline. They can return through the same link and try again.
- **R18** — Until the sale completes or the chain ends, the item stays unavailable to everyone else, exactly as it is while bidding runs.

### Completing, and running out

- **R19** — A confirmed payment completes the auction. The item is recorded as sold to that bidder for that amount, stock goes down by one, and the order is fulfilled like any other.
- **R19a** — The organisation is paid on an auction sale exactly as on any other sale, with the platform keeping its commission under the terms agreed with that organisation. An auction is not a separate commercial arrangement.
- **R19b** — Auctions that ended before this feature keep manual settlement. No offer is ever sent for them, and the platform records their outcome by hand as before.
- **R20** — When every bidder has been offered the item without a sale, the auction is recorded as unsold, the item returns to normal sale, and the platform is told.
- **R21** — Every bid and every offer stays on record, including who was offered, when, and how it ended.

### The platform's controls

- **R22** — The platform can see the chain for any auction: who holds the offer now, the time left, and how every earlier offer ended.
- **R23** — The platform can end the current offer early and pass to the next bidder. It can also stop the chain and record the auction as unsold. Each such action is attributable.
- **R24** — The selling organisation sees the sale the way it sees any order it fulfils. It never sees the bid ladder, the losing bidders, or the offer chain.

## Product acceptance

- **A1** — An auction ends with three bidders. Within minutes, the top bidder has an email showing the item, their price, and a deadline 12 hours away.
- **A2** — On a ~360px phone, a guest accepts from the email, enters an address and pays in one pass. The item is then sold, and the next bidder hears nothing.
- **A3** — The top bidder declines. The second bidder receives an offer at their own highest bid, not the winning figure.
- **A4** — The top bidder ignores the email. After the deadline the offer passes on, and the old link shows the offer as closed.
- **A5** — A bidder accepts, abandons the payment window, returns two hours later through the same link, and can still pay.
- **A6** — A bidder with no email is skipped, and the platform's view of the chain says so. The bid form warned that bidder beforehand.
- **A7** — A mail scanner opening the accept and decline links changes nothing.
- **A8** — While any offer is open, every direct attempt to buy the item fails, including one made against the API.
- **A9** — When every bidder declines, the auction shows as unsold and the product sells normally again.
- **A10** — The organisation sees the completed order and can fulfil it, and sees no other bidder.
- **A11** — On a ~360px phone, the bidding page shows "winner pays shipping" without scrolling past the bid controls, and the winner's checkout shows the bid and the shipping as two lines.
- **A12** — The organisation's payout for an auction sale shows the same commission it would on a normal order for that item.
- **A13** — An auction that ended before this shipped, with bids still unsettled, gets no email and is still settled by hand.

## Out of scope (this feature)

- Offering by SMS or WhatsApp. Email is the only automated channel today.
- A deadline the organisation chooses per auction. The window is fixed at 12 hours for now.
- Barring bidders who have walked away from a win before.
- Offering the item to more than one bidder at once, or more than one unit per auction.
- Any change to how the auction itself runs: bids, the clock, and the purchase gate while it's live.
