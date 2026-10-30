# UX — own-store/product-form

- **Status:** Signed off
- **Verified:** 2026-10-30
- **Prototype:** `product-listing-prototype.html` (shared with bulk-sheet; owner to publish as a private artifact and link here)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

## Journeys
Each starts one step before the form, as the owner asked.
1. **Shop: list a new product (R1–R5, R14–R16).** Products tab → "+ Add product" → Photos and
   video: "Add" opens a sheet "Take photo · Choose photos or video · Add YouTube link"; the seller
   taps "Cover" on a photo → "Next" → What it is: category picker
   (search), name, description → "Next" → Price & stock: price, sale price, stock per location,
   packed weight → "Next" → Details: the type's questions as chips, hint "Amazon also asks:
   Fabric" → "Next" → Review: buyer preview, "Ready for your store · 1 thing Amazon will ask" →
   "Put on sale" → success "On sale now" → "Share on WhatsApp" or "Add another".
2. **Shop: list by copying (Q15).** Photos → "Start from a product you already sell" → picker →
   the form fills everything but photos, price and stock → continue from Photos and video.
3. **Shop: adds a video (R14, R16, A9).** Photos and video → "Add" → "Choose photos or video" →
   picks a 40 s clip → "Uploading…" → a Video row with a film mark and "Processing" → "Next"
   works at once → after save the worker finishes, the row loses the badge and shows the poster.
   Goes wrong: a 250 MB file → "Too large: clip.mov. A video is at most 200 MB"; a 2-minute clip
   uploads, then reads "Failed" with the reason in the library → "Remove".
4. **Shop: goes wrong — missing price (R4, A2).** Review → "Put on sale" → form jumps to Price &
   stock, Price outlined, "Add the price buyers pay"; chip reads "Price · 1"; sticky bar reads
   "1 thing to fix · Show" → types price → "Put on sale" again from Review.
5. **Shop: changes category mid-way (R6, A4).** Details filled for Abaya → back to What it is →
   picks Ring → sheet "Change to Ring?" lists "Fabric, Length, Sleeve won't apply to a ring" →
   "Keep Abaya" or "Change to Ring". Switching back restores the answers.
6. **Shop: edit a product (R7, R8).** Products → row → product page → "Edit" → overview: five
   cards, each a one-line summary and any hint → "Price & stock" → changes price → "Save
   changes" → toast "Saved. Live on your store now." → back at the overview.
7. **Shop: goes wrong — leaves or conflicts (R8, R9).** Edits price → back → sheet "Leave without
   saving?" → "Keep editing" / "Leave". Or "Save changes" → refusal "Bhendi Bazaar team changed
   this product 2 min ago" → latest loads, the seller's price re-applied and marked → "Save changes".
8. **Admin: fix a product for a shop (R10–R12).** Shop emails for help → Admin › Products →
   search → product → "Edit for shop" → banner "Editing for Noor Attar House — the shop will see
   this" → reason "Shop asked to fix the price" → section → change → "Save for shop" → toast
   "Saved. Noor Attar House will see 'Edited by Bhendi Bazaar team'."
9. **Admin: add a product for a shop (R10).** Admin › Shops › shop → "Add product for this shop"
   → the five steps with the banner and reason → "Put on sale for shop".
10. **Shop: sees the team's edit (R12).** Home task "Our team changed 1 product" → product page
   badge "Edited by Bhendi Bazaar team · 30 Oct" → "See what changed" → history line.

## Screens
| Screen | Route | Reached from | Change | Serves |
|---|---|---|---|---|
| New product — steps 1–4 | `/org/[orgId]/products/new` | "+ Add product", success "Add another" | Replaces the long form with steps, chips and sticky bar; step 1 houses the existing gallery editor | R1, R2, R4–R6, R14–R16 |
| Review and success | same route, step 5 | "Next" from Details, any chip | New | R3, R5 |
| Edit overview | `/org/[orgId]/products/[id]/edit` | Product page "Edit" | Replaces the long form with section cards; a card opens one section | R7–R9 |
| Category-change sheet | over What it is | Choosing a category of another type | New picker sheet (ADR-0040) | R6 |
| Leave sheet | over the form | Back, tab bar, or close with changes | New | R8 |
| Admin edit / add for shop | `/admin/products/[id]/edit`, `/admin/orgs/[orgId]/products/new` | "Edit for shop", "Add product for this shop" | New routes over the same form, banner and reason | R10, R11 |
| Shop product notice | `/org/[orgId]/products/[id]` and the list row | Products tab, home task | Badge and history | R12 |

## State matrix — New product, steps 1–4
| State | What the person sees | Copy | One action |
|---|---|---|---|
| First use | Photos and video step, empty tiles, the shot list for no category yet | "Start with photos. Tap 'Cover' on the one buyers see first." · "At least one photograph is required. Video is optional." | "Add" |
| Empty | Shop has no locations: Price & stock shows an inline location form | "Where is this kept? Add your shop address once." | "Add location" |
| Loading | First load: step skeleton. Category answers loading after a pick: chips shimmer | — | — |
| Partial | Some steps filled; chips show ✓ or a count; draft restored on reopen | "We kept what you typed at 4:12 pm." | "Discard" |
| Success | Moves to the next step; chip ticks | — | "Next" |
| Retryable error | A photo upload fails | "Photo didn't upload. Check your internet." | "Try again" |
| Terminal error | Photo too large or not an image | "This file isn't a photo we can use. Pick a JPG or PNG." | "Pick another" |
| Refused | Category of another type chosen after Details | Sheet: "Change to Ring? Fabric, Length, Sleeve won't apply to a ring." | "Keep Abaya" / "Change to Ring" |
| Stale | Draft older than 7 days on reopen | "We kept what you typed on 22 Oct. Use it?" | "Use it" / "Start fresh" |
| Long content | Category paths wrap to two lines; long names wrap in the preview | — | — |
| Many items | 60+ categories: picker opens with search and recent picks; 10+ locations scroll inside the step | "Search categories" | — |
| Slow | Photo uploads run in the background; "Next" still works | "2 photos still uploading" | "Next" |
| Phone / tablet / desktop | Phone: one step, chips scroll, sticky bar. `md:` steps as a left rail. `lg:` adds a live buyer preview (Q19) | — | — |

## State matrix — Photos and video (step 1)
Copy is the code's: `product-media-manager.tsx`, `gallery-rows.tsx`, `src/lib/image/upload-video.ts`, `server/catalog/video-transcode.ts`.
| State | What the person sees | Copy | One action |
|---|---|---|---|
| First use | Slots, an "Add" tile, the item count | "At least one photograph is required. Video is optional." | "Add" |
| Add sheet | Bottom sheet, three rows | "Take photo" · "Choose photos or video" · "Add YouTube link" | One of the three |
| Uploading | Button spinner; photos go through the crop sheet first, videos do not | "Uploading…" · "Uploading 2/3…" | — |
| Processing | Video row: film mark (poster once made), "Video" and "Processing" badges; "Next" works | "Being made playable in the background. Save whenever you like; it plays on the product page once ready." | "Next" |
| Ready | Video row with its poster and play mark, no state badge; move up/down and Remove, no "Cover" | — | Move or remove |
| Failed | "Failed" badge on the row | "Could not be made playable — the reason is on this video in your library. Remove it here." | Remove |
| Over limit — size or type | Notice under the extras; nothing added for that file | "Could not upload clip.mov (Too large: clip.mov. A video is at most 200 MB)." · "…Not a video we can accept: clip.avi. Allowed: MP4, MOV, WebM" | Pick another |
| Over limit — length | Uploaded, then Failed (the worker reads length); library holds "This video is 120 seconds long; a product video is at most 90 seconds" | As Failed | Remove |
| 10-item cap | Add stays tappable; tapping says why (R13) | "A product can have at most 10 gallery items" | Remove one |
| YouTube link | Pasted link becomes a Video row with YouTube's poster | Field "Paste a YouTube link" · "Add video" · bad: "That does not look like a YouTube link" · repeat: "That video is already in this gallery" | "Add video" |
| Refused | Remove on the cover; a video picked into a slot | "Choose another cover before removing this photograph" · "A video is always an extra, so it was added below the slots" | Tap "Cover" on another photo |
| Cover missing at Review | Jumps here | "Choose exactly one photograph as the cover" | Tap "Cover" |
| Many items | 10 rows scroll inside the step; count line | "{n} of 10 items · {k} of {m} slots filled." | — |
| Slow | Uploads run one after another; "Next" still works | "Uploading 1/2…" | "Next" |

## State matrix — Review and success
| State | What the person sees | Copy | One action |
|---|---|---|---|
| First use | Buyer preview card, readiness list | "This is how buyers will see it." | "Put on sale" |
| Empty | n/a — Review is reached only from a step; with nothing typed it lists every missing field | — | — |
| Loading | Readiness line shimmers while re-checked | "Checking…" | — |
| Partial | Some places ready, one has asks | "Ready for your store · Amazon will also ask: Fabric" | "Add fabric" (opens Details) |
| Success | Success screen | "On sale now. {Name} is live on your store." | "Share on WhatsApp" · "Add another" · "Copy this one" · "View product" |
| Retryable error | Save fails on network | "Couldn't save. Your work is still here." | "Try again" |
| Terminal error | Required field missing | Jumps to the step; sticky bar "2 things to fix · Show" | "Show" |
| Refused | SKU already used by another product | Under SKU: "Your product 'Emerald Abaya' already uses this code." | "Open More options" |
| Stale | n/a — create has no saved copy to drift from | — | — |
| Long content | Description in preview clamps to 3 lines with "More" | — | — |
| Many items | 12+ photos: preview strip scrolls | — | — |
| Slow | Save over 3 s: button shows a spinner and stays tappable; a second tap is ignored | "Putting on sale…" | — |
| Phone / tablet / desktop | Phone: preview then list. `lg:` preview right, list left | — | — |

## State matrix — Edit overview
| State | What the person sees | Copy | One action |
|---|---|---|---|
| First use | Five section cards with summaries | "Tap a section to change it." | A section card |
| Empty | n/a — an existing product always has photos, name, price and stock | — | — |
| Loading | Card skeletons | — | — |
| Partial | Cards with a hint dot | "Details · Amazon will ask: Fabric" | Open "Details" |
| Success | Toast; card summary updates; badge cleared if the team edited it | "Saved. Live on your store now." | — |
| Retryable error | Save fails on network | "Couldn't save. Your changes are still here." | "Try again" |
| Terminal error | Field error in an open section | Under the field; card count | Fix the field |
| Refused | Changed by someone else (Q11) | "Bhendi Bazaar team changed this product 2 min ago. We loaded the latest and kept your changes — check and save." | "Save changes" |
| Stale | Stock sold while open | "2 sold while you were editing. Stock is now 8." | "Save changes" |
| Long content | Summaries truncate to one line | — | — |
| Many items | n/a — a product has five sections | — | — |
| Slow | "Saving…" on the button, tappable | — | — |
| Phone / tablet / desktop | Phone: cards stacked; a section opens full screen. `md:` section opens beside the list. `lg:` plus preview | — | — |

## State matrix — Admin edit / add for shop
| State | What the person sees | Copy | One action |
|---|---|---|---|
| First use | Banner over the form and a reason field | "Editing for {Shop}. The shop will see 'Edited by Bhendi Bazaar team'." | Type a reason |
| Empty | Shop has no locations | "{Shop} has no pickup address yet. Add one for them first." | "Add location" |
| Loading | As the shop's form | — | — |
| Partial | As the shop's form | — | — |
| Success | Toast; product page shows "Edited by Bhendi Bazaar team · you" | "Saved. {Shop} will see what changed." | "Back to product" |
| Retryable error | Network | "Couldn't save. Try again." | "Try again" |
| Terminal error | Reason empty on save (Q22) | Under reason: "Say why — the shop will read it." | Type a reason |
| Refused | Product archived | "This product is archived. Restore it to edit." | "Restore" |
| Stale | Shop saved since it was opened | As Edit overview, naming the shop member | "Save for shop" |
| Long content | Long shop names wrap in the banner | — | — |
| Many items | n/a — one product | — | — |
| Slow | As the shop's form | — | — |
| Phone / tablet / desktop | Admin is mostly desktop; the same layout rules apply | — | — |

## State matrix — Shop product notice and history
| State | What the person sees | Copy | One action |
|---|---|---|---|
| First use | Badge on product page and row | "Edited by Bhendi Bazaar team · 30 Oct" | "See what changed" |
| Empty | No team edits: no badge, no history section | — | — |
| Loading | History shimmer | — | — |
| Partial | n/a — a save is recorded whole | — | — |
| Success | History lines | "Bhendi Bazaar team · 30 Oct, 4:12 pm · Price ₹2,499 → ₹2,299 · 'Shop asked to fix the price'" | — |
| Retryable error | History fails to load | "Couldn't load the history." | "Try again" |
| Terminal error | n/a — read-only | — | — |
| Refused | n/a — read-only | — | — |
| Stale | Badge clears when the shop next saves | — | — |
| Long content | Long before/after values clamp with "More" | — | — |
| Many items | 20+ lines: newest 5, then "Show all" | "Show all changes" | — |
| Slow | Skeleton | — | — |
| Phone / tablet / desktop | Same list; wider at `md:` | — | — |

## Copy deck
| Where | Copy |
|---|---|
| Step names | Photos and video · What it is · Price & stock · Details · Review |
| Progress | "Step 2 of 5" |
| Sticky bar | "Back" · "Next" · on Review "Put on sale" · with errors "{n} things to fix · Show" |
| Copy from | "Start from a product you already sell" |
| Photos and video | "Add" → "Take photo" · "Choose photos or video" · "Add YouTube link" · "Tap 'Cover' on the photograph that should represent this product in listings." · "A video is sent as it is and made playable in the background." · video copy as in its state matrix (Q34) |
| More options | "More options" · "SKU (your own code)" · "Tell me when stock is below" · "Tags" · "Part of a family" |
| Readiness hint | "{Channel} also asks: {fact}" · "Ready for your store" · "Ready for {Channel}" |
| Field errors | "Add the price buyers pay" · "Sale price must be below the price" · "Add at least one photograph" · "Pick a category" · "Name needs 2 or more letters" |
| Category sheet | "Change to {new}?" · "{facts} won't apply to {a new}." · "Keep {old}" · "Change to {new}" |
| Leave sheet | "Leave without saving?" · "Your changes to {section} will be lost." · "Keep editing" · "Leave" |
| Draft | "We kept what you typed at {time}." · "Discard" |
| Success | "On sale now" · "{Name} is live on your store." · "Share on WhatsApp" · "Add another" · "Copy this one" · "View product" |
| Edit toast | "Saved. Live on your store now." |
| Conflict | "{Who} changed this product {when}. We loaded the latest and kept your changes — check and save." |
| Admin | "Edit for shop" · "Add product for this shop" · "Editing for {Shop}. The shop will see 'Edited by Bhendi Bazaar team'." · "Why are you changing this?" · "Save for shop" · "Put on sale for shop" |
| Shop notice | "Edited by Bhendi Bazaar team · {date}" · "See what changed" · home task "Our team changed {n} product(s)" |

## Sign-off
Signed off by the owner, 2026-10-30, from the prototype file; the owner asked for video upload to be included (built in the "Photos and video" step) and approved the rest as drawn.
