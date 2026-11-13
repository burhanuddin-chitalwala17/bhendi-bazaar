# UX — own-store/storefront-look (with storefront-font)

- **Status:** Signed off 2026-11-13
- **Verified:** 2026-11-13
- **Prototype:** [prototype.html](prototype.html) (local file; publishing as an artifact needs a claude.ai login in this session)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [storefront-font spec](../storefront-font/spec.md), [storefront-font decisions](../storefront-font/decisions.md), [spike.md](spike.md)

> Phone first (360×740), desktop beside it at 1280. One UX for both features: the font choice lives on the same
> Look screen and draws into the same store. Shop in every example: **Niqab Boutique**, "Crafted for Modesty",
> 112 products — handbags, abayas, niqabs, hijabs, kaftans. Sizes in every template are the platform's
> (storefront-look Q1); templates differ in face, case, tracking, shape, colour and order.

## Journeys
1. **A buyer opens a shared store link on a phone.** WhatsApp link → store home: header (logo, name, cart) →
   banner in full colour with its label below → identity strip (name, line, ★ 4.7 · Since 2019 · 112 products)
   → category rail (Handbags, Abayas, Niqabs…) → bestsellers. Tap **Abayas** → shop page filtered → tap a
   product → title at headline size (≤3 lines), price at title size → **Add to cart**.
2. **The same buyer on a laptop.** Store home: banner on the left, identity and four featured products on the
   right; categories in one row of six below. No empty column (storefront-look R5).
3. **A shop chooses a heading font.** Portal → Storefront → **Look** → its template's card → **Font: Jost ·
   Template default** → sheet "Font for headings", every option written in "Niqab Boutique" → tap
   **Marcellus** → the card's live preview redraws → **Preview** (full screen) → **Publish** → confirm →
   toast "Published. Your store now uses Marcellus." → **View store**.
4. **A shop goes back to the template's font.** Look → Font → **Use template default** → preview redraws →
   Publish.
5. **A shop changes template and keeps its font.** Look → Bloom card → the Font row already reads
   "Marcellus" (storefront-font R6) → Publish.
6. **It goes wrong.**
   - Publish fails on the network → toast "Couldn't publish. Check your connection and try again." with
     **Try again**; the draft is kept.
   - Someone else published first → sheet "Ayesha published Bloom 4 min ago" → **See latest** or **Publish mine**
     (storefront-themes Q31).
   - A staff member (not the owner) taps Publish → sheet "Only the shop owner can publish a look" → **OK**.
7. **A new shop with no photos and one product opens its store.** The banner slot draws the template's pattern
   at banner height with the name on it in the palette's ink (no photo, so nothing to shade); the featured slots
   show the one product and pattern tiles; no category rail. Nothing is an empty area (R9).

## Screens
| Screen | Route | Reached from | Serves |
|---|---|---|---|
| Store home, four templates (changed) | `/store/{handle}` | shared link, "Visit {shop}" | look R1, R2, R4–R9 |
| Shop page grid and product card (changed) | `/store/{handle}/shop` | Shop all, category tap | look R1, R2, R7 |
| Product page inside a store (changed: title, price) | `/product/{slug}?shop={handle}` | any product card | look R3 |
| Look picker: Font row on each template card (changed) | `/org/{orgId}/storefront/look` | Storefront → Look | font R1, R4, R6 |
| Font sheet (new) | overlay on Look | Font row | font R1, R2, R4 |
| Publish confirm (changed copy) | overlay on Look | Publish | font R5, Q6 |

## Template by template (what changes)
| Template | Hero, phone | Hero, desktop | Categories | Card and product page |
|---|---|---|---|---|
| Edge | Banner edge to edge, no shade; identity bar on solid ground below; banner label in a solid chip below the photo | Banner 7 of 12 columns; identity + 2 featured products | Rail of 4:5 tiles, 140px wide | Mono category line, name at body, price at price size |
| Darbar | Banner, then a solid ivory name card overlapping its foot, caps, tracked; ribbon line below | Banner left, name card and 4 featured right | Rail of arched tiles, 120px wide (was three full-screen tiles) | Centred caps name at tag size, price tracked |
| Bloom | Banner, identity stacked below with chips | Identity above a 2×2 of featured products, beside the banner (fills the old empty pink) | Circles, 4 to a phone row, 6 on desktop | Square image, rating chip |
| Daily | Banner carousel (up to three), trust strip below (Returns 7 days · COD · Ships in 2 days) | Banner plus two side offer tiles | Circles, 4 to a row | Dense: 3 columns on phone (Q6, owner), % off chip, bold price |

## State matrix — Store home
| State | What the buyer sees | Copy | Action |
|---|---|---|---|
| First use | n/a — a buyer never sets a store up; the shop's first-use is storefront-themes' setup list | — | — |
| Empty (no products) | Identity strip and banner/pattern; storefront-themes' "setting up" line in place of shelves | "Niqab Boutique is setting up. Check back soon." | Browse Bhendi Bazaar |
| Loading | Header and identity render with the page (server render); images fade in over the palette's muted ground, at their final size, so nothing jumps | — | — |
| Partial (no photo, 1 product, no categories) | Pattern at banner height with the name; one featured product and pattern tiles; no rail | name only | Shop all 1 |
| Success | Journey 1 | "Shop all 112" | tap a category or product |
| Retryable error | storefront-themes' error page, unchanged | "This page didn't load. Try again." | Try again |
| Terminal error | n/a — a missing store is the platform's 404, unchanged | — | — |
| Refused (storefront locked) | feature-access' closed page, unchanged | "Niqab Boutique isn't open here yet" | Browse Bhendi Bazaar |
| Stale | n/a — store reads are shared and cleared on write (ADR-0065) | — | — |
| Long content | Shop name of 40 characters wraps to two lines at headline size; line clamps at two lines; banner label one line, ellipsis | — | — |
| Many items | Rail scrolls sideways with a peek of the next tile; landing shows 8 bestsellers (storefront-themes Q23) | "Shop all 112" | Shop all |
| Slow (>3s) | Same as Loading: text first, images fill in their reserved boxes | — | — |
| Phone / tablet / desktop | Phone stacks: banner → identity → categories → goods. `md:` puts identity beside the banner. `lg:` adds featured products into the identity column | — | — |

## State matrix — Product page title area (inside a store)
| State | What the buyer sees | Copy | Action |
|---|---|---|---|
| First use / Empty | n/a — a product page always has a product | — | — |
| Loading | Unchanged: the page renders on the server | — | — |
| Partial (no reviews) | Title, "No reviews yet — be the first", price | as today | Write a review |
| Success | Shop link, title in the template's display face at headline size, price at title size with MRP struck, "Inclusive of all taxes" | as today | Add to cart |
| Retryable / Terminal error | Unchanged product page errors | — | — |
| Refused (sold out) | Price stays; button reads "Sold out" and explains on tap | "Sold out. Tap Notify me to hear when it's back." | Notify me |
| Stale | n/a | — | — |
| Long content | Owner's example (66 characters) is three lines on a 360px phone, two on desktop; never clamped on the product page | — | — |
| Many items | n/a | — | — |
| Slow | n/a | — | — |
| Phone / tablet / desktop | Phone: gallery then title. `md:` two columns; title size rises along the platform's clamp to 32px, never further | — | — |

## State matrix — Look picker and Font sheet
| State | What the shop sees | Copy | Action |
|---|---|---|---|
| First use (no font chosen) | Font row shows the template's face | "Font · Jost · Template default" | tap row |
| Empty | n/a — the list is fixed in code and never empty | — | — |
| Loading | Sheet opens at once; each sample is drawn in the system font for a moment, then swaps to its face (`swap`) | — | — |
| Partial (one face failed to load) | That sample stays in the system font with a note; still selectable | "Preview unavailable — it will show on your store" | pick |
| Success | Chosen row ticked; preview redraws; banner on the card | "Previewing · not live yet" | Publish |
| Retryable error | Toast; draft kept | "Couldn't publish. Check your connection and try again." | Try again |
| Terminal error | n/a — a font key is fixed in code; an unknown one reads as the default (font Q7) | — | — |
| Refused (stale look) | Sheet | "Ayesha published Bloom 4 min ago. Look at theirs first, or publish yours over it." | See latest · Publish mine |
| Refused (not the owner) | Sheet on tap of Publish (never a disabled button, ADR-0053) | "Only the shop owner can publish a look. Ask Ayesha to publish it." | OK |
| Stale | Covered by Refused (stale look) | — | — |
| Long content | Shop name over 24 characters: the sample shows the first 24 and an ellipsis | — | — |
| Many items | Eight fonts, grouped: Suggested for {template} first, then More fonts | — | — |
| Slow (>3s publish) | Publish button shows a spinner and "Publishing…"; the sheet stays | "Publishing…" | — |
| Phone / tablet / desktop | Phone: bottom sheet. `md:` the same sheet as a side panel beside the preview | — | — |

## Copy deck
**Store (buyer)**
- Identity chips: "★ 4.7 (38)" · "Since 2019" · "112 products"
- Hero button: "Shop all 112" · Section headings: "Shop by category", "Bestsellers", "New in"
- Banner label (solid, below or beside the photo): banner's own title, then "Shop now"
- Daily trust strip: "7-day returns" · "Cash on delivery" · "Ships in 2 days" (derived facts only, storefront-themes Q21)
- Product page: "Inclusive of all taxes" · "Add to cart" · "Buy now"

**Look (shop)**
- Font row: "Font" · value "{Face} · Template default" or "{Face}"
- Sheet title: "Font for headings"
- Sheet help: "Your shop name, headings and product names use this font. Sizes stay the same."
- Group labels: "Suggested for {Template}", "More fonts"
- Tags: "Template default", "Suggested"
- Buttons: "Use this font", "Use template default", "Cancel"
- Preview banner: "Previewing · not live yet"
- Confirm title: "Publish {Template} with {Face}?"
- Confirm body: "Your store changes for everyone straight away. You can switch back for 30 days."
- Confirm buttons: "Publish", "Keep editing"
- Toasts: "Published. Your store now uses {Face}." · "Couldn't publish. Check your connection and try again."
- Stale: "{Name} published {Template} {n} min ago. Look at theirs first, or publish yours over it." · "See latest" · "Publish mine"
- Not owner: "Only the shop owner can publish a look. Ask {Owner} to publish it." · "OK"
- Face failed: "Preview unavailable — it will show on your store"

## Sign-off
Owner, 2026-11-13: "the look is amazing, make sure you follow the prototype." The look is approved as prototyped; desktop hero pictures keep the uploaded shape (storefront-look Q12).
Owner, 2026-11-13: Q6 yes, font Q1 yes, font Q2 as recommended with product names on cards included.

Signed off by the owner, 2026-11-13
