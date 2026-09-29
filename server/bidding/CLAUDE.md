# CLAUDE.md — bidding domain

- **Verified:** 2026-09-29
- **Covers:** `server/bidding/**`

> **Read the project-wide rules first:** [`/CLAUDE.md`](../../CLAUDE.md) covers the SDLC and the Project Invariants. This file covers **bidding** only. Requirements are in [docs/specs/bidding/](../../docs/specs/bidding/) and, for what happens after an auction ends, [winner-offer](../../docs/specs/bidding/winner-offer/).

## Purpose
Bidding owns timed auctions on a single item: opening an event, taking bids, suspending the item from normal sale while it runs, offering it down the ladder once it ends, and recording what it sold for. It reads a product through `catalog`. An auction created since winner-offer sells through an **ordinary order** the winner pays for, priced from their accepted offer ([ADR-0041](../../docs/adr/0041-an-auction-winner-buys-through-an-order-priced-from-their-offer.md)). An older one (`claimWindowHours` null) is still settled by hand, which credits the organisation through `payouts` and creates no order.

## Boundaries

**Owns:** `server/bidding/**` and the `BiddingEvent`, `Bid` and `BidOffer` tables.

**Does not own:** the product or its stock (`catalog`), the winner's order and its payment (`checkout`, `payments`), the ledger entry a sale produces (`payouts`), or the emails it triggers (`notifications`). It composes them.

## The two ideas everything here rests on

**1. Stored status records only what the clock cannot decide.** `BiddingStatus` is `OPEN | CANCELLED | SOLD | UNSOLD`. Whether an `OPEN` event is scheduled, running or finished comes from `startAt`/`endAt` against a clock passed in — every time it is read, by `bidding-window.ts`. A read cannot be stale because nothing was cached ([ADR-0023](../../docs/adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)). `BidOffer` follows the same rule: whether an offer can still be acted on is `isActionable` in `offer-chain.ts` — status *and* `expiresAt > now` — asked at the moment of acting. What follows an ending, the offer chain, does run on the worker (ADR-0041 D4), but a late job only delays the next email; it never lets a late acceptance through.

**Never branch on `status` alone.** `status === "OPEN"` does not mean "biddable". Go through `biddingPhase`, `isAcceptingBids` or `suspendsPurchase`.

**2. Every contested write is decided by the database.** A bid, the opening of an event and a stock movement are all guarded conditional updates whose affected-row count is the verdict ([ADR-0007](../../docs/adr/0007-conditional-stock-decrement.md)). Application-level checks in this domain exist to produce a good message and are advisory by construction. Two constraints Prisma cannot express live in the migration and are load-bearing: a partial unique index making one live event per product a database fact, and `@@unique([eventId, amountPaise])` making tied bids impossible independently of the guard.

## Rules

- **`acceptBid` is the only way a bid is accepted.** Its `where` carries the clock, the event's state and the price together, so nothing can arrive after the close or land at a figure that does not beat the current high. Adding a bid path that reads first and writes second reintroduces both races.
- **`orgId` is a parameter, never a body field.** A body-supplied one is how an organisation would open an event on someone else's goods.
- **Org-facing and public reads select no bidder column.** `PublicBiddingView` and `OrgBiddingSummary` have no field that could carry one, so [spec](../../docs/specs/bidding/spec.md) R16 and R36 hold as a property of the type. `BidLadderEntry` is the only shape that names a person, and only platform-admin surfaces are typed to receive it.
- **The purchase gate is derived, never stored.** Nothing is written to `Product` when an event opens or closes. Display reads go through the request-memoised `loadBiddingLockContext`; enforcement goes through `assertNotUnderBidding` **inside** the order transaction, which is the only race-safe point. In `order.service.ts` that call sits *after* the stock reservation deliberately — the reservation takes the row lock that event creation also takes, so checking afterwards is what makes the two decisions serial. Moving it earlier silently reopens the window.
- **A hand-recorded sale writes an `OrgLedgerEntry` of kind `ADJUSTMENT`; an offer-settled sale writes none.** The winner's paid order credits the organisation through the ledger's normal path, with commission, so an `ADJUSTMENT` beside it would pay the organisation twice. `confirmSale` refuses any event with a claim window for the same reason.
- **`advance` in `offer.service.ts` is the only thing that moves a chain.** The end-of-auction job, the hourly sweep, a decline and an admin all call it; it locks the event row first and decides from what it then reads. Anything writing an event and its offers in one transaction takes the event lock first too (`completeFromPaidOrder` does), or the two deadlock.
- **An offer with an unpaid or paid order on it is never lapsed or withdrawn.** A payment begun before the deadline may finish after it (winner-offer R13). `advance` asks payments to release abandoned attempts first, and holds while one is genuinely moving.
- **The offer link's token exists only in the email.** `offer-notify.ts` mints it at send time and stores its SHA-256; it is never in a job payload, a notification row or a log.
- **The winner's order is the only way past the purchase gate.** `assertNotUnderBidding` takes a claim and releases that claim's *event*, never the product. `claimOfferForCheckout` locks the offer row inside the order transaction; checkout reaches it through `sale-gates.ts`.
- **Offers never apply.** A bid is already the negotiated price, so layering a promotion on it double-discounts ([ADR-0019](../../docs/adr/0019-discount-is-one-winning-offer.md)). `resolveProductPrice` is not consulted on a bidding path.
- **The recorded amount may differ from the winning bid, and then it needs a reason.** The organisation is paid on that figure, and the record has to explain a number that appears nowhere in the ladder.
- **Settlement decisions audit inside their transaction** — `recordAdminActionIn(tx, …)`, never `recordAdminAction`, because these must live or die with the mutation ([ADR-0021](../../docs/adr/0021-audit-trail-never-fails-the-action.md)). The admin id comes from `requirePlatformAdminId()`, which re-reads the row.
- **The outbid email is fire-and-forget; the offer email is not.** A mail failure must never unwind an accepted bid. The offer email is sent the moment the offer opens, after its transaction commits, by whichever process took the step (the worker at `endAt`, or the request that declined or withdrew). A failed send never undoes the offer; the hourly sweep resends it. A bidder with no email gets no outbid notice and no offer — the chain records them `SKIPPED` — which the bid form disclosed beforehand (R22a, winner-offer R5/R6).
- **Nothing is deleted.** Bids are the record of what people offered and every foreign key out of these tables is `onDelete: Restrict` ([ADR-0020](../../docs/adr/0020-money-bearing-records-never-cascade.md)). Cancellation is the real operation.
- **No rate limiting is available** — the implementation is parked while the cache is unwired. The organisation's maximum increase per bid is what bounds a bad-faith bidder; do not budget for a limiter that is not there.

## Structure

`bidding-window.ts` and `offer-chain.ts` are pure and Prisma-free: phase derivation, bid arithmetic, and who is offered the item next, testable without a database. `bidding.repository.ts` is the only module touching `prisma.biddingEvent` and `prisma.bid`, and `bid-offer.repository.ts` the only one touching `prisma.bidOffer` ([ADR-0003](../../docs/adr/0003-one-repository-per-aggregate.md)). `offer.service.ts` runs the chain and reaches `checkout` and `payments`; `offer-notify.ts` is everything it says to people; `offer.job.ts` holds the job specs the web app enqueues and `offer.jobs.ts` the handlers only the worker imports; `offer-claim.ts` is the claim checkout makes on an accepted offer. `bidding.service.ts` serves the organisation and the public; `admin.bidding.service.ts` serves the platform and is the only module that hands out a bidder's details — **not a separate admin domain**. `bidding-lock.ts` is the purchase gate, imported by `cart` and `checkout`.
