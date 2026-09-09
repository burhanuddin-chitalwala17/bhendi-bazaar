# CLAUDE.md — bidding domain

> **Read the project-wide rules first:** [`/CLAUDE.md`](../../CLAUDE.md) covers the SDLC and the Project Invariants. This file covers **bidding** only. Requirements are in [docs/specs/bidding/](../../docs/specs/bidding/).

## Purpose
Bidding owns timed auctions on a single item: opening an event, taking bids, suspending the item from normal sale while it runs, and recording what the platform eventually sold it for. It reads a product through `catalog`, credits an organisation through `payouts`, and never touches `checkout` — a bidding sale is not an order.

## Boundaries

**Owns:** `server/bidding/**` and the `BiddingEvent` and `Bid` tables.

**Does not own:** the product or its stock (`catalog`), the ledger entry a sale produces (`payouts`), or the email a bid triggers (`notifications`). It composes them.

## The two ideas everything here rests on

**1. Stored status records only what the clock cannot decide.** `BiddingStatus` is `OPEN | CANCELLED | SOLD | UNSOLD`. Whether an `OPEN` event is scheduled, running or finished comes from `startAt`/`endAt` against a clock passed in — every time it is read, by `bidding-window.ts`. That is why this feature has no cron and needs none: a read cannot be stale because nothing was cached, and no correctness rests on a job having run.

**Never branch on `status` alone.** `status === "OPEN"` does not mean "biddable". Go through `biddingPhase`, `isAcceptingBids` or `suspendsPurchase`.

**2. Every contested write is decided by the database.** A bid, the opening of an event and a stock movement are all guarded conditional updates whose affected-row count is the verdict ([ADR-0007](../../docs/adr/0007-conditional-stock-decrement.md)). Application-level checks in this domain exist to produce a good message and are advisory by construction. Two constraints Prisma cannot express live in the migration and are load-bearing: a partial unique index making one live event per product a database fact, and `@@unique([eventId, amountPaise])` making tied bids impossible independently of the guard.

## Rules

- **`acceptBid` is the only way a bid is accepted.** Its `where` carries the clock, the event's state and the price together, so nothing can arrive after the close or land at a figure that does not beat the current high. Adding a bid path that reads first and writes second reintroduces both races.
- **`orgId` is a parameter, never a body field.** A body-supplied one is how an organisation would open an event on someone else's goods.
- **Org-facing and public reads select no bidder column.** `PublicBiddingView` and `OrgBiddingSummary` have no field that could carry one, so [spec](../../docs/specs/bidding/spec.md) R16 and R36 hold as a property of the type. `BidLadderEntry` is the only shape that names a person, and only platform-admin surfaces are typed to receive it.
- **The purchase gate is derived, never stored.** Nothing is written to `Product` when an event opens or closes. Display reads go through the request-memoised `loadBiddingLockContext`; enforcement goes through `assertNotUnderBidding` **inside** the order transaction, which is the only race-safe point. In `order.service.ts` that call sits *after* the stock reservation deliberately — the reservation takes the row lock that event creation also takes, so checking afterwards is what makes the two decisions serial. Moving it earlier silently reopens the window.
- **A sale writes an `OrgLedgerEntry` of kind `ADJUSTMENT`, never an `Order`.** An order would show the organisation its buyer (R36) and would need `paymentStatus: "paid"` with no gateway signal, which [Invariant 2](../../CLAUDE.md) forbids. Money for a bidding sale is collected off the platform; what the system records is the amount.
- **Offers never apply.** A bid is already the negotiated price, so layering a promotion on it double-discounts ([ADR-0019](../../docs/adr/0019-discount-is-one-winning-offer.md)). `resolveProductPrice` is not consulted on a bidding path.
- **The recorded amount may differ from the winning bid, and then it needs a reason.** The organisation is paid on that figure, and the record has to explain a number that appears nowhere in the ladder.
- **Settlement decisions audit inside their transaction** — `recordAdminActionIn(tx, …)`, never `recordAdminAction`, because these must live or die with the mutation ([ADR-0021](../../docs/adr/0021-audit-trail-never-fails-the-action.md)). The admin id comes from `requirePlatformAdminId()`, which re-reads the row.
- **The outbid email is fire-and-forget.** A mail failure must never unwind an accepted bid. A bidder who gave no email is skipped, which the bid form disclosed to them beforehand (R22a).
- **Nothing is deleted.** Bids are the record of what people offered and every foreign key out of these tables is `onDelete: Restrict` ([ADR-0020](../../docs/adr/0020-money-bearing-records-never-cascade.md)). Cancellation is the real operation.
- **No rate limiting is available** — the implementation is parked while the cache is unwired. The organisation's maximum increase per bid is what bounds a bad-faith bidder; do not budget for a limiter that is not there.

## Structure

`bidding-window.ts` is pure and Prisma-free: phase derivation and bid arithmetic, testable without a database. `bidding.repository.ts` is the only module touching `prisma.biddingEvent` and `prisma.bid` ([ADR-0003](../../docs/adr/0003-one-repository-per-aggregate.md)). `bidding.service.ts` serves the organisation and the public; `admin.bidding.service.ts` serves the platform and is the only module that hands out a bidder's details — **not a separate admin domain**. `bidding-lock.ts` is the purchase gate, imported by `cart` and `checkout`.
