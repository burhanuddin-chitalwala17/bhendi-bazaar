# TRD — winner-offer

- **Status:** Accepted
- **Domain:** bidding, checkout, payments, notifications
- **Phase:** 8 — Bidding
- **Verified:** 2026-09-28
- **References:** [spec.md](spec.md), [../trd.md](../trd.md) (bidding), [ADR-0041](../../../adr/0041-an-auction-winner-buys-through-an-order-priced-from-their-offer.md), [ADR-0002](../../../adr/0002-server-holds-pricing-authority.md), [ADR-0005](../../../adr/0005-payment-state-server-only.md), [ADR-0007](../../../adr/0007-conditional-stock-decrement.md), [ADR-0023](../../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md), [ADR-0036](../../../adr/0036-a-files-reasons-to-change-are-a-decision.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [checkout-abandonment](../../checkout-abandonment/)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

The winner's purchase is an ordinary `Order`, priced from an accepted offer instead of the catalogue. Everything after the order already exists: the address, the Razorpay conversation, the conditional stock decrement, abandonment, fulfilment and the org ledger. So this feature only adds what comes before the order, a chain of offers owned by `bidding`, plus one exception in `checkout` that lets the winner through the purchase gate at the bid price.

The auction itself is unchanged. Its phase is still derived from the clock ([ADR-0023](../../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)). What changes is that an ending now *causes* something, so the offer chain is moved forward by jobs on the worker ([ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)). This partly supersedes ADR-0023, and a new ADR records it together with D5's pricing exception.

## Technical decisions

- **D1 — A `BidOffer` table, reached only through `bidding.repository.ts`** ([ADR-0003](../../../adr/0003-one-repository-per-aggregate.md)).
  - Each row holds: the event, the bid offered, a sequence number, the token's hash, the status, `expiresAt`, the time it was answered, and the reason it closed.
  - Status is `OFFERED | ACCEPTED | DECLINED | LAPSED | SKIPPED | WITHDRAWN | PAID`.
  - Whether an offer can still be acted on is decided by the clock: status `OFFERED` or `ACCEPTED` and `expiresAt > now`. `LAPSED` is written only when the chain moves past an offer, as the record of how it ended (spec R21).
  - A partial unique index allows one open offer per event, making R2's "one person at a time" a database fact, as bidding already does for one live event per product.
- **D2 — Choosing the next person is a pure function, `nextStep` in `offer-chain.ts`.** It takes the ladder and the earlier offers and returns the highest bid from a person not yet offered, together with that person's own top bid (R2, R3). "Same person" means the same `userId`, or, for guests, the same phone number with the formatting removed. Every guest bid requires a phone number, while the email may differ from bid to bid or be missing. A person with no email produces a `SKIPPED` row and the function is asked again (R5), so a skip is recorded, not silently passed over.
- **D3 — The window is stored on the event.**
  - `BiddingEvent.claimWindowHours` defaults to 12 and freezes with the other terms at the first bid, using the existing update guard (R10).
  - A null value marks an event created before this feature. Those events keep manual settlement, and every trigger in D4 ignores them, so deploying doesn't start sending offers for past auctions (spec R19b). There is no backfill: the migration adds the column without filling it for existing rows, and the manual record-sale path stays for them. On an event with a non-null window, that path refuses while an offer is open.
- **D4 — Three triggers, one guarded transition.**
  - **At the end:** creating an event enqueues a job to run at `endAt`, in the same transaction. Events have no edit path, so `endAt` never moves under the job. `enqueue` in `server/shared/jobs/jobs.enqueue.ts` gains a start-after option. That job is one row, not a polling wait, so it doesn't add to ADR-0038 D8's operations budget.
  - **On decline:** a decline moves the chain forward inside its own transaction.
  - **Hourly backstop:** a scheduled sweep opens chains that the end-of-auction job missed, and moves lapsed offers on. It uses one of the four schedules in `jobs.config.ts`.
  - **All three call one service routine.** Its insert is guarded by D1's index, so a job and the sweep running together produce one offer and one email.
  - **Lateness:** at an hourly sweep, a lapsed offer passes on at most about an hour late. Acting on an offer is still refused exactly at `expiresAt` (R13).
- **D5 — The winner's order is priced from the offer.**
  - A new checkout entry point asks bidding's public surface to claim an accepted, unexpired offer inside the order transaction. It then prices the single line from the offered amount and never calls `resolveProductPrice` (spec R16).
  - The request body carries only the token and the address. The amount never crosses the wire, so the server-held pricing of [Invariant 1](../../../../CLAUDE.md) holds, and the only thing that changes is where that price comes from.
  - This is a recorded exception to [ADR-0002](../../../adr/0002-server-holds-pricing-authority.md) and [ADR-0018](../../../adr/0018-one-effective-price-function.md). It goes in the new ADR.
  - The exception covers only the item line. Shipping is charged on top of it through the normal order path, from the address the winner enters, and appears on the order as its own line, exactly as on any order (spec R15a). The bid is never adjusted to absorb shipping.
- **D6 — The purchase gate lets one claim through.** `assertNotUnderBidding` in `server/bidding/bidding-lock.ts` takes an optional claimed offer and passes only that offer's product. It still runs after the stock reservation, as the bidding rules require. This is the change most likely to open a hole, so it is mutation-tested: remove the offer check and A8 must fail.
- **D7 — `Order.bidOfferId`, unique and nullable, links the order to its offer.**
  - Each visit to the link creates a fresh order, so the link is not unique across orders. Abandonment then releases stock exactly as it does now, without touching the offer (R17).
  - Before a new attempt, the order route asks payments to release the offer's abandoned attempts. Otherwise a winner whose browser died mid-payment would be blocked by their own attempt until the daily payments sweep. Inside the transaction the claim refuses while another attempt is still open.
  - An order can't be created unless the offer is still open, which is checked in the transaction.
  - A payment already in flight finishes under the existing `releaseIfUnpaid` and `confirmPaid` rules (R13), and the sweep doesn't lapse an offer that has an unreleased order.
- **D8 — Completion runs in the paid transition.**
  - `server/checkout/payment-confirmed.ts` calls `completeFromPaidOrder` right after the paid transition, not inside it: that module runs once the payment is confirmed and must never throw. In one transaction of its own, the offer becomes `PAID` and the event becomes `SOLD`, with `soldBidId` and the bid as its amount. It is idempotent, and the sweep retries a missed one.
  - The paid order is the attribution. The admin log requires a person, and nobody acted.
  - **No `ADJUSTMENT` ledger entry is written.** The org is credited by the order's own ledger path, and writing both would pay the org twice. The bidding CLAUDE.md rule "a sale writes an ADJUSTMENT" is amended to cover only manual settlement.
  - **Commission follows the org's own terms, with nothing added** (spec R19a). The order line's gross is the bid, and `resolveRateBps` in `server/payouts/commission.ts` picks the org's rate for the product's category exactly as for any sale. With no discount on the line, the commission base is the bid, and shipping is outside it. A manual `ADJUSTMENT` carries no commission, which is one more reason the automated path must not write one.
- **D9 — Offer links: GET shows, POST acts** (R7).
  - The token is 32 random bytes, minted by the email job at the moment it sends. Only its hash is stored (`server/shared/hash.ts`), so the token is never in a job payload or the database.
  - `/bid-offer/[token]` is a server-rendered confirm page. Accept and decline are one route handler parsed by Zod.
  - Accepting is a guarded `updateMany` on the status and `expiresAt` together (R8, R13). An accepted offer's page becomes the link to its checkout.
- **D10 — Emails go out as jobs enqueued in the transaction that opens the offer.**
  - The handler records the send time on the offer and skips a redelivery (ADR-0038 D4).
  - A failed send is retried by the queue and never undoes the offer. An offer whose mail never went out still lapses and passes on.
  - New templates: the offer, and (optionally) "the item went to another bidder". The chain running out notifies platform admins in the app.
- **D11 — Admin controls live in `admin.bidding.service.ts`:** withdraw the current offer, and stop the chain as unsold. Each is audited with `recordAdminActionIn` inside its transaction (R23).
- **D12 — Organisations see the order, not the auction** (R24). `OrgBiddingSummary` and `PublicBiddingView` still carry no bidder field. The buyer reaches the org as the customer on an order, because shipping the item needs that.

## Packages

None. pg-boss already supports a job start time.

## UI approach

At ~360px:
- **Offer page:** the product image, the option, the price, a countdown, and two full-width buttons docked at `bottom-tabbar` (accept is the primary one). Closed offers show their outcome, not a 404.
- **Auction checkout:** reuses the checkout's address and payment steps, with one line that can't be edited (no quantity control, no coupon field), and the countdown at the top. The totals show the bid and the shipping as two lines, and shipping is filled in once an address is entered (R15a).
- **Bidding page:** directly under the current price and above the bid controls, a notice built from a semantic token rather than muted small print: "Winner pays shipping on top of the bid · 12 hours to confirm and pay." It sits there so it can't be missed at ~360px (R10, R10a, A11). The same line goes in the offer email.
- **Bid form:** the email-optional warning grows to cover winning (R6).
- **Admin:** the chain is a vertical list on the event's admin page, and desktop only widens it.

## Data model

[MIGRATION] Adds:
- the `BidOfferStatus` enum;
- the `BidOffer` table with its partial unique index;
- `BiddingEvent.claimWindowHours Int?`;
- `Order.bidOfferId String? @unique`;
- `NotificationType.BID_OFFER`.

Every new foreign key is `Restrict` ([ADR-0020](../../../adr/0020-money-bearing-records-never-cascade.md)).

## API / contract changes

[CONTRACT]: the offer view, the accept and decline request, and the auction checkout request and response go into `docs/CONTRACTS.md`.

## Test plan

- **Unit:**
  - the next-person function (distinct people, own top bid, skips, running out);
  - token hashing;
  - the gate exception, mutation-tested.
- **Integration:**
  - two concurrent accepts, and an accept racing the sweep, each give exactly one winner;
  - the end-of-auction job and the sweep together open one offer;
  - a redelivered email job sends once;
  - a GET on either link changes nothing;
  - an abandoned order leaves the offer open;
  - payment completes the event, and no `ADJUSTMENT` row is written;
  - the ledger entry for an auction order has commission at the org's category rate on the bid, with shipping excluded from the base (A12);
  - the auction order total equals the bid plus the shipping quoted for the address, and a body carrying any amount is ignored;
  - events from before this feature are never picked up, and their manual record-sale path still works (A13).
- **Coverage:** follows [TESTING.md](../../../TESTING.md).

## Delivery (PRs)

1. **Schema, repository, the pure chain logic and tests.** No behaviour change.
2. **Auction checkout, gate exception and completion on payment.** Tested against a seeded accepted offer. Nothing creates offers yet.
3. **Turns the feature on:** offer emails, the offer page, the end-of-auction job, the sweep, the 12-hour notices, and the running-out handling.
4. **Admin chain view and controls, and in-app notifications.**

## Open questions

Settled 2026-09-28: the winner pays shipping on top of the bid (D5, spec R10a and R15a); commission follows the org's agreed terms (D8, spec R19a); past auctions stay manual (D3, spec R19b).

The ADR is [ADR-0041](../../../adr/0041-an-auction-winner-buys-through-an-order-priced-from-their-offer.md), which supersedes ADR-0023's decision 2 in part. None remain open.
