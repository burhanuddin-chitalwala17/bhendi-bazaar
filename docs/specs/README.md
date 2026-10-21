# Specs

- **Verified:** 2026-10-18

Feature-based specs. **One folder per feature**, `kebab-case`, named for the feature — no numbering. Each holds a `spec.md` (requirements and product approach), a `decisions.md` (every decision, open or made), a `ux.md` when it has UI, and a `trd.md` (technical approach, no code), plus any supporting artifacts.

This is the home for per-feature detail. The phased status map is [../BACKLOG.md](../BACKLOG.md); decisions are in [../adr/](../adr/).

## Convention ([ADR-0010](../adr/0010-spec-convention.md))

- **Folder per feature**, kebab-case, no numbers. One feature per folder.
- **`spec.md`** = requirements and product approach **only** — no technical approach, package choices, or data-model decisions.
- **`trd.md`** = technical approach and decisions; **no code**, only references to *existing* code to justify a decision ([ADR-0009](../adr/0009-docs-reference-code-never-copy-it.md)).
- **≤100 readable lines** each. *Readable content* = body prose (sentences, bullets); **excludes** front-matter, headings, tables, fenced blocks, link-only lines, and blanks. Over the cap → split into subfeatures, each with its own `spec.md`, plus a short overview in the parent.
- **One outcome per feature** ([ADR-0061](../adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md)): the spec's **Scope** section lists *In* and *Later*; Later items go to `decisions.md` and BACKLOG.
- **`decisions.md`** is uncapped: `Q<n>`, question, answer, who decided, date, why — *open*, *decided*, *implemented*, *superseded by Qn* or *parked*. A Q not yet implemented is replaced in place, its why ending "was: …"; an implemented one is superseded by a new row ([ADR-0062](../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)). Other documents cite `Q` ids, and every reader checks a Q's State first: *decided* and *implemented* bind.
- **`ux.md`** (features with UI, before the TRD): journeys, screen inventory, a state matrix per screen, exact copy, a link to the prototype and the owner's dated sign-off. ≤100 readable lines; tables uncapped. Scaffold with `/bb-sdlc ux-start <feature>`.
- **Supporting artifacts** live in the folder, named for their purpose (`rate-comparison.md`, `weight-audit.md`); never named `spec` or `trd`; not line-capped.
- **Cross-reference by relative path and feature name.** Numbering is never used.
- **Header on each:** `Summary · Status · Domain · Phase · Verified · References`. `Summary` is one line and is the row the tables below are generated from — `npm run docs:index`; the tables are never typed by hand and `docs:check` fails while they are stale.
- Scaffold with `/bb-sdlc spec-start <feature-name>`.

A spec describes a **requirement** — what must be true. It is not a defect report: a known defect either becomes a spec (because meeting the requirement needs design) or a PR (because an ADR already states the rule). Nothing in here is a bug list, and nothing here should need deleting once the work lands — the requirement remains true afterwards, and `Status` moves to Implemented.

## Features

<!-- generated:specs-index:start -->
| Feature | Summary | Phase | Domain | Status |
|---|---|---|---|---|
| [checkout-abandonment](checkout-abandonment/) | An unpaid checkout releases its goods within minutes and is shown to nobody | 2 | checkout, payments | ✅ Implemented — PR-104 |
| [image-delivery](image-delivery/) | Images are stored small and served at the size the screen uses | 2 | catalog (identity for avatars) | ✅ Implemented — PR-105 |
| [inventory-reservation](inventory-reservation/) | Stock counts mean something; the last unit sells once | 2 | checkout, catalog | ✅ Implemented — PR-40 |
| [money-as-paise](money-as-paise/) | Every amount displayed, stored, charged, and reported is exact | 2 | cross-domain | ✅ Implemented — PR-37 |
| [payment-confirmation](payment-confirmation/) | An order is paid when the gateway says so, for the right amount | 2 | payments, checkout | ✅ Implemented — PR-39 (R7's refund flow remains Phase 5, as scoped) |
| [server-side-pricing-authority](server-side-pricing-authority/) | The charged amount is determined by the store from its own catalogue | 2 | checkout, payments | ✅ Implemented — PR-38 |
| [multi-vendor-marketplace](multi-vendor-marketplace/) | Three audiences — buyers, selling organisations, platform owners — each with their own portal | 3 | cross-domain | Draft — programme overview; each subfeature carries its own spec and TRD |
| [product-weight-and-rates](product-weight-and-rates/) | A product's weight is recorded and prices its shipping | 3 | catalog, shipping | ✅ Implemented — R1/A1 in PR-22; R2/R3 fell out of the allocation cutover (PR-48); the billing rule, R7, and the remainder closed in PR-53 |
| [shipment-lifecycle](shipment-lifecycle/) | One status vocabulary every courier maps into, and what each state means for stock, refunds and settlement | 3 | shipping (consequences in checkout, catalog, payments) | Implemented — PR-135 (vocabulary, adapter, transition guard, migration), PR-137 (restock and ledger reversal). Refund execution stays manual by decision; the customer-return direction is unbuilt until that flow is specified |
| [shipping-fulfilment](shipping-fulfilment/) | A paid order becomes a real, trackable parcel | 3 | shipping | Draft — deferred by decision (2026-08-10, see Open decision) |
| [rate-limiting](rate-limiting/) | Sensitive endpoints are rate limited in every deployed environment; one that can't enforce is refused at deploy time | 4 | cross-domain (guards identity, payments, checkout, cart, bidding handlers) | Draft |
| [supply-chain-integrity](supply-chain-integrity/) | What the store ships carries no published vulnerability and no committed secret, established by the pipeline | 4 | cross-domain | Draft |
| [error-tracking](error-tracking/) | When something fails, somebody finds out — in minutes, with enough detail to act | 5 | cross-domain | Draft |
| [read-caching](read-caching/) | A page that renders the same for everyone is built once, and no price on it is ever stale | 5 | catalog, with cross-domain reads | Draft |
| [bulk-catalog-upload](bulk-catalog-upload/) | Org owners create their catalogue from a spreadsheet + local photos; admins likewise for categories | 6 | catalog | Implemented |
| [copy-product](copy-product/) | An org starts a new product from one of its own, carrying the descriptive fields | 6 | catalog | Implemented — PR-147 |
| [product-archive](product-archive/) | An org archives a product and restores it without destroying what it was part of | 6 | catalog (enforcement point in checkout) | Implemented — PR-113 |
| [product-video](product-video/) | A product page shows video alongside its photographs, in an order the seller composes | 6 | catalog, checkout | 📝 Draft |
| [org-payouts](org-payouts/) | What each organisation has earned, what the platform kept, and what is still owed | 7 | payouts *(new)*, checkout | 🔨 In progress — ledger, settlement and org-facing API landed (PR-67); console screens outstanding |
| [promotions](promotions/) | The platform and each organisation can run time-boxed offers, applied automatically or by coupon code | 7 | promotions *(new)*, catalog, checkout | 🔨 In progress — engine, checkout, offers API and salePrice retirement landed (PR-67); admin/org screens outstanding |
| [bidding](bidding/) | An organisation puts one product up for timed bidding and shares a link; the platform sells it directly and records what it fetched | 8 | bidding *(new)*, catalog, checkout, payouts | ✅ Implemented — PR-89 |
| [org-storefront](org-storefront/) | Every selling organisation gets a storefront of its own at a link it can promote | 9 | catalog, with cross-domain reads | ✅ Implemented — all seven subfeatures; each carries its own spec |
| [seo](seo/) | The store is findable: every public page describes itself, every product is machine-readable at the price it is sold for, and every URL answers honestly | 10 | cross-domain (catalog leads) | Draft |
| [store-policies](store-policies/) | One public page states how the store sells — shipping, cancellation, returns, refunds, payments, privacy, terms, reviews, bidding and grievances — in words that match what the store actually does | 10 | cross-domain (content only) | Draft |
| [channel-registry](channel-registry/) | What each selling channel is, what it calls the things this shop sells, and whether a product is ready to go there — answered before publishing rather than after a rejection | 11 | catalog, with a seam each channel adapter implements | ✅ Implemented |
| [image-enhancement](image-enhancement/) | A phone photo becomes a marketplace-grade image on demand — cut out, on white, on a studio backdrop, in a scene, brightened, or enlarged — each a tool applied alone, each result a proposal the org accepts or discards | 11 | content (enhancement), reading catalog (assets); runs on the worker | ✅ Implemented — PR-185, PR-190, PR-191, PR-193, PR-198 (2026-09-28) |
| [listing-vocabulary](listing-vocabulary/) | Describe a product once, in the words this shop uses, so every fact is stated where it is known and anything that sells on its own has its own stock | 11 | catalog | ✅ Implemented — PR-236…PR-253 (2026-10-04) |
| [marketplace-integration](marketplace-integration/) | A shop runs its Flipkart and Amazon business from one master product per item: connect the accounts, bring the catalogue in, settle duplicates, tune each platform's listing, keep one stock figure, and publish | 11 | channels (new), with catalog and listing | Draft |
| [media-library](media-library/) | Every stored image is a record with dimensions, source and uses; galleries fill by named slot; capture is guided on the phone | 11 | catalog (assets, slots), content (renditions, capture checks) | ✅ Implemented — PR-152, PR-161, PR-163, PR-177, PR-178, PR-209, PR-211 (2026-09-29) |
| [seller-profile](seller-profile/) | An organisation's profile has a private face for what listing needs and a public face for what a buyer may see, and nothing is demanded before it is needed | 11 | catalog | ✅ Implemented — PR-151, PR-162, PR-175, PR-182, PR-184, PR-208 (2026-09-28) |
| [shopfront-feeds](shopfront-feeds/) | Two feeds at public URLs — one Google Merchant Center fetches, one Meta Commerce Manager fetches — each listing every product a shop has sent to that channel at the price and availability a buyer would see | 11 | cross-domain (catalog, listing, promotions, bidding) | Implemented |
| [worker-foundation](worker-foundation/) | The place where slow work goes: a queue in our Postgres, a worker we own, health in admin, a machine rebuilt by a script | 11 | cross-domain (`server/shared/jobs/`, `worker/`) | ✅ Implemented — PR-150, PR-154, PR-210 (2026-09-29) |
| [contact-us](contact-us/) | Anyone can reach the store from any page — by WhatsApp, or by a message emailed to its inbox | — | notifications | Implemented — PR-107 |
| [home-banners](home-banners/) | The home page hero is a set of platform-owned banners the owner orders, replaces and takes down without a deploy | — | catalog | ✅ Implemented |
| [international-phone](international-phone/) | Every phone field accepts a number from any country, and one number has one spelling | — | cross-domain (identity, catalog, checkout) | Implemented |
| [product-reviews](product-reviews/) | Buyers read and write reviews, photographs included, and the rating every surface shows is derived from the published ones | — | catalog, reading from checkout for the verified badge | ✅ Implemented — PR-124, revised PR-125 |
| [seamless-sign-in](seamless-sign-in/) | Signing in happens over the current page, keeps the shopper's place, and finishes what prompted it — checkout included | — | identity, with UI in the storefront chrome, wishlist and checkout; cart | Implemented — PR-111 |
| [shared-phone-numbers](shared-phone-numbers/) | One phone number backs any number of accounts; email alone identifies one | — | identity | Implemented |
<!-- generated:specs-index:end -->

### Subfeatures

<!-- generated:subfeatures-index:start -->
| Feature | Summary | Phase | Domain | Status |
|---|---|---|---|---|
| [multi-vendor-marketplace/addresses-as-entities](multi-vendor-marketplace/addresses-as-entities/) | An address is a record with columns, not a field inside a JSON blob | 3 | identity, catalog | ✅ Implemented — PR-41; requirements below were held to (R5's no-preselection per the 2026-08-08 decision) |
| [multi-vendor-marketplace/category-tree](multi-vendor-marketplace/category-tree/) | Categories nest to any depth, and the taxonomy belongs to the platform | 3 | catalog | ✅ Implemented (PR-42) |
| [multi-vendor-marketplace/dashboard-widgets](multi-vendor-marketplace/dashboard-widgets/) | One dashboard assembled from widgets, each declaring which audience it is for | 3 | analytics, cross-domain | ✅ Implemented (PR-50) |
| [multi-vendor-marketplace/order-and-cart-lines](multi-vendor-marketplace/order-and-cart-lines/) | What a customer bought is a relation to the product, not an id inside a blob | 3 | checkout, catalog | ✅ Implemented (PR-43, PR-44) |
| [multi-vendor-marketplace/org-onboarding](multi-vendor-marketplace/org-onboarding/) | Someone with no organisation starts one from the store and arrives in a working portal as its first owner | 3 | catalog, identity | ✅ Implemented — PR-28 |
| [multi-vendor-marketplace/org-portal-chrome](multi-vendor-marketplace/org-portal-chrome/) | Inside the portal you always see which organisation you act for and who you are, can switch, and can leave | 3 | cross-domain | ✅ Implemented — PR-31, corrected in PR-32 |
| [multi-vendor-marketplace/org-team](multi-vendor-marketplace/org-team/) | An organisation's people can be listed, added, given a role, and removed | 3 | catalog, identity | Not drafted — scope agreed, requirements provisional, no TRD yet |
| [multi-vendor-marketplace/organisations-and-membership](multi-vendor-marketplace/organisations-and-membership/) | A vendor is an organisation with people in it; a person may belong to several | 3 | catalog, identity | ✅ Implemented — PR-23 (rename) and PR-24 (membership) |
| [multi-vendor-marketplace/portal-separation](multi-vendor-marketplace/portal-separation/) | Three route groups for three audiences, and one authorization model that tells them apart | 3 | cross-domain | ✅ Implemented — see trd.md; requirements below were held to |
| [multi-vendor-marketplace/stock-locations-and-allocation](multi-vendor-marketplace/stock-locations-and-allocation/) | Stock is known per pickup location, and an order ships from wherever its stock actually is | 3 | catalog, shipping, checkout | ✅ Implemented (PR-45..49; rename PR-24..28 and reservation PR-40 as prerequisites) |
| [org-storefront/org-handle](org-storefront/org-handle/) | Every organisation gets a short, readable name that can appear in a URL | 9 | catalog | ✅ Implemented |
| [org-storefront/org-withdrawal](org-storefront/org-withdrawal/) | One switch takes an organisation and all its goods off the platform, and one puts it back | 9 | catalog, reaching into cart, checkout, bidding, promotions | ✅ Implemented |
| [org-storefront/seller-identity](org-storefront/seller-identity/) | A product says which organisation sells it, and that name leads to everything else it sells | 9 | catalog | ✅ Implemented |
| [org-storefront/storefront-branding](org-storefront/storefront-branding/) | The organisation composes its own storefront from the portal: mark, hero, introduction, policies, banners | 9 | catalog | ✅ Implemented |
| [org-storefront/storefront-browse](org-storefront/storefront-browse/) | Search, category navigation and filters that see one organisation's catalogue and nothing else | 9 | catalog | ✅ Implemented |
| [org-storefront/storefront-discovery](org-storefront/storefront-discovery/) | A correct link preview, a place in search results, and a directory so a shop can be found | 9 | catalog | ✅ Implemented |
| [org-storefront/storefront-pages](org-storefront/storefront-pages/) | A landing page, an about page and a grid of goods for one organisation, at a link it can hand out | 9 | catalog | ✅ Implemented |
| [listing-vocabulary/categories](listing-vocabulary/categories/) | Nine categories, each naming the kinds it holds and the few questions it asks, with fixed answers where a list exists | 11 | catalog | ✅ Implemented — PR-236…PR-246 (2026-10-03) |
| [listing-vocabulary/inherited-facts](listing-vocabulary/inherited-facts/) | A fact left blank is filled in from the family, the brand or the shop's defaults, stored on the product, and shown with where it came from | 11 | catalog | ✅ Implemented — PR-227, PR-253 (2026-10-04) |
| [listing-vocabulary/product-types](listing-vocabulary/product-types/) | An admin creates and edits the question sets themselves, so onboarding a seller with a new product line does not wait for a developer | 11 | catalog | ✅ Implemented — PR-236, PR-237, PR-238, PR-240, PR-241 (2026-10-03) |
| [listing-vocabulary/variants](listing-vocabulary/variants/) | Anything that sells on its own is its own product with its own stock, and the category says what makes two things different | 11 | catalog | ✅ Implemented — PR-247, PR-249, PR-250 (2026-10-04) |
| [marketplace-integration/channel-connectors](marketplace-integration/channel-connectors/) | A shop connects its own Amazon and Flipkart seller accounts by consenting on the marketplace's own page, and sees on one Channels page where it sells and whether each connection is healthy | 11 | channels (new) | Implemented |
| [marketplace-integration/channel-import](marketplace-integration/channel-import/) | After a shop connects Amazon or Flipkart, every listing it has there appears in an inbox on Bhendi Bazaar, and listings whose SKU equals one of its products link to that product by themselves, undoably | 11 | channels | Accepted |
| [media-library/renditions](media-library/renditions/) | Every surface that needs its own size or shape gets a derived image made once from a declared recipe, and the source never changes | 11 | content, reading catalog | ✅ Implemented — PR-211 (2026-09-29) |
| [media-library/video-hosting](media-library/video-hosting/) | A seller uploads a short video from the phone as they would a photograph; the platform stores it, makes it playable everywhere, and treats it as an image is treated | 11 | catalog (assets), content (renditions) | ✅ Implemented — PR-180, PR-181, PR-183 (2026-09-27); accepted 2026-09-27 with the defaults 90 s, 200 MB, 1080p and 720p |
| [seller-profile/brand-page](seller-profile/brand-page/) | The shop's about page is a brand landing page, drawn from what the platform knows and finished when the seller has written one line | 11 | catalog | ✅ Implemented — PR-182, PR-184, PR-208 (2026-09-28) |
| [product-reviews/review-media](product-reviews/review-media/) | A review can show the piece as it arrived: a few photographs taken by the buyer | — | catalog | ✅ Implemented — PR-124, revised PR-125 |
<!-- generated:subfeatures-index:end -->

Three parent folders here. [multi-vendor-marketplace](multi-vendor-marketplace/) grew out of a single question about shipping origin and turned into nine subfeatures, because the data-model work and the portal work are the same change seen from two sides. [org-storefront](org-storefront/) is seven subfeatures for the same reason in reverse: giving one organisation a public face touches its identity, the product page, the catalogue query, the seller portal and the crawl rules, and none of those is reviewable inside the others.

[product-reviews](product-reviews/) has one: buyer-submitted photographs are a separate slice with their own upload path, storage budget and moderation hazard, and the words are worth shipping without waiting for them.

In the first two, `spec.md` is the programme overview and each subfeature carries its own `spec.md`; in `product-reviews` the parent stays a full spec with one slice lifted out of it to stay inside the cap. In all three, a subfeature's `trd.md` is written when that subfeature is picked up rather than all of them up front. `org-storefront` also carries a parent `trd.md`, because the decisions its subfeatures inherit — where a storefront lives, what stays canonical, what a public query may select — are settled once for the programme rather than re-argued six times.

### Sequencing

Within Phase 2, [money-as-paise](money-as-paise/) should land before [server-side-pricing-authority](server-side-pricing-authority/), since recomputation logic written against floats would need rewriting. [payment-confirmation](payment-confirmation/) needs pricing authority first, so that the amount it matches against is trustworthy.

Phase 3 is strictly ordered: [product-weight-and-rates](product-weight-and-rates/) before [multi-vendor-marketplace](multi-vendor-marketplace/) before [shipping-fulfilment](shipping-fulfilment/). Booking real parcels at default weights turns a pricing error into courier invoices that do not match what customers paid, and booking them from a guessed origin does the same for the pickup leg.

[multi-vendor-marketplace](multi-vendor-marketplace/) also depends on [inventory-reservation](inventory-reservation/) from Phase 2, which is the one cross-phase dependency here: it moves the stock guard's target, so the guard has to exist first. Its `trd.md` D7 records why the guard is not simply written in its final place.

Phase 7 is a pair: [promotions](promotions/) must land before [org-payouts](org-payouts/). The ledger's arithmetic reads a discount's funding split, so the thing that produces the split has to exist before the thing that settles from it — and building the ledger first would mean writing entries whose discount attribution is a constant zero, then migrating them.

Phase 9 has two entry points. [org-withdrawal](org-storefront/org-withdrawal/) depends on nothing and closes a gap that exists today — `Org.isActive` is read by nothing a buyer sees, so the platform's only compliance control is one it does not have; publishing ungated public pages is defensible only once it works. [org-handle](org-storefront/org-handle/) blocks every remaining subfeature, since nothing can link to a storefront that has no address. [seller-identity](org-storefront/seller-identity/) is the smallest slice with standalone value, can ship before any storefront page exists, and is also the channel most storefronts will be found through — a buyer already looking at a product is the platform's own route into its seller's shop, needing nothing shared and nothing indexed. It also reverses a decision recorded in [multi-vendor-marketplace](multi-vendor-marketplace/spec.md) — *"one storefront, many vendors"* — which needs an ADR before the first PR, not after.

Phase 10's [seo](seo/) deliberately overlaps Phase 9. [storefront-discovery](org-storefront/storefront-discovery/) states the discovery rules for `/store/<handle>`; [seo](seo/) states them for the marketplace. Neither imports the other, because a storefront's rules are about a shop being found and the marketplace's are about goods being found, and collapsing them would make one document answerable for both. What they must agree on — that a product keeps one address — is recorded as a requirement in both.

[shipping-fulfilment](shipping-fulfilment/) carries an open product decision — whether to book real shipments or stop quoting live rates — stated in its `spec.md`. It is the one item here that cannot be resolved by engineering judgement.
