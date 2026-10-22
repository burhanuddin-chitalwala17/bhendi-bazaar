# UX — product-merge

- **Status:** Signed off
- **Verified:** 2026-10-21
- **Prototype:** https://claude.ai/artifact/VS5Jvo5hRiyXsJt3CemTyS (private to the owner)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [channel-import ux](../channel-import/ux.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). Buttons are never disabled. Every string below is the string that ships.
> The Listings page, its rows and the details panel are channel-import's; this adds to them.

## Journeys
1. **Add a new product.** Listings → Not linked → tap a row → "Add as new product" → the Settle page:
   the same item on Flipkart is suggested and kept → each field shows the more complete side → price,
   SKU, category, "How many do you actually have?" → "Add product" → back on Listings, toast "Added
   Black Nida Abaya – M.", the row now under Linked as "Linked by you".
2. **Match to a product I already have.** Tap a row → "Match to a product" → picker with "Similar
   names" on top → pick → the Settle page compares the listing with the product, nothing changed
   unless chosen → "Link and save".
3. **Leave it off.** Tap a row → "Leave off" → toast "Left off Bhendi Bazaar." with "Undo" → the
   row leaves the to-do; "Show left off" on Not linked lists it, with "Bring back".
4. **It goes wrong.** "Add product" with a SKU another product already has → the Settle page says
   which product and offers "Match to it instead". Someone else settled it meanwhile → the page says
   what happened, and nothing is changed.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Listings page | `/org/[orgId]/channels/[channel]/listings` | Changed: "Show left off" filter, a suggestion line on rows, the panel's three choices | R1–R3, R7, R8 |
| Match picker | Over the details panel: sheet on phone, popover from `md:` (ADR-0040 picker) | New | R2 |
| Settle page | `/org/[orgId]/channels/settle?listing=…` (and `&product=…` when matching) | New | R3–R6 |
| Marketplace card | Channels | Changed: "· 78 to settle" | R1 |
| Product "On marketplaces" | `/org/[orgId]/products/[id]` | Changed: "Linked by you"; photo copying | R8 |

## State matrix — Listings page (additions)
| State | What the person sees | Action |
|---|---|---|
| Not linked, with a suggestion | Row adds a line: "Same SKU on Flipkart" or "Looks like Black Nida Abaya – M" | Tap row |
| Not linked, none suggested | As channel-import | Tap row |
| Details panel, not linked | Footer: "Add as new product" (primary) · "Match to a product" · "Leave off" | One of three |
| Show left off | Not linked tab, filter "Show left off (4)": rows say "Left off by you"; "Not linked 78" counts only the to-do | Bring back |
| Left off, empty | "Nothing left off. Listings you leave off Bhendi Bazaar wait here." | — |
| Everything settled | Not linked tab: "All settled. Every Amazon listing is on Bhendi Bazaar or left off." | — |
| Many items | Search and Show more as channel-import; rows with a suggestion are not reordered | Show more |

## State matrix — Match picker
| State | What the person sees | Action |
|---|---|---|
| First open | "Similar names" (up to three), then "All products", search "Search your products" | Pick |
| No similar names | Only "All products" | Pick |
| Empty search | "No product matches "abaya xl". Add it as a new product instead." | Add as new product |
| Product already on this marketplace | Row greyed note: "Already linked to another Amazon listing" | Tap: explains, offers Unlink there |
| Loading / slow | Three skeleton rows; after 3 s "Still loading…" | — |
| Retryable error | "Couldn't load your products. Try again." | Try again |
| Long name | Two lines, then truncated | — |
| Phone / tablet / desktop | Bottom sheet / popover beside the panel / same | — |

## State matrix — Settle page
| State | What the person sees | Action |
|---|---|---|
| Add new, one marketplace | Header "Add as a new product"; fields from that listing; price, SKU, category, quantity | Add product |
| Add new, same item suggested | Card "Same SKU on Flipkart: Black Nida Abaya M · FSN ABYG9…" with "Include" on, "Not this one" | Include · Not this one |
| Add new, name suggestion only | Card "Looks like the same item on Flipkart?" off by default | Include |
| Match | Header "Match to Black Nida Abaya – M"; each field: product's value kept unless switched | Link and save |
| Field comparison | Per field (Title, Description, Photos): a choice per side; "More complete" on the default | Switch |
| Price | "Price on Bhendi Bazaar" pre-filled ₹1,899; "Amazon ₹1,999 · Flipkart ₹1,899. Each marketplace keeps its own price." | Edit |
| SKU, sides differ | "SKU for this product": one choice per side; "Each marketplace listing keeps its own SKU." | Pick |
| Category | "Category" picker, pre-filled with the last one chosen here | Pick |
| Quantity | "How many do you actually have?" pre-filled with the lowest; "Amazon says 9, Flipkart says 7." and "Amazon and Flipkart keep their own count until stock sync is on. Change it there too if it's different." | Edit |
| Nothing live on the marketplace | Under the header: "Inactive on Amazon, so it goes on your Archived shelf." with a switch "Put it on sale here", off | Switch |
| Location | Shown only with two or more: "Kept at" picker, first location chosen | Pick |
| No description on any side | "Flipkart doesn't share descriptions with us. Add one now, or later on the product." with a text box | Type |
| Main photo couldn't be copied | "Couldn't copy Amazon's main photo. Try again, or add a photo." | Try again · Add photo |
| Match, stocked at several locations | One field per location under "How many do you actually have?", each pre-filled with its count | Edit |
| No photo on any side | "Add at least one photo. Flipkart doesn't share its photos with us." with upload | Add photo |
| Long content | Description shows four lines, "Show all"; long titles wrap | Show all |
| Saving / slow | Button "Adding…"; after 3 s "Still saving…" | — |
| Success | Back on Listings; toast "Added Black Nida Abaya – M." or "Linked to Black Nida Abaya – M." | — |
| Success, archived | Toast "Added Black Nida Abaya – M to your Archived shelf." | — |
| Retryable error | "Couldn't save. Nothing was changed. Try again." | Try again |
| Refused: SKU taken | "SKU ABY-BLK-M is already used by Black Nida Abaya – M (archived). Pick another SKU, or match to that product." | Match to it instead |
| Refused: stock changed | "The stock of Brass Bakhoor Burner changed while you were here. Check the numbers and save again." with the new counts filled in | Link and save |
| Refused: settled meanwhile | "This listing was just linked to Black Nida Abaya – M. Nothing was changed." | Back to listings |
| Refused: left off meanwhile | "This listing was just left off Bhendi Bazaar. Nothing was changed." | Back to listings |
| Loading the listing | Header at once, field skeletons; after 3 s "Still loading…" | — |
| Couldn't read the listing | "Couldn't read this listing from Amazon. Try again in a minute." | Try again |
| Page couldn't load | "Couldn't read this listing. Try again in a minute." | Try again |
| Stale | "As Amazon reported 3 days ago." under the header | Read again (on Listings) |
| Phone / tablet / desktop | One column, docked button / sides as columns from `md:` / same, wider | — |

## State matrix — product and card
| State | What the person sees | Action |
|---|---|---|
| Linked by you | "Amazon · ● Linked by you · ASIN B0C7X2… · Live · ₹1,999 · 9 in stock" | See listing |
| Photos copying | "Copying 6 photos from Amazon…" | — |
| Photos partly copied | "2 of 6 photos couldn't be copied from Amazon." | Try again |
| Card, to settle | "480 listings · 402 linked · 78 to settle" | See listings |
| Card, all settled | "480 listings · all settled" | See listings |

## Copy deck
Buttons: "Add as new product", "Match to a product", "Leave off", "Bring back", "Include", "Not this
one", "Add product", "Link and save", "Match to it instead", "Back to listings", "Try again", "Show
all", "Put it on sale here", "Show left off". Toasts: "Added {name}.", "Added {name} to your Archived shelf.", "Linked to {name}.", "Left off Bhendi Bazaar." with "Undo", "Brought
back." A product is "on Bhendi Bazaar"; a listing is "on Amazon" or "on Flipkart"; nothing says
"merge" or "import".

## Sign-off
Signed off by the owner, 2026-10-21, as the prototype stands (version 6).

Changed while building, 2026-10-21, for the owner to confirm: "settled meanwhile" names the product
but not the person (who linked is not stored); added rows for left off meanwhile, loading the listing,
a failed read and a page that could not load.
