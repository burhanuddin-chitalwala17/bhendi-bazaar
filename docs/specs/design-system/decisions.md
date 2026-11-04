# Decisions — design-system

- **Verified:** 2026-11-04

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones (ADR-0062).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Which icon set replaces lucide? | Phosphor (MIT, six weights) behind one `Icon` seam, so the owner's own icons replace it name by name later | Owner | 2026-11-04 | Free; weights give the store a lighter voice than the portals; the seam keeps the choice cheap to reverse | decided |
| Q2 | Who draws the brand icons? | Claude drafts 6–10 SVGs on Phosphor's grid; the owner approves them on a preview page before any ships | Owner | 2026-11-04 | The owner has no icon experience; drafts on the same grid match the base set | decided |
| Q3 | New visual direction, or refine the brand? | Keep emerald, parchment, gold and the serif; refine how they are used | Owner | 2026-11-04 | Brand equity; the problem is usage, not the palette | decided |
| Q4 | Fix the audit's defects now or with the revamp? | Now, as fixes (CHANGELOG 2026-11-04, "Seven UI defects") | Owner | 2026-11-04 | They are bugs; design sign-off should not hold them | implemented |
| Q5 | Which form factors does the revamp design? | Phone first for shoppers; tablet (`md:`) and desktop (`lg:`) designed for every screen, not stretched | Owner | 2026-11-04 | Owner's instruction; ADR-0015, ADR-0050 | decided |
| Q6 | How does type behave on a phone? | Each role has its own phone size, smaller and tighter than desktop; floor 11px; values in foundations Q10 | Owner | 2026-11-04 | "Sophisticated, not enlarged" on small screens | decided |
| Q7 | Is render speed in scope? | Yes, as a rule every subfeature follows; the Cache Components migration is its own subfeature (Q8) | Owner | 2026-11-04 | Owner asked for fast mounting and painting | decided |
| Q8 | Turn on Cache Components / partial prerendering in this programme? | Build on the caching that landed on main, once it is pulled into this checkout; Claude reviews it first | Owner | 2026-11-04 | Owner: the other session has landed; was: deferred until it lands | decided |
| Q9 | Rename `ui/`, `shared/`, `layout/` to `design-system/` and `shared/components/`? | No. `ui/` is the design-system library, `shared/` the cross-domain components, `layout/` the chrome and page layouts; ADR-0066 names the tiers | Claude · reversible | 2026-11-04 | Same meaning as the owner's tiers; a rename rewrites ~400 imports for no behaviour | decided |
| Q10 | Phone type scale | Phone → desktop: display 28→48, headline 22→32, title 18→22, body 15→16, small 13→14, caption 12, label 11 (uppercase, 0.08em). Inputs keep 16px | Claude · reversible | 2026-11-04 | iOS body is 17pt and Material 14–16px; fashion apps run 13–15px on phones. 15px reads as refined without losing legibility; 16px inputs stop iOS zooming (ADR-0015) | decided |
| Q11 | Icon weight by surface | Store `light`, portal and admin `regular`, a selected state `fill` | Claude · reversible | 2026-11-04 | Lighter strokes match the serif; portals need legibility at 16px | decided |
| Q12 | Phone product grid: 3-up (ADR-0016) or 2-up (the code since b2c4ce46)? | 2-up stays; ADR-0016's grid clause is superseded in storefront-journey | Claude · reversible | 2026-11-04 | Myntra, Nykaa and Ajio show apparel 2-up; cloth cannot be judged at 105px | decided |
| Q18 | How is the UX signed off for a one-go build? | One combined review canvas (all surfaces, brand icon drafts included); the owner approves it, then everything is built in one go | Owner | 2026-11-04 | Owner's request; replaces per-subfeature ux.md sign-off for this programme | decided |
| Q19 | Product grid columns by form factor | Phone 2, tablet 3, desktop 4 (today 2 / 2 / 3) | Owner | 2026-11-04 | Owner approved 2026-11-04; fashion stores show 4-up on desktop | decided |
| Q20 | Checkout as a focused flow without the tab bar? | Yes, no tab bar in checkout; a back arrow to the bag in the top bar, and the browser back works | Owner | 2026-11-04 | Owner approved, asking for a way back; was: no back affordance named | decided |
| Q21 | Phone tab bar for shoppers | Home · Shop · Saved · Bag · Account; Contact moves to Account and the product page | Owner | 2026-11-04 | Owner approved 2026-11-04 | decided |
| Q22 | How is the build run? | Claude builds foundations, then parallel agents on store, seller portal and admin (no shared files), then a fresh-context review; nothing committed | Owner | 2026-11-04 | Scale is ~300–400 files | decided |
| Q23 | Show more, infinite scroll or virtual scroll for product lists? | Infinite scroll as today (loads a screen early); no virtualization; long grids get `content-visibility` | Claude · reversible | 2026-11-04 | `paginated-product-grid.tsx` already auto-loads; virtualization costs layout and find-in-page for no gain at hundreds of tiles | decided |
| Q24 | Phone and desktop versions of a banner or storefront photo, with crop or fit | One shared image-slot part: each place declares its phone and desktop shape in code; upload one or both; "keep it exact" crops, "fit it in" fills the edges; admin banners, shop banners and storefront slots all use it. Own subfeature (image-slots), schema change | Owner | 2026-11-04 | Owner's request; today Banner and OrgBanner hold one image at one 5:2 shape | decided |
| Q25 | Pincode delivery check on the product page | Built in storefront-journey on the existing rates lookup (Shiprocket returns a delivery estimate); not built today | Claude · reversible | 2026-11-04 | Delivery date by the button is the strongest trust cue on Indian fashion apps | decided |
| Q26 | "Ask the shop a question" | Not built and not planned; removed from the design. Contact us (email to the platform) stays | Claude · reversible | 2026-11-04 | No messaging exists; a shop inbox is its own feature | parked |
| Q27 | Payment method choice on checkout | None: one Pay button opens Razorpay, which offers UPI, card, net banking and wallets. No cash on delivery (store policy) | Claude · reversible | 2026-11-04 | A picker would duplicate Razorpay's own; COD claims removed from every screen | decided |
| Q28 | Size guide | Not built; the slot stays in the component, hidden until a product type has one | Owner | 2026-11-04 | Owner's call | decided |
| Q29 | Bulk actions on selected products | Edit price, edit stock, archive, send to a connected marketplace; seller-workspace. Today only sheet import exists | Owner | 2026-11-04 | Owner approved, with optimised queries: one guarded statement per action over the selected ids, never a loop of single updates | decided |
| Q30 | Admin metrics and "needs action" | Derived by queries in analytics (read-only): daily sales series with prior period, platform kept from the ledger, queues from Refund, CourierConflict, unverified shops, owed settlements. No new columns or stored labels | Claude · reversible | 2026-11-04 | Counts are derived, never stored (ADR-0058's rule); the shop's Home already works this way | decided |
| Q31 | What earns a place in "Needs attention"? | Only an item the viewer can resolve now, with one action that resolves it, linked to the exact place; a threshold, not mere existence (low stock only for products that sold in the last 30 days; a refund once requested; a courier conflict until dismissed; an unverified shop only once it has a live product); the line says what waits on it; ordered money and buyers first; at most five; nothing at zero; an "all clear" when empty. Every item is a query, never a stored label | Owner | 2026-11-04 | Owner: attention must be a useful call, not noise | decided |
| Q32 | "Shops not verified" in the admin queue: add a Verify action, or drop the item? | Drop it. `Org.isVerified` is shown to no buyer and set by nothing, so the item has no action and no effect; shop verification is parked until it means something (a check, a badge, a payout rule) | Owner | 2026-11-04 | Owner asked if it was necessary; Q31 needs one action that resolves an item. was: recommend a Verify action | decided |
| Q33 | The shop's Home drops "new reviews" and "auction ends soon" (nothing the shop does clears them), reversing own-store Q13 and Q22? | Yes; reviews return when a reply feature exists | Owner | 2026-11-04 | Owner agreed | decided |

## Parked (Later)
- Q13 — An admin chart (revenue trend) needs a chart package or hand-drawn SVG; decided in admin-console's TRD.
- Q14 — Auth pages and `/sell` restyled; they follow in storefront-journey once the page grammar exists.
- Q15 — `shared/forms/product/` (~1,900 lines) moves to `product/`; layering clean-up done in page-grammar.
- Q32 — Shop verification: what "verified" means (a GST or ID check, a badge, a payout rule) is its own feature.
- Q26 — Buyer-to-shop questions; a shop inbox is its own feature.
- Q8 — Cache Components, deferred until the other session's caching lands.
- Q16 — Keyboard shortcuts and a ⌘K palette for admin; admin-console, if its UX asks for them.
- Q17 — View Transitions between a product tile and its page; storefront-journey.
