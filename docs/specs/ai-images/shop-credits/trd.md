# TRD — ai-images/shop-credits

- **Status:** Accepted
- **Domain:** payouts (credit ledger, payment details, settlement proof)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-21
- **References:** [spec.md](spec.md), [ux.md](ux.md), [../decisions.md](../decisions.md) (Q2, Q14–Q20, Q34–Q36, Q39), [org-payouts](../../org-payouts/), [ADR-0004](../../../adr/0004-money-as-integer-paise.md), [ADR-0020](../../../adr/0020-money-bearing-records-never-cascade.md), [ADR-0021](../../../adr/0021-audit-trail-never-fails-the-action.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
An append-only ledger of credit lines per shop in the **payouts** domain, which already owns the
money between the platform and each shop (`server/payouts/ledger.*`, `settlement.service.ts`). The
balance is a sum, never a column. The admin records offline money with proof; improve-with-ai
charges through one service call that checks the balance under a per-shop lock. A singleton row holds
the platform's payment details. Settlements gain the same proof.

## Prior art
- **Double-entry-lite append-only ledgers** (Stripe's balance transactions, Modern Treasury, every
  wallet): lines are immutable, a correction is a reversing line, the balance is derived. We follow
  it, and so does `OrgLedgerEntry` here (payouts D6: edit until paid, then correct by entry).
- **Charging against a balance under concurrency**: the field serialises per account — a row lock on
  an account row or an advisory lock — then reads the balance and writes the debit in one
  transaction. We have no account row by design (R1: the balance is never stored), so the lock is
  `pg_advisory_xact_lock` on the shop's id. Invariant 6's guarded `updateMany` is the stock version of
  the same idea; it needs a stored counter, which R1 forbids.
- **Holds vs. charge-then-adjust.** Card networks authorise a hold and capture less. We charge the
  first model's price and adjust after the run if a fallback model answered at a different price;
  the request is refused unless the balance covers the **most expensive** eligible model, so an
  adjustment can never take the balance below zero (R7). Fewer lines than a hold in the common case.

## Technical decisions
- **D1 — Lives in payouts, not subscriptions (Q39).** `server/subscriptions/CLAUDE.md`: "nothing
  here knows about money". Files: `credit.types.ts`, `credit.repository.ts` (the one writer of
  `CreditLine`, `CreditSettings`, `OrgCreditPolicy`), `payment-details.repository.ts`,
  `credit.service.ts`. content calls `creditService` (public surface); payouts imports nothing of content.
- **D2 — `CreditLine`**: org (Restrict, ADR-0020), kind (`GRANT`, `TOP_UP`, `CHARGE`, `ADJUSTMENT`,
  `REFUND`, `REVERSAL`), signed `amountPaise`, and per kind: provider cost and margin (bps) for a
  charge; the enhancement it paid for; method, reference, paid-on date and receipt URL for a top-up;
  the line it reverses (unique) and why; who recorded it; `grantKey` (unique, the org id) so a shop
  can hold one grant only. No update or delete exists in the repository.
- **D3 — The starting ₹2,500 (Q14).** The migration grants every existing shop; a shop created later
  is granted the first time its credit is read or charged (`ensureGrant`, an insert that skips on the
  unique `grantKey`). No coupling from shop creation in catalog to payouts.
- **D4 — Margin (Q15).** `CreditSettings` (singleton, `marginBps`, default 0) and `OrgCreditPolicy`
  (`marginBps`, nullable means platform's) — the enhancement settings' two-layer shape. A charge is
  cost + ceil(cost × bps / 10,000), integer paise; the line records cost, bps and amount.
- **D5 — Charging is a hold, settled down (R5, R7).** `creditService.charge(tx, { orgId, enhancementId,
  costPaise, worstCostPaise, marginBps })` inside the request's transaction: advisory lock, ensure
  grant, sum, refuse below the **worst eligible model's price with margin**, else write a `CHARGE` of
  that worst case. Holding the worst case (not the expected price) is what keeps two concurrent
  charges from overdrawing. Each run then has **one closing line**, keyed `close:<run>`: `settle`
  gives back what was held beyond the actual price (`ADJUSTMENT`, never a further charge) and
  `refund` gives back all of it (`REFUND`); whichever arrives first wins, so a late settle after a
  refund, or the reverse, changes nothing. Inserts use `skipDuplicates`, never a caught unique
  violation, which would abort the caller's transaction. (Revised after review, 2026-11-21: was
  "charge the expected price and adjust either way".)
- **D6 — Proof (Q17, Q18).** `PaymentMethod` enum (`UPI`, `BANK_TRANSFER`, `CASH`, `OTHER`). One
  `paymentProofSchema` (method, reference 1–120 chars, paid-on date not in the future, optional receipt
  URL of our own store) is used by top-ups and by marking a settlement paid; the settlement route's
  inline schema moves into `src/lib/validation/schemas/` (Invariant 4) and `PAID` now requires proof.
  `Settlement` gains `method` and `receiptRef`.
- **D7 — Payment details (Q35).** `PlatformPaymentDetails` singleton: UPI id, QR image URL, account
  name, number, IFSC, bank. Images (QR, receipts) upload through the admin's existing uploader as
  platform images.
- **D8 — Top-up limit (Q36).** 1 paisa to ₹10,00,000 per line, in the schema.
- **D9 — Routes.** A page number is a whole number from 1 (`creditPageOf`); an unknown shop is 404. Admin: `GET/POST /api/admin/orgs/[id]/credits` (lines + top-up),
  `POST …/credits/[lineId]/reverse`, `PUT …/credits/margin`, `PUT /api/admin/credits/settings`,
  `PUT /api/admin/payment-details`. Shop: `GET /api/org/[orgId]/credits` (balance, a page of lines,
  payment details). Every admin write is audited: top-ups and reversals in their transaction, margins
  and payment details after the write. A proof's date may not be after today by India's clock.

## Packages
None.

## UI approach
Per [ux.md](ux.md). Shop: a **Credits** button in the Photos page header opens a `TaskDialog` (full
screen on a phone) with the balance, the note, the payment details with copy buttons, and lines via
`useAsyncData`. Admin: a **Credits** tab in the shop console (balance, margin, Record top-up and
Reverse in `FormDialog`s — a short form's surface under ADR-0040); `/admin/payment-details` as a form
page; the settlement form gains the proof fields. The forms keep local state with `useMutation`, as
the payouts forms beside them do, rather than `useServerForm` (Q40): the schemas import the object
store's own-URL check, which the browser cannot load. A typo is caught before sending; the server's
envelope message is the toast. Copy in each area's copy module.

## Gates touched
- `one-repository`: `credit.repository.ts`, `payment-details.repository.ts`; `ledger.repository.ts`
  keeps `Settlement`.
- `feature-registry`: the org route is `core: FREE` (anyone may read their credit).
- `route-reachability`: each route's caller is its `*ApiClient.ts`.
- `overlay-surfaces`, `hardcoded-copy`, `ui-primitives`, `double-submit`.

## Data model
[MIGRATION] `CreditLine`, `CreditLineKind`, `PaymentMethod`, `CreditSettings`, `OrgCreditPolicy`,
`PlatformPaymentDetails`; `Settlement.method`, `Settlement.receiptRef`; a `GRANT` of 250,000 paise for
every existing shop.

## API / contract changes
Settlement `PAID` now requires `method` and `reference` — an admin-only route; CONTRACTS.md checked,
not listed there.

## Test plan
- `credit-ledger.test.ts` — balance is the sum; grant once; margin rounding; charge refused below the
  worst case; settle and refund idempotent; reversal once per line.
- `payment-proof.test.ts` — the schema; settlement `PAID` without proof refused.
- Route guards are the shared `requirePlatformAdminId` and `withOrg`, already covered; no route test of
  their own (the parse is the schema's, tested in `payment-proof`).

## Delivery (PRs)
One unit: schema, service, routes, admin and shop screens.

## Open questions
None.
