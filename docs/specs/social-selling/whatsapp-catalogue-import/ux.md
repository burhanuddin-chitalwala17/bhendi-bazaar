# UX — social-selling/whatsapp-catalogue-import

- **Status:** Signed off 2026-11-23
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/connect.html](../prototypes/connect.html), section "Settle your WhatsApp catalogue"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux-patterns](../ux-patterns.md), the shipped Settle screen (`settle-copy.ts`, product-merge), [connect-whatsapp ux](../connect-whatsapp/ux.md)

> The existing Listings and Settle screens, given WhatsApp as a source (Q5): the same rows, the
> same three choices and wording. New here: the Done bar that hands the catalogue over in one push,
> and the count of items that will be removed from WhatsApp.

## Journeys
1. **Settle.** WhatsApp card checklist → **Settle catalogue · 40 items** → WhatsApp Listings page:
   36 rows to settle, 4 already linked by SKU ("Same SKU on WhatsApp", Q1) → on each row
   **Match to a product** (picker with "Looks like Kashmiri shawl" first) / **Add as new product**
   (form pre-filled from the item, asking "How many do you actually have?") / **Leave off** → the
   `ActionBar` counts "28 of 36 settled" → **Done** sheet: "38 will stay in your catalogue as your
   products · 2 will be removed from WhatsApp" → **Update WhatsApp** (pending "Updating WhatsApp…")
   → back on the card, checklist Catalogue ticked, toast "Your WhatsApp catalogue now shows your
   products."
2. **Leave and come back.** Settle 10 rows, leave; the card says "26 items to settle"; returning
   opens the page where it was, every choice kept; WhatsApp unchanged until Done (Q2).
3. **Grouped items.** Items the shop grouped with options settle one by one; a line under them says
   "These were one item with options on WhatsApp. After settling, make them one family from
   Products." (Q3)
4. **Can't read the catalogue.** The card's Catalogue step says "We couldn't read your WhatsApp
   catalogue" with **Use the bulk sheet** and **Skip** (products are pushed as usual).

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| WhatsApp Listings page | `/org/[orgId]/channels/whatsapp/listings` | Changed: the marketplace Listings page with WhatsApp as source | R1–R3, R7 |
| Match picker / Add form | Existing Settle overlays | Unchanged | R4, R5 |
| Done sheet | `HandoffSheet` | New | R6, R7 |
| Can't read note | WhatsApp card checklist | New | R9 |

## State matrix — WhatsApp Listings page
| State | What the shop sees | Action |
|---|---|---|
| First use | `PageHeader` "Settle your WhatsApp catalogue"; intro "These are the items in your WhatsApp catalogue now. Match each to a product, add it as new, or leave it off. Nothing changes in WhatsApp until you tap Done." | Settle rows |
| Empty | n/a — skipped when the catalogue has no items (R1) | — |
| Loading | Row skeletons in place; first read "Reading your WhatsApp catalogue…" with a count as items arrive | — |
| Partial | `ActionBar`: "28 of 36 settled" with Done; unsettled rows first | Done |
| Success | Done sheet → card, toast | — |
| Retryable error | Read failed: "Couldn't read your WhatsApp catalogue. Try again." | Try again |
| Terminal error | Catalogue unreadable (R9): note on the card, not this page | Use the bulk sheet |
| Refused | Tapping Done with rows unsettled: the sheet lists them first: "8 not settled yet. They'll stay in WhatsApp as they are until you settle them." | Settle them · Done anyway |
| Stale | The catalogue changed in the app while settling: banner "Your WhatsApp catalogue changed. 2 new items added below." | — |
| Long content | Long item names wrap to two lines, then truncate | — |
| Many items | 300+ items: search, filter chips "To settle · Linked · Left off", `ResourceList` paging | — |
| Slow | Reading a large catalogue: progress "Reading · 120 of 300" | — |
| Phone / tablet / desktop | Rows on a phone with actions in a row menu; table from `md:` | — |

## State matrix — Done sheet
| State | What the shop sees | Action |
|---|---|---|
| Ready | "38 will stay in your catalogue as your products. 2 will be removed from WhatsApp. Prices will show as on your product pages." | Update WhatsApp · Not yet |
| Updating | Button pending "Updating WhatsApp…"; past 3 s progress "Updating · 20 of 40" | — |
| Success | Sheet closes; toast; card ticks | — |
| Retryable error | "WhatsApp didn't take every change. 36 updated; 4 will be tried again in a few minutes." | — |
| Phone / tablet / desktop | Bottom sheet / centred dialog | — |

## Copy deck
- Row badges reuse `LISTINGS_SETTLE`: "Same SKU on WhatsApp", "Looks like <name>", "Linked by you → <name>", "Left off by you".
- Actions reuse `SETTLE_ACTION`; the leave-off toast here: "Will be removed from WhatsApp when you tap Done."
- Done sheet title "Update your WhatsApp catalogue"; button "Update WhatsApp"; secondary "Not yet".
- Toast "Your WhatsApp catalogue now shows your products."
- Card step texts: "Catalogue · 36 items to settle" → "Catalogue · all in your catalogue".

## Sign-off
Signed off by the owner on 2026-11-23, after the senior UX review ([ux-review](../ux-review.md)) and the final cross-feature check.
