# UX — marketplace-publish

- **Status:** Signed off
- **Verified:** 2026-11-02
- **Prototype:** https://claude.ai/artifact/JT6ymWHU5TL2VBBwVNBMsf (one canvas with channel-listings)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [channel-listings ux](../channel-listings/ux.md)

> Phone first (~360px). Progress words (Sent, Checking) and result words (Live, Needs attention)
> never share a line without a separator. Buttons are never disabled. Every string here ships.

## Journeys
1. **Publish one listing.** Listing screen → "2 changes waiting · Review and publish" → Review: each
   change old → new, each with "Undo" → "Publish 2 changes to Amazon" → the listing reads "Sent ·
   Amazon usually answers within an hour" → later "Live".
2. **Publish everything.** Channels → Amazon → Listings → "12 listings have changes · Review and
   publish" → the review grouped by listing → "Publish to Amazon" → "10 sent · 2 need attention" →
   tap one → its listing, the field marked.
3. **Put a product on Amazon.** Product page → "Not on Amazon" → "Put on Amazon" → "Looking for it
   on Amazon…" → a match by barcode or name: "Sell on this page" / or "Create a new page" → the
   listing screen as a draft with what Amazon still needs → Review → "Create on Amazon" → Amazon's
   check runs first → "Sent" → "Live".
4. **Put a family on Amazon.** Family page → "Put the family on Amazon" → "One page with 3 colours"
   → Review (the family's page and each colour) → "Create on Amazon" → per member result.
5. **Pause.** Listing screen → "On sale" switch → "Paused" → Review shows "On sale → Paused" →
   Publish → "Paused on Amazon".
6. **It goes wrong.** Amazon refuses a title → "Needs attention · Amazon says: …" on Title → fix →
   publish again. No barcode and no exemption → "Amazon needs a barcode or a barcode exemption for
   'Niqab Boutique'." → Add barcode / How to get the exemption. Amazon down → stays "Sent", retried.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Review and publish | `/org/[orgId]/channels/[channel]/publish` (`?listing=` for one) | New | R1, R2, R9 |
| Listing screen: status and issues | channel-listings' screen, top and per field | Changed | R3, R4, R11 |
| Put on Amazon | `/org/[orgId]/products/[id]/listings/[channel]/new` | New | R5, R6 |
| Listings page: changes bar and status column | Marketplace's Listings page | Changed | R2, R3 |
| On marketplaces block and family page | Product page, family page | Changed: "Put on Amazon", status | R3, R5 |

## State matrix — Review and publish
| State | What the person sees | Action |
|---|---|---|
| First use | Title "Review changes for Amazon"; "Nothing is sent until you publish." | Publish |
| Empty | "Nothing waiting for Amazon. Changes you save on a listing show here." | Back to listings |
| Loading | Listing rows as grey bars | — |
| Partial | Some lines undone: struck through, with "Put back" | Publish {n} changes |
| Success | Toast "Sent to Amazon. We'll check back and tell you here." → the listing or Listings page | — |
| Retryable error | "Couldn't reach Bhendi Bazaar. Nothing was sent." | Try again |
| Terminal error | n/a — refusals come from Amazon later and show on the listing | — |
| Refused | A listing changed after the review opened: "This listing changed while you were reviewing. Review it again." | Review again |
| Stale | n/a — the review reads at open; a change after it is Refused | — |
| Long content | Old and new each wrap; a description shows the first two lines with "Show all" | Show all |
| Many items | Grouped by listing, 20 per page, "Show more"; a count at the top | Show more |
| Slow | Button "Sending…"; the page stays | — |
| Phone / tablet / desktop | Phone: old above new. `md:` old and new side by side. `lg:` listings in a left column, changes right | — |

## State matrix — a listing's status (listing screen header, block, Listings row)
| State | What the person sees | Action |
|---|---|---|
| Not on Amazon | "Not on Amazon" | Put on Amazon |
| Draft | "Draft · not on Amazon yet" | Review and create |
| Changes waiting | "Live · 2 changes waiting" | Review and publish |
| Sent | "Sent {ago} · Amazon usually answers within an hour" | — |
| Checking | "Checking with Amazon · next look in {n} min" | — |
| Live | "Live on Amazon · checked {ago}" | — |
| Needs attention | "Needs attention · {n} problem(s)" (red); each on its field | Fix and publish |
| Live, last change refused | "Live · your last change wasn't taken" | See why |
| Showing other content | Field line "Amazon is showing other content: {value}" | — |
| Paused | "Paused on Amazon" | Resume |
| Busy, retrying | "Sent · Amazon is busy, trying again" | — |
| Not answered | After the last check: "Amazon hasn't answered. We'll look again tomorrow." | Check now |

## State matrix — Put on Amazon
| State | What the person sees | Action |
|---|---|---|
| First use / loading | "Looking for it on Amazon…" | — |
| Found | Up to 5 matches: photo, title, ASIN, "Sell on this page" each | Sell on this page |
| Empty | "Not found on Amazon. Create a new page for it." | Create a new page |
| Partial | Draft listing with "Amazon still needs: Fabric, Sleeve length" (readiness) | Fill on product |
| Refused | Amazon says the category needs approval: "Amazon needs you approved to sell in {category}. Apply in Seller Central, then publish again." | How to apply |
| Retryable error | "Couldn't reach Amazon. Try again." | Try again |
| Phone / tablet / desktop | One column; `md:` matches as a two-column grid | — |

## Copy deck
- Bars: "{n} change(s) waiting · Review and publish" · "{n} listings have changes · Review and publish"
- Review: "Review changes for {Marketplace}" · "Nothing is sent until you publish." · "Undo" · "Put back" · "Publish {n} change(s) to {Marketplace}" · "Create on Amazon" · "Big change: {old} → {new}. Check before publishing."
- Results: "Sent to {Marketplace}. We'll check back and tell you here." · "{n} sent · {m} need attention"
- Status: as the matrix above; "Amazon says:" before a marketplace's sentence
- Barcode: "Amazon needs a barcode or a barcode exemption for '{brand}'." · "Add barcode" · "How to get the exemption" (Seller Central → Catalogue → Apply for GTIN exemption)
- Put on Amazon: "Put on Amazon" · "Looking for it on Amazon…" · "Sell on this page" · "Create a new page" · "Put the family on Amazon" · "One page with {n} {axis}"
- Flipkart: "New products are made in Flipkart Seller Hub. Once it's there, Read again links it here."
- Pause: "On sale" · "Paused" · "Paused on Amazon" · "Resume"

## Sign-off
Signed off by the owner, 2026-11-02 ("signed off"), on the prototype above, with its four confirmations: Flipkart paise rounded down, Amazon's issue message shown, Amazon pause ends the offer, one read-only production schema read.
