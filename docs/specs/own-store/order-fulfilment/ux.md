# UX — own-store/order-fulfilment

- **Status:** Signed off
- **Verified:** 2026-11-01
- **Prototype:** https://claude.ai/artifact/Kc2hoehEDTCsduV695V4sH (private)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

## Journeys
Each starts one step before the screen, as the owner asked.
1. **Shop: new paid order to delivered (R3, R6, R7, R9).** Email "New order to pack" (or the
   Orders tab badge) → Orders, "To pack" → parcel → "Ready for pickup" → confirm sheet → parcel
   reads "Ready — we're booking your pickup" → email "Pickup booked for Sat 2 Nov" → parcel shows
   date, AWB, "Download label" → hands parcel over → email "Picked up" → timeline "Delivered".
2. **Shop: cancels (R10, R12; goes wrong).** Parcel "To pack" → "Cancel parcel" → sheet: pick a
   reason → "Cancel parcel" → parcel reads "Cancelled — stock is back on sale" → buyer is emailed.
   Variant: the shop taps "Cancel parcel" on a ready parcel → explanation sheet → "Contact us".
3. **Admin: ready to booked (R4, R5, R6).** Email "Parcel ready to book" → Pickups queue, oldest
   first → books on Shiprocket in another tab → "Book pickup" → enters pickup date, ETA, courier,
   AWB, tracking link, label link → "Save booking" → row moves to "Booked"; buyer and shop emailed.
   Goes wrong: a missing field is named under that field; an AWB already on another parcel is
   refused with that parcel's code; a 24 h-old ready parcel is flagged amber and emailed again.
4. **Admin: courier silent (R2, R8).** Pickup date passed, no courier update → row flagged
   "Pickup was due yesterday" → "Mark picked up" or "Change pickup date". A courier update for an
   unknown AWB or a cancelled parcel lands on Conflicts (Q28).
8. **Admin: cancels a booked parcel (R10, Q28).** Pickups → parcel → "Cancel parcel" → sheet with
   reason → "Cancelled. Now cancel AWB {awb} on Shiprocket." Goes wrong: courier picked it up first.
9. **Admin: shop not packing (R3a).** Shop nudged at 12 h and 24 h → at 36 h the parcel appears
   under Pickups "Not packed" → "Email shop" or "Cancel parcel".
10. **Admin: changes the cancellation fee (R12a).** Settings → "Shop cancellation fee" → ₹75 →
   "Save" → next shop cancel charges ₹75. The same page lists cancellations per shop.
5. **Admin: refund owed (R14).** Refunds → "₹1,240 owed · BB-4821-SH1 · cancelled by shop" →
   "Refund ₹1,240" → confirm sheet → "Refund started" → buyer emailed. Goes wrong: gateway refuses
   → its reason shown; timeout → "We couldn't confirm the refund. Check Razorpay before trying
   again." (decisions Q12).
6. **Buyer: paid to delivered (R6, R7, R9).** Confirmation email (now "We'll email the delivery
   date once your parcel is booked") → My orders → order → "Order confirmed" → email "Ships Sat 2
   Nov · arrives by Wed 6 Nov" → "Track parcel" → "Out for delivery today" → "Delivered".
7. **Buyer: cancels (R10–R13; goes wrong).** Order "Being prepared" → "Cancel order" → sheet,
   optional reason (Q21) → "Yes, cancel" → "Cancelled · refund of ₹1,240 on its way" → email
   "Refund started". Variant: tapping "Cancel order" once the shop marked it ready → sheet "This
   parcel is packed and waiting for the courier. To stop it, contact us." → "Contact us".

## Screens
| Screen | Route | Reached from | Change | Serves |
|---|---|---|---|---|
| Shop orders | `/org/[orgId]/orders` | Tab bar "Orders" (own-store Q13), email | Tabs To pack · Ready · On the way · Done · Cancelled, per parcel | R3, R7 |
| Shop parcel | `/org/[orgId]/orders/[orderId]` | Orders row, email | One card per own parcel: next action, timeline, pickup details | R3, R6, R7, R10 |
| Shop cancel sheet | over shop parcel | "Cancel parcel" | New picker sheet (ADR-0040) | R10 |
| Admin pickups | `/admin/orders/pickups` | Email, admin nav "Pickups" with count | New queue: Ready · Booked · Overdue | R4, R5 |
| Admin book pickup | panel over pickups and order console | "Book pickup" | Replaces ShipmentTrackingForm's fields | R5, R6 |
| Admin refunds | `/admin/orders/refunds` | Admin nav "Refunds" with count | New list of refunds owed and started | R14 |
| Buyer order | `/order/[orderId]`, `/orders` | Email, My orders | Timeline per parcel, ETA, track link, cancel, refund line | R7, R10, R14 |
| Buyer cancel sheet | over buyer order | "Cancel order" / "Cancel these items" | New picker sheet | R10 |
| Admin cancel sheet | over pickups and order console | "Cancel parcel" | New picker sheet | R10 |
| Admin change pickup date | small panel over pickups | "Change pickup date" | New | R5 |
| Admin conflicts | `/admin/orders/pickups` tab "Conflicts" | Pickups tab with count | New list of unmatched courier updates | R8 |
| Admin fee setting + cancellation count | `/admin/settings/fulfilment` | Admin nav "Settings" | New; headed "Fulfilment settings", the table "Cancellations by shop, last 30 days" (added at build, unit 5) | R12a |
| Admin not-packed flag | `/admin/orders/pickups` tab "Not packed" | Pickups tab with count | New, parcels paid 36 h+ and not ready | R3a |
| Parcel timeline | inside the three above | — | One component, wording by audience; times in India time | R7 |

## Timeline wording (one component, three readers)
| Parcel state | Shop sees | Buyer sees | Admin sees |
|---|---|---|---|
| `packing` | "To pack — mark ready when it's packed" | "Order confirmed" | "Shop packing · paid {time}" |
| `ready_for_pickup` | "Ready — we're booking your pickup" | "Being prepared" | "Ready to book · {age}" |
| `pickup_booked` | "Pickup booked for {date}" | "Ships {date} · arrives by {eta}" | "Booked · {courier} · {awb}" |
| `picked_up` | "Picked up by {courier}" | "Shipped" | "Picked up" |
| `in_transit` | "On the way" | "On the way" | "In transit · {courier wording}" |
| `out_for_delivery` | "Out for delivery" | "Out for delivery today" | "Out for delivery" |
| `delivery_failed` | "Courier couldn't deliver — trying again" | "Delivery attempt missed — the courier will try again" | "Attempt failed · {courier wording}" |
| `delivered` | "Delivered {date}" | "Delivered {date}" | "Delivered" |
| `cancelled` | "Cancelled by {you / the buyer / us} · {reason}" | "Cancelled · refund {state}" | "Cancelled by {actor} · {reason}" |
| `rto_*`, `lost`, `damaged` | "Coming back to you" / "Problem in transit — we'll contact you" | "There's a problem with this parcel. We'll contact you." | courier wording (Q15) |
| ETA changed | — | "New delivery date: {eta}" | "ETA {old} → {eta}" |

## State matrix — shop orders
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Empty "To pack" with one line | "No orders yet. When someone buys, it appears here and we email you." | Share your shop |
| Empty | Tab empty | "Nothing to pack. Nice." / Ready: "Nothing waiting for pickup." / Cancelled: "No cancelled parcels." | — |
| Loading | Skeleton rows; refresh keeps rows | — | — |
| Partial | Order with two of the shop's parcels, one ready | Row per parcel: "Parcel 1 of 2 · Ready"; buyer shown as name, city, pincode (Q22) | Open |
| Success | Row moves tab after an action | Toast "Marked ready. We'll book the pickup." | — |
| Retryable error | Banner over list | "Couldn't load orders. Check your internet." | Try again |
| Terminal error | n/a — a list read has nothing to change | — | — |
| Refused | Not a member of this shop | "You don't have access to this shop's orders." | Go to my shops |
| Stale | Pull to refresh; "Updated {n} min ago" over 5 min | "Updated 12 min ago" | Refresh |
| Long content | Product name 2 lines, then … | — | — |
| Many items | 20 per page, oldest "To pack" first; search by order code | "Search order number" | Load more |
| Slow | Skeleton after 300 ms; spinner on refresh | — | — |
| Phone / tablet / desktop | Phone: cards; `md:` two columns; `lg:` table | — | — |

## State matrix — shop parcel
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | First order: a one-line hint under the button | "Pack the items below, then tap Ready for pickup. We book the courier for you." | Ready for pickup |
| Empty | n/a — a parcel always has lines | — | — |
| Loading | Skeleton card | — | — |
| Partial | Two-shop order: only own parcel shown | "You see only the parcels that ship from your shop." | — |
| Success: ready | Green tick, timeline step | "Ready — we're booking your pickup. We'll email you the date." | — |
| Success: booked | Pickup card | "Pickup booked for Sat 2 Nov · Delhivery · AWB 1234567890" | Download label (signed-in only, until pickup — Q26) |
| Success: delivered | Timeline complete | "Delivered Wed 6 Nov. Your earnings are in Money." | View earnings |
| Retryable error | Toast, button stays | "Couldn't mark ready. Check your internet and try again." | Ready for pickup |
| Terminal error | n/a — marking ready needs no input | — | — |
| Refused: cancel after ready | Sheet | "This parcel is marked ready, so it can't be cancelled here. Contact us and we'll help." | Contact us |
| Refused: ready on a cancelled parcel | Sheet | "This parcel was cancelled by the buyer on {date}. Don't send it." | OK |
| Stale | Another tab changed it: action refused with the current state | "This parcel is already ready for pickup." | Refresh |
| Long content | Names wrap; reason wraps | — | — |
| Many items | 30+ lines: first 5, then "Show all 32 items" | — | Show all |
| Slow | Button shows spinner, stays enabled | "Marking ready…" | — |
| Phone / tablet / desktop | Phone: docked "Ready for pickup" bar above tab bar (ADR-0016); `lg:` button in card header | — | — |

## State matrix — shop cancel sheet
| State | Sees | Copy | Action |
|---|---|---|---|
| First use / Empty | Reason list (Q21), none picked | "Why are you cancelling? The buyer gets a full refund and ₹{fee} is taken from your earnings." | Cancel parcel |
| Loading | n/a — reasons are static | — | — |
| Partial | n/a — one parcel | — | — |
| Success | Sheet closes; card cancelled with a fee line | "Parcel cancelled. Stock is back on sale and the buyer will be refunded. ₹50 cancellation fee taken from your earnings." | — |
| Retryable error | Inline above button | "Couldn't cancel. Try again." | Cancel parcel |
| Terminal error | No reason picked; "Other" empty | "Pick a reason." / "Tell us the reason in a few words." | — |
| Refused: buyer cancelled first | Sheet message replaces the list | "The buyer already cancelled this parcel. No fee is charged." | OK |
| Refused: marked ready in another tab | Sheet message | "This parcel was marked ready, so it can't be cancelled here. Contact us and we'll help." | Contact us |
| Stale | n/a — the sheet's two refusals above are its stale cases | — | — |
| Many items | n/a — fixed list of five reasons | — | — |
| Long content | "Other" up to 120 characters | — | — |
| Slow | Spinner in button | "Cancelling…" | — |
| Phone / tablet / desktop | Bottom sheet; `md:` centred dialog | — | Keep parcel |

## State matrix — admin pickups
| State | Sees | Copy | Action |
|---|---|---|---|
| First use / Empty | Empty queue | "No parcels waiting. You'll get an email when a shop marks one ready." | — |
| Loading | Skeleton rows | — | — |
| Partial | Order with one parcel booked, one ready | Row per parcel, "Parcel 2 of 2" | Book pickup |
| Success | Row moves to Booked | Toast "Booked. Buyer and shop emailed." | — |
| Retryable error | Banner | "Couldn't load pickups." | Try again |
| Terminal error | n/a — read only | — | — |
| Refused | Not a platform admin | "This page is for Bhendi Bazaar staff only." | Go to home |
| Stale: paid 36 h, not ready | "Not packed" tab, red | "Paid 37 h ago, not ready. Shop emailed twice." | Email shop / Cancel parcel |
| Stale: ready > 24 h | Amber "Waiting 26 h" | "Ready for 26 h — book today" | Book pickup |
| Stale: pickup date passed | Red "Pickup was due yesterday" (later: "Pickup was due {n} days ago", added at build) | "No courier update since booking." · toast on "Mark picked up": "Marked picked up. The shop is emailed." | Mark picked up / Change date |
| Long content | Shop name and address wrap; pincode bold | — | — |
| Many items | Oldest first; filter by shop, city; 50 per page | — | — |
| Slow | Skeleton | — | — |
| Phone / tablet / desktop | Phone cards; `lg:` table with pickup address column | — | — |

## State matrix — admin book pickup
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Hint above fields | "Book this parcel on Shiprocket first, then copy the details here." | Open Shiprocket |
| Empty | Fields blank; courier prefilled from checkout's rate | — | Save booking |
| Loading | n/a — opens with data | — | — |
| Partial | Some fields filled | — | Save booking |
| Success | Panel closes | "Booked. Buyer and shop emailed." | — |
| Retryable error | Inline | "Couldn't save. Try again." | Save booking |
| Terminal error | Field errors | "Enter the pickup date." · "Enter the delivery date." · "Delivery date must be after the pickup date." · "Enter the courier." · "Enter the AWB from Shiprocket." · "Tracking link must start with https://" · "Label link must be the link Shiprocket gives you." (added at build, unit 3) | Fix field |
| Refused | AWB on another parcel; parcel cancelled meanwhile | "This AWB is already on BB-4790-SH1." · "The buyer cancelled this parcel. Cancel it on Shiprocket too." | — |
| Stale | Booked by another admin | "Already booked by {name} at 4:12 pm." | Refresh |
| Long content | Long tracking URL truncated with … | — | — |
| Many items | n/a — one parcel | — | — |
| Slow | Spinner in Save | "Saving…" | — |
| Phone / tablet / desktop | Full-height panel on phone; side panel `lg:` | — | — |

## State matrix — admin refunds
| State | Sees | Copy | Action |
|---|---|---|---|
| First use / Empty | Empty list, one line | "No refunds owed." | — |
| Loading | Skeleton | — | — |
| Partial | Some started, some owed; cause shown (cancelled, lost, damaged, returned — Q25) | Owed first, then "Started 3 Nov · rfnd_…" | Refund ₹{x} |
| Success | Row to Started | "Refund of ₹1,240 started. Buyer emailed." | — |
| Retryable error: no answer | Inline on row; row marked "Unconfirmed" | "We couldn't confirm the refund. Check Razorpay before trying again." | Open in Razorpay / Try again |
| Terminal error | Gateway refuses (e.g. payment already refunded there) | "Razorpay says: {reason}. Check the payment in Razorpay before trying again." | Open in Razorpay / Try again (added at build, unit 6: the copy invites a retry, and no row may be stuck) |
| Refused | Already started by another admin | "Already started by {name}." | — |
| Stale | Owed over 2 days amber | "Owed for 3 days" | Refund |
| Long content | Reason wraps | — | — |
| Many items | Owed oldest first; 50 per page | — | — |
| Slow | Spinner; button stays | "Refunding…" | — |
| Phone / tablet / desktop | Cards; `lg:` table | — | — |

## State matrix — admin cancel sheet
| State | Sees | Copy | Action |
|---|---|---|---|
| First use / Empty | Reason list (Q21 shop list), none picked | "Why are you cancelling? The buyer gets a full refund. No fee for the shop." | Cancel parcel |
| Loading | n/a — reasons are static | — | — |
| Partial | n/a — one parcel | — | — |
| Success: before booking | Sheet closes; row leaves the queue | "Parcel cancelled. Buyer and shop emailed." | — |
| Success: after booking | Sheet closes; amber reminder on the row | "Cancelled. Now cancel AWB {awb} on Shiprocket." | Open Shiprocket |
| Retryable error | Inline | "Couldn't cancel. Try again." | Cancel parcel |
| Terminal error | No reason; "Other" empty | "Pick a reason." / "Tell us the reason in a few words." | — |
| Refused: picked up first | Message replaces the list | "The courier picked this up at {time}, so it can't be cancelled. It can only come back as a return." | OK |
| Stale: cancelled by buyer or shop meanwhile | Message | "Already cancelled by {the buyer / the shop} at {time}." | OK |
| Long content | "Other" up to 120 characters | — | — |
| Many items | n/a — fixed list | — | — |
| Slow | Spinner in button | "Cancelling…" | — |
| Phone / tablet / desktop | Bottom sheet; `md:` dialog | — | Keep parcel |

## State matrix — admin change pickup date
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Current date shown above the picker | "Pickup was booked for {date}. Change it on Shiprocket first." | Save date |
| Empty | n/a — opens with the booked date | — | — |
| Loading | n/a — opens with data | — | — |
| Partial | Date changed, ETA not | "Also check the delivery date." under ETA | Save date |
| Success | Panel closes; timeline gains "Pickup moved to {date}" | "Pickup moved. Shop and buyer emailed." | — |
| Retryable error | Inline | "Couldn't save. Try again." | Save date |
| Terminal error | Field errors | "Pickup date can't be in the past." · "Delivery date must be after the pickup date." | Fix field |
| Refused | Parcel picked up or cancelled meanwhile | "The courier already picked this up." / "This parcel was cancelled." | OK |
| Stale | Another admin changed it | "Changed to {date} by {name} at {time}." | Refresh |
| Long content | n/a — two dates | — | — |
| Many items | n/a — one parcel | — | — |
| Slow | Spinner in Save | "Saving…" | — |
| Phone / tablet / desktop | Bottom panel; `lg:` popover beside the row | — | Keep date |

## State matrix — admin conflicts
| State | Sees | Copy | Action |
|---|---|---|---|
| First use / Empty | Empty tab | "No unmatched courier updates." | — |
| Loading | Skeleton rows | — | — |
| Partial | Some resolved, some open | Open first; resolved greyed with "Dismissed by {name}" | Dismiss |
| Success | Row moves to resolved | "Dismissed." | — |
| Retryable error | Banner | "Couldn't load conflicts." | Try again |
| Terminal error | n/a — read and dismiss only | — | — |
| Refused | Not a platform admin | "This page is for Bhendi Bazaar staff only." | Go to home |
| Stale: unknown AWB | Row | "Update for unknown AWB {awb} from Shiprocket at {time}." | Find parcel / Dismiss |
| Stale: cancelled parcel moving | Red row | "Update for cancelled parcel {code}: courier says \"Picked up\". Cancel it on Shiprocket." | Open Shiprocket / Dismiss |
| Long content | Courier wording wraps; raw payload behind "Show details" ("Hide details" to close, added at build, unit 4) | — | Show details |
| Many items | Newest first; 50 per page; same AWB grouped with a count | "3 updates" | Load more |
| Slow | Skeleton | — | — |
| Phone / tablet / desktop | Cards; `lg:` table | — | — |

## State matrix — admin fee setting and cancellation count
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Field prefilled ₹50 (the owner's default) | "Shop cancellation fee (₹)" · "Taken from a shop's earnings when it cancels a paid parcel. Applies to the next cancellation." | Save |
| Empty: no cancellations | Count table empty | "No shop has cancelled a parcel yet." | — |
| Loading | Skeleton | — | — |
| Partial | Fee saved, count still loading | Count skeleton under the saved field | — |
| Success | Toast; "Last changed by {name}, {date}" | "Saved. New cancellations charge ₹75." | — |
| Retryable error | Inline | "Couldn't save. Try again." | Save |
| Terminal error | Field error | "Enter an amount from ₹0 to ₹1,000, in whole rupees." | Fix field |
| Refused | Not a platform admin | "This page is for Bhendi Bazaar staff only." | Go to home |
| Stale | Another admin saved meanwhile | "Changed to ₹{fee} by {name} at {time}. Check before saving." | Refresh |
| Long content | Long shop names wrap in the count table | — | — |
| Many items | Count table: last 30 days, most cancellations first, 50 per page | "Zari Works · 4 cancelled · ₹200 fees" | Load more |
| Slow | Spinner in Save | "Saving…" | — |
| Phone / tablet / desktop | Stacked; `lg:` field and table side by side | — | — |

## State matrix — admin not-packed flag
| State | Sees | Copy | Action |
|---|---|---|---|
| First use / Empty | Empty "Not packed" tab | "Every paid parcel was packed within 36 hours." | — |
| Loading | Skeleton rows | — | — |
| Partial | Some shops emailed today | "Shop emailed at 12 h and 24 h" / "+ you emailed 1 h ago" | Email shop |
| Success: emailed | Toast | "Email sent to {shop}." | — |
| Success: became ready | Row leaves for Ready | — | — |
| Retryable error | Banner | "Couldn't load parcels." | Try again |
| Terminal error | n/a — read, email or cancel only | — | — |
| Refused | Not a platform admin | "This page is for Bhendi Bazaar staff only." | Go to home |
| Refused: emailed already | Toast on a second "Email shop" (once per parcel) | "You emailed {shop} on {time}. Call them on the number shown." | — |
| Stale | Age counts up; over 72 h red | "Paid 3 days ago, not ready." | Cancel parcel |
| Long content | Shop name wraps; city and phone of the shop shown | — | — |
| Many items | Oldest first; filter by shop | — | — |
| Slow | Skeleton | — | — |
| Phone / tablet / desktop | Cards; `lg:` table | — | — |

## State matrix — buyer order
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | n/a — reached only with an order | — | — |
| Empty | My orders with none | "No orders yet." | Start shopping |
| Loading | Skeleton timeline | — | — |
| Partial | Two parcels, one shipped one preparing | "Arriving in 2 parcels" | Track parcel |
| Success: booked | ETA headline | "Arrives by Wed 6 Nov" | Track parcel |
| Success: delivered | — | "Delivered Wed 6 Nov" | Write a review |
| Success: cancelled | Refund line; coupon line when every parcel is cancelled | "Cancelled. Refund of ₹1,240 is on its way. We'll email you when it starts." · "Your {code} coupon can be used again." → "Refund of ₹1,240 started 3 Nov. It reaches your account in 5–7 working days." | — |
| Retryable error | Banner | "Couldn't load your order." | Try again |
| Terminal error | n/a | — | — |
| Refused: cancel after ready | Sheet | "This parcel is packed and waiting for the courier. To stop it, contact us." | Contact us |
| Refused: unpaid order | No cancel shown; existing pay-or-expire copy | — | — |
| Guest (not signed in) | Paid, not yet collected: "Contact us" in place of cancel (Q31, added at build, unit 5) | "Contact us" | Contact us |
| Stale | ETA moved | "New delivery date: Thu 7 Nov" | — |
| Long content | Names 2 lines | — | — |
| Many items | First 3 lines per parcel, "+5 more" | — | — |
| Slow | Skeleton | — | — |
| Phone / tablet / desktop | Phone: timeline full width, docked "Track parcel"; `lg:` timeline beside items | — | — |

## State matrix — buyer cancel sheet
| State | Sees | Copy | Action |
|---|---|---|---|
| First use / Empty | Amount and optional reason | "Cancel this order? You'll get ₹1,240 back to the way you paid." | Yes, cancel |
| Success | Sheet closes | Toast "Order cancelled." | — |
| Retryable error | Inline | "Couldn't cancel. Try again." | Yes, cancel |
| Refused | Shop marked ready meanwhile | "The shop just packed this. Contact us to stop it." | Contact us |
| Loading | n/a — the amount is on the order page already; the sheet opens with it | — | — |
| Partial | Multi-parcel order: sheet names the parcel | "Cancel the items from {shop}? You'll get ₹{x} back." | Yes, cancel |
| Terminal error | n/a — the reason is optional, so nothing can be wrong | — | — |
| Stale | Already cancelled in another tab | "This order is already cancelled." | OK |
| Long content | "Other" up to 120 characters | — | — |
| Many items | n/a — four fixed reasons | — | — |
| Slow | Spinner | "Cancelling…" | — |
| Phone / tablet / desktop | Bottom sheet; `md:` dialog | — | Keep order |

## Emails (own-store Q9; Q8 here)
| Trigger | To | Subject | First line |
|---|---|---|---|
| Order paid | Buyer | "Order BB-4821 confirmed" | "Thank you! We'll email the delivery date once your parcel is booked." |
| Order paid | Shop | "New order to pack — BB-4821" | "Someone bought 2 items from {shop}. Pack them and tap Ready for pickup." |
| Parcel marked ready | Admin | "Parcel ready to book — {shop}, {city}" | "BB-4821-SH1 is packed. Book it on Shiprocket and enter the details." |
| Ready 24 h, still unbooked | Admin | "Waiting 24 h: parcel BB-4821-SH1" | "This parcel has been ready since {time}. The shop is waiting." |
| Pickup booked | Buyer | "Your order ships {Sat 2 Nov}" | "Arrives by {Wed 6 Nov}. Track it with {courier}: {link}." |
| Pickup booked | Shop | "Pickup booked for {Sat 2 Nov}" | "{courier} will collect BB-4821-SH1. Open the parcel to download the label." (link to the parcel page — Q26) |
| Pickup date changed | Shop, Buyer | "Pickup moved to {date}" / "New delivery date: {eta}" | "{courier} will now collect on {date}." / "Your order now arrives by {eta}." |
| Picked up | Shop | "BB-4821-SH1 picked up" | "{courier} has your parcel. We'll tell you when it's delivered." |
| Delivered | Buyer | "Delivered: order BB-4821" | "Your parcel from {shop} was delivered. Hope you love it." |
| Cancelled (any actor) | Buyer | "Order BB-4821 cancelled" | "{Who} cancelled {items}. Your refund of ₹1,240 is on its way." |
| Cancelled (any actor) | Shop | "Parcel BB-4821-SH1 cancelled" | "Don't send this parcel. Its stock is back on sale." (+ "₹{fee} cancellation fee taken from your earnings." when the shop cancelled) |
| Refund started | Buyer | "Refund of ₹1,240 started" | "It reaches your account in 5–7 working days." |
| Not ready at 12 h and again at 24 h (Q24) | Shop | "1 parcel waiting to be packed" | "BB-4821 was paid {12 hours / a day} ago. Tap Ready for pickup once it's packed." |

## Copy deck
| Where | Text |
|---|---|
| Shop button | "Ready for pickup" · "Cancel parcel" · "Download label" · "Contact us" · "Keep parcel" |
| Shop confirm sheet | "Is everything packed and sealed?" / "Once marked ready, it can't be cancelled here." · "Yes, it's ready" |
| Shop toasts | "Marked ready. We'll book the pickup." · "Parcel cancelled." |
| Admin buttons | "Book pickup" · "Save booking" · "Mark picked up" · "Change pickup date" · "Cancel parcel" · "Refund ₹{x}" |
| Admin fields | "Pickup date" · "Delivers by" · "Courier" · "AWB number" · "Tracking link" · "Label link" |
| Admin refund sheet | "Refund ₹1,240 to the way the buyer paid? This can't be undone." · "Refund ₹1,240" · "Not now" (changed at build, unit 6: the payment method is not stored; was "the buyer's {UPI / card}") |
| Buyer buttons | "Track parcel" · "Cancel order" / "Cancel these items" · "Yes, cancel" · "Keep order" |
| Unknown courier update (admin) | "Update for unknown AWB {awb} from Shiprocket at {time}." · "Update for cancelled parcel {code}: courier says \"{wording}\". Cancel it on Shiprocket." |
| Admin cancel | "Why are you cancelling? The buyer gets a full refund. No fee for the shop." · "Cancelled. Now cancel AWB {awb} on Shiprocket." |
| Admin refund timeout | "We couldn't confirm the refund. Check Razorpay before trying again." |
| Admin fee setting | "Shop cancellation fee (₹)" · "Taken from a shop's earnings when it cancels a paid parcel. Applies to the next cancellation." · "Saved. New cancellations charge ₹{fee}." |
| Shop cancel success | "Parcel cancelled. Stock is back on sale and the buyer will be refunded. ₹{fee} cancellation fee taken from your earnings." |
| Buyer cancel success | "Cancelled. Refund of ₹{x} is on its way. We'll email you when it starts." · "Your {code} coupon can be used again." |

## Sign-off
Signed off by the owner, 2026-10-30, from the prototype file (the published link shows an earlier draft; republish pending a claude.ai login). Decisions Q20–Q24 answered 2026-10-30; Q25 and Q27 confirmed by the owner the same day.
