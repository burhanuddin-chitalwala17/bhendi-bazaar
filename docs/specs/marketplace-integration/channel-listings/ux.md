# UX — channel-listings

- **Status:** Signed off
- **Verified:** 2026-11-02
- **Prototype:** https://claude.ai/artifact/JT6ymWHU5TL2VBBwVNBMsf (one canvas with marketplace-publish)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [marketplace-publish ux](../marketplace-publish/ux.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md)

> Phone first (~360px). The same screen for every marketplace; what a marketplace cannot take is a
> state of a field, not a different form. Buttons are never disabled. Every string here ships.

## Journeys
1. **A shorter title for Amazon.** Products → a product → On marketplaces → "Edit Amazon listing" →
   change Title → Save → the chip reads "Changed for Amazon", the bar reads "1 change waiting ·
   Review and publish" (marketplace-publish).
2. **Back to the product's.** On a changed field → "Use product's" → Save → "Same as product".
3. **Amazon has something else.** A field shows "On Amazon now: …" → "Use Amazon's" → it becomes the
   listing's own; or leave it, and the next publish sends ours.
4. **Flipkart's title.** Flipkart listing → Title reads "Flipkart's catalogue · change it in Seller
   Hub" → "Copy ours" → paste in Seller Hub; Read again brings Flipkart's back.
5. **The product changes.** Edit product → description → Save → each listing that inherits it shows
   "1 change waiting".
6. **It goes wrong.** Saving while offline → "Couldn't save. Your changes are still here." → Try
   again. Over Amazon's length → the counter turns amber: "Amazon allows 200; it will refuse this."

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| On marketplaces block | Product page | Changed: state chip and "Edit … listing" per marketplace | R8, Q7, Q16 |
| Listing screen | `/org/[orgId]/products/[id]/listings/[channel]` | New | R1–R5, R9 |
| Product form | Product edit, "Details" step | Changed: Key features, Barcode | R7 |

## State matrix — Listing screen
| State | What the person sees | Action |
|---|---|---|
| First use | Header "Amazon listing" · product name; one line: "This is what Amazon gets. Fields marked 'Same as product' follow your product; change one to make it Amazon's own." | Edit any field |
| Empty | n/a — a listing always has the product's values | — |
| Loading | The form's outline with grey bars; first load only, the page is server-rendered | — |
| Partial | Some fields changed, some the product's: each with its chip | Save |
| Success | Toast "Saved. 2 changes waiting for Amazon." Bar: "2 changes waiting · Review and publish" | Review and publish |
| Retryable error | "Couldn't save. Your changes are still here." | Try again |
| Terminal error | A field over its limit: "Amazon allows 200 characters; it will refuse this title." Saving still works | Shorten it |
| Refused | Another tab saved first: "This listing changed since you opened it. Reload to see it; your text is kept below." | Reload |
| Stale | "On Amazon now" line: "As read 3 days ago" | Read again (Listings page) |
| Long content | Title wraps; description and features grow; counters show from 80% of the limit | — |
| Many items | Up to 5 features, up to 9 photos: a photo strip that scrolls sideways | — |
| Slow | Save shows a spinner in the button; the form stays editable | — |
| Phone / tablet / desktop | Phone: one column, Save bar fixed at the bottom. `md:` the locked group moves to a side column. `lg:` the product's value shows beside each field rather than under | — |

## State matrix — a field
| State | What the person sees | Action |
|---|---|---|
| Same as product | Chip "Same as product"; the value | Edit |
| Changed | Chip "Changed for Amazon"; under it "Product: …" | Use product's |
| Marketplace differs | "On Amazon now: …" under the field | Use Amazon's |
| Not writable | Chip "Flipkart's catalogue"; Flipkart's value; "Change it in Flipkart Seller Hub — it takes about two days." | Copy ours |
| Locked | Lock and value; tap: "Set on the product, so every marketplace shows the same." | Edit product |
| Warned | Amber line under the field (length, photo size) | — |

## State matrix — On marketplaces block (per marketplace)
| State | What the person sees | Action |
|---|---|---|
| Not on it | "Not on Amazon" | Put on Amazon (marketplace-publish) |
| Live, nothing waiting | "Live · ASIN B0… · ₹1,299 · 4 in stock" | Edit Amazon listing |
| Changes waiting | "Live · 2 changes waiting" | Edit Amazon listing |
| Publish states | marketplace-publish ux.md | — |

## Copy deck
- Block: "Edit Amazon listing" · "Not on Amazon" · "{n} change(s) waiting"
- Chips: "Same as product" · "Changed for {Marketplace}" · "{Marketplace}'s catalogue"
- Field lines: "Product: {value}" · "On {Marketplace} now: {value}" · "As read {ago}"
- Actions: "Use product's" · "Use product's for all" · "Use {Marketplace}'s" · "Copy ours" · "Copied" · "Save" · "Edit product"
- Locked: "Same everywhere" · "Set on the product, so every marketplace shows the same."
- Not writable: "Change it in Flipkart Seller Hub — it takes about two days."
- Flipkart price: "Flipkart takes whole rupees: ₹{n} will be sent."
- Limits: "{n} of {max}" · "{Marketplace} allows {max} characters; it will refuse this {field}."
- Photo: "Amazon wants 1000 px or more; this one is {n} px." · "Amazon wants a white background for the first photo."
- Save: "Saved. {n} change(s) waiting for {Marketplace}." · "Saved. Nothing waiting." · "Couldn't save. Your changes are still here."
- Conflict: "This listing changed since you opened it. Reload to see it; your text is kept below."
- Product form: "Key features" · "Up to five short points buyers see first" · "Barcode (EAN, UPC or ISBN)" · "Leave blank if the product has none"

## Sign-off
Signed off by the owner, 2026-11-02 ("signed off"), on the prototype above, with its four confirmations: Flipkart paise rounded down, Amazon's issue message shown, Amazon pause ends the offer, one read-only production schema read.
