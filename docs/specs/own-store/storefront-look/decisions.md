# Decisions — own-store/storefront-look

- **Verified:** 2026-11-13

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones (ADR-0062).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids.
> storefront-themes' decisions bind here unless a row below replaces one; that feature is implemented, so a
> change to one of its rows is a new row here that supersedes it there.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | How is the type scale held across templates? | Templates stop overriding sizes and proportions (headline, title, body, price, tag, section, gutter, grid, container); they keep faces, weight, case, tracking, radius, shadow, motion, pattern, palette | Claude · reversible | 2026-11-13 | Owner: "differ in style, not proportions"; removing numbers beats capping them (spike §1, option A) | decided |
| Q2 | What size is a store's product title and price? | The platform product page's: title at `headline` (22→32px), price at `title`; in the template's display face, at its normal weight unless the template's style is bold | Claude · reversible | 2026-11-13 | R3; today the title is Playfair bold at a theme size up to 72px | decided |
| Q3 | How does text stay readable without a shade? | Phone: text below the picture. Desktop: text beside it, or a small solid label card on the picture's edge. Card badges sit on solid `deal` or `card` ground, never on a scrim | Claude · reversible | 2026-11-13 | R6; Shopify Dawn defaults overlay to 0 and puts text below on phones (spike) | decided |
| Q4 | What fills the hero so it is never bare? | Each template keeps its variant, reshaped: identity strip (logo, name, line, chips: rating · since · products) + picture + featured goods or categories within the first phone screen; on desktop featured products fill the side column | Claude · reversible | 2026-11-13 | R4, R5; follows Nykaa Fashion, Libas and Dawn's order: image, then categories, then goods | decided |
| Q5 | How do Darbar's categories become compact? | Darbar draws collections as tall arched tiles in a rail, three and a bit to a phone screen, six to a desktop row — the same size as Edge's rail, in Darbar's style | Claude · reversible | 2026-11-13 | R7; keeps the royal look (arch, caps) without a full-screen tile | decided |
| Q6 | Does Daily keep three product columns on a phone? | Yes: it is Daily's purpose (dense, affordable); card text at the same sizes, only the image smaller | Owner | 2026-11-13 | Taste; touches "same proportions" (R2), accepted as Daily's one exception | decided |
| Q7 | Is the shop name ever larger than `headline`? | No; the shop name is a headline at most, in every template and the header | Claude · reversible | 2026-11-13 | R1; owner's screenshot 2 | decided |
| Q8 | Are banner photos ever cropped to fit text? | No text sits on a photo, so a picture keeps the shape the shop framed it in (Q12) and is never darkened | Claude · reversible | 2026-11-13 | R6; the shop chose that framing. was: phone 4:5, desktop 5:2 (hero photos are 16:9 on desktop) | decided |
| Q9 | Does the marketplace home banner lose its scrim too? | Parked: the owner asked about stores | Claude · reversible | 2026-11-13 | Outside the outcome; the same rule may follow in a later change | parked |
| Q10 | May a shop arrange its own hero blocks? | Parked: a theme's order is its design (storefront-themes Q25) | Claude · reversible | 2026-11-13 | New capability | parked |
| Q11 | Which products fill the hero's featured slots? | The landing page's first bestsellers (the same list the bestsellers shelf shows), skipping sold out; with fewer than needed, the slot is the template's pattern tile | Claude · reversible | 2026-11-13 | No new pick for the seller to make; derived, so never stale | decided |
| Q12 | What shape is each template's desktop hero picture? | The shape the shop uploaded: hero photos 16:9, offer banners 5:2, phone 4:5 for both (image-slots, unchanged). The prototype's per-template desktop shapes (Bloom 4:3, Darbar and Daily 5:2) are drawn at the slot's shape when built; layout as prototyped | Claude · reversible | 2026-11-13 | Owner confirmed phone and desktop uploads exist; a picture is never cropped differently from what the shop framed | decided |

## Parked (Later)
- Q9 — marketplace home banner scrim; a BACKLOG row under Phase 13 (design system).
- Q10 — shop-arranged hero; stays rejected by storefront-themes Q25 until a shop asks.
