# UX — own-store/storefront-themes

- **Status:** Signed off
- **Verified:** 2026-10-30
- **Prototype:** prototypes/storefront-themes-prototype.html — tokens from `brand-pages-reference.md` via spec.md Theme cards
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

## Journeys
Each starts one step before the screen.
1. **Owner: picks a theme (R1–R4, A2).** Setup list "Choose your shop's look" (or Shop tab → "Look")
   → picker: four cards, each a moving mini-preview of **their own** shop → taps *Darbar* → three
   palette dots under it; taps "Ivory & gold" → full-screen preview of their landing page →
   scrolls; switches "Landing / Shop" → "Publish this look" → sheet "Your shop will look like this
   for everyone. You can switch back any time." → "Publish" → toast "Your new look is live." →
   "Share your shop".
2. **Owner: fills what the theme asks (R9, R10).** Preview → a section shows a soft "Add a photo"
   chip where the theme draws a pattern → tap the section → sheet with only its fields → "Save" →
   preview redraws. Nothing blocks publishing; empty sections close up or draw the pattern.
3. **Owner: switches back (Q4).** Look → "Switch back to {previous}" (30 days) → sheet → "Switch back".
4. **Owner: goes wrong.** Preview fails to load → "Couldn't load your preview." / Publish fails →
   "Not published. Your shop still shows {current}." → "Try again". Another member published
   first → "{Name} published {theme} 2 min ago." → "See it" / "Publish mine anyway".
5. **Buyer: from a shared link to the cart (R5–R7, A5).** WhatsApp link → landing page in the
   shop's theme → deals section "20% off all sarees · Ends Sun" → "Shop the deal" → shop page,
   Deals filter on → product (marketplace product page, themed chrome kept) → "Add to cart" →
   cart (shared) → platform checkout.
6. **Buyer: back to the shop's home.** Shop page or product → "Visit Zaveri & Sons" (Q23) → landing.
7. **Buyer: leaves for the marketplace.** Tab bar "More" → "Shop all of Bhendi Bazaar" (Q6).

## Screens
| Screen | Route | Reached from | Serves |
|---|---|---|---|
| Look picker | `/org/{orgId}/storefront/look` | Setup list, Shop tab | R1, R3, R4 |
| Live preview & publish | same, full-screen overlay (canvas task, ADR-0040) | Picker card | R4, A2, Q4 |
| Section sheet | sheet over preview | Tap a section | R9, R10, Q9, Q10 |
| Landing page | `/store/{handle}` | Shared link, "Visit {Shop name}" | R5–R8, R10 |
| Shop page | `/store/{handle}/shop` (`?deals=1`) | "Shop all {n}", Deals tab | R6, R7, R13 |
| Themed chrome | every `/store/{handle}/**` and product pages reached from it | — | R5, Q6 |

## State matrix — look picker
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Four cards, the one matching the shop's main category marked "Suggested" | "Choose how your shop looks. You can change it any time." | Preview |
| Empty | Shop has no products: cards preview with sample goods, labelled | "Showing sample products until you add your own." | Add a product |
| Loading | Card frames with the theme's pattern; mini-previews fade in | — | — |
| Partial | One card's preview failed; others shown | "Preview unavailable" on that card | Try again |
| Success | Current theme carries a "Live" tag | "Live now" | Preview |
| Retryable error | Banner | "Couldn't load your themes. Check your internet." | Try again |
| Terminal error | n/a — four themes are code; nothing the owner changes fixes a read | — | — |
| Refused | Member without shop-edit role | "Only the shop's owner can change its look." | Back |
| Stale | n/a — themes are code; previews read the shop on open | — | — |
| Long content | Shop name 2 lines in mini-preview, then … | — | — |
| Many items | n/a — four themes, three palettes each | — | — |
| Slow | Patterns stay, previews arrive one by one | — | — |
| Phone / tablet / desktop | Phone: cards stacked, swipe palettes; `md:` 2×2; `lg:` 4 across | — | — |

## State matrix — live preview & publish
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Own landing page in theme; top bar theme name, palette dots, Landing/Shop switch | "Tap any part to change it." (once) | Publish this look |
| Empty | Name and logo only: hero draws pattern, sections close up | Soft chip "Add a photo" on hero | Tap section |
| Loading | Theme frame with pattern, then content | — | — |
| Partial | Some photos still optimizing: pattern in their slots | — | — |
| Success | Toast; picker shows "Live" | "Your new look is live." | Share your shop |
| Retryable error | Inline over page | "Couldn't load your preview." / "Not published. Your shop still shows {current}." | Try again |
| Terminal error | n/a — any theme renders any shop | — | — |
| Refused | Another member published since opening | "{Name} published {theme} {n} min ago." | See it / Publish mine anyway |
| Stale | Products edited in another tab | n/a — preview reads on open; reopen to refresh | — |
| Long content | 60-char name: hero headline wraps to 3 lines; header shows logo only | — | — |
| Many items | 500 products: landing shows 8 + 8 (Q23) | "Shop all 500" | — |
| Slow | Pattern frame holds; publish button shows spinner after 1 s, stays tappable | "Publishing…" | — |
| Phone / tablet / desktop | Phone: full-screen; `md:` phone frame + controls side; `lg:` phone and desktop previews side by side | — | — |

## State matrix — section sheet
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Only this section's fields, each saying where it shows | e.g. "Up to 3 photos. The first one is what WhatsApp shows." | Save |
| Empty | Fields blank, the preview shows what blank looks like | "Leave it empty and this part draws a pattern." | Save |
| Loading | Photo uploading: thumbnail with progress | "Uploading…" | — |
| Partial | One of 3 photos failed | "1 photo didn't upload." | Try again |
| Success | Sheet closes; section redraws | "Saved" | — |
| Retryable error | Banner in sheet | "Couldn't save. Your words are kept here." | Try again |
| Terminal error | Field error under field | "Too long — 120 letters at most." / "Use a photo, not a PDF." | Edit |
| Refused | A fourth claim picked (Q21) | "Up to three. Remove one to add this." | Remove one |
| Stale | Another member saved this section | "Changed by {Name} just now. Load theirs?" | Load / Keep mine |
| Long content | Counter from 80% of the limit | "112 / 120" | — |
| Many items | Collections: 40 categories, search | "Search your categories" | — |
| Slow | Save over 3 s: spinner on button, sheet stays | "Saving…" | — |
| Phone / tablet / desktop | Phone: bottom sheet; `md:`+ side panel beside preview | — | — |

## State matrix — landing page (buyer)
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | n/a — a buyer's first visit is the normal page | — | — |
| Empty | No products | "{Shop name} is setting up. Check back soon." + story, visit | Shop all of Bhendi Bazaar |
| Loading | Theme frame and pattern; sections stream in | — | — |
| Partial | No offers → deals closes up; proof under floors → strip closes up | — | — |
| Success | Full page in theme | — | Shop all {n} |
| Retryable error | Section-level: a failed section closes up; page-level error page in theme | "Something went wrong. Try again." | Try again |
| Terminal error | Shop withdrawn or unknown handle | "This shop isn't on Bhendi Bazaar." | Shop all of Bhendi Bazaar |
| Refused | n/a — public page | — | — |
| Stale | Offer ended while open | Badge drops on next load; cart prices it right (A3) | — |
| Long content | Long shop name: "Visit shop" (Q23); product names 2 lines | — | — |
| Many items | 8 bestsellers, 8 new in, 6 collections | "Shop all {n}" | — |
| Slow | Hero first, below-fold sections after | — | — |
| Phone / tablet / desktop | Phone: app shell, tab bar; `md:` 2–3 col grids; `lg:` theme's desktop composition | — | — |

## State matrix — shop page (buyer)
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | n/a — as landing | — | — |
| Empty | Filter returns nothing | "Nothing here with these filters." | Clear filters |
| Loading | Card skeletons in theme's card shape | — | — |
| Partial | Out-of-stock cards greyed, kept, sorted last | "Sold out" | — |
| Success | Grid in theme's card style; Deals chip | "{n} products" | Add |
| Retryable error | Next page failed | "Couldn't load more." | Try again |
| Terminal error | n/a — same as landing | — | — |
| Refused | Item up for bidding: no add button (ADR-0023) | "In an auction" | View |
| Stale | n/a — prices resolved per load | — | — |
| Long content | Name 2 lines | — | — |
| Many items | Infinite scroll, category chips, sort, search within shop | "Search {Shop name}" | — |
| Slow | Skeleton after 300 ms | — | — |
| Phone / tablet / desktop | Theme decides: Daily 3-up phone, others 2-up; `md:` 3–4; `lg:` 4–6 with filter rail | — | — |

## Copy deck
- Picker: "Your shop's look" · "Choose how your shop looks. You can change it any time." · "Suggested for {category}" · "Live now" · "Preview"
- Preview: "Publish this look" · "Landing" · "Shop" · "Tap any part to change it." · "Add a photo"
- Publish sheet: "Publish {theme}?" · "Your shop will look like this for everyone. You can switch back any time." · "Publish" · "Not yet"
- Toasts: "Your new look is live." · "Saved" · "Switched back to {theme}."
- Buyer: "Visit {Shop name}" / "Visit shop" · "Shop all {n}" · "Shop the deal" · "Ends {Sun 3 Nov}" · "Ends today" · "Code {CODE} · tap to copy" · "Copied" · "Sold on Bhendi Bazaar" · "Shop all of Bhendi Bazaar"
- Why buy from us (facts; claims shown apart, e.g. "BIS hallmarked — every piece, card in the box"): "★ 4.8 from 212 reviews" · "1,400+ orders delivered" · "On Bhendi Bazaar since 2024" · "Ships in {n} days" ("1 day", "today", Q38) · "{n}-day returns" (shown as the returns preset label, Q37)
- Visit & contact: "{Area}, {City}" · "Open today 10:30 am – 9 pm" · "Contact us" (platform; no shop phone, Q22) · "Dispatch in {n} days" (Q38) · "{n}-day returns" (preset label, Q37) + the shop's note
- Errors: as in the matrices. No disabled buttons; an unavailable action explains on tap.

## Sign-off
Signed off by the owner, 2026-10-30, from the prototype file (approved as drawn).
