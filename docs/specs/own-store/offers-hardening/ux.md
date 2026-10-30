# UX — own-store/offers-hardening

- **Status:** Signed off
- **Verified:** 2026-10-29
- **Prototype:** ASCII previews shown to the owner in the sign-off question (three changed states on existing screens; no new screen)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md)

## Journeys
1. **Admin runs a deep platform campaign (R4).** Admin → Offers → New → sets 30% → a panel appears
   under "What it takes off" → types CONFIRM LOSS and a budget → Save → the list shows "₹0 of
   ₹50,000 used".
2. **Goes wrong: budget runs out (R4).** Buyer reviews ₹1,200 → pays → refused "That offer has just
   ended. Please review your total." → total refreshes without the offer.
3. **Shop sets too deep a flat offer (R3).** Shop → Offers → ₹900 off a ₹1,000 product with a 50% cap
   → Save → field error under the amount.
4. **Shop types a ₹1 sale price (R3).** Product form → Sale price → Save → field error under it.

## Screens
| Screen | Route | Change | Serves |
|---|---|---|---|
| Admin offer form | `/admin/promotions/new`, `/admin/promotions/[id]/edit` | Loss panel + budget field | R4 |
| Admin offers list | `/admin/promotions` | Budget use beside usage | R4 |
| Shop offer form | `/org/[orgId]/promotions/…` | Ceiling message for flat and fixed price | R3 |
| Product form | `/org/[orgId]/products/…` | Ceiling message on sale price | R3 |
| Checkout | `/checkout` | Budget-ended refusal; coupon set aside silently | R4, R7 |

## State matrix — admin offer form, loss panel
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | No panel until a value is typed | — | — |
| Within commission | No panel; optional "Budget (₹)" field | "Stop the offer once it has cost this much. Optional." | Save |
| Could lose | Amber panel under the value | "This can cost more than we earn on a sale (lowest commission 15%). Type CONFIRM LOSS and set a budget to run it anyway." | Type, set budget, Save |
| Terminal error | Field errors | "Type CONFIRM LOSS exactly." / "Set a budget for an offer that can lose money." | Fix field |
| Success | Toast, back to list | "Offer saved." | — |
| Loading / slow | Save shows a spinner; button stays enabled (ADR-0053) | — | — |
| Retryable error | Toast | "Couldn't save. Try again." | Save |
| Refused | n/a — admin is allowed; errors above cover it | — | — |
| Stale / many items / long content | n/a — a single form | — | — |
| Phone / tablet / desktop | Panel full width on phone; inside the form column on `md:`+ | — | — |

## State matrix — admin offers list, budget
| State | Sees | Copy |
|---|---|---|
| No budget | Usage as today | "12/100 used" |
| Budget set | Beside usage | "₹12,400 of ₹50,000 used" |
| Budget spent | Grey badge, offer no longer applying | "Budget used up" |
| Loss confirmed | Small amber note | "Runs at a loss — confirmed by {name}, {date}" |

## State matrix — shop forms, ceiling
| State | Sees | Copy |
|---|---|---|
| Within cap | Nothing | — |
| Over cap (offer) | Field error | "Your shop's offers can take off at most 50%. ₹900 off ₹1,000 is 90%." |
| Over cap (sale price) | Field error | "Your sale price can be at most 50% below the price — no lower than ₹500." |
| Product with several prices (category or all-products offer) | Saved; engine caps it | n/a — the engine limits each line (decisions Q7) |

## Copy deck
- "This can cost more than we earn on a sale (lowest commission {rate}%). Type CONFIRM LOSS and set a budget to run it anyway."
- "Budget (₹)" · "Stop the offer once it has cost this much. Optional." / required variant: "Set a budget for an offer that can lose money."
- "Type CONFIRM LOSS exactly."
- Budget below what is already spent: "This offer has already spent ₹{spent}. Set a budget of at least that." (added while building unit 5)
- "₹{spent} of ₹{budget} used" · "Budget used up" · "Runs at a loss — confirmed by {name}, {date}"
- "Your shop's offers can take off at most {cap}%. ₹{amount} off ₹{price} is {pct}%."
- "Your sale price can be at most {cap}% below the price — no lower than ₹{floor}."
- Checkout: "That offer has just ended. Please review your total."

## Sign-off
Signed off by the owner, 2026-10-29 (ASCII previews of the three changed states approved as drawn).
