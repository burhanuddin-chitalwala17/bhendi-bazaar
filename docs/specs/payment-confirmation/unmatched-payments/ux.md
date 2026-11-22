# UX — unmatched payments

- **Status:** Signed off
- **Verified:** 2026-11-22
- **Prototype:** none — no screen is added (Q7)
- **References:** spec.md, decisions.md; the screen as built: `src/components/order/refunds/refund-list.tsx`, `refunds-copy.ts`

## Journeys
1. **A late payment is refunded.** The admin opens Orders → Refunds and sees a row owed, Why "paid after release", the order code, no parcel. They press "Refund ₹220.72", confirm in the sheet, and the row reads "Started 22 Nov · rfnd_…".
2. **It goes wrong.** Razorpay does not answer: the row reads Unconfirmed, "We couldn't confirm the refund. Check Razorpay before trying again.", with "Open in Razorpay" on this payment. Razorpay refuses: the row reads Refused with Razorpay's reason.

Both are the list's existing journeys; only the row's cause and its missing parcel are new.

## Screens
| Screen | Route | Change | Serves |
|---|---|---|---|
| Refunds (admin) | `/admin/orders/refunds` | One new kind of row: no parcel, Why "paid after release" | R2, R3, A1, A2 |

## State matrix — the new row on Refunds
| State | What the admin sees | Copy | Action |
|---|---|---|---|
| First use | The list's existing empty state, reworded to include this cause | "A refund appears here when a paid parcel is cancelled, lost, damaged or returned, or a payment arrives after its order was released." | none |
| Empty | Same | Same | none |
| Loading | The list's existing skeleton | — | — |
| Partial | n/a — a row is one refund; there are no parts | — | — |
| Success | The row reads Started, newest first among started | "Refund of ₹220.72 started." (no "Buyer emailed": Q8) | Open in Razorpay |
| Retryable error | Unconfirmed, as for any refund | existing `unconfirmed` | Open in Razorpay, then Try again |
| Terminal error | Refused, with Razorpay's reason | existing `refused` | Open in Razorpay |
| Refused | Another admin already started it | existing "Already started by {name}." | none |
| Stale | Owed past 2 days turns amber, as for any refund | existing `owedFor` | Refund |
| Long content | Order code and amount are short; Why is fixed text | — | — |
| Many items | Pages of 50, as today | — | Previous / Next |
| Slow | The button's own pending state | existing "Refunding…" | — |
| Phone / tablet / desktop | Phone: the row's meta line shows "—" for parcel; from `md:` the Parcel cell shows "—" | "—" | as above |

## Copy deck
| Where | Copy |
|---|---|
| Why cell | `paid after release` |
| Parcel cell, no parcel | `—` |
| Empty list | `A refund appears here when a paid parcel is cancelled, lost, damaged or returned, or a payment arrives after its order was released.` |
| Success toast, no parcel | `Refund of {₹x} started.` |

Every other word on the row is the list's existing copy.

## Sign-off
Signed off by the owner, 2026-11-22.
