# Decisions — channel-listings

- **Verified:** 2026-11-02

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids.
> "Parent Qn" means [../decisions.md](../decisions.md). Binding here: parent Q1, Q19, Q21–Q29, Q39, Q43;
> channel-import Q19; product-merge Q10, Q15; marketplace-publish Q2.
> Research of 2026-11-02 (both marketplaces' listing APIs, multichannel tools, form research) is in
> [INTEGRATIONS.md](../../../INTEGRATIONS.md) "Editing and creating a listing".

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What is this subfeature's one outcome? | Each product's listing on each connected marketplace has its own screen here: it inherits the product, keeps only what differs, and shows what the marketplace has beside it. Sending it is marketplace-publish | Claude · reversible | 2026-11-02 | Editing and sending are two outcomes; the parent's order puts the screen first | implemented |
| Q2 | Where does each platform listing start when this ships? | Keep what's live: wherever a linked listing's title, price or text differs from the product, the marketplace's value is kept as that listing's own. Nothing changes on a marketplace until the shop picks "Use product's" or edits | Owner | 2026-11-02 | Same rule as parent Q19: bringing a catalogue in never changes a marketplace. Owner: as recommended | implemented |
| Q3 | Which fields does a platform listing have? | One set for every marketplace: title, selling price, photos (which and in what order), key features, description, and on sale or paused. Each marketplace declares which of them it lets us write; the rest show what the marketplace has and say where to change it | Claude · reversible | 2026-11-02 | One form, never per platform; what differs is a marketplace capability, declared once in its provider | implemented |
| Q4 | Which can Flipkart write? | Selling price and on sale or paused. Title, photos, key features and description belong to Flipkart's catalogue and change only in Seller Hub, with about two days of checking; the screen says so, shows Flipkart's, and offers ours to copy | Claude · reversible | 2026-11-02 | Flipkart's listing API (checked 2026-11-02) carries no content field. Parent Q29 narrowed in place to match | implemented |
| Q5 | Which can Amazon write? | All six | Claude · reversible | 2026-11-02 | `patchListingsItem` accepts each (checked 2026-11-02) | implemented |
| Q6 | Where do key features and the barcode live? | On the product, as two new optional fields: up to five key features, and a barcode (EAN, UPC or ISBN). The barcode is a strict field (parent Q28) | Claude · reversible | 2026-11-02 | Platform-only facts belong to the master (parent Q23, Q25); the barcode is identity and must match everywhere. Owner chose the barcode path in marketplace-publish Q8 | implemented |
| Q7 | Where is the screen? | Its own page per marketplace, reached from the product page's "On marketplaces" block ("Edit Amazon listing") and from the marketplace's Listings page | Claude · reversible | 2026-11-02 | Channel-import Q19 said this block becomes the way in; a page holds a long form better than a sheet on a phone | implemented |
| Q8 | How does a field show it is inherited or changed? | A text chip on every field: "Same as product" or "Changed for Amazon". A changed field shows the product's value under it and "Use product's". The header offers "Use product's for all" | Claude · reversible | 2026-11-02 | Overrides nobody can see are the commonest complaint about inherited content (Figma, Storyblok research); a colour alone fails | implemented |
| Q9 | What does the screen show of the marketplace's own copy? | Under each field, when it differs from what we would send: "On Amazon now: …" with "Use Amazon's", which copies it into this listing (parent Q39). Read from the last listing read | Claude · reversible | 2026-11-02 | The shop decides which wins; nothing is overwritten silently | implemented |
| Q10 | Locked fields? | Shown in a "Same everywhere" group: MRP, barcode, HSN and tax, brand, stock. Tapping one says "Set on the product, so every marketplace shows the same. Edit product" | — | 2026-11-02 | Parent Q28; buttons and fields explain themselves, never disabled | implemented |
| Q11 | Photos per listing? | Chosen and ordered from the product's own photos; no photo belongs only to one listing. A marketplace's photo rule (Amazon: 1000 px or more, white background for the first) is a warning on the photo | Claude · reversible | 2026-11-02 | One library (media-library); parent Q29 allows choice and order, not separate uploads | implemented |
| Q12 | Length limits? | Each marketplace declares its limits (Amazon: title 200, five features of 500, description 2,000 characters). A counter shows near the limit; going over warns and is what Amazon will refuse | Claude · reversible | 2026-11-02 | Warn, never block (ADR-0053); the limit is the marketplace's, declared beside its other facts | implemented |
| Q13 | Flipkart takes whole rupees. A price with paise? | The Flipkart price field takes rupees only. An inherited price with paise is sent rounded down to the rupee, and the field says "Flipkart takes whole rupees: ₹1,299 will be sent" | Claude · reversible | 2026-11-02 | Flipkart's price fields are integers. Owner told 2026-11-02; confirm at UX sign-off (money) | implemented |
| Q14 | A family's members? | Each member's listing is its own screen, like any product. The family's own Amazon page (the parent) takes its title from the family | Claude · reversible | 2026-11-02 | Each member is its own product (ADR-0043); a parent listing on Amazon carries no offer | implemented |
| Q15 | Saving? | A Save button for the form; saving never sends anything. Once saved, "N changes waiting" leads to marketplace-publish's review | Claude · reversible | 2026-11-02 | Saving and publishing must never be confused (Shopify research); owner chose Publish as the only send (publish Q2) | implemented |
| Q16 | A product with no listing on a connected marketplace? | The block says "Not on Amazon" with "Put on Amazon" (marketplace-publish). No listing screen exists until then | Claude · reversible | 2026-11-02 | A listing is something on, or going to, a marketplace | implemented |
| Q17 | Amazon search keywords and other Amazon-only text? | Later, on the product when a shop asks | Claude · reversible | 2026-11-02 | Not needed for a listing to go live; one outcome | parked |
| Q18 | Editing many listings at once? | Later | Claude · reversible | 2026-11-02 | A new capability, not an edge of this one | parked |

## Parked (Later)
- Q17 — Amazon search keywords and other Amazon-only text fields; added when a shop asks, on the product (parent Q23).
- Q18 — Editing many listings at once (one price change across fifty); BACKLOG row "channel-listings bulk edit".
- family-merge Q13 — pairing a family's Amazon and Flipkart listings member by member; still after this.
