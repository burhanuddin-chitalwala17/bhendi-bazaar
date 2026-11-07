# UX — listing-model / dynamic-form

- **Status:** Signed off
- **Verified:** 2026-11-07
- **Prototype:** none (parent Q34); this document is the reference
- **References:** [spec.md](spec.md), [decisions.md](decisions.md)

> Phone first (~360px). Never a disabled button (ADR-0053). Words in copy modules (ADR-0067).

## Journeys
1. **Describe a product fully.** Products → Add a product (or Edit) → Details → "Required now" lists the
   type's questions BB and connected channels need, each with channel badges → fill → the channel strip
   updates "Amazon 19 of 19" → Save.
2. **See what another channel would need.** Details → "Also helps on Flipkart, Meesho" (collapsed) →
   open → fill any, never required.
3. **Override an inherited answer.** A field reads "From your brand Noor: Made in India" → Change →
   type a value → it now reads "Set on this product" with "Use brand's" to go back.
4. **Connect a channel.** Channels → connect Flipkart → Home: "38 products need 4 details for Flipkart"
   → Fill them → the bulk-fill page, one detail at a time across products.
5. **A channel changes its rules.** Home: "Amazon now asks 2 more details for Tote bags" → Fill them.
6. **Set up a brand.** Brands and defaults → Add a brand → name (required) → maker, packer, importer
   (each name, address, pincode, optional) → Registered on Amazon / List as Generic → Save.

## Screens
| Screen | Route | Serves |
|---|---|---|
| Product form, Details step (changed) | `/org/{org}/products/new`, `/{id}/edit` | R1–R3, R8 |
| Product page channel strip (changed) | `/org/{org}/products/{id}` | R4 |
| Products list channel filter (changed) | `/org/{org}/products?channel=` | R4 |
| Home lines (changed) | `/org/{org}` | R5, R6 |
| Bulk fill (changed) | `/org/{org}/products/fix` | R5 |
| Brand form (changed) | `/org/{org}/listing` | R7 |

## State matrix — Product form, Details
| State | What the shop sees | Action |
|---|---|---|
| No type yet | "Choose a category to see its questions." | Choose a category |
| No channel connected | "Required now" holds BB's questions only; every other question under "Also helps on…" | — |
| Partial | Missing required questions marked; strip "Amazon 6 of 19 · Flipkart 12 of 12" | Fill |
| Complete | Strip "Ready for Amazon, Flipkart" | Save |
| Inherited | "From your {level} {name}: {value}" | Change |
| Overridden | "Set on this product" | Use {level}'s |
| Unknown answer for a channel | "Amazon has no match for {value}. We've asked to add it." | — |
| Saving / failed | Save pending; "Couldn't save. Your changes are kept." | Try again |
| Long content | Labels and badges wrap | — |
| Many questions | Grouped (What it is, Size and weight, Materials, Compliance), groups collapsible | — |
| Phone / tablet / desktop | One column; from `lg:` the channel strip stays beside the form | — |

## State matrix — Brand form
| State | What the shop sees | Action |
|---|---|---|
| New | Name, then "Who makes, packs and imports it (marketplaces ask)" with three optional parties | Save |
| Partial | Saved; "Amazon needs the packer's address" on products using it | Fill |
| Generic | "Not registered on Amazon: lists as Generic" | Change |

## Copy deck
"Required now" · "Also helps on {channels}" · "{channel} {n} of {m}" · "Ready for {channels}" ·
"From your {level} {name}: {value}" · "Set on this product" · "Use {level}'s" · "Choose a category to see its questions." ·
"{n} products need {m} details for {channel}" · "{channel} now asks {n} more details for {type}" · "Fill them" ·
"Who makes, packs and imports it (marketplaces ask)" · "Maker" · "Packer" · "Importer" · "Address" · "Pincode" ·
"Registered on Amazon" · "List as Generic" · "Couldn't save. Your changes are kept."

## Sign-off
Signed off by the owner, 2026-11-07 ("signed off"), as documents in place of prototypes (parent Q34).
