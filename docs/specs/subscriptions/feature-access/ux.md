# UX — subscriptions/feature-access

- **Status:** Signed off 2026-11-12
- **Verified:** 2026-11-12
- **Prototype:** [prototype.html](prototype.html) (local file; publishing as an artifact needs a claude.ai login in this session)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). **Screens never lock; actions do** (Q20, Q28). A shop opens every tab and sees
> what the feature does. Each paid action shows a small lock and, on tap, the locked sheet. The sheet's
> one way forward is the contact sheet, filled in with the plan (Q26). One look for every lock, so a shop learns it once.

## The three locks
| Lock | On | Off: the shop | Off: everyone else |
|---|---|---|---|
| Channels | Connect, publish, sync, read listings and orders, Google and Meta feeds, channel requests | Every channel screen opens; a plan banner on top; each channel action carries a lock (Q29). Product form unchanged (Q5) | Not in the feeds; live listings stay up, unsynced (Q9) |
| Storefront | Public `/store/{handle}`, in the directory, sitemap, "Sold by" | Builds and previews as usual (Q18); Share and View store carry a lock | "Not yet available"; hidden everywhere (Q7) |
| Image enhancement | Enhance by hand or automatically | Improve and Enhance carry a lock wherever they appear (Q29); queued work finishes (Q12) | — |

## Every way in (Q29)
Each row is a place the shop can start a paid action. All of them get the lock and open the same sheet.
The TRD maps each one to its server check, so a direct call is refused even with no button on screen.

| Lock | Where | Action that opens the locked sheet |
|---|---|---|
| Channels | Channels: each marketplace card | Connect · Renew · Reconnect · Check |
| Channels | A marketplace's Listings screen | Review and publish · Read again · Refresh · Link · Settle · Stock sync |
| Channels | Product page → "On marketplaces" (straight after a product is saved) | Put on {marketplace} (Edit listing stays open: its answers are saved, never sent, Q34) |
| Channels | `/products/{id}/listings/{channel}/new` opened directly | The page opens; Create and Use this one carry the lock |
| Channels | Products → bulk actions | Any marketplace action |
| Channels | Orders → Marketplace tab | The tab opens, with the plan banner instead of "no orders yet" |
| Channels | Setup requests | Amazon fields · Amazon category (issues stay free, Q19) |
| Channels | Home → Needs you now | Channel nudges are not shown while locked; the shop cannot act on them |
| Storefront | Home, setup list, Shop → link card, Look picker | Share your shop |
| Storefront | Storefront editor | View store (Preview stays free) |
| Image enhancement | Library → a photo | Enhance |
| Image enhancement | Product form → photos: each photo row, "Improve…", the capture warning's Improve | Improve |
| Image enhancement | Automatic enhancement (admin's per-shop policy) | No new jobs start; the admin's policy row reads "Paused: Image enhancement is off" |

Accepting or discarding a proposal that was already made stays free (Q12).

## Journeys
1. **Admin switches Channels off.** Admin → Shops → a shop → **Plan** tab → Channels switch → sheet
   "Turn off Channels for {shop}?" with what stops and the oversell warning (Q9) → Turn off → toast
   "Channels off for {shop}" → the row reads "Off · since {date} · by {admin}".
2. **Admin switches a feature on.** Plan tab → switch → on at once, no sheet → toast "Storefront on for {shop}".
3. **Shop explores Channels while locked.** Sidebar Channels (unmarked) → the normal Channels screen →
   plan banner on top → Amazon, Flipkart, Google and Meta cards, each saying what it does, Connect with
   a lock → tap → locked sheet → Talk to us → contact sheet, filled in.
4. **Shop saves a product, then meets "Put on Amazon".** Product form → Save → product page →
   "On marketplaces" → Put on Amazon (locked) → locked sheet → Not now → back on the product page.
5. **Shop fills channel fields while locked.** Product form → Amazon's fields asked, optional → Save →
   "Amazon: 2 missing" → later Channels on → publish, no edits (Q5, A3).
6. **Shop taps Improve while adding photos.** Product form → photos → a photo row → Improve (locked) →
   locked sheet → Not now → the photo stays as uploaded; the form keeps everything typed.
7. **Shop taps Enhance in the Library.** Library → a photo → Enhance (locked) → locked sheet.
   A photo already enhancing when the lock came still finishes (Q12).
8. **Shop previews and tries to share a locked storefront.** Storefront → Preview → the real storefront
   under a banner → back → Share your shop (locked) → locked sheet.
9. **A buyer opens a locked storefront link.** WhatsApp link → "{shop} isn't open here yet" → Browse
   Bhendi Bazaar. The shop's products still sell from their own pages (Q8).
10. **Someone weighing the plan on /business.** Header Talk to us, or the pricing card's Talk to us →
    contact sheet (Q30).

## Screens
| Screen | Route | Reached from | Serves |
|---|---|---|---|
| Plan tab (new) | `/admin/orgs/{org}?tab=plan` | admin shop detail tabs | R1, R9 |
| Turn-off sheet (new) | over the Plan tab | a switch turned off | R1, R3 |
| Plan banner (new) | top of Channels, a marketplace's Listings, Orders → Marketplace | opening the screen while locked | R2, R8 |
| Lock mark on an action (new) | every row of *Every way in* | — | R8 |
| Locked sheet (new) | over the screen the action was on | a locked action tapped | R7, R8 |
| Contact sheet (changed) | existing; opened from the locked sheet or /business | Talk to us | R8 |
| Storefront preview banner (changed) | `/org/{org}/storefront/preview`, `/store/{handle}` for members | Storefront → Preview | R5 |
| Not yet available (new) | `/store/{handle}` for everyone else | a shared link | R5, R6 |
| /business (changed) | `/business` | marketing links | R11 |

## State matrix — Plan tab (admin)
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Three rows, each a switch with what it covers | "What this shop pays for. Changes apply on the shop's next screen." | Switch |
| Empty / Many | n/a — always three locks | | |
| Loading | Skeleton rows, as the other tabs | — | — |
| Partial | Each row's own state | "On · since {date} · by {admin}" / "Off · since {date} · by {admin}" | Switch |
| Success | Row flips; toast | "Channels off for {shop}" / "Storefront on for {shop}" | — |
| Retryable error | Switch springs back; toast | "Couldn't change {feature}. Try again." | Try again |
| Terminal error | n/a — any switch is always allowed | | |
| Refused | Home brand: no switches, one line (Q13) | "{shop} is the home brand. Every feature stays on." | — |
| Stale | Another admin changed it: the newest wins, the row re-reads | "{feature} was already {on/off}." | — |
| Long content | Shop name wraps in the sheet title; rows never truncate | — | — |
| Slow | Switch shows pending; a second tap is one change | — | — |
| Phone / tablet / desktop | Rows stacked; from `md:` the switch sits right; sheet becomes a dialog | — | — |
| Never switched (every shop at release, every new shop) | All three off (Q14, Q15) | "Off · not switched on yet" | Switch |

## State matrix — plan banner, lock mark, locked sheet (shop)
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | The screen as it is; banner on top; each paid action with a small lock icon before its label | Banner: "{feature} is part of the ₹699 plan." | Talk to us |
| Empty | A Channels screen with nothing connected shows the four cards, each with its value line | Card line per marketplace (copy deck) | Connect (locked) |
| Partial | A shop that had connected before the lock: its cards and listings show as they are, read-only; every action locked | "Not syncing: Channels is off." | — |
| Loading | The page's own skeleton; never a flash of an unlocked action | — | — |
| Success | Lock lifted: banner and lock icons gone on next load | — | — |
| Retryable / Terminal error | n/a — the sheet makes no request | | |
| Refused | A locked action tapped, or a direct call refused by the server: the locked sheet | "{feature} is part of the ₹699 plan" | Talk to us · Not now |
| Stale | Lock switched off while the screen was open: the next tap gets the server's refusal and opens the sheet | same | same |
| Long content | Sheet body wraps; three short lines | — | — |
| Phone / tablet / desktop | Banner full width; sheet → dialog from `md:` | — | — |

## State matrix — Storefront, locked
| State | Sees | Copy | Action |
|---|---|---|---|
| Member or admin | The real storefront under a banner | "Only your team sees this. Your link shows 'not yet available' until Storefront is on." | Talk to us |
| Anyone else | Not yet available page, the shop's name and logo only | "{shop} isn't open here yet" · "Their products are on Bhendi Bazaar." | Browse Bhendi Bazaar |
| No logo / long name | Initial in place of logo; name wraps to two lines | — | — |
| Search engines | Not indexed; not in sitemap or `/store` (Q7) | — | — |
| Lock lifted | Live on next load; banner gone | — | — |

## Copy deck
- Feature names: "Channels" · "Storefront" · "Image enhancement".
- Plan tab: "Plan" · "What this shop pays for. Changes apply on the shop's next screen." · "Channels: Amazon, Flipkart, Google and Meta: publish, stock sync, orders, feeds." · "Storefront: the shop's own page, to share on WhatsApp and Instagram." · "Image enhancement: photos made ready for every platform." · "On · since {date} · by {admin}" · "Off · since {date} · by {admin}" · "Off · not switched on yet" · "{shop} is the home brand. Every feature stays on."
- Turn-off sheet: "Turn off {feature} for {shop}?" · Channels: "Publishing, stock sync, orders and feeds stop. Live listings stay up, but their stock stops updating and may oversell." · Storefront: "Their link shows 'not yet available' and the store leaves search." · Image enhancement: "No new enhancements. Photos already in the queue still finish." · "Nothing the shop has set up is deleted." · "Turn off" · "Keep on".
- Toasts: "{feature} off for {shop}" · "{feature} on for {shop}" · "Couldn't change {feature}. Try again." · "{feature} was already {on/off}."
- Plan banner: "{feature} is part of the ₹699 plan." · "Talk to us".
- Channel cards (locked): each card keeps its existing purpose and pitch lines, which already say what that marketplace does (found while building, 2026-11-12; no second line added) · "Not syncing: Channels is off."
- Locked sheet: "{feature} is part of the ₹699 plan" · Channels: "List once on Amazon, Flipkart, Google and Meta, with one stock count everywhere." · Storefront: "Your own shop page to share on WhatsApp, cards and Instagram." · Image enhancement: "Phone photos made ready for every platform." · "₹699 a month, GST included. Everything you've set up stays." · "Talk to us" · "Not now".
- Contact sheet, from a lock: WhatsApp and the message both start "Hi, I'd like {feature} for {shop}."
- Product form (Channels off): "These are for Amazon, Flipkart, Google and Meta. Fill them now and your listings are ready when Channels is on."
- Storefront: "Only your team sees this. Your link shows 'not yet available' until Storefront is on." · "{shop} isn't open here yet" · "Their products are on Bhendi Bazaar." · "Browse Bhendi Bazaar".
- /business: header "Talk to us" beside "Open your shop"; pricing card "Talk to us" under "Open your shop".

## Sign-off
Owner, 2026-11-12: "the prototype looks good to me. I am signing it off."
