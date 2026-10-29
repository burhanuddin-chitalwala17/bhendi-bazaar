# UX — family-merge

- **Status:** Signed off
- **Verified:** 2026-10-29
- **Prototype:** https://claude.ai/artifact/Y9jppxUqJuAYLd4SpWFmmT (version 20, private to the owner; both features on one canvas, with a flow board per feature and the Channels page they start from)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [product-merge ux](../product-merge/ux.md), [marketplace-facts ux](../marketplace-facts/ux.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md)

> Phone first (~360px). "Amazon" stands for any marketplace that groups its listings. Buttons are
> never disabled. Every string below is the string that ships.

## Journeys
1. **An Amazon item in four colours.** Listings → Not linked → the group "Nida Abaya · 4 colours
   on Amazon" → "Settle as one family" → the Family page: name, category, shared facts and the four
   members, each with its colour, SKU, price and stock → "Make family of 4" → back on Listings, toast.
2. **Colours already settled one by one.** Listings → Linked → the same group, its four rows already
   linked to four products → "Make one family" → the Family page with the four products → save.
3. **Flipkart colours.** Listings → Not linked → "Looks like one item: 3 listings" → "Group them" (or
   "Group listings" to pick by hand) → the Family page with those listings → save.
4. **It goes wrong.** Two members read "Black" → the save is refused, both named, nothing saved. A
   group that also differs in length → the family varies by colour and length, and says so (Q16).

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Listings: variant group | `/org/[orgId]/channels/[channel]/listings` | Changed: the group header offers "Settle as one family" or "Make one family"; Flipkart suggestions and "Group listings" | R1, R7, R8 |
| Family page | `/org/[orgId]/channels/family?…` | New | R1–R6 |
| Product form: family | Product edit page | Unchanged: leave or change family there (Q11) | R9 |

## State matrix — Listings: variant group
| State | What the person sees | Action |
|---|---|---|
| Amazon group, none settled | Header "Nida Abaya · 4 colours on Amazon" | Settle as one family |
| First group the shop sees | Under the header: "Amazon lists these as one item in 4 colours. Settle them together to make one family." Shown once | Settle as one family |
| Family exists, some listings outside it | Header plus "Family: Nida Abaya · 2 not in it" | Add to family |
| Amazon group, all settled separately | Header plus "4 products, not a family yet" | Make one family |
| Amazon group, some settled | Header plus "2 of 4 settled" | Settle as one family (settled ones join as they are) |
| Already a family | Header plus "Family: Nida Abaya" | See family |
| Flipkart suggestion | Card "Looks like one item: 3 listings" with their titles | Group them · Not one item |
| Flipkart, picking by hand | Each Not linked row gains a tick box; a bar "3 picked" | Continue · Cancel |
| Phone / tablet / desktop | Rows stacked / two columns from `md:` / table from `lg:` | — |

## State matrix — Family page
| State | What the person sees | Action |
|---|---|---|
| Loading | Header; skeleton rows; after 3 s "Still reading Amazon…" | — |
| Ready | Family name (from the parent's title), description, category with the type question (marketplace-facts Q35), "Shared by all 4" facts, and one row per member: colour (or bottle size, plating, pack), title, SKU, price, stock, photo | Make family of 4 |
| Colour to confirm | Member row: "Amazon says Colour: Ink. Which fits?" with our colours | Choose one |
| A member left out | Row toggle "Include" off; the save button counts only included rows | Include |
| Member already a product | Row reads "Already Nida Abaya – Olive" with its own SKU, price and stock, read-only | — |
| Member in another family | Row reads "In family Rida Set. Move it here?" | Move here · Leave out |
| Varies by more than the type's usual axis (Q16) | "This family varies by Colour and Length (the listings differ on both)." Each member reads by its values, "Red · 17 in" | Remove an axis |
| Refused: two the same | "Two members are Black: SKU ABY-BLK and ABY-BLK-2. Change one, or leave one out." | — |
| Refused: SKU taken | "SKU ABY-MRN is already used by Nida Abaya – Maroon. Pick another SKU." on that row | — |
| Settled meanwhile | "Some of these listings were just settled. Nothing was changed." | Back to listings |
| Read failed for some | Row reads "Couldn't read this listing from Amazon" with what the inbox stored | Try again |
| Saved | Toast "Made Nida Abaya with 4 colours." Back on Listings | — |
| Save failed | "Couldn't save the family. Nothing was changed." | Try again |
| No product type (Q17) | "Pick a category with a product type. Without one, members can't be told apart." | Pick category |
| Answer missing (Q18) | Save refused: "Give each member its colour: Ink is not answered." on that member | — |
| More than 30 (Q19) | "This group has 42 listings. The first 30 make the family now; add the rest after with Add to family." | Make family of 30 |
| Adding to an existing family (Q20) | Header "Add to Nida Abaya"; existing members listed read-only above the new ones | Add {n} to family |
| Many members | Rows grouped by the first difference when there are two (jewellery by plating); each group collapses; "Show all" | Show all |
| Long content | Titles wrap to two lines; SKU and price stay on one line | — |
| Phone / tablet / desktop | Member rows as cards / two columns from `md:` / a table from `lg:` | — |

## State matrix — Settle page (changed, Q22)
| State | What the person sees | Action |
|---|---|---|
| Listing is one of a group | Line above the form: "This listing is one of 4 colours of Nida Abaya." | Settle all 4 as one family |

## Copy deck
Buttons: "Settle as one family", "Add to family", "Add {n} to family", "Settle all {n} as one family", "Pick category", "Make one family", "Group them", "Not one item", "Group listings",
"Continue", "Cancel", "Make family of {n}", "Include", "Move here", "Leave out", "See family",
"Back to listings", "Try again", "Show all". Headings: "Family", "Shared by all {n}", "Members".
Lines: "{title} · {n} {difference}s on {marketplace}" (colours, bottle sizes, platings), "{n} products, not a family yet", "{k} of {n} settled",
"Looks like one item: {n} listings", "{n} picked". Toast: "Made {name} with {n} {difference}s."
Nothing says "merge" or "variant".

## Sign-off
Signed off by the owner, 2026-10-29, as the prototype stands (version 20): "I accept all the ux".
Changed while building, 2026-10-29: the loading screen says "Still reading the marketplace…", since it
shows before the page knows which; the first group explains itself until the shop has made a family
from that marketplace (the "shown once" rule, without remembering anything per person); "Continue"
with fewer than two picked says "Pick at least two listings that are one item."; a member whose
listing is not live is added off sale (Q24). From the fresh-context review: member cards sit one, two and three to a row
(phone, `md:`, `lg:`) rather than a table at `lg:`; with two differences they gather under the first
and each group collapses, so "Show all" is not needed; a member whose listing says nothing on an
axis reads "Amazon doesn't say its colour. Which is it?", and a length is typed as a number; a read
that failed offers "Try again"; adding lists the family's members above the new ones.
