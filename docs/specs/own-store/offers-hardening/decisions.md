# Decisions — own-store/offers-hardening

- **Verified:** 2026-10-29

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones (ADR-0062).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids. The
> parent's decisions (own-store Q2–Q7, Q20, Q21) bind here and are not repeated.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | "Lowest price in 30 days" of what? | The list price (`Product.price`) only, not the price after the shop's own offers | Claude · reversible | 2026-10-29 | The after-offer price depends on offers, the platform's own past campaigns included, which is circular | implemented (unit 6) |
| Q2 | When may a platform offer "cost more than commission"? | When its depth beats the lowest commission rate on any shop that can sell: a percentage above that rate, or a flat amount above that rate of its minimum spend (or with no minimum) | Claude · reversible | 2026-10-29 | Conservative: a false warning costs a typed word, a missed one costs money. Only shops that can sell count (active, not blocked — the storefront's predicate); was: all orgs | implemented (unit 5) |
| Q3 | When is budget spent and given back? | Spent inside the order transaction; given back when an unpaid order expires, as coupon uses are | Claude · reversible | 2026-10-29 | Same lifecycle as the usage limit (promotions D11) | implemented (unit 5) |
| Q4 | What does the buyer see when the budget runs out mid-checkout? | An offer whose remaining budget cannot cover this basket's share is left out of the quote, so the review shows the real total; "That offer has just ended. Please review your total." appears only when another order took the budget in between | Claude · reversible | 2026-10-29 | Charging a total the buyer did not review breaks ADR-0018, and a refusal the buyer cannot clear by reviewing is a dead end; was: refused with that message, order not placed | implemented (unit 5) |
| Q5 | Can a budget be set on any platform offer? | Yes, optional; required only with a loss confirmation | Claude · reversible | 2026-10-29 | A budget is useful on any campaign, a requirement only where loss is possible | implemented (unit 5) |
| Q6 | What happens to reversals already written order-wide? | They stand; a parcel's reversal counts them as already reversed | Claude · reversible | 2026-10-29 | ADR-0020: money rows are never rewritten | implemented (unit 1) |
| Q7 | Clamp or refuse an offer over a shop's ceiling? | Refuse at the form when it can be known; clamp in the engine always, since a price edit can breach it later | Claude · reversible | 2026-10-29 | The rule must hold for offers already running | implemented (unit 4) |
| Q8 | A shop ends its own markdown just before a platform campaign | No action: ending a sale is not a price rise; the platform pays what its campaign advertised on an unchanged list price | Claude · reversible | 2026-10-29 | Explained to the owner; reopen only if a campaign shows shops doing it on purpose. was: parked | decided |
| Q9 | Coupon codes can be guessed: the quote endpoint is not rate limited | Limited through the product-wide rate-limiting registry (own-store Q26) | Owner | 2026-10-29 | Built with [rate-limiting](../../rate-limiting/). was: parked | decided |
| Q10 | Coupon use given back when a paid order is cancelled (own-store Q5) | — | — | — | Cancellation does not exist yet; lands with order-fulfilment | parked |
| Q11 | Who may confirm a loss? | Any platform admin; the confirmation records who and when | Claude · reversible | 2026-10-29 | Admins already hold the platform's money controls; the record makes it accountable | implemented (unit 5) |
| Q12 | How is a manually edited sale reversed? | Its header figures are split pro rata by the cumulative share of gross reversed (cumulative floor, base derived), so a full return sums to the edited header exactly; lines as unedited | Claude · reversible | 2026-10-30 | The admin's correction is the figure that was owed | implemented (unit 1) |
| Q13 | A parcel cancelled before the order is paid | — | — | — | The SALE written at payment includes it and nothing reverses it; pre-existing, lands with order-fulfilment | parked |
| Q14 | What happens to a loss confirmation when the offer is edited? | An edit the loss rule does not flag keeps the earlier confirmation; one it flags must be confirmed again, which records the new confirmer, and every confirmation is written to the admin audit trail | Claude · reversible | 2026-10-29 | Erasing who accepted a loss loses accountability; re-asking on a deepening edit keeps it deliberate (ADR-0021) | implemented (unit 5) |
| Q15 | Does the 30-day basis decide whether a coupon applies? | No: minimum spend is judged at the shown price; the basis only bounds what the platform pays, and only shops whose price rose fund the shortfall | Claude · reversible | 2026-10-29 | Owner's Q21: the shop alone pays for its own price rise; a shop whose price did not move pays nothing extra | implemented (unit 6) |

## Parked (Later)
- Q8 — residual price gaming through markdowns; revisit if a platform campaign shows it. BACKLOG Phase 12.
- Q9 — [rate-limiting](../../rate-limiting/) spec, which already covers checkout endpoints.
- Q10 — own-store/order-fulfilment.
- Q13 — own-store/order-fulfilment.
