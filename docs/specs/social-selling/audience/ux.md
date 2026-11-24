# UX — social-selling/audience

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/reach.html](../prototypes/reach.html), sections "Audience", "Upload", "Lists", "What a buyer sees"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [consent-core ux](../consent-core/ux.md), [whatsapp-campaigns ux](../whatsapp-campaigns/ux.md), parent Q9, Q110

> Who the shop may message, and how it grows that number honestly. The page leads with the one
> figure that matters ("104 can get your offers on WhatsApp") and the three ways to grow it: the
> checkout box, the "Get offers on WhatsApp" button, and an upload of people who already agreed.

## Journeys
1. **See who I can reach.** Menu → **Customers** → tab **Audience** → header figures "104 can get
   offers on WhatsApp · 61 by email" → chips **All · Opted in · Not yet · Stopped · Buyers** →
   rows with name, masked phone (•••• 4321), channel badges, source.
2. **Grow it.** A card under the figures, until dismissed: "Grow your list" with three lines:
   "Buyers can tick a box at checkout (on for every shop)", "Add Get offers on WhatsApp to your shop
   page · On" (switch), "Upload people who agreed" → **Upload**.
3. **Upload (A3).** **Upload** → sheet: pick a CSV or spreadsheet → column match ("Phone" → phone,
   "Name" → name; changeable) → preview "200 rows · 196 valid · 4 skipped (numbers not valid)" →
   the tick, unticked: "These people agreed to get WhatsApp messages from Niqab Boutique" with the
   line "We record that you ticked this, with your name and this file." → **Add 196** (pending
   "Adding…") → toast "196 added as opted in. 4 skipped." Without the tick the button reads
   **Add 196 as Not yet**.
4. **Make a list (A4).** Tab Audience → **Lists** → **New list** → name, conditions as chips:
   "Bought from: Abayas", "Wishlisted", "Ordered in the last 30 days", "From upload: Diwali.csv" →
   live count "38 opted in" → **Save list**.
5. **See a number (A5).** Row → contact → phone "•••• 4321" → **Show** → full number, and the line
   "Views are recorded."
6. **Phone contacts.** A line on the page: "Your phone's contacts: 312 arrived · Not yet" (or
   "still arriving" / "weren't shared when you connected").
7. **First offer to phone contacts (A6).** Grow card line "Send a first offer to your 312 phone
   contacts" → **Send first offer** → one sheet: product (picked, or the last post's), the message
   preview as WhatsApp shows it ("Hi Ayesha! 🌙 Niqab Boutique here. Our Eid edit is in: Black nidha
   abaya, ₹2,200. Want our new arrivals and offers here?" with **Shop now**, **Yes, keep me
   posted**, **Stop messages**), the line "Each contact gets this once. Those who tap Yes join your
   list; no answer means we won't message them again.", cost "312 × about ₹0.86 · about ₹268 ·
   ₹212 of ₹1,000 used this month", pace "Up to 100 a day, so WhatsApp keeps your number's quality
   high · done by Thu" → **Send to 312 · about ₹268** (pending "Starting…") → the line becomes
   progress "First offer · 100 of 312 sent · 21 said yes · 3 said stop" → done: "48 said yes ·
   9 said stop · 255 no answer". The 48 are Opted in (source "first offer · tapped Yes").

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Customers | `/org/[orgId]/customers?tab=audience\|campaigns` | New | R1 |
| Contact detail | `/customers/contacts/[id]`; sheet on a phone | New | R6 |
| Upload | `HandoffSheet` (phone) / `TaskDialog` (desktop), three steps in one sheet | New | R4 |
| Lists | `/customers/lists`, editor as a sheet | New | R5 |
| Checkout box | Checkout, above Pay | Changed | R2 |
| Get offers button | Store page, under the shop's name | Changed | R3 |

## State matrix — Audience
| State | What the shop sees | Action |
|---|---|---|
| First use | "No one can get your offers yet." + the Grow card open | Upload |
| Empty filter | Opted in: "No one has agreed yet. They will as they buy and tick the box." | — |
| Loading | Figures and rows as skeletons | — |
| Success | Figures, Grow card (dismissible), rows | Open |
| Retryable error | `ErrorState` | Try again |
| Refused | No plan: lock (ux-patterns §8) | Talk to us |
| Many items | Search by name or last 4 digits; paged | — |
| Phone / tablet / desktop | Rows on a phone; table from `md:` | — |

## State matrix — Upload
| State | What the shop sees | Action |
|---|---|---|
| Ready | "Pick a CSV or spreadsheet with a phone column." | Pick file |
| Reading | "Reading · 120 of 200" | — |
| Refused | No phone column: "We couldn't find phone numbers. Pick the column that has them." | Pick column |
| Preview | Counts, 5 sample rows, the tick | Add |
| Stopped people in file | "3 asked to stop earlier and stay stopped." | — |
| Done | Toast; the figures update | — |
| Over 10,000 rows | "Upload up to 10,000 rows at a time." | — |

## Buyer-facing words
- Checkout box (unticked, one box naming both consents, Q8): "I agree to get offers from Niqab
  Boutique and, separately, from Bhendi Bazaar, on WhatsApp and email. I can stop either any time."
- Store page button: "Get offers on WhatsApp" → WhatsApp opens with "YES" ready to send.

## Copy deck
- "Customers", tabs "Audience", "Campaigns"; figures "<n> can get offers on WhatsApp · <n> by email".
- Chips "All", "Opted in", "Not yet", "Stopped", "Buyers"; "Grow your list".
- Upload as above; "Add <n>", "Add <n> as Not yet", toast "<n> added as opted in. <n> skipped."
- Lists "New list", "Bought from", "Wishlisted", "Ordered in the last <n> days", "From upload", "<n> opted in", "Save list".
- "Show", "Views are recorded."
- First offer: "Send a first offer to your <n> phone contacts", "Send first offer", "Each contact gets this once. Those who tap Yes join your list; no answer means we won't message them again.", "Up to 100 a day, so WhatsApp keeps your number's quality high · done by <day>", "Send to <n> · about ₹<x>", "First offer · <n> of <m> sent · <n> said yes · <n> said stop", buttons "Shop now", "Yes, keep me posted", "Stop messages"; already sent: "Your phone contacts have had their first offer."

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
