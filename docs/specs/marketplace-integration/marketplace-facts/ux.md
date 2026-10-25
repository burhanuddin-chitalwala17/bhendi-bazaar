# UX — marketplace-facts

- **Status:** Signed off
- **Verified:** 2026-10-25
- **Prototype:** https://claude.ai/artifact/CvMU1S23rbYtQjakzgzfma (version 2, private to the owner)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [product-merge ux](../product-merge/ux.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> One card per linked marketplace, the same for each (Q4, Q14); "Amazon" below stands for any.
> Phone first (~360px). The shop answers as few questions as possible, one tap each. Buttons are
> never disabled. Every string below is the string that ships.

## Journeys
1. **Making a product from a listing.** Settle → choose a category → "Facts from Amazon" on the
   Settle page shows the clear facts already filled, each marked "from Amazon", and the unclear
   ones with our answers → the owner taps one or skips → "Add product" saves them with the product
   (Q35). The product page's card shows the same facts afterwards, for any change.
2. **Answering a question.** The card lists "Amazon says Fabric: Other. Which fits?" → the owner
   taps one of its own answers → the fact fills, marked "from Amazon · you chose", and the count drops.
3. **Filling an older linked product.** Product page → "Facts from Amazon" → "Fill from Amazon" → the
   read runs → clear facts fill, unclear ones wait for the owner.
4. **Something is missing.** A product with no product type, or a type with no Amazon mapping → the
   card says why and offers the one action that fixes it (set the category, or nothing to do).

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Facts from Amazon card | Product page `/org/[orgId]/products/[id]`, under "On marketplaces" | New | R1, R2, R5 |
| Choose a fact | Sheet on phone, popover from `md:` (ADR-0040 picker) over the card, and from a filled fact's "Change" | New | R3, R7 |
| Product page: "On marketplaces" | Same page | Changed: a link "Fill from Amazon" when Amazon is linked | R1 |
| Channel register: types | `/admin/channels/[channel]`, admin only | Changed: each of our types lists its marketplace types, with add, remove and "Publishes here" | R10 |

## State matrix — Facts from Amazon card
| State | What the person sees | Action |
|---|---|---|
| Not read yet | "Amazon's answers haven't been read yet." | Fill from Amazon |
| Loading | Card header; three skeleton rows; after 3 s "Still reading Amazon…" | — |
| Partial | "4 facts filled from Amazon · 2 to confirm" | Confirm 2 |
| Success | "All facts filled from Amazon. Read 2 min ago." | Fill from Amazon |
| Fact changed by you | Each changed fact reads "Fabric · changed by you (was Crepe from Amazon)" | Edit · Reset to Amazon's answer |
| To confirm | "Amazon says Fabric: Other. Which fits this product?" with our options as chips | Choose one · Skip for now |
| Type to confirm | "Amazon lists this as Abaya. Which of our types is it?" with our options | Choose one |
| Category to confirm | "Amazon lists this as Rug, our Prayer mat. Which category does it go in?" with the shop's prayer-mat categories | Choose one |
| No matching type | "Amazon lists this as Walking Shoes, which isn't one of our product types. Nothing is filled." then "Pick one of ours if it fits, or park it." with our nine types (Settle page); on a linked product's card, "Pick one of ours if it fits, or ask the admin to add one." (Q33) | Choose one · Park it (Settle) · Ask the admin (card) |
| Parked | Listing in Left off: "Waiting for a product type. Ask the admin to add one." | Ask the admin · Bring back |
| Ask the admin | Two buttons: "Send by WhatsApp" and "Send by email", each opening the app with the message filled in; a line says "Send it yourself. Nothing is sent without you." | Send by WhatsApp · Send by email |
| Stale mapping | "Check the mapping: Amazon's answers for this type were last checked 4 months ago." | Fill from Amazon |
| Retryable error | "Couldn't read Amazon's answers. Amazon is busy; try again in a few minutes." | Try again |
| Terminal error | "Amazon stopped accepting our access, so we can't read this listing. Reconnect on Channels." | Go to Channels |
| No product type | "This product has no product type, so there are no Amazon facts to fill. Set its category first." | Edit product |
| No Amazon mapping for the type | "No Amazon mapping yet for this type. Nothing to fill." | — |
| No answers from the marketplace | "Flipkart didn't share any answers for this listing, so there's nothing to fill." | Fill from Flipkart |
| Long content | A value wraps; a long option truncates to two lines, a tap shows it in full | — |
| Many items | Questions first, then filled facts; each group collapses | Show all |
| Slow | Skeleton rows; after 3 s "Still reading Amazon…" | — |
| Phone / tablet / desktop | Stacked rows / two columns from `md:` / a table from `lg:` | — |

## State matrix — Settle page: Facts from Amazon (Q35)
| State | What the person sees | Action |
|---|---|---|
| No category yet | "Pick a category to see Amazon's facts for it." | — |
| Filled and to confirm | "These fill when you add it. Answer the rest or skip them; you can change any later." then the filled facts, each "Colour · Green · from Amazon", and each unclear one: "Amazon says Fabric: Other. Which fits this product?" with our answers | Tap one · Skip for now |
| Answered here | The tapped answer shows selected; tapping it again clears it | Tap again to clear |
| Skipped | The question folds to "Fabric · skipped" | Ask again |
| Nothing to fill | "Nothing new to fill from Amazon: the facts it answers are already filled." | — |
| No mapping for the type | "No Amazon mapping yet for this type. Nothing to fill." | — |
| No answers from the marketplace | "Amazon didn't share any answers for this listing, so there's nothing to fill." | — |
| Matching a product | Only that product's empty facts show | Same |

## State matrix — Choose a fact
| State | What the person sees | Action |
|---|---|---|
| Open | "Amazon says Fabric: Other." then "Which of these fits?" with our options; each with an example | Choose |
| Chosen | The fact fills; the sheet closes; toast "Fabric filled from Amazon." | — |
| Save failed | "Couldn't save that answer. Nothing was changed." | Try again |
| Owner answered meanwhile | "You already answered this: Crepe. Nothing was changed." | Close |

## State matrix — Channel register: types (admin)
| State | What the person sees | Action |
|---|---|---|
| Mapped | "Prayer mat → Rug (publishes here), Home Furniture and Decor" with the checked date | Add · Remove · Publishes here |
| Not mapped | "Socks has no Amazon type yet." | Add an Amazon type |
| Adding | A field for the marketplace's type name, suggesting the types already in the mapping and seen on shops' listings | Add |
| Saved | Toast "Saved. Amazon types for Prayer mat updated." | — |
| Refused: last publishing type | "Prayer mat needs one type it publishes to. Mark another first." | — |
| Save failed | "Couldn't save that change. Nothing was changed." | Try again |
| Phone / tablet / desktop | One type per row, stacked / two columns from `md:` / a table from `lg:` | — |

## Copy deck
Card: "Facts from Amazon", "Fill from Amazon", "Confirm", "Skip for now", "Choose one", "Show all",
"Try again", "Edit product", "Go to Channels". Marks: "from Amazon", "from Amazon · you chose".
Toasts: "Parked. It's in Left off until a type exists." "Prayer mats chosen. Facts are filling." "Fabric filled from Amazon." "Fabric changed. Amazon's answer is kept for reference." "Reset to Amazon's answer." Changed marks: "changed by you", "was Crepe from Amazon". Nothing says "imported" or "synced".
Admin message (prefilled, the seller sends it): "Hello Bhendi Bazaar, {shop} needs a product type for an
Amazon listing: {title} (SKU {sku}). Amazon lists it as {amazon type}. Please add a matching type."

## Sign-off
Signed off by the owner, 2026-10-23, as the prototype stands (version 2). Changed after sign-off at the
owner's request, 2026-10-23: one card per marketplace through one path, and "No answers from the
marketplace" replaces "Flipkart only" (Q4, Q14). Added 2026-10-24 at the owner's request: "Category to confirm" (Q25) and the admin's types control on the channel register (Q26).
Changed while building, 2026-10-25: "Adding" suggests known types instead of searching the marketplace, because the admin has no marketplace account to search with. The card's "No matching type" offers "Ask the admin" instead of "Park it", since a linked listing cannot be parked without unlinking it (Q33); the type and category questions also show on the Settle page above the category field; choosing a category toasts "{category} chosen. Facts are filling."; the Choose sheet lists our answers without examples, as no examples are stored. Changed 2026-10-25 at the owner's direction (Q35): facts fill and are answered on the Settle page as soon as a category is chosen, and save with the product; the card remains for later changes. From the fresh-context review: skipped questions are listed as "Skipped for now:" with "Ask Fabric again", and a read that fills nothing new says "Nothing new to fill from Amazon: the facts it answers are already filled." instead of claiming success.
