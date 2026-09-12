# TRD — bidding

- **Status:** ✅ Implemented — PR-89
- **Domain:** bidding *(new)*, catalog, checkout, payouts
- **Phase:** 8 — Bidding
- **Verified:** 2026-09-09
- **References:** [spec.md](spec.md), [org-payouts](../org-payouts/), [ADR-0003](../../adr/0003-one-repository-per-aggregate.md), [ADR-0007](../../adr/0007-conditional-stock-decrement.md), [ADR-0012](../../adr/0012-modules-are-vertical-slices-by-domain.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0020](../../adr/0020-money-bearing-records-never-cascade.md), [ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md), [ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

A new `server/bidding/` domain owning two tables, following the vertical-slice convention ([ADR-0012](../../adr/0012-modules-are-vertical-slices-by-domain.md)).

The approach rests on one idea: **the stored status records only what the clock cannot decide.** An event is `OPEN`, `CANCELLED`, `SOLD` or `UNSOLD`; whether an `OPEN` event is scheduled, running or finished is derived from its two timestamps against the clock, every time it is read. Nothing writes on a read, no state can be stale, and no job has to have run for the answer to be right — which is what H6 asks for and why this feature needs no cron on a plan that could not schedule one to the minute anyway.

The second idea is that **every contested write is decided by the database, not by application code that read first.** A bid, the opening of an event, and a stock movement are all guarded conditional updates whose affected-row count is the verdict, the shape [ADR-0007](../../adr/0007-conditional-stock-decrement.md) already sets for stock.

## Technical decisions

- **D1 — Domain layout.** `bidding.repository.ts` / `bidding.service.ts` / `admin.bidding.service.ts` / `bidding.types.ts`, plus `bidding-window.ts`, a pure DB-free module that maps `(status, startAt, endAt, now)` to a phase. Mirrors `server/promotions/`, whose pure engines are bare nouns. No barrel; callers import full `@server/*` paths.
- **D2 — Two models, `BiddingEvent` and `Bid`.** Both carry money and attribution, so every foreign key out of them is `onDelete: Restrict` ([ADR-0020](../../adr/0020-money-bearing-records-never-cascade.md)). Deleting a product or an org that has ever been bid on is refused; the real operation is cancellation (R27, "no deletion while an event runs").
- **D3 — Status stores lifecycle, not time.** `BiddingStatus = OPEN | CANCELLED | SOLD | UNSOLD`. Deriving the phase rather than storing it is what removes the scheduled job (H6). The cost is that every read must go through `bidding-window.ts` rather than trusting a column, so nothing may branch on `status` alone.
- **D4 — One event per product is a database fact.** A partial unique index — unique on `productId` where `status = 'OPEN'` — added as raw SQL in the migration, the same device `ProductMedia` already uses for "at most one cover per product". Two simultaneous creations cannot both succeed, and no column is added to `Product` (R7, R32, H3).
- **D5 — A bid is accepted by one guarded update on the event row.** A conditional update requiring `status = OPEN`, `startAt <= now`, `endAt > now`, and the current high below the offered amount; `count === 0` is the refusal, and the caller re-reads to tell the bidder the price that beat them (R24). Because the event row is the thing being contested, the clock test and the price test are a single atomic act — which is what closes both H1 and H2. The `Bid` row is inserted in the same transaction.
- **D6 — Unique on `(eventId, amountPaise)`.** D5's guard already makes equal bids impossible; this makes it impossible independently of the guard being written correctly. A tie cannot exist in the data, so no tiebreak rule has to be maintained (H1).
- **D7 — The current high and the bid count live on the event row.** Denormalised, but written only inside D5's guarded update, so they are authoritative by construction rather than by a reconciliation. It also makes the bidding page a single row read, which matters on a public link that will be opened far more often than it is bid on.
- **D8 — Purchase suspension is derived, and enforced twice at different strengths.** One indexed query returns the handful of product ids currently locked, memoised per request with React `cache()` exactly as `loadPriceContext` does (`server/promotions/price-context.ts:32`). Display surfaces — product page, listings, cart — read that memoised set. **Enforcement re-checks inside the `$transaction` in `server/checkout/order.service.ts:148`**, alongside the stock guard, because a per-request set is stale by definition and that transaction is the only race-safe point in the codebase today (H5). The add-to-cart handler checks too, so the failure arrives early rather than at payment.
- **D8a — Locked means `status = OPEN` and either the end time is still ahead or at least one bid exists.** An event that expires with no bids stops locking with no action taken; one with bids stays locked until it is settled or cancelled. R33 therefore needs no cleanup step (H4).
- **D9 — The product's price is copied onto the event at creation** and never read from `Product` again, so repricing cannot rewrite what the event says the item was worth (R4).
- **D10 — The named variant is descriptive only.** `ProductStock` is keyed by product and location (`prisma/schema.prisma:679`) with no variant dimension, so the size or colour recorded on the event states what is being sold and does not create variant-level inventory. Stock moves at product level (R1a, R41).
- **D11 — A confirmed sale writes an `OrgLedgerEntry` of kind `ADJUSTMENT`, not an `Order`.** That kind exists for "a manual line the order flow does not produce" (payouts R5). An `Order` was rejected: it carries a buyer the org must never see (R36), and it would have to be marked paid with no gateway signal, which Invariant 2 forbids outright. Commission still applies, so the entry is built through the existing commission resolution rather than a second arithmetic (R42).
- **D12 — Stock moves inside the confirmation transaction**, by the guarded `updateMany` on `ProductStock` already used at `server/checkout/order.service.ts:314`, against a location the platform selects. `count === 0` refuses the confirmation rather than recording a sale of something absent (R41).
- **D13 — Confirming, marking unsold and cancelling audit with `recordAdminActionIn(tx, …)`.** These are money and attribution decisions that must live or die with their transaction, which is the case [ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md) reserves that variant for. The admin id is re-read by the guard, never taken from the JWT claim.
- **D14 — A guest bidder's details live on the `Bid` row.** Name and phone required, email nullable — no guest table, following the address snapshot already carried on `Order`. A signed-in bidder stores a user reference instead, and contact details are read through it at display time so they cannot go stale (R21, R22).
- **D15 — The outbid email is fire-and-forget.** The dynamic-import-and-`.catch()` shape at `server/checkout/order.service.ts:100` is the house pattern, and the reasoning transfers exactly: a mail failure must never unwind an accepted bid (R28). A previous leader with no email on file is simply skipped.
- **D16 — The public link carries a random token, not the product slug.** Short enough to share, unguessable, and independent of a slug that is frozen for other reasons (R9).
- **D17 — The page ships the server's clock alongside the end time**, and the countdown runs against the difference. Display only; D5 is what actually decides a late bid, so a tampered client gains nothing (R17, R26).
- **D18 — The social preview is generated with `next/og`.** The repo has no dynamic OG image today, so this introduces the route convention. It states an absolute end time and the price at generation — never a relative countdown, because scrapers cache aggressively and a frozen "2 hours left" would keep being wrong long after (R19).
- **D19 — The org's views select amounts and counts and never bidder columns**, at every phase, so R16 and R36 are a property of the query rather than of the template.

## Packages

None. `next/og` ships with Next; email already goes through Resend.

## UI approach

Mobile-first ([ADR-0015](../../adr/0015-mobile-first-design.md)); the bidding page is the one most visitors will only ever see on a phone, arriving from a shared link. All colour, type, tracking, elevation and shape come from the tokens in `globals.css`, page width and titles from `PageShell`/`PageHeader` ([ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md)).

| Surface | Base (~360px) | Breakpoints add |
|---|---|---|
| Org — list | `Bidding` sidebar entry; single-column cards, status chip, current high, time left | two-up grid at `md:` |
| Org — create | Dialog with a search-and-pick-one product list, then a narrow single-column form: variant, window, starting bid, max increase, quick-bid amounts as a field array | side-by-side date fields at `md:` |
| Public — bid page | Gallery, name, variant, usual price, current high, countdown, quick-bid buttons stacked full-width, custom amount, guest fields with the email disclaimer; the bid action docks above the safe area | gallery beside the panel at `md:` |
| Admin — ladder | Bidder rows highest first with contact; confirm-sale and mark-unsold actions | table at `md:` |

Reuses `Dialog`, `ProductPicker`'s search shape, `FormInput`/`FormSelect`, `useFieldArray` for quick-bid amounts, `DataTable` for the ladder. Touch targets stay ≥40px; the quick-bid buttons are the primary action and are sized for a thumb.

## Data model

`[MIGRATION]`. Two models and one enum, plus raw SQL in the migration for D4's partial unique index. No change to `Product`, `Cart` or `Order` (D8, R32).

## API / contract changes

`[CONTRACT]`. The product DTO gains a bidding indicator — whether the item is suspended from sale and the link to its event — because the storefront must render R30 without a second round trip. `docs/CONTRACTS.md` moves in the same PR.

## Test plan

Per [TESTING.md](../../TESTING.md). Unit: `bidding-window.ts` phase derivation across every boundary, including the exact end instant; bid validation against the increment floor and the max-increase cap; commission arithmetic on a confirmed sale. Integration, against a real database rather than mocks: two concurrent bids at the same amount yield one winner and one refusal; a bid at the end instant is refused; two concurrent event creations on one product yield one event; an order containing a suspended product is refused inside the transaction; a confirmation with no stock at the chosen location is refused whole. Guard tests: an org member cannot bid on their own org's item, and no org-facing query selects a bidder column.

## Delivery (PRs)

1. Schema, migration, domain types, repository, `bidding-window.ts` — no behaviour.
2. Services, validation schemas, org and public route handlers.
3. **The purchase gate** — the memoised lookup, the transaction check, the cart check, the product-page state. This is the PR that changes existing behaviour.
4. Org console: list, create dialog, form.
5. Public bidding page, countdown, bid flow, OG image.
6. Admin ladder, sale confirmation, unsold, ledger entry, outbid email.

## Open questions

- Whether the smallest quick-bid amount doubles as the minimum a custom increase may be, or whether that is its own setting on the event. Proceeding on the former unless overridden — it needs no extra field and cannot contradict the buttons on screen.

*Closed 2026-09-09 — a guest's email stays optional with a disclaimer at the point of entry (R22, R22a, R28); the platform settles fully offline and no delivery address is stored (R38, D11); an event names its variant, which is descriptive rather than stocked (R1a, D10).*
