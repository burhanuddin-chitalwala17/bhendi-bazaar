# CHANGELOG

## Format
- **Append-only.** Never edit an old entry; corrections go in as new entries.
- Newest entries at the top.
- Entry header: `## [PR-NN] YYYY-MM-DD — Short title`
- Add `[CONTRACT]` when a DTO in [CONTRACTS.md](CONTRACTS.md) changed — the signal that client and server must move in lockstep.
- Add `[MIGRATION]` when the PR includes a Prisma migration, so a deploy knows to run one.
- One entry per merged PR. Cross-domain changes are recorded here; domain-internal changes go in that domain's own CHANGELOG.

## Entries

## 2026-10-31 — family-merge: members kept in the order the shop picked them

- The family save named two look-alike members in the database's sort order, which differs by
  collation: CI's Postgres (`en_US.UTF-8`) sorts "black" before "Black", local `C` the reverse, so
  `family-merge.test.ts` failed only in CI. Members now keep the order of the shop's selection.
- **Reproduced** on a local database created with `en_US.UTF-8`: the old code failed the test, the
  fix passes. **Suites run there:** the whole suite in UTC (2503), `tsc`, `lint:boundary`.

## 2026-10-29 — inventory-sync: the five-minute order check costs little when nothing changes

- A marketplace reports every order still waiting on every check (Flipkart's waiting shipments,
  Amazon's last order again). Each was a transaction of three or four operations per line, every
  five minutes. Now one read finds the lines already recorded; only a new line, or one whose state
  moved, opens a transaction. Locations and listings are read only when something is new.
- Due connections are claimed in one `UPDATE … RETURNING`, and the connection is read once. The
  cursor is written only when it moved and something came in, or hourly.
- A quiet run is now about 3 database operations plus the queue's own (was about 10, plus about 3.5
  per waiting order line).
- **Mutation-tested:** every reported line processed again → the quiet-check test red; the cursor
  written on every run → red. Each restored.
- **Tests:** `stock-sync.test.ts` (18).

## 2026-10-29 — inventory-sync and family-merge: fixes from the self-review [CONTRACT]

- **Amazon's first order check after turning sync on** no longer asks for orders updated within
  two minutes of now, which Amazon refuses; the start is held back two minutes.
- **A listing the marketplace turns down** is recorded on the listing and named on the section
  ("turned down n listings"), instead of "Sending… 119 of 120" for ever; it is sent again on its
  next change (Q25, which supersedes Q12's last clause).
- **An order whose listing had no product** reads "Not linked to a product: stock not taken".
- **Match locations:** Save with nothing picked says "Pick a location first."
- **Family form:** the price is shown through `paiseToRupees` (Invariant 3), checked with the shared
  `rupeeAmount` (at most two decimals), and SKU and price stack on a phone (ADR-0015).
- **Not changed:** every stock change still enqueues its push in the business transaction,
  checkout's included (ADR-0038); whether to enqueue only for linked products is the owner's call.
- **Mutation-tested:** the two-minute clamp removed → `stock-providers.test.ts` red; the refusal
  record removed → the turned-down test red. Each restored.
- **Tests:** `stock-providers.test.ts` (5), `stock-sync.test.ts` (17).

## 2026-10-29 — A missing product or category answers 404; categories get their own title and canonical

- Search Console listed dead product slugs and unknown categories as soft 404s: both answered
  200. The root layout's `<Suspense>` around every page started the stream before `notFound()`
  could set a status; it is gone, and boundaries stay inside pages. A category's DAL read now
  throws `NotFoundError` (it threw a plain `Error`), and the page calls `notFound()` on it.
- The category page gains `generateMetadata`: its name, description and canonical (seo D6), which
  ends every category sharing the site title. A real category with no products now says so
  ("No products in this category yet") instead of showing an empty grid.
- `/semi-formal-ridas` redirects permanently to `/category/semi-formal-rida` (`next.config.ts`).
- **Tests:** `honest-status.test.ts` — no layout wraps `children` in Suspense; no `loading.tsx`
  above a storefront page that calls `notFound()`. **Mutation-tested:** the root layout's original
  line (`fallback={<LoadingSkeleton />}`) put back, and a `loading.tsx` added above the product
  page → both red. Checked against `next dev`: unknown
  product and category 404, real ones 200 with their own title and canonical; `next build` passes.

## 2026-10-29 — inventory-sync: fixes from the fresh-context review [MIGRATION] [CONTRACT]

- **The worker no longer fails at boot.** The five-minute order check was a schedule under the
  hour floor (and a fifth schedule over the cap of four), which throws when the worker loads, taking
  every job type down. It is now a job that enqueues its next run only while a connection has sync
  on, each run claiming the connections due (`ordersCheckedAt`), so a second chain stops (Q23). The
  daily stock check is enqueued by the daily maintain pass. `enqueueLater` added to the job seam.
- **A push reads what was last sent inside its lock**, so one waiting on another never compares
  against a stale send. The daily check compares with what was last sent and sends again through
  the push, under the same lock (D5).
- **Older sales are not taken again:** turning on starts the order check from now; a sale from
  before sync is recorded, not taken (Q24, `MarketplaceOrder.beforeSync`). Flipkart's dispatched
  orders are read too, so a sale dispatched between checks still counts.
- **Matching locations sends what waited** (Q16). A location matched to a closed shop location
  is sent 0 and asks for a new match; deleting a shop location clears its match (`ON DELETE SET
  NULL`) instead of being refused.
- **The section's missing states:** "Sending… n of m", "Couldn't reach…", "…doesn't let us send
  stock yet", from `stockProblem` (D7, reworded in the TRD: a refusal is recorded, not predeclared).
  A product stocked by the marketplace says so; an oversold line clears once shipped or cancelled;
  "today" is India's day. Orders rows show "Before stock sync" and a guessed location (Q18).
- Migration `20261029000500_stock_sync_checks`: adds `ChannelConnection.ordersCheckedAt`,
  `stockProblem` (checked set), `MarketplaceOrder.beforeSync`; swaps one foreign key's delete rule.
  Drops no data.
- **Mutation-tested:** the worker loading a 300-second schedule → `worker-registrations.test.ts` red
  (the test that would have caught this); listings read before the lock → the waiting-push test red;
  the before-sync rule removed → red; the chain continuing with nothing due → red; no push after
  matching → red; the cursor not reset on turn-on → red. Each restored.
- **Tests:** `worker-registrations.test.ts` (2, new), `stock-sync.test.ts` (16).

## 2026-10-29 — Search results leave the index; the old site's other WordPress addresses answer 410

- `/s` is out of the sitemap and carries `noindex, follow` (seo R8, the `/s` part of TRD delivery 1).
- `src/middleware.ts` answers `/wp-*`, `/xmlrpc.php`, `/feed`, `/comments/feed`, `/tag/` and
  `/author/` with 410, beside the dated permalinks. `/category/` is excluded because the app serves it.
- **Tests:** `portal-guards.test.ts` (the new shapes are gone; `/feeds/*` and `/category/feed` are not).
  **Mutation-tested:** the rule narrowed back to dated paths → the new test red.

## 2026-10-29 — inventory-sync units 4–5: the daily check, the product's stock line and every section state [MIGRATION] [CONTRACT]

- A daily check reads every linked listing's counts, sends ours where they differ and records a
  `StockCorrection` (migration `20261029000400_stock_corrections`, adds a table only); the section
  lists today's (Q9). A product's On marketplaces block shows what was last sent and an oversold
  order; a marketplace that stocks every listing itself (FBA) says so and sends nothing (Q5, Q20).
- **Tests:** `stock-sync.test.ts` (the daily check records a correction; FBA skipped).

## 2026-10-29 — inventory-sync unit 3: the order check, oversold and cancellations [MIGRATION] [CONTRACT]

- `channels.check-orders` every five minutes per connection with sync on: Amazon's Orders API v0
  (Q21; moving to `searchOrders` is in BACKLOG, due before 2027-03-27), Flipkart's shipment search.
  Each line is a `MarketplaceOrder` once (migration `20261029000300_marketplace_orders`, adds a table,
  unique on connection, order and line; claimed with `createMany … skipDuplicates`, since a unique
  violation inside the transaction would abort it). Stock is taken through catalog's new `takeUpTo`,
  never below zero; what could not be taken flags the line oversold (Q7). A line cancelled before
  dispatch restocks once, claimed by a conditional update (Q8). Orders gains a Marketplace orders tab.
- **Mutation-tested:** the claim's skip removed → the re-reported order test red; `takeUpTo`'s
  minimum removed → the oversold test red; `restockedAt: null` removed from `claimRestock` → the
  three-checks-at-once test red 3/3. Each restored.
- **Allowlist edit (vocabulary.test.ts):** `item\.SellerSKU` — Amazon's own field name in its
  orders response, read in `amazon.stock.ts`; the word is theirs, not our vocabulary.
- **Tests:** `stock-providers.test.ts` (4), `stock-sync.test.ts`.

## 2026-10-29 — inventory-sync unit 2: the switch, the preview and the push [MIGRATION] [CONTRACT]

- Stock sync is off, on or paused per connection (migration `20261029000200_stock_sync`, adds
  columns only). Turning on shows a preview of every linked listing's count, theirs and ours, then
  sends (Q4). Every stock write in catalog (reserve, release, restock, adjust, takeOne, import) and
  archiving enqueue `channels.push-stock` in their transaction, through `server/shared/jobs`, so
  catalog does not import channels; a count reaching 0 goes first (Q19). The push reads the count
  under a lock per product and skips counts already sent (Q22). `JobSpec` gains `priority`.
- `PUT /api/org/[orgId]/channels/[channel]/stock-sync` (`stockSyncChangeSchema`).
- **Mutation-tested:** the already-sent skip removed → the repeat-send test red. Restored.
- Product read census +1 (`stockForPush`, archived included to send 0); product repository +1.
- **Tests:** `stock-plan.test.ts` (4), `stock-sync.test.ts`, `payment-failed-restock.test.ts` (mock
  gains `aggregate` and the enqueue).

## 2026-10-29 — inventory-sync unit 1: marketplace locations and Match locations [MIGRATION] [CONTRACT]

- `ChannelLocation` (migration `20261029000100_channel_locations`, adds a table only): each
  marketplace's pickup locations, read on connect and Read again, matched once to one of the shop's
  or marked not used; a pincode match is suggested; a new one or a closed match flags the section
  (Q15–Q17). Amazon without multi-location is one location (Q12, from the production read of
  2026-10-29). `PUT …/channels/[channel]/locations` (`locationMatchSchema`).
- **Tests:** `stock-sync.test.ts` (matching, the closed and new flags).
- **Suites run (all units):** `tsc --noEmit`, `vitest run tests/unit`, the integration suite on
  `bhendi_bazaar_ci`, `lint:boundary`, `docs:check`, `next build` — 2150 unit, 336 integration,
  all green.

## 2026-10-29 — family-merge: fixes from the fresh-context review

- **Adding to a family checks against its members:** the family's members are planned with the new
  listings, so a second "Black" is refused naming the one already in it; a new member inherits the
  family's own facts, not ones worked out among the new listings only.
- **Leftovers of a large group:** listings already in the family no longer fill the page's 30, so
  "Add to family" shows the rest (Q19).
- **A member whose listing says nothing on an axis is asked**, with every answer of ours; a length
  is answered with its number (Q18).
- **The page plans as the save does**, with existing products' own answers.
- **One type per family:** a product of another type is refused by name; a category is checked
  against the family's type; more than six axes is refused (the type rule's limit).
- **Locked axis widening** (`FOR UPDATE`), so two adds at once keep both. A shared fact the shop
  typed is kept as the shop's on the family, not as the listing's.
- **Suggestions:** trigrams computed once per listing; only a SKU of three parts or more has a stem,
  so "HJB-001" and "HJB-002" no longer chain different items; at most 300 listings looked at.
- **The form:** three columns from `lg:`, members grouped under the first of two differences,
  existing members listed when adding, Try again on a failed read, a cleared price no longer blocks
  a member left out.
- **Mutation-tested:** the family's members left out of the plan → red; the type check removed → red;
  leftovers not filtered → red. Each restored.
- **Tests:** `family-plan.test.ts` (12), `family-suggest.test.ts`, `family-merge.test.ts` (15: a
  failure inside the transaction rolls back members already made; a duplicate against the family;
  32 listings in parts; another type; a silent listing answered). Product read census +1
  (`familyMembers`, deliberate). **Suites run:** `tsc --noEmit`, `vitest run tests/unit` (2142),
  the integration suite on `bhendi_bazaar_ci` (325), `lint:boundary`, `docs:check`, `next build`.

## 2026-10-29 — family-merge unit 5: Flipkart, suggested and picked by hand [MIGRATION] [CONTRACT]

- Listings with no marketplace grouping that look like one item (a SKU differing only at the end, or
  titles this close) are suggested together on Not linked, three at a time, never grouped by
  themselves (Q5). "Not one item" is remembered on the listings (`familyHintDismissedAt`, migration
  `20261029000000_family_hint_dismissed`, adds a column only) and the suggestion stays away (Q21).
  "Group listings" ticks listings by hand; Continue with fewer than two says why.
- **Mutation-tested:** the dismissed filter removed → the dismissal test red. Restored.
- **Tests:** `family-suggest.test.ts` (3), the picker in `family-form.test.tsx`, `family-merge.test.ts`.

## 2026-10-29 — family-merge unit 4: the Listings page's group entry points [CONTRACT]

- Each variation group's header offers its one action across tabs: "Settle as one family",
  "Make one family" (all settled separately), "Add to family" (some outside it) or "See family".
  The first group explains itself until the shop has made a family from that marketplace, and a
  group member's Settle page offers "Settle all n as one family" (Q22).
- **Tests:** `family-merge.test.ts` (each state, settle → family → add; make), `settle-form.test.tsx`.

## 2026-10-29 — family-merge unit 3: the save, its routes and the form [CONTRACT]

- `POST /api/org/[orgId]/channels/family`: the server plans again from the stored reads and refuses,
  before writing, two members alike, an unanswered one, no product type, a SKU in use (ignoring case)
  or a product in another family not moved; main photos are copied first (one failure saves
  nothing); then one transaction locks the listings in id order, makes or reuses the family (widening
  its axes, Q16, Q20), creates each new member with its own SKU, price, stock and photos queued,
  joins existing products conditionally, links each listing, and writes facts: shared ones on the
  family and on members as `family`, each member's own as the marketplace's (D4). A member whose
  listing is not live is added off sale (Q24). The family page and form implement ux.md's states.
- **Found while building:** an answer the browser sent for a fact the listing already answered
  replaced it; answers now count only for a fact that member was asked (a test for it added).
- **Mutation-tested:** moving without the owner's say-so → red. The lock verdict, the conditional
  link and the SKU unique index each stop a second save on their own (removing two of them still
  leaves the third rolling it back whole); recorded as layered, not missing.
- **Tests:** `family-merge.test.ts` (11), `family-form.test.tsx` (4).

## 2026-10-29 — family-merge unit 2: the family page's read [CONTRACT]

- `channelFamilyService.page`: this shop's listings on one connection, none left off, the first 30
  (Q19, Q23), each read live at two a time and stored, a failed read standing on the last one;
  Amazon's parent gives the family's name and description (Q2, Q10). Every type is planned, so a
  category choice shows its axes and shared facts at once. `FamilyPageDTO` in
  `channel-family.types.ts`; CONTRACTS.md moved with it.

## 2026-10-29 — family-merge unit 1: the planner

- `server/channels/family-plan.ts` (pure): each member planned as one product (marketplace-facts D5);
  the axes are the type's plus any asked fact or measurement the members differ on (Q16); shared
  facts fill the family once (Q7); duplicates (Q8) and unanswered values (Q18) are found; an existing
  product's answers win (D4).
- **Mutation-tested:** duplicates never found → red; every attribute an axis → red; the listing over
  an existing product's answer → red; answers not of ours accepted → red. Each restored.
- **Tests:** `family-plan.test.ts` (9). **Suites run for units 1–5:** `tsc --noEmit`, `vitest run
  tests/unit`, the integration suite on `bhendi_bazaar_ci` (321 passed), `lint:boundary`,
  `docs:check`, `next build`.

## 2026-10-25 — marketplace-facts implemented

- The owner checked it: facts fill and are answered on the Settle page, the product card shows,
  changes and resets them, and the review fixes hold. BACKLOG follows. Next: family-merge.

## 2026-10-25 — marketplace-facts unit 6 and product-merge Q31: fixes from the fresh-context review [CONTRACT]

- **Matching saved none of the page's facts:** a matched product also carries `categoryId`, so the
  save took it for a new product and found no type. Told apart by `productType` now; a match-mode
  test proves only the product's empty facts fill and its own answers stay.
- **A typed SKU differing only in case or spaces is refused**, as listings are matched (`skuKey`),
  naming the product that holds it. Two settles typing the same SKU at once make one product; the
  other is told it is used (already mapped; now tested).
- **The Settle page reads the marketplace beside its other loads**, and a failure planning the facts
  costs the section, never the page.
- **No type:** a matched product with none, or a category with none, says "This product has no
  product type…" instead of "Pick a category"; ux.md gains that row and "Couldn't read the
  marketplace". `SettleFactsDTO.matching` added.
- **Kept as is:** when the page's read fails, a save may still fill the clear facts from an earlier
  stored read; only empty facts fill, and the worker would fill them anyway.
- **Mutation-tested:** the SKU compare back to exact → the case test red; restored. The unit test now
  answers then skips, proving the skip clears the answer.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit`, the integration suite on
  `bhendi_bazaar_ci`, `lint:boundary`, `docs:check`, `next build`.

## 2026-10-25 — marketplace-facts unit 6: facts filled and answered on the Settle page [CONTRACT]

- **The owner's call (Q35, superseding Q3):** the attributes are read when the Settle page opens, so
  choosing a category shows its type's facts at once: the clear ones filled "from Amazon", the
  unclear ones as Amazon's words with our answers to tap, or Skip for now (Ask again brings one
  back). They are saved with "Add product" or "Link and save", in the same transaction, only into
  empty facts. The product page card stays for later changes and older products.
- **Nothing is trusted from the browser:** the server re-plans from the stored read for the type
  being saved, and keeps an answer only for a fact still asked and one of our answers to it.
  `SettleDetailDTO.facts` and the settle body's `answers` added; CONTRACTS.md moved with them.
- **Mutation-tested:** the answer check removed → the "one of ours" test red. Restored.
- **Tests:** `settle-form.test.tsx` (the chosen category's facts; tapped answers sent, skipped
  ones not), `marketplace-facts.test.ts` (the page's facts per type; the settle saves the clear ones
  and valid answers; answers to unasked facts or not ours are kept out).
- **Docs:** decisions Q35, ux.md's "Settle page: Facts from Amazon" states and journey 1, TRD D7
  and unit 6.

## 2026-10-25 — product-merge: the product's SKU is typed freely [CONTRACT]

- The Settle page's SKU was a choice among the listings' SKUs. It is now a text field that starts
  at the listing's SKU and suggests the listings' SKUs (product-merge Q31, superseding Q10, owner).
  The settle route no longer refuses a SKU that no listing has; a SKU another product holds is
  still refused by name. Each listing keeps its own SKU. CONTRACTS.md's `sku` line moved with it.
- **Tests:** `settle-form.test.tsx` (a typed SKU is what is sent).

## 2026-10-25 — marketplace-facts: fixes from the fresh-context review [MIGRATION]

- **A long marketplace answer could empty a product's facts:** a stored entry caps the marketplace's
  words at 500 characters and the column reads as empty when one entry fails. The fill now caps
  them and writes only entries the stored schema accepts.
- **Amazon's water codes left the shared fill:** Amazon's provider says them as `yes` / `no` beside
  its code; the fill reads yes or no for any marketplace (Q4).
- **The card:** a skipped question is listed with "Ask … again"; a read that fills nothing new says
  so instead of "All facts filled".
- **Skips are one statement each** (`array_append` / `array_remove`), so two quick skips both stay.
- **A product save reads its marks scoped by shop.** A fill landing between that read and the save
  can still be overwritten by the save; the shop's own answers never are, and "Fill from" restores it.
- **The Amazon data migration** (unpushed) inserts a type's row read only when that type already
  publishes elsewhere on Amazon, instead of dropping it; local checksums refreshed.
- **The row lock is proven:** fill and the shop's answer at the same moment keep both; with the
  locks removed that test went red three runs in three. Restored.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit`, the integration suite on
  `bhendi_bazaar_ci`, `lint:boundary`, `docs:check`, `next build`.

## 2026-10-25 — marketplace-facts unit 5: type and category, park and ask the admin [CONTRACT]

- **Settle's starting category** comes from the listing's own marketplace type (D9): the Settle page
  reads it when it opens and stores it; a mapped type with one category starts there, several ask
  "Amazon lists this as Rug, our Prayer mat. Which category does it go in?", several types ask which
  type first. `SettleDetailDTO.type` added.
- **No type of ours fits:** the Settle page offers our types, "Park it" (Left off with reason
  `no_type`, Q6) and "Ask the admin" (WhatsApp and mail links with ux.md's message; nothing is sent
  by us, Q12, Q13). A parked row reads "Waiting for a product type." with Ask the admin and Bring
  back, which clears the reason. `ChannelListingDTO.waitingForType` added; the leave-off route takes
  an optional `reason`.
- **The card** asks an untyped product's type and category; the choice sets the product's category,
  its type follows (Q25, Q27), and the stored read fills at once. Kind is left to the owner (Q34);
  the card never parks a linked listing (Q33).
- **Tests:** `settle-form.test.tsx` (category tap sent; park with reason), `marketplace-facts.test.ts`
  (park and bring back; the reason refused off Left off by the database check; the Settle page's
  type, mapped and none; category choice types and fills the product).

## 2026-10-25 — marketplace-facts unit 4: the "Facts from {marketplace}" card [CONTRACT]

- **One card per linked listing** on the product page, the same for every marketplace, computed
  from the stored read, today's mapping and the product (D6): filled facts marked "from Amazon",
  "from Amazon · you chose" or "changed by you (was Crepe from Amazon)", questions with our answers
  as chips (more in the Choose sheet, `ResponsivePicker`), Skip for now, Reset, Show all, the
  90-day "Check the mapping" note (Q8), and every ux.md state's copy (`facts-copy.ts`).
- **Commands** on `POST /api/org/[orgId]/channels/[channel]/listings/[id]/facts` (fill, answer,
  change, reset, skip, category), through `channelsApiClient` and `useMarketplaceFacts`. "Fill from"
  reads in the request so busy and reconnect show at once (Q32). Answering a fact the shop answered
  meanwhile is refused with "You already answered this: Crepe. Nothing was changed."
- New `ProductMarketplaceFactsDTO` (`channel-facts.types.ts`); CONTRACTS.md moved with it.
- **Mutation-tested:** the answer without its empty check → "answered meanwhile" red. Restored.
- **Tests:** `marketplace-facts-card.test.tsx` (7: questions, changed and reset, no type, no answers,
  busy, category, stale), `marketplace-facts.test.ts` (answer once, change keeps Amazon's words and
  reset restores them, skip and ask again).

## 2026-10-25 — marketplace-facts unit 3: the fill, on settle and on Fill [CONTRACT]

- **One fill for every marketplace** (`server/channels/fact-fill.ts`, pure, D5): our type (the
  product's own, else mapped, several to choose, or none), then each empty fact: an exact mapped
  value or our answer's words fills, two or none is a question ranked by name similarity, numbers
  parse, the water code is the boolean; dimensions fill length, width and height in the type's unit.
- **Catalog's conditional commands** (D7): `fillFromMarketplace` locks the product row and writes
  only empty facts and measurements (each with its marketplace and words), weight when unset or
  0.5 kg (Q28), MRP when empty; brand label details fill the product's brand, a same-name brand or
  the default brand for "Generic", only where empty, and never create one (Q29); HSN fills the
  category's tax code in the listing defaults only when it has none (Q21).
- **The job** `channels.fill-facts` reads one listing, stores the read and fills; a settle enqueues
  it in its transaction for each listing (Q3). Listing's `channelMapService` serves the mapping
  backwards (D2). A form save keeps marketplace marks (Q31); measurements carry `source` too.
- **Mutation-tested:** the planner filling an answered fact → red; filling on two named answers →
  red (a test added for it); catalog writing over a set fact → red; weight always replaced → red;
  brand fields always written → red. Each restored.
- **Tests:** `fact-fill.test.ts` (10), `marketplace-facts.test.ts` (fills only empty; an edit made
  meanwhile wins; Generic brand; HSN once; no answers; settle queues the job). Product read census
  +1 (`marketplaceFacts`, deliberate).

## 2026-10-25 — marketplace-facts unit 2: each listing's attributes, read [CONTRACT] [MIGRATION]

- `MarketplaceProvider.listingAttributes` returns a listing's marketplace type, its attributes
  flattened to `name` / `name.part` paths, and its product details in our units (D1). Amazon reads
  `getListingsItem` (parcel then item weight in kg, dimensions in cm, HSN, MRP in paise, ISO origin,
  brand, manufacturer, packer, importer); Flipkart reads its listing details (MRP, HSN, parcel,
  label) and no attributes, the "no answers" case (Q4).
- Migration `20261025000200_listing_attributes_and_mrp`: `ChannelListing.attributes`,
  `attributesReadAt`, `attributeSkips`, `leftOffReason` (checked: `no_type`, only when left off),
  `Product.mrpPaise` (checked ≥ 0). Adds columns only.
- **Tests:** `listing-attributes.test.ts` (5).

## 2026-10-25 — marketplace-facts unit 1: several marketplace types per type, and Amazon's mapping [CONTRACT] [MIGRATION]

- `ChannelCategoryMap.publishes`: a type of ours may be read from several marketplace types, with
  one publishing (Q18, D3). Readiness and the register read only publishing rows; undoing "not
  sold" removes only the publishing row. Migration `20261025000000_channel_types_read_and_publish`
  replaces the unique with partial uniques.
- Amazon's mapping ships as data, migration `20261025000100_amazon_mappings` generated from
  `amazon-mapping.json` (47 types, 124 attributes, 225 values), each row dated with its source.
  Combo rows read only (combos are not sold on any channel).
- The admin's types control on `/admin/channels/[channel]` (`PUT /api/admin/channels/types`): add,
  remove, "Publishes here"; the publishing one cannot be removed until another is marked (Q26).
- **Mutation-tested:** readiness reading every row → red; undoing "not sold" deleting read rows →
  red; the conditional delete removed → red. Each restored.
- **Tests:** `channel-type-mapping.test.ts` (5), `channel-mappings-seed.test.ts` (read-only combos).
- **Suites run for units 1–5:** `tsc --noEmit`; `vitest run tests/unit`; the integration suite on
  the local `bhendi_bazaar_ci` database (304 passed); `lint:boundary`; `docs:check`; `next build`.

## 2026-10-23 — product-merge implemented

- The owner checked merging on production: adding a new product, matching, and leaving off all work.
  Spec and TRD move to Implemented; BACKLOG follows. Next: marketplace-facts.

## 2026-10-23 — product-merge: the Settle page's match link was blocked at the edge

- Clicking a match opened a Vercel "This request was blocked" page (403, `x-vercel-mitigated: deny`):
  the edge firewall refuses any `product=` or `p=` query parameter, whatever its value, even on
  other pages. The Settle page now reads `productId`, which passes. Nothing in our app returned it.
- **Suites run:** `tsc --noEmit`, the docs check. The edge rule is in the Vercel firewall, not the
  repository; if it is ever changed, this parameter name can come back.

## 2026-10-21 — product-merge: fixes from the fresh-context review [CONTRACT]

- **"Add product" could not submit:** the form validated before its choices (title, photo source)
  were in its values, and showed no field. Choices are now written into the values as they change;
  a component test submits the real form (`settle-form.test.tsx`).
- **The listings are locked first** (`SELECT … FOR UPDATE`, D4's order), so two identical taps make
  one product and the second is told "This listing was just linked to …", not "SKU in use".
- **A match checks its stock locations** belong to the shop, as the add path does.
- **Try again keeps the copy's mode** (`photoMode`, added to the unpushed migration): a match still
  replaces its gallery only when every photo arrives. A copy whose re-read fails counts every
  photo as failed, so Try again shows instead of "Copying…" forever.
- **Link back** leaves a left-off row alone and names a product already linked on that marketplace.
- **The page:** the photo-copy error shows with Try again and Add photo; "settled meanwhile" offers
  Back to listings; descriptions have Show all; the read failure has Try again; the load error says
  it could not read the listing; the Settle page uses `PageShell`; Undo on Leave off says "Brought
  back.". SKU and description limits match the product form. Weight logged as Q30.
- **Mutation-tested:** the form without the choice sync → the component test red; no lock first →
  the identical-taps test red; retry always appending → red; no location check → red. Each restored.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit` (180 files), the integration suite on the
  local dev database (`product-merge.test.ts` now 14 tests), `lint:boundary`, `docs:check`.

## 2026-10-21 — product-merge: settle every marketplace listing [CONTRACT] [MIGRATION]

- **Units 1–5 of the accepted TRD**, built in one pass and left uncommitted for the owner. A
  not-linked listing is added as a new product, matched to one the shop has, or left off; the same
  item on the other marketplace is suggested (same SKU, then a similar name) and settled with it.
  Migration `20261022000000_listing_settlement` adds `leftOffAt`/`leftOffById`, photo-copy counts
  and a partial unique index of one listing per connection per product; it drops nothing.
- **One transaction per settle (D4):** catalog creates the product inside it (the insert split from
  `createProduct`; the slug is chosen free first, since a duplicate aborts a Postgres transaction),
  or updates only the chosen fields and sets counted stock against what the page saw; every listing
  is linked conditionally, and a short count rolls the product back. Photos: the main one is copied
  before the save (a failure writes nothing); the rest by `channels.copy-listing-photos`, which
  re-reads them from Amazon's catalogue (Q26), accepts only Amazon's image hosts, at most nine, and
  stores them through the new `mediaImportService`. Flipkart gives no photos or description.
- **Screens:** the details panel's three choices, the match picker, the Settle page, "Show left
  off" on Not linked, the row's suggestion line, "Linked by you", photo progress with Try again on
  the product, and the card's "to settle". Built-time ux.md changes: "settled meanwhile" names the
  product but not the person (who linked is not stored), and rows for left off meanwhile, loading
  the listing and a failed read.
- **CONTRACTS.md** — Settling marketplace listings. **Gates:** the product-visibility census gains
  four reads that see archived products on purpose, each with its reason.
- **Mutation-tested:** the settle link without its condition → the two-taps test red (the first
  version of that test passed under the mutation, because the second tap was refused for its SKU;
  it was rewritten so only the link can stop it); a read linking a left-off listing → red; never
  archiving → red; any https host accepted for photos → red. Each restored.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit` (179 files), the integration suite on the
  local dev database (36 files, 286 tests; `product-merge.test.ts` new), `lint:boundary`,
  `docs:check`.
- **Still to do:** A7 and A8 on the owner's catalogue at 360px, including photos against Amazon.

## 2026-10-21 — channel-import implemented

- Acceptance A1, A7 and A8 checked by the owner on production: Amazon and Flipkart listings read
  and linked by SKU, the variant group, Unlink / Undo / Link back, the details panel on a phone,
  and Flipkart's prices read as rupees. Spec and TRD move to Implemented; Q20 is implemented;
  BACKLOG and TRACKER follow. Next: product-merge.

## 2026-10-21 — channel-import: Flipkart reads without product search (Q20)

- The production probe (`scripts/flipkart-listing-probe.ts`, run on the owner's request) showed
  Flipkart answers our app 404 on `listings/v3/product/search` and 200 on listing search, listing
  details and the SKU lookup. The Flipkart reader now skips product search on a 404 and reads every
  listing from search and details: no picture (the initial tile) and no one-shop account check on
  Flipkart. Decision Q20 supersedes Q8 (Flipkart pictures) and Q10; spec, TRD, ux.md and
  INTEGRATIONS.md say so. Amazon is unchanged.
- **Mutation-tested:** treating product search's 404 as fatal again → the new Q20 test red.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit`, the integration suite on the local dev
  database, `lint:boundary`, `docs:check`.

## 2026-10-21 — channel-import: a refused request stops the read instead of retrying [CONTRACT]

- The first live Flipkart read failed with HTTP 404 on every attempt and the page said "Flipkart is
  busy". A 4xx other than auth or rate limit is now `MarketplaceRequestError`: not retried, the read
  stops as `not_allowed` ("Flipkart doesn't let us read your listings yet…", a new ux.md row), and
  the job's log line names the call and status (`flipkart /listings/v3/product/search`, `404`).
  Amazon's calls carry a step name the same way.
- `scripts/flipkart-listing-probe.ts` asks each Flipkart listing call once with the stored token
  and prints status and field names, to find which calls our app may use. Not run by Claude.
- **Mutation-tested:** classing a 404 as busy again → the new unit test red (five calls, not one).
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit`, the integration suite on the local dev
  database, `lint:boundary`, `docs:check`.

## 2026-10-21 — channel-import: fixes from the fresh-context review [CONTRACT]

- **A read could stay "running" forever** after a worker restart or a slow Amazon report: the
  queue retried within the 30-minute takeover window and gave up. Readers now report in while they
  wait (`ListingSink.alive`), the takeover window is 5 minutes (`READ_STALL_MS`), and
  `ChannelReadDTO.stalled` brings Read again back for a silent read.
- **Different account:** a Flipkart reconnect no longer wipes the account id its reads learned, so
  the different-account stop can fire; a fresh connect after Disconnect still starts clean. The page
  sends that state to Channels, as ux.md says.
- **"See listings"** shows on every live card, so a connection made before this feature has a way in.
- **Flipkart** stops before writing any row if product search named no account (D6 cannot be skipped).
- Tab numbers count what the tab lists (gone rows included); "Reading… n of m" shows once rows
  exist; linking looks only at the batch's SKUs; the unreachable "No SKU" row left ux.md.
- Docs: decisions Q14–Q19 back in the table; channels CLAUDE.md names `channel-import.service` as
  public; the image-delivery allowlist reason corrected; no audit row on a refused account, noted in D6.
- **Mutation-tested:** dropping the different-account stop → the new D6 test red; restored.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit` and the integration suite on the local dev
  database (all green, `channel-import.test.ts` now 9 tests), `lint:boundary`, `docs:check`.

## 2026-10-21 — channel-import: listings read, linked by SKU [CONTRACT] [MIGRATION]

- **Units 1–5 of the accepted TRD**, built in one pass and left uncommitted for the owner.
  `ChannelListing` (migration `20261021000000_channel_listings`, no drops) holds one row per
  marketplace SKU; `ChannelConnection` gains the read-state columns. The worker job
  `channels.read-listings` runs on connect and on "Read again": Amazon through the all-listings
  report then the Listings API for pictures and variation parents; Flipkart in three passes, naming
  the account first so a second shop's is refused before a row is written.
- **Screens:** the Listings page per marketplace (tabs, search, Show more, variant groups, details
  panel with Unlink / Link back), the card's reading line and "See listings", and the product page's
  "On marketplaces" block. Copy is ux.md's; one row was added there while building: a read that
  meets a different account than the connection's.
- **Catalog:** `listWithSku` and `compareFacts` reads; a product a listing links to cannot be
  deleted, and the refusal says so and points at Archive.
- **CONTRACTS.md** — Marketplace listings: `ChannelReadDTO`, `ChannelListingDTO`,
  `ChannelListingsPageDTO`, `ChannelListingDetailDTO`, `ProductMarketplaceLinkDTO`, the card's
  `read` and `listings`, three routes.
- **Allowlists, each with its reason:** overlay-surfaces (details panel, decision 3), image-delivery
  (marketplace pictures, not our asset), vocabulary (`seller-sku`, Flipkart's `/sellers` and
  `sellerId`), product-visibility (two reads that see archived products on purpose). CSP `img-src`
  gains Amazon's and Flipkart's image hosts.
- **Mutation-tested:** paise from floats instead of digits → red; keeping an Amazon variation parent
  as a row → red; relinking a listing the owner unlinked → red; claiming a read with no condition →
  the one-at-a-time test red; marking gone on a stopped read → red. Each restored.
- **Suites run:** `tsc --noEmit`, `vitest run tests/unit` (178 files, 2,078 tests), the integration
  suite on the local dev database (35 files, 274 tests, `channel-import.test.ts` new),
  `lint:boundary`, `docs:check`.
- **Still to do:** A1, A7 and A8 on the owner's own Amazon and Flipkart accounts at 360px, including
  Flipkart's price units. Spec and TRD move to Implemented after that.

## 2026-10-21 — channel-connectors implemented

- Acceptance A8 passed on the owner's accounts: Amazon connected on production and Flipkart on
  production. Spec and TRD move to Implemented; BACKLOG and TRACKER (F-013) follow.
- What the first live connect taught, recorded in INTEGRATIONS.md and decision Q19: redirects match
  character for character, and production's origin is `www`. Amazon gained the `www` callback;
  Flipkart, whose single redirect cannot be edited, got a new third-party app.
- Still to watch: the worker's first daily `channels.maintain` run moving "Last checked".

## 2026-10-20 — Worker env from one secret per variable

- The deploy no longer needs the whole worker env file re-pasted to change one value. Every GitHub
  secret named `WORKER_ENV_<NAME>` becomes `NAME=value` (`infra/worker/compose-env.sh`, read through
  `toJSON(secrets)`); `WORKER_ENV_FILE` stays as an optional base whose lines an individual secret
  replaces, so the move can be gradual. The staging worker does the same with
  `WORKER_STAGING_ENV_<NAME>` over `WORKER_STAGING_ENV_FILE`, and still refuses to run when its
  database equals production's, now compared on the composed files.
- Both workflows fail with a named error when the composed file has no `DATABASE_URL`.
- Checked locally: base plus overrides, overrides only, and the staging prefix ignoring production
  secrets. OPERATIONS.md's secrets table and staging note describe it.

## 2026-10-20 — channel-connectors: fixes from the fresh-context review [CONTRACT]

- **The different-account way out:** Disconnect now sits beside Renew now and Reconnect, and on the
  different-account note, so "disconnect, then connect" (Q8) can be done from the screen.
- **A marketplace cannot be switched on without connecting it:** `org-channels.schema.ts` accepts
  only `google` and `meta`; a `PUT` naming Amazon or Flipkart is refused (D11). CONTRACTS.md notes it.
- **The callback** refuses a state signed for another marketplace's channel, and checks membership
  with the uncached `resolveOrgScope` (now exported from `org-auth.ts`).
- **The daily job survives a bad row:** each connection is maintained in its own try/catch and
  counted as `failed`, logged by id only. "Needs reconnecting" and "checked" are conditional writes
  (`state = CONNECTED`), so a disconnect mid-check is never undone.
- Recorded as decisions rather than changed: Amazon's `selling_partner_id` is trusted from the
  redirect as Amazon documents it (Q17); the 25-shop count can be passed by one in a race, which
  Amazon itself refuses (Q18).
- UI: touch targets `min-h-10`; closed sets compared by constant; the store card's host comes from
  `appUrl()`; "Still loading…" after 3 s; long names expand on a tap; the vocabulary exemption now
  applies only to `server/channels/` and `channel-copy.ts`. ux.md records each added string.
- Mutation-tested: dropping the callback's channel check — "never spends an Amazon state on
  Flipkart's callback" red; dropping its same-user check — "refuses a return finished in another
  sign-in" red. Restored.
- Tests: `tests/unit/channel-callback-route.test.ts` (6), `channel-cards.test.tsx` (+3). Ran
  `tsc --noEmit`, `tests/unit` (all), the channel integration suites, `lint:boundary`, `docs:check`.

## 2026-10-20 — channel-connectors unit 6: daily maintenance and the dashboard banner

- `channels.maintain` (`server/channels/channels.jobs.ts`, the third of four schedule slots, every
  24 h): per live connection, Flipkart renewal when under 30 days of refresh token remain, a health
  check behind "Last checked", and re-sealing under the newest `CREDENTIAL_KEYS` version inside the
  row lock. Suspended shops are skipped (Q11). Registered in `worker/main.ts`; `.env.worker.example`
  gains `CREDENTIAL_KEYS`, which the worker must share with the site.
- The org dashboard shows `ChannelAttentionBanner`: one line for renewal due or needs reconnecting,
  "2 channels need attention." for both (spec R9). Its read fails alone, like the other cards.
- Tests: `tests/integration/channel-connections.test.ts` "the daily pass … skips a suspended shop";
  `tests/unit/channel-cards.test.tsx` banner cases.

## 2026-10-20 — channel-connectors unit 5: the Channels page

- New page `/org/[orgId]/channels`, "Channels" in the sidebar under Products (Q5): own store, Amazon,
  Flipkart, Google, Meta; one column, two from `md:`, three from `lg:`. Server-rendered from
  `channelsDAL`; client leaves are only the card actions, the disconnect sheet (shared `FormDialog`),
  the feed toggles and the return note. Requests go through `channelsApiClient` (`connectUrl`,
  `disconnect`, `checkNow`) with `useMutation`. Every string is ux.md's, in `channel-copy.ts`; two
  lines added while building (Flipkart's revoke line, Meta's feed text) are recorded in ux.md.
- "Where you sell" is removed from What you sell, and `where-you-sell.tsx` deleted (R8). `StatusBadge`
  gains `connected`, `attention`, `problem`, `muted` on existing semantic tokens; no new token.
- Allowlist edit, `tests/unit/vocabulary.test.ts`: lines are scanned with the marketplaces' own names
  removed (Amazon's consent host and Sellers API path, Flipkart's `Seller_Api` scope, "Seller
  Central", "seller account", "asks sellers"), because the signed-off copy and the APIs must spell
  them as the marketplaces do. Mutation-tested: "the seller signs in here" beside the consent URL —
  red; restored.
- Tests: `tests/unit/channel-cards.test.tsx` (13, every card state's copy and action; every
  `CONNECT_RESULT` has copy).

## 2026-10-20 — channel-connectors units 3–4: Amazon and Flipkart, and the routes [CONTRACT]

- Providers `server/channels/providers/amazon/` (Seller Central India consent with `version=beta`
  and a 25-shop cap while the app is unlisted — a fact in the provider, Q16; Login with Amazon
  tokens; `getMarketplaceParticipations` as the health read) and `providers/flipkart/` (GET token
  calls with Basic auth; the token-expiry endpoint as the health read). Ten-second timeouts;
  failures classed as reconnect (`MarketplaceAuthError`) or try later (`MarketplaceUnavailableError`).
- Routes: `GET …/channels/[channel]/connect`, `GET /api/channels/[channel]/callback` (in
  `EXTERNALLY_CALLED`: the marketplaces' redirect), `DELETE …/connection`, `POST …/connection/check`.
  CONTRACTS.md gains "Channel connections".
- Tests: `tests/unit/channel-providers.test.ts` (14).

## 2026-10-20 — channel-connectors unit 2: the channels domain [MIGRATION]

- Migration `20261020000000_channel_connections`: `ChannelConnection`, unique per (shop, channel), a
  partial unique index making one live connection per marketplace account a database fact (Q8), and
  CHECKs on state and on tokens matching state. No data dropped. Never cascades from a shop.
- `server/channels/`: types and closed sets, the one switch `CHANNELS_CONNECT`, the signed ten-minute
  `state`, the repository, and `channel-connection.service` (overview cards with derived renewal-due,
  unavailable and full; connect; disconnect; lazy renewal under `FOR UPDATE`; check; the daily pass).
  Connect and disconnect write listing's `OrgChannel` in the same transaction through the new
  `orgChannelService.setIn`, audited. New domain: `PUBLIC_SURFACE` (`channels: []`), root CLAUDE.md
  table, `server/channels/CLAUDE.md` in `LIVING_DOCS`, ARCHITECTURE.md's domain list and counts.
- Mutation-tested: removing the row lock — "two renewals at once" went red (renewed twice);
  removing the service's other-shop check alone stayed green (the partial index refused it);
  removing the index handling as well — "refuses an Amazon account already connected to another
  shop" went red. Restored.
- Tests: `tests/unit/channel-connect-state.test.ts` (6), `tests/integration/channel-connections.test.ts`
  (14). Ran `tsc --noEmit`, `tests/unit` (all, 2057), `tests/integration` against `bhendi_bazaar_ci`
  (only the known `channel-registry` index failure), `lint:boundary`, `docs:check`.

## 2026-10-20 — channel-connectors unit 1: secrets at rest under a versioned key

- New `server/shared/crypto.ts`: AES-256-GCM under `CREDENTIAL_KEYS` (`version:64-hex` pairs; the
  highest encrypts, any listed decrypts), ciphertext prefixed `v<n>:`, `needsReencryption` for the
  daily re-encrypt in unit 6 ([TRD](specs/marketplace-integration/channel-connectors/trd.md) D3).
  A missing or malformed key throws and never echoes key material.
- Shipping moved onto it; `server/shipping/utils/encryption.ts` removed. Values written before this
  (no prefix) still decrypt from `ENCRYPTION_KEY`, so stored carrier passwords keep working; new
  writes need `CREDENTIAL_KEYS`, which the deployment must now set (OPERATIONS.md). Shipping's
  ADR-0002 status records the amended key handling.
- Mutation-tested: decrypting with the current key when the named version is missing — "refuses to
  open once its key is removed" went red; restored.
- Review fixes: the GCM tag length is pinned to 16 bytes, and a truncated tag is refused; production
  and worker env templates list `CREDENTIAL_KEYS`.
- Tests: `tests/unit/credential-crypto.test.ts` (14). Ran `tsc --noEmit`, `tests/unit` (all, 2020),
  `lint:boundary`, `docs:check`.

## 2026-10-18 — SDLC gains a scope cut, a decision log and a UX stage (ADR-0061)

- New cycle: spike → spec → **UX** → TRD → build → review. Recorded in
  [ADR-0061](adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md),
  with one line in CLAUDE.md's conventions index and the cycle block rewritten.
- `/bb-sdlc spec-start` now cuts a feature to one outcome, with a **Scope** section split into In
  and Later, and opens `decisions.md` (append-only: Q id, answer, who decided, why). The spec
  template's "Out of scope" becomes Scope plus Q ids for open questions. The TRD's Gates list,
  previously pasted into its Packages section, is put back.
- New `/bb-sdlc ux-start`: journeys, screen inventory, a state matrix for every screen (first use
  through phone, tablet and desktop), copy deck, phone-first prototype and the owner's dated sign-off.
- `/bb-build` refuses open decisions and UI without a signed-off `ux.md`, and its acceptance report
  walks every state. `/bb-review` and `pr-finish` check screens against `ux.md` and scope against
  the ids. `/bb-brainstorm` turns options into open Qs and parks anything beyond its question.
- docs/README.md and docs/specs/README.md describe the two new files. Docs only; `docs:check` ran.

## 2026-10-15 — Worker machine bans repeated SSH failures (fail2ban)

- `infra/worker/provision.sh` gains `intrusion_prevention`: fail2ban's `sshd` jail on the systemd
  journal (Ubuntu 24.04's sshd does not write `auth.log`), banning through ufw so the firewall stays
  one rule set — 5 failures in 10 minutes earns a 1-hour ban.
- Why now: the Amazon SP-API developer profile attests to intrusion detection and prevention; the
  machine had a firewall and key-only SSH but nothing watching for repeated attempts.
- Applied to the live worker 2026-10-15 by running only this step (not the whole script, which would
  reset ufw and overwrite the deployed `compose.yml`): fail2ban 1.0.2-3ubuntu0.1 active, the `sshd`
  jail reading the journal, and its first ban already a ufw `REJECT` rule; worker container still
  healthy. No test covers the provisioning script; `bash -n` checks its syntax.

## 2026-10-14 — Shipping is charged from a signed quote, never from the request [CONTRACT]

- **Invariant 1 violation fixed.** Checkout charged `shippingGroups[].selectedRate.rate` as the
  browser sent it, rejecting only a negative number; an edited request could ship for ₹0. Done as a
  defect fix under ADR-0002, with no TRD: the rule existed, the code did not obey it.
- `POST /api/shipping/rates` adds `quote` to every rate and to `defaultRate`: an HMAC
  (`server/shipping/rate-quote.service.ts`, key derived from `NEXTAUTH_SECRET` for this purpose
  only) over courier, provider, charge in paise, origin and destination pincode, billable weight and
  a 30-minute expiry. A stateless signed quote is the field's usual answer (carrier rate handles at
  checkout); re-quoting the carrier inside the order transaction was rejected — it holds row locks
  across an HTTP call and can charge a price the buyer never saw.
- Order creation's `selectedRate` is `{ quote }` only; the old fields are stripped. Checkout reads
  courier, provider and charge from the signature and requires its origin, destination and weight
  to equal the parcel it allocated. An edited, expired or wrong-parcel quote is a 409.
- A refused payment re-quotes the checkout's shipping, keeping the buyer's courier where it is
  still offered, so an expired quote does not refuse every retry.
- Mutation-tested, each red then restored: signature check removed (unit + integration);
  destination check removed (unit + integration); expiry, weight checks removed (unit); checkout
  passing a fixed pincode instead of the address (integration); the key ignoring the secret (unit).
- Tests: `tests/unit/rate-quote.test.ts` (6), `tests/integration/order-transaction.test.ts` (+2,
  fixture now signs its quote). Ran `tsc --noEmit`, `tests/unit` (all), `tests/integration` against
  `bhendi_bazaar_ci` (only the known `channel-registry` index failure), `lint:boundary`, `docs:check`.
  Reviewed in a fresh context; its findings are fixed here. No migration.

## 2026-10-14 — Store policies page (store-policies)

- `/policies`: one page, twelve anchored sections — shipping, cancellation, returns (7 days),
  refunds (7 business days), payments, privacy, terms, reviews, bidding, grievances, contact. Copy
  describes the manual process where the store has no feature (cancel, return, refund).
- `LEGAL` in `src/lib/config.ts` holds the legal name, address, jurisdiction and grievance officer;
  unset values render as `[TO FILL: …]`. `ABANDONED_HOLD_MINUTES` exported so the page states the
  real hold.
- Reached from the footer (desktop) and a third row in Contact us (phone); added to the sitemap.
- No test: the page is copy. Checked by rendering `/policies` on a dev server — all twelve anchors
  present, the hold, return window, India-only shipping, no-COD line and `[TO FILL]` markers shown.
  Ran `tsc --noEmit`, `tests/unit` (all), `lint:boundary`, `docs:check`.

## 2026-10-14 — Google and Meta product feeds (shopfront-feeds)

- `GET /feeds/google.xml` and `GET /feeds/meta.xml`: RSS 2.0 with the `g:` namespace, built on
  every fetch from `productsDAL.listForChannelFeed`, which maps through the product page's own
  `mapProduct` — so the declared price, offer and bidding hold are the page's answers (spec R2, R3).
- One builder, `server/listing/shopfront-feed.ts`, with the channel a parameter; the shops come from
  `orgChannelRepository.orgsWith`, categories from each channel's own `channel-map` rows.
  Products with no image or description are left out; the brand falls back to the shop's name.
  Characters XML forbids are dropped and text is cut by code point, so one pasted description
  cannot void the file; a sale price is declared only when `hasOffer` says one is in force.
- Gates: `/feeds/*.xml` in `EXTERNALLY_CALLED` (route-reachability); the new read in the
  product-visibility CENSUS (23 → 24) and in org-scoping's `PUBLIC_READS`.
- Mutation-tested, each one red then restored: `isBuyable` ignoring `biddingSlug` (unit);
  `categoryFor` ignoring `notSold` (unit); `orgsWith` dropping `enabled: true` (integration, A4);
  the feed read dropping `AVAILABLE` (integration, A3) and `FROM_ACTIVE_ORG` (integration, R4); the
  crawl-block check removed (integration, R8); the forbidden-character strip removed and truncation
  by UTF-16 unit (unit).
- Tests: `tests/unit/shopfront-feed.test.ts` (14), `tests/integration/shopfront-feed.test.ts` (6).
  Reviewed in a fresh context with `/bb-review`; its findings are fixed here.
  Ran `tsc --noEmit`, `tests/unit` (all), `tests/integration` against `bhendi_bazaar_ci`,
  `lint:boundary`, `docs:check`. One unrelated integration failure: `channel-registry` "refuses a
  second mapping covering every kind" — the local `bhendi_bazaar_ci` lacks the partial index
  `ChannelCategoryMap_channel_productType_allkinds_key` that the dev database has.

## 2026-10-14 — Lockfile resolves from the public npm registry

- `aeefb24` was installed on a work machine, so 185 `resolved` URLs in `package-lock.json` pointed
  at a private corporate Artifactory the deploy cannot authenticate to. Rewritten to
  `registry.npmjs.org` (same tarballs, same integrity hashes).
- New project `.npmrc` pins `registry=https://registry.npmjs.org/`, overriding any machine-wide
  registry so it cannot recur.

## 2026-10-08 — Edit form keeps measurements; "On its own" family saves (BF-014, BF-015) [CONTRACT]

- **BF-014 — measurements blank on edit.** The admin products DAL read the `measurements`
  column through `parseStoredFacts`, whose keys are *facts*. Every measurement key (`bust`,
  `hip`, …) failed it, the defensive parse returned `{}`, and the edit form opened empty although
  the values were saved. Added `parseStoredMeasurements` (keyed by `measureKeySchema`) in
  `server/listing/listing-facts.ts` and used it in `src/data-access-layer/admin/products.dal.ts`.
- **BF-015 — "Too small: expected string to have >=1 characters".** The family picker's
  "On its own" option submits `""`, which `familyId: z.string().min(1)` refused. `kind`, `familyId`
  and `brandId` now read an unselected picker as `null` (`unselectedIsNull` in
  `product.schema.ts`), so `kind` no longer stores `""` either. No existing rows held `""`.
  Additive contract change, recorded under *Listing vocabulary* in CONTRACTS.md.
- Tests: `tests/unit/stored-measurements.test.ts` (parser + a scan that nothing feeds a
  measurements column to the fact parser) and two cases in `product-schema.test.ts`. Both
  mutation-tested; reverting the schema reproduces the exact message the user saw.

## 2026-10-08 — Dates and counts formatted in one locale and zone (BF-013)

- **Root cause**: tables called `toLocaleDateString()` with no locale, so the server (UTC, en-US)
  rendered `10/8/2026` and the browser (IST, en-IN) `08/10/2026`, failing React hydration. It
  recurred in the orders, categories, users and carts tables. Pinning only the locale (BF-006)
  still left a different *day* near midnight, because the zones differ.
- **Fix**: `src/lib/format.ts` pins `en-IN` and `Asia/Kolkata` in `formatDay`, plus new
  `formatShortDate`, `formatDateTime`, `formatDate(value, options)` and `formatCount`. All 24
  call sites across `src/` route through them.
- **Gate**: `tests/unit/locale-formatting.test.ts` fails on any `toLocale*String(` outside
  `format.ts`. Mutation-tested.
- Fixture category hero image is now a local file, so the admin categories table can render it.
- Side fixes: "seller" → "org" in two strings (retired vocabulary); the tracking gate compares
  against `ORDER_STATUS` rather than bare strings.

## 2026-10-08 — Integration tests no longer write to real data (BF-012)

- **Root cause**: `ensureFixtures()` (`tests/helpers/test-db.ts`) borrowed the first real org,
  category, user and carrier with an unscoped `findFirst`. Suites then mutated those rows on the
  dev database: category product types reset to null (4 suites), the org's sales channels deleted
  (3 suites), its colour values and enhancement policy deleted. The stop hook ran these suites
  after every edit, which is why category product types kept disappearing.
- **Fix**: `ensureFixtures()` now owns its world. Every row is found or created by a fixed test
  key (`FIXTURE_KEYS`), so suites mutate only test rows and reruns reuse them rather than leak.
- Three suites that touched shared reference data now leave it as found:
  `channel-readiness-service` used the real `ethnic-wear/abaya` node (now stamped);
  `product-type-table` restores each type's prior `retiredAt` in `finally`;
  `product-family-service` restores `islamic-wear`'s prior variant axis, not a guessed one.
  `bulk-upload` uses the fixture category instead of a random real one.
- **Guard**: `test-integrity.test.ts` fails if the fixture helper or any integration suite reads
  with an unscoped `findFirst`. Mutation-tested: restoring the old borrow fails it.
- Verified: real categories, product types, org channels, listing values, attribute maps and
  enhancement policies are byte-identical before and after a full 32-suite run.

## 2026-10-08 — Buyer product specs and variant switcher (BL-007, BL-008)

- **Specifications section** on buyer product page: facts (colour, material, sleeve length)
  and measurements (length, bust, waist) now render below the description. Added `facts`
  and `measurements` to buyer `Product` type and DAL mapping.
- **Variant switcher**: when a product belongs to a family, an "Also available" row shows
  sibling products with thumbnails. Clicking navigates to that variant's page.
  Added `getFamilySiblings` to `product.read.repository.ts` and `siblings` to `Product`.

## 2026-10-08 — Blocked user session revocation (BF-002, BL-005)

- `requireSession` now checks `isBlocked` on every authenticated request (one PK lookup).
  A blocked user with an active JWT is stopped immediately — not just at next sign-in.
  Resolves BF-002 and BL-005. `requireActiveSession` removed (redundant).
- Admin self-block prevented: `toggleBlockUser` refuses `id === adminId` (BF-001).

## 2026-10-08 — Org blocking: API guard and location confirm dialog (B-007 follow-up)

- **API guard**: `resolveOrgScope` (`src/lib/org-auth.ts`) now checks `org.isBlocked`
  before granting a scope. All `withOrg` route handlers and `requireOrgMember` server
  components reject blocked orgs with "This organisation has been suspended".
  `findMembership` joins the org row to carry `orgBlocked`.
- **Location delete**: Replaced browser `confirm()` with a proper Dialog component
  in `LocationsManager`.

## 2026-10-08 — Tracker bug fixes: seller orders improvements (B-016)

- **Search and filter**: Seller orders page now has a search bar (by order code)
  and a status filter dropdown (confirmed/processing/packed/shipped/delivered).
  Extended `adminOrderRepository.getOrdersForOrg` and `orgOrdersDAL.getOrders`
  with `filters` parameter.
- **Mark as Packed**: Seller order detail page shows a "Mark as Packed" button
  when order status is `processing`. New API route
  `PATCH /api/org/[orgId]/orders/[orderId]/transition` accepting `{ status: "packed" }`,
  with org ownership verification through `adminOrderService.transitionForOrg`.
- No "Mark as Shipped" — shipping is the delivery partner's responsibility.

## 2026-10-08 — Tracker bug fixes: admin org detail page (B-013)

- New page at `/admin/orgs/[orgId]` — read-only portal mirror with horizontal tabs.
  Five tabs live (Dashboard, Products, Orders, Earnings, Reviews); six more
  (Storefront, Listing, Library, Offers, Bidding, Locations) show "coming soon"
  pending `readOnly` prop additions to their interactive components.
- Org rows in the admin orgs table are now clickable (Link on the name column).
- Added `AdminOrgTabs` component for horizontal tab navigation.
- Added `OrgBlockToggle` client component for block/unblock on the detail page.
- Added `getById` to `orgsDAL`.
- Fixed pre-existing `product-family.test.ts` teardown FK constraint error.

## 2026-10-08 — Tracker bug fixes: admin user detail page (B-012)

- New page at `/admin/users/[userId]` — read-only detail view showing profile
  (name, email, mobile, role, joined date), activity stats (orders, total spent,
  last active), and a block/unblock action.
- User rows in the admin users table are now clickable (Link on the name column).
- Added `UserBlockToggle` client component and `getById` to `adminUsersDAL`.

## 2026-10-08 — Tracker bug fixes: product flag derivation (B-015)

- ON_OFFER and NEW_ARRIVAL are now computed, not stored. ON_OFFER is derived from
  whether the product has an active sale price; NEW_ARRIVAL from `createdAt` (14 days).
  FEATURED, HERO, CLEARANCE_SALE remain manual checkboxes.
- Removed ON_OFFER and NEW_ARRIVAL from the product form (`ProductFlagsFields.tsx`);
  only `MANUAL_FLAGS` are shown.
- Added `isNewArrival()` helper and `MANUAL_FLAGS` constant to `src/types/product.ts`.
- Product list table badges now derive ON_OFFER and NEW_ARRIVAL at display time.
- Shrunk the shape-legacy allowlist by one entry (`ProductFlagsFields.tsx` → `rounded-card`).

## 2026-10-08 — Tracker bug fixes: buyer order tracking display (B-009)

- Added order status badge and tracking info to buyer order detail page
  (`src/components/order/order-client.tsx`). Shows order fulfilment status
  (confirmed/processing/packed/shipped/delivered), delivery address, and per-shipment
  tracking cards with courier name, AWB number, tracking URL, and estimated delivery.
  Data already flowed from DB through DAL — just was not rendered.

## 2026-10-08 — Tracker bug fixes: org blocking replaces deletion (B-007) [MIGRATION] [CONTRACT]

- Replaced hard-delete route with block/unblock. `DELETE /api/admin/orgs/[id]` removed;
  `PATCH /api/admin/orgs/[id]` added accepting `{ action: "block" | "unblock" }`.
  Aligns with ADR-0032 (records people authored are retired, never deleted) and
  ADR-0020 (money-bearing records never cascade).
- **Migration**: Added `isBlocked Boolean @default(false)` to Org model with index.
- **Portal guard**: Org layout shows a suspended page when `isBlocked` is true.
- **Buyer-facing**: `FROM_ACTIVE_ORG` visibility filter now excludes blocked orgs
  (`server/catalog/product.visibility.ts`).
- **UI**: Delete button → block/unblock toggle in admin orgs table. Browser `confirm()`
  removed. Blocked badge shown in status column.
- `src/domain/org.ts`: `Org` interface gains `isBlocked: boolean`.
- `orgApiClient`: `deleteOrg` → `blockOrg` / `unblockOrg`.

## 2026-10-07 — Tracker bug fixes: ADR-0053 compliance and error pulse (B-002, B-003, side-note)

- **Button pulse**: Added `data-[error]` classes to Button (`src/components/ui/button.tsx`).
  Any `<Button data-error>` now pulses with a destructive ring — global error signal.
- **B-002**: Checkout button no longer disabled when cart is empty. Clicking shows an
  inline message + pulse effect instead (ADR-0053).
- **B-003**: Location delete button no longer disabled. Server `DomainError` reaches the
  user as a toast via the existing mutation handler (ADR-0053).
- **Side-note**: Product form error banner moved from top of form to directly above the
  submit button, where it's visible on long forms.

## 2026-10-07 — Tracker bug fixes: admin sidebar nav (B-014)

- Added Product Types and Media to admin sidebar navigation
  (`src/components/layout/AdminSidebar.tsx`). Both pages existed but were only
  reachable by typing the URL directly.

## 2026-10-07 — Tracker bug fixes: Instagram share (B-008)

- Replaced browser `alert()` with a sonner toast in the Instagram share handler
  (`src/components/shared/ShareDialog.tsx`). Also fixed the handler copying a
  relative path instead of the resolved full URL.

## 2026-10-07 — Tracker bug fixes: code cleanup (B-004, B-005, B-006, B-010, B-011)

- **B-004**: Removed debug `console.log` statements and `setTimeout` debug wrapper from
  `src/store/cartStore.ts`. Kept `console.warn` for corrupted-item detection.
- **B-005**: Deleted dead `CartService` interface from `src/domain/cart.ts` (zero imports).
  Not a contract change — the interface was never implemented or consumed.
- **B-006**: Removed scaffolding comments (`ADD THIS`) from `prisma/schema.prisma`
  and Prisma marketing boilerplate. Comment-only — no structural schema change, no migration.
- **B-010/B-011**: Deleted dead `getTopProducts` and `getRevenueChart` functions from
  `server/analytics/dashboard.service.ts`, `dashboard.repository.ts`, and their types
  (`TopProduct`, `RevenueChart`) from `dashboard.types.ts` and `src/domain/admin.ts`.
  Both returned placeholder/zero data and had zero callers. Not a contract change —
  no route handler served these types and no client consumed them.

## [PR-286] 2026-10-06 — FormDialog, dead code, and the docs match the tree

- **FormDialog** (`src/components/shared/overlays/form-dialog.tsx`): the fifth overlay surface
  (ADR-0040) — a bottom sheet on phone, a centred dialog from tablet. Today's 17 raw
  `DialogContent` form sites are ratcheted in `overlay-surfaces.test.ts` with their case;
  a new one fails unless it goes through `FormDialog`, `TaskDialog` or is listed with a reason.
  Mutation-tested.
- **Dead code removed**: `AdminAccessButton` (0 importers), `useStockCheck` (0 importers).
  Two single-domain hooks moved to their component: `useCategoryForm` → `components/category/`,
  `useListingValues` → `components/shared/forms/product/`.
- **Docs corrected**: ARCHITECTURE.md no longer claims every handler uses `toErrorResponse`;
  TESTING.md counts and dead-directory paragraph fixed; OPERATIONS.md local DB recipe uses
  the real Docker container on port 5433 and `.env.example`. Verified dates bumped.

## [PR-285] 2026-10-06 — The aggregate's repository carries the aggregate's name

`admin.product.repository.ts` held every product write while `product.repository.ts` was
read-only. That named the write side for the console instead of for the table it owns.
Swapped: `product.repository.ts` is the aggregate repository (writes), `product.read.repository.ts`
is the storefront read model. Same for category. Export names stay (`productsRepository`,
`adminProductsRepository`) so the 56 import sites change their path, not their code.

The `ADMIN_WRITERS` ratchet in `one-repository.test.ts` is now empty: no `admin.*` file writes,
and the test refuses a new one. The rule that held this together — "an admin listing is a query
on its domain, kept as `admin.*` files" — and the rule that held it accountable — "a write in
an `admin.*` file fails the build" — both hold outright.

## [PR-284] 2026-10-05 — Money, page titles and touch targets through the wrappers

- `shared/Money.tsx` replaces inline `formatCurrency` in table/summary contexts —
  `OrderDetailAside`, `OrdersTable`, `ShipmentsPanel`, `SettleEntries`, `CartsTable`.
- `SectionHeader` gains an `as` prop (`h1`/`h2`/`h3`); 17 portal pages' hand-rolled `<h1>`
  converted to `<SectionHeader as="h1" />` with their description.
- `Button size="sm"` is phone-first: `min-h-10` at base (40px touch target), `md:h-8` from
  tablet. The 36 sites that were 32px on a phone are fixed by the primitive, not per-file.
- Skills refreshed: `/bb-review` gains the listing/channel checks (readiness, facts origin,
  reference data, jobs); `/bb-sdlc`'s Gates touched gains one-repository and the visibility
  census; `/bb-brainstorm` knows about fal.run.

## [PR-283] 2026-10-05 — The listing vocabulary becomes its own domain

`server/catalog/` was 43% of `server/` at 14k LOC. Twenty-three files — facts, product types,
families, channel registry, readiness, listing values, org channels, listing defaults, size labels
— had zero outward imports and formed a clean cluster. They now live in `server/listing/`, the
fourteenth bounded context.

Cross-domain calls go through services: `fact-correction.service.ts` used to reach catalog's
product repository directly for the three methods that rewrite a product's facts; those became
`productService.countProductsWhere`/`listProductFactsWhere`/`replaceProductFacts`. `listing-fill`
reaches `brand.repository` and `category.repository` through catalog's declared public surface.

`module-boundaries.test.ts` gains a `listing` entry in `PUBLIC_SURFACE`; the product-visibility
census, the file-cohesion records and the domain table in root `CLAUDE.md` are all updated.

## [PR-282] 2026-10-05 — The pipeline that decides quality, written down and wired in

A review across architecture, the design system, the rules, the ADRs, the process and the docs
found the same thing from six directions: the guards are strong and voluntary. Nothing ran until an
agent chose to run it, review was self-review, and the owner's decisions lived in specs and in one
assistant's memory. This unit is the process half of the answer; the code halves are PR-279 to
PR-281.

- **Ten ADRs** record decisions that were only spec prose or habit: facts as one JSON column with
  an origin per entry (0051), a product type as a row over facts declared in code (0052), readiness
  advises and never gates (0053, superseding 0045 D3), mappings carry a date and source (0054),
  admin modules read and the aggregate's one repository writes (0055), the ratchet pattern (0056),
  one shared hooks home (0057), media as one aggregate (0058), pixel identity (0059), and route
  handlers with an Origin check instead of Server Actions (0060, correcting 0048's CSRF premise).
  Twelve older ADRs gain Status notes saying which decision a later one amended; 0032's heading
  used an em dash the index generator could not read, so the index showed its filename.
- **Hooks, committed in `.claude/settings.json`.** Every `Edit`/`Write` to source runs the
  scanning gates on the spot (`scripts/hooks/post-edit.sh`, ~5s); a schema edit regenerates the
  client and refuses to pass without a migration folder; a docs or skill edit runs `docs:check`.
  The turn cannot end (`scripts/hooks/stop.sh`) with a failing typecheck, failing related tests, a
  changed wire type without `CONTRACTS.md`, or changed code without a CHANGELOG entry. `git push`
  and `gh` are denied for this repo: the owner pushes.
- **`/bb-build`**, the implementation skill the cycle never had: refuses a Draft TRD, plans units
  from Delivery mapped to R/A/D ids, writes the failing test for each acceptance id first,
  mutation-tests and *records* every new guard, reviews in a fresh subagent, flips spec and TRD
  Status together, and ends with an acceptance report the owner walks on a phone.
- **Five docs gates** for what `docs:check` could not see: a spec and its TRD agree on Status (nine
  TRDs said Draft under Implemented specs), CHANGELOG numbers are unique with the newest highest
  (eight historical collisions stay, append-only), every directory rulebook carries `Covers:` and is
  a living doc (`server/shipping/ARCHITECTURE.md` said `Scope:` and had dodged the date gate since
  August), every npm script a doc names exists, and every API route a doc names exists with that
  verb (README named ~20 that were gone). Each broken on purpose once and seen red.
- Root `CLAUDE.md` re-read against the tree: catalog's "Owns" cell, content's, shared's, the admin
  paragraph, Invariants 5–7 and the cycle corrected; the commit rule and the spec-stays-uncommitted
  rule move out of memory into the file; ten index lines added and the skills table folded into one
  line, so it sits at 195 of its 200.

## [PR-281] 2026-10-05 — Every form field's label reaches its control, and a dropped column says whose data goes

`FormField` rendered a raw `<label>` with no `htmlFor` and never gave its control an `id`, so the
102 fields built on `FormInput`/`FormSelect`/`FormTextarea` had labels a click did nothing with
and a screen reader read as "edit text". It now uses `useId()` and the `Label` primitive, passes
`id`, `aria-invalid` and `aria-describedby` to the control, and the hint and error carry the ids
they are described by. Eleven raw labels elsewhere were given `htmlFor`. `labelled-controls.test`
holds both: render tests that the `for` matches the control and the error is announced for it
(all five fail when `htmlFor` is dropped), and a scan for a raw `<label>` without `htmlFor`
outside `ui/` (red on a planted one).

The variants TRD promised (D7) a migration that copied `sizes`/`colors` into the new shape before
the drop. None did, and the drop shipped. The owner confirmed on 2026-10-05 that both were free text
no reader used and are safe to drop in production too; D7 now says so, dated, and the migration's
header carries the confirmation beside the one it already had for `BiddingEvent`. The rule that
makes this a check rather than a memory: `migration-drops.test` requires every `DROP COLUMN`/
`DROP TABLE` migration to state, with a date, that the data was confirmed disposable — older
migrations are on a dated ratchet. Red when both confirmations were removed from the header.

## [PR-280] 2026-10-05 — Credentials stop at the server, and a mutating request must come from here [CONTRACT]

- **Carrier credentials never reached the browser on purpose and did anyway.** The admin provider
  reads returned whole rows — `authToken`, `tokenExpiresAt`, encrypted `accountInfo` — under a
  comment saying "no sensitive config", and the connect response and its audit record carried the
  live Shiprocket JWT and the encrypted password. Every read that answers a request is now
  `ShippingProviderSummary` with `accountInfo` narrowed to `{ email }`; only the provider's own
  auth path may call `findWithCredentials`. `provider-dto.test` holds the projection at type level
  (red on `authToken: true` in the select, and on a mapper that spreads the row) — the test
  shipping ADR-0002 D3 asked for in August.
- **`User` has one writer.** `admin.user.repository` is a read model; its one write became
  `profileRepository.updateAdminFields`. `orgMember.addMember` had no callers and is gone, so
  `org.repository.createWithOwner` is that table's only writer.
- **A cross-site page cannot mutate anything.** `src/middleware.ts` refuses `POST`/`PUT`/`PATCH`/
  `DELETE` to `/api/**` whose `Origin` (or `Referer`) is not ours, computed the way `appUrl()`
  computes it; `Sec-Fetch-Site: same-origin` is accepted; the signed webhooks and `/api/auth` are
  the named exemptions. The predicate is `src/lib/same-origin.ts`, with 27 cases including the
  forwarded-host deploy and lookalike paths; flipping the comparison fails ten of them.
  `src/lib/csrf.ts`, which nothing called and ADR-0048 cited as protection, is deleted (ADR-0060).

## [PR-279] 2026-10-05 — Stock has one writer, and an admin cannot move an order where the table forbids [CONTRACT]

`ProductStock` had five writers across three domains — checkout's reserve, two restocks, bidding's
lock-and-take, and the admin save, which replaced every row from the form and silently overwrote a
reservation taken mid-edit. `server/catalog/stock.repository.ts` is now the only module that
touches the table, through commands that carry their own guard — `reserve`, `release`,
`restockShipment`, `lockAll`/`takeOne`, `adjust`, `setForImport`, `dropEmptyAt` — and checkout and
shipping call them through `stockService` on their own transaction, the way the sale gate is
called. The admin form sends the quantity it saw (`seenQuantity`, hence [CONTRACT]) and `adjust` is
a compare-and-set: stock that moved answers 409 "reload", which `useServerForm` shows. Bulk import
sets absolute quantities and says so.

Orders: `orderRepository.transition` moves a fulfilment status only where the table allows;
`admin.order.repository` is a read model and its unconditional write — any string, no table — is
gone with `bulkUpdateStatus`, which nothing called. The order transaction's direct `tx.*` writes
moved into named repository methods; `server/checkout/reservation.ts` is what it takes from the
catalogue.

`one-repository.test` now reads every file for `prisma.`, `tx.`, `db.` and `client.` model calls:
no write outside a `*.repository.ts`, no write in an `admin.*` file (two catalogue files ratcheted
with their reason — they are the write path misnamed, fixed by the rename the catalog restructuring
carries), and the two-writer list is empty. Red on a planted `prisma.user.update` in an admin file.
Integration: a stale `adjust` is refused and leaves the row unchanged; delivered→processing is
refused; the order, bidding and shipment suites pass unchanged (ADR-0055).

## [PR-278] 2026-10-04 — develop's new code, brought under the new rules

Merging `develop` into the design branch brought in 35 commits written before ADR-0048 and the
Invariant 5 ratchet existed, and the guards caught exactly that code:

- `src/services/admin/productTypeApiClient.ts` re-created the dissolved `src/services/`. It splits
  into `src/components/product-type/productTypeApiClient.ts` (the console) and
  `src/components/product/listingApiClient.ts` (the product form's listing values and families).
- Three new components called `fetch` themselves (`unmapped-value-row`, `where-you-sell`, and from
  the second merge `not-sold-button`); all now go through
  `src/components/channel/channelsApiClient.ts`, the last with `useMutation`.
- `fact-correction.service.ts` read and wrote products directly. Its queries are now
  `admin.product.repository.ts` methods, and the predicate stays in the service so the preview
  and the update still share it.
- The bulk import's new update-by-SKU path joined the repository move: `listLiveSkus` and
  `importBulk` (creates and full-replace updates in one transaction). The wizard's new "updated"
  count is carried through the shared `useBulkImport` hook.

Numbering: this branch's entries were PR-233 to PR-239 while `develop` reached PR-270, so they are
renumbered PR-271 to PR-277. ADR-0048 to ADR-0050 did not collide.

## [PR-277] 2026-10-02 — Every table is reached through a repository

PR-276's ratchet listed nineteen files calling `prisma.<model>` outside a repository. All of them
have moved, and its allowlist is now empty:

- **Identity:** auth config, the NextAuth adapter's account creation, admin re-reads (still on
  every request, ADR-0021), password and verification tokens, signup, and the profile picture
  now go through `profile.repository.ts`. Callers outside identity use the new
  `accountService`; notifications reaches its token rows through it too.
- **Shipping and checkout:** `Shipment` gets its first repository
  (`server/shipping/repositories/shipment.repository.ts`). The tracking route and the Shiprocket
  webhook call a new `trackingService`. The webhook's order write — the worst entry — is now
  `orderService.markDelivered`, so only checkout writes order state.
- **Catalog:** bulk import, stock check, wishlist availability and the media backfill go through
  catalog's repositories. The allocate route's body became
  `server/checkout/parcel-preview.service.ts`, so the route reaches one domain.
- **Analytics:** the dashboard widgets' reads moved to `server/analytics/widgets.repository.ts`.

The NextAuth adapter is still handed the Prisma client, because the library works that way.

Measuring this found the harder half of Invariant 5. Four tables are *written* by more than one
repository: `ProductStock`, `User`, `OrgMember` and `Order`. Most are a storefront repository
beside an `admin.*` one, which "no admin domain" sanctions and Invariant 5 forbids. That
contradiction needs a decision, not a move. `one-repository.test.ts` gains a second ratchet that
records the four and fails a fifth.

Every query moved with its where, select and include unchanged. Verified with the integration
suite against a freshly migrated local database — 103 tests, the seeded-data suite skipped — as
well as the unit suite.

## [PR-276] 2026-10-02 — Invariant 5 gets the guard it never had

"One aggregate, one repository" was a hard block with no test. Measured today: nineteen files
outside a repository call `prisma.<model>` directly — six route handlers among them, and a
shipping webhook writing `prisma.order`. `tests/unit/one-repository.test.ts` is a ratchet over
them: each entry says why it has not moved, a new direct call fails, and a fixed file must leave
the list. Broken once on purpose to confirm it fails. The webhook entry is marked the most urgent.

## [PR-275] 2026-10-02 — The rules say what the tests check, where the code is written

An audit of the rules and skills against the tests found the server's rules stated where code is
written, and the front end's mostly not: several gates (row-shaped buttons, overlay choice, portal
guards, `cn` registration) had no rule anywhere, and were met only when a test went red. Root
`CLAUDE.md` was also 232 lines against its own 200-line limit, four rules stated twice.

- `src/components/CLAUDE.md` and `src/app/api/CLAUDE.md` are new and load lazily. Each rule names
  the test that enforces it, or says it has none.
- Root `CLAUDE.md` is back under 200 lines: duplicates removed, the repository tree replaced by a
  pointer to `docs/README.md`, and an implementation step that names the directory's rules. When
  a rule, skill and ADR disagree, the newest ADR now wins, instead of the skill.
- `/bb-review`:
  - scopes to the PR-sized unit instead of `main...HEAD`;
  - its mobile-first grep no longer uses a lookahead `grep -E` rejects;
  - its image section describes R2, not Blob;
  - it drops a stale note about `Float` money and adds `slug` to the server-owned fields;
  - it gains front-end layering, portal guards, allowlist edits and mutation-testing a new guard.
- `/bb-sdlc`:
  - drops `<domain>/CHANGELOG.md`;
  - names `lint:boundary` and `docs:check`;
  - matches the commit policy;
  - its TRD template gains a per-form-factor UI section and "Gates touched".
- `/bb-brainstorm` no longer assumes Vercel serverless or offers Upstash (ADR-0037, ADR-0038).
- `docs:check` now scans skills (every path a skill names must exist) and the new `CLAUDE.md`
  files, and fails if root `CLAUDE.md` passes 200 lines.
- Small fixes: `ui-primitives.test.ts` cited the wrong ADR, `server/notifications/CLAUDE.md`
  carried a second, older `Verified:` date, and the empty `src/probe-tmp.ts` is deleted.

## [PR-274] 2026-10-02 — The browser calls our API through one door

Fifty-seven inline `fetch` calls — 49 in 42 components, 8 in hooks — each re-implemented "check
`ok`, read the envelope, parse", and API clients lived in three places under two names. Now a
component renders, a hook holds state, and an API client makes the call (ADR-0048):

- `src/lib/api-client.ts` (`apiRequest`) is the one place the browser calls our API; a failure is
  always an `ApiError` with its field details.
- Every request lives in a `<thing>ApiClient.ts` beside its domain under `src/components/`. Clients
  never toast or navigate. `src/services/` is dissolved into those folders.
- Components call clients through `useServerForm`, `useMutation` and `useAsyncData`. `useAsyncData`
  now hands the fetcher an `AbortSignal` and aborts the stale run, which `useDebouncedSearch`
  builds on for the two product pickers.
- `tests/unit/api-clients.test.ts` enforces it with no allowlist: every site was classified first
  and none needed to own its request. Each of its four rules was broken once to confirm it fails.

Defects closed by the move: the cart's stock check parsed an error body as stock rows; both
checkout stock checks did the same and crashed; two search pickers let an older reply overwrite a
newer one, and ignored failures; the media sheet could show one asset's details on another; the
bulk wizards rebuilt their error and dropped its details; `orgService.createOrg` threw on its own
error path; the shipping-provider client checked `!response` instead of `!response.ok`; four
components read the envelope by hand; three hand-rolled forms (`CommercialTerms`, both
`BidLadder` dialogs) dropped field errors and now use `useServerForm` with their existing schemas;
the shipment-tracking schema moved out of its route into `src/lib/validation/schemas/` so its form
can share it.

Review of the conversion found one regression it had made reachable: a payment-order refusal with
field details left checkout on "Processing" with the Pay button disabled. Fixed, with
`tests/unit/checkout-payment-errors.test.ts`, seen to fail without the fix.

## [PR-273] 2026-10-02 — Three form factors, and the tablet gets the image it shows

The breakpoints now have meanings (ADR-0050): phone at base, with `sm:` only refining it;
tablet from `md:`; desktop from `lg:`. Tailwind's defaults, not a custom scale. Scripts read
the same two queries from `FORM_FACTOR_QUERY`, and `useIsDesktop` — which matched at 768px,
the tablet — is now `useIsTabletUp`. `video-player.tsx`'s second copy of that query is gone.

`tests/unit/form-factors.test.ts` requires every hand-written media query to name a declared
breakpoint, and its first run found a real defect. The product gallery's image hint said
half-width from 768px and a third from 1200px; the page is full width until `lg` and half the
72rem column after. A tablet was downloading every gallery image at half the size it showed
it. The hint is now declared once as `GALLERY_SLIDE_SIZES` and shared by the gallery, the
video poster and the YouTube thumbnail, which had copied the same string.

## [PR-272] 2026-10-02 — Colour is a palette the themes pick from

`globals.css` spelled out 52 colour values across 152 declarations, the warm charcoal ink seven
times. They now live once, in a primitive palette (`--emerald-550`, `--charcoal-220`, …) at the
top of the file, and every semantic token in every theme is a `var()` to one of them
(ADR-0049). Every declaration resolves to the value it had before — checked one by one — so
nothing on screen moved. The near-duplicates the repetition was hiding are now visible as
`-soft` twins, left for a deliberate design pass rather than merged here.

`tests/unit/design-tokens.test.ts` guards it: no raw colour outside the palette, no unused
primitive, and no file in `src/` naming one. Each was broken on purpose once to confirm it fails.

## [PR-271] 2026-10-02 — The orders table is handed the row it shows, not the order

`OrdersTable` was typed by `@prisma/client`'s `Order`, so the admin orders page sent every column
of every order to the browser to render seven of them. The boundary test missed it twice: it
looked for the Prisma *client*, never `@prisma/client`, and it exempted type-only imports — an
exemption written for imports between server domains (ADR-0033 D5), where a type really is just
a type.

`adminOrderService.getOrders` now returns `AdminOrderRow` (`server/checkout/admin.order.types.ts`),
and `OrgLocation` moved out of the repository into `server/catalog/org.address.types.ts`, which
three components were importing it from. The component rule in
`tests/unit/module-boundaries.test.ts` now forbids `@prisma/client` and repositories outright,
types included — broken on purpose once to confirm it fails.
## [PR-270] 2026-10-04 — A dev catalogue shaped like the real one

The seed was broken and the dev database could not exercise any of the listing work. Both fixed.

**`db seed` had failed since the media library landed.** Six models point at a `MediaAsset` with
Restrict and none of them was in the teardown, so clearing the database threw on the first org.
An asset also points at the one it was derived from and at its poster, so the self-references are
cleared before the set goes.

**The seeded categories now carry a product type.** The live catalogue's types were assigned by a
migration keyed on its own slugs, which a seeded database does not have — so locally every
category asked nothing and the whole vocabulary looked broken while working in production.

**The catalogue is now shaped like the real one**: ridas with four children — formal, semi-formal,
casual, ohbat — that share one product type. That is the case worth having in dev, because nothing
else shows as plainly that a browsing category is not a question set.

Three products exist to make a surface reachable: a rida answered in plain `nida`, which Flipkart
has no word for, so the worklist is not empty; a half-answered rida, because a catalogue where
everything is complete never shows what incomplete looks like; and a masalla bag, whose type is
decided against, so the "not sold here" list is not empty either.

Every seeded answer is checked against the vocabulary a migration ships —
`tests/integration/seed-vocabulary.test.ts`, mutation-tested four ways. Writing it caught two
values I had invented: `plating: 925-silver` and `shape: rectangle`, where the real keys are
`sterling-silver` and `rectangular`.

**And a test that was eating reference data.** `channel-readiness-service` used the real values
`maroon` and `ochre` as fixtures and deleted them in its teardown, so every full-suite run removed
the platform's own seeded mapping for maroon. The same class of fault as the billed-operations
instrument in PR-257: a suite quietly spending something it did not own. Its fixtures are now
stamped and collide with nothing.

## [PR-269] 2026-10-04 — The channel contracts, recorded [CONTRACT]

Found by running `/bb-review` over the thirteen commits: the TRD said `[CONTRACT]` and that
`CONTRACTS.md` would move in the same PR. It never did, and no entry carried the flag.

Three shapes cross the boundary — a shop's channel choice, a value mapping, a not-sold decision —
and they are now recorded with the reasoning that is easy to lose: the channel set is sent whole
so silence is never read as "off", `theirValue` is free text because it is somebody else's
vocabulary, and both register writes upsert so a repeat is a correction rather than a duplicate.

**And one the TRD promised that does not exist.** It anticipated a readiness DTO per product and
channel. Building it showed a route handler would be a round trip for a read the server already
does, so readiness is computed and rendered server-side and never crosses the wire. Recorded as
an absence with its reason, because a contract document that lists a shape nobody sends is worse
than one that is merely incomplete.

The review also caught a numbering collision — the owner committed PR-266 between two of mine and
I reused the number — and a commit that shipped with no changelog entry at all. Both corrected in
PR-268 above.

## [PR-268] 2026-10-04 — How much of the catalogue each channel would take

The last of the channel registry's delivery list, and the spec moves to Implemented.

**A count per channel above the product list, not a column on it.** The list pages and refetches
on the client, so a per-row verdict would be blank on page two unless it travelled through a
route handler — a round trip for a read the server already does. The number answers the question
a shop has, which is how much is left; the product page already says what.

**The register is read for every product type at once** rather than once per type, so a catalogue
of nine types costs what one does. Budgeted exactly, and watched going from 5 queries to 14 when
the read was moved back inside the loop.

Numbering correction: this entry and the one below it were first written as a second PR-266,
colliding with the entry above. Both are same-day and unpushed; what happened is unchanged.

## [PR-267] 2026-10-04 — Not sold here, on purpose [MIGRATION]

The register could not tell a decision from a blank, so it listed 18 masalla bags as work to do.

Combos sell on this store only — the owner's call on 2026-10-04 — and that was recorded by
writing no mapping. But no mapping is also what *nobody has chosen yet* looks like, so the
worklist named a settled question every time it was opened. A to-do list that keeps telling you
to do something you have already done is a list that stops being read, which costs more than the
one entry it was wrong about.

**A third answer to the same question.** Where does this type go on this channel — their word for
it, the nearest they have, or nowhere. All three sit on the category mapping and obey the same
kind precedence, so a type can be not sold while one kind of it is. A database CHECK keeps a row
from claiming both a category and none; a second table would have been a second copy of
`categoryFor`, which is already tested.

**Listed, not hidden, and reversible from where it is read.** Marked types move into a "Not sold
on X" section beside the nearest-fits, with the button that undoes it on the row itself. Hiding
them would have traded a nagging list for a decision nobody could find again — the worse of the
two problems. Undoing deletes the row rather than blanking it, so the type reads as undecided
again and the choice is genuinely back.

A product whose type is not sold on a channel simply does not appear for that channel in the
readiness panel — the same silence as a channel the shop never enabled, rather than a ready
verdict that reads as an invitation.

The decision itself is now data: one row per publishable channel for `combo`. Four mutations were
watched turning the guards red, including one that only a direct caller of the pure function can
reach — `readinessByChannel` filters those channels out first, so the guard inside it had no test
until the mutation said so.

## [PR-266] 2026-10-04 — Every hero piece on the home page, loaded as you scroll

The home page showed the six newest `HERO` products and silently dropped the rest. It now shows
all of them: nine on first paint (three rows of the phone grid), then the rest through the same
`PaginatedProductGrid` and `/api/products` route every other listing uses, via a new `heroOnly`
filter (`?hero=1`). The section is hidden when there are no heroes. `productsDAL.getHeroProducts`
is gone — nothing called it any more.

## [PR-265] 2026-10-04 — How this would list elsewhere, on the product itself

The readiness panel, on the org's product page. Per channel: the band, where it would be listed,
and every reason it would not go cleanly — in the shop's words rather than the schema's.

**It advises and never gates** (D10). Nothing is disabled and nothing is refused. The panel says
so in as many words: *"if a channel disagrees with us, it is the channel that is right."* We have
never watched a publish succeed, so the gate's idea of required is untested, and the panel is
honest about being a prediction rather than a verdict.

**A shop selling nowhere else sees nothing at all** — not an empty panel, no panel (spec A6).
Channels are off until a shop says otherwise, so this is most shops until they opt in.

A nearest fit reads as what it is, with its note, every time rather than once: *"This is the
nearest they have, not their own word for it. Flipkart has no rida node…"*. An unmapped value says
what it costs to fix and that fixing it once serves every product that shares it, which is the
same sentence the register's worklist is built on.

A read, so a server component does it and no route handler exists for it: a client fetch here
would be a round trip bought for data the server already had ([ADR-0034](adr/0034-render-on-the-server-by-default.md)).

## [PR-264] 2026-10-04 — The register, and a worklist that shortens

The platform owner's screen: what each channel has mapped, and what this catalogue still needs
decided. `/admin/channels`, one page per channel.

**Both worklists are built from what products actually answer, never from the vocabulary.** There
are 186 colours in the list and 35 on Flipkart; mapping the other 151 before anybody sells one is
work with no buyer. A value arrives on the list when a product answers it, carries how many
products share it, and leaves the moment a decision is recorded — which is what makes a long job
finite rather than endless (spec A3, the fourth hazard).

The same row corrects a mapping that already exists. Everything seeded over the last few commits
is a starting point, not a fixture: `setValue` upserts on the natural key, so recording a
different word is a correction rather than a second mapping, and the owner's rows carry
"Decided in the channel register" where the seeded ones name a template and a date.

**One field and one button per row, deliberately.** A single form saving the whole list would
make a long job all-or-nothing, when the point is that it can be done a few at a time.

A second list names product types that sell here and have no category on that channel — which is
how a newly added type surfaces without anybody remembering to check.

Nearest fits are listed apart from both, because they are not work. They are decisions already
taken, shown with the note every affected product keeps displaying (D6, D12).

Audited: a mapping decides where somebody else's listing goes, so recording one writes to the
admin trail ([ADR-0021](adr/0021-audit-trail-never-fails-the-action.md)).

Five mutations of the worklist were each watched turning its guard red — including a mapped
category still reading as unmapped, which the first pass did not catch because the test only ever
asserted the negative. The positive assertion came from the mutation, not the other way round.

## [PR-263] 2026-10-04 — What Google asks for, read rather than remembered [MIGRATION]

Google's and Meta's attribute mappings, from Google's own product data specification fetched on
the day. Reading it rather than recalling it changed the answer, which is the whole point of
[ADR-0046](adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md).

**From memory this would have marked `gender`, `age_group` and `size` required for apparel.** The
specification says they are required only for products targeted to **Brazil, France, Germany,
Japan, the UK and the US**. This shop sells in India, so Google asks for none of the three. A gate
built on recall would have told a seller to answer three questions nobody was asking.

**What it does require, country-independently, is `color` for free listings on every Apparel &
Accessories product.** Six of the eleven nodes this shop maps to sit under that branch — clothing,
pants, socks, scarves, rings and handbags — and five do not: perfume, incense, religious items,
backpacks and toiletry bags. So the same fact is required on some nodes and optional on others,
which is the per-node key from PR-262 earning itself a second time.

**A channel can now say its field takes any text.** Google's colour, material and pattern are free
text; Flipkart's are closed lists of 35, 140 and 56 words. Without somewhere to record that, the
gate reported every colour as having no Google equivalent — on a channel that needs no equivalent.
`freeText` on the attribute mapping says so, and it is a property of the channel's own field, which
is where it sits.

**Meta carries the field names and nothing required.** It accepts Google's RSS namespace so the
names hold, but Meta's own specification has not been read. Marking its fields required would be
claiming knowledge we have not checked, so Meta can warn and will never call a product incomplete
— honest about what has been verified rather than tidy.

Absent on purpose: `condition`, a constant until this store sells anything used; `item_group_id`,
which is the family and is derived; `gender` and `age_group`, which the audience fact answers in
the adapter the day a target country needs them.

A black nida rida now reads warned on Google and Meta and incomplete on Flipkart, where `nida` is
still unmapped — Flipkart spells it "Nida Matte", which is one decision for the owner rather than
a guess for the code.

## [PR-262] 2026-10-04 — What Flipkart calls our facts and our answers [MIGRATION]

Sixty attribute mappings and 474 value mappings, derived from the twelve template workbooks
rather than typed, so a mapping cannot claim Flipkart asks something it does not.

**An attribute mapping is now keyed by their node, not our product type.** Found while seeding,
before a single row existed. Flipkart's `bag` asks Number of Compartments and Waterproof;
`sling-bag` and `hand-messenger-bag` carry neither field — and all three are our `bag`. Keyed by
our type, a sling bag would have been told to answer a question Flipkart never asks, which is the
readiness-that-disagrees-with-the-channel hazard the spec names second. One template file per
node is also how the data arrives, so the table now has the shape its source already had.

`material` is seeded as "Fabric" on cloth nodes and "Material" on the rest — one question, two
names, which is what a per-node key makes expressible.

**Thirty-three mandatory Flipkart fields are deliberately absent**, and the migration lists each.
`Type` (mandatory in eleven nodes) is answered by the product's kind, and `Size` by the stored
measurements — both derived by the adapter, never asked of a shop. `With Hijab`, `Features`, the
five Diamond grades and the kids' age bands are channel extras the shop cannot answer by looking
at the product, so they belong to the adapter's own schema. Neither group is a gap: a fact is
admitted because a shop can answer it, never because a platform asks.

**468 values matched exactly; 366 did not and carry no row.** Our vocabulary is the union of what
Flipkart and Meesho permit, so a colour Meesho has and Flipkart does not is expected. Nothing is
guessed — "Baby Pink" is reported as having no Flipkart word rather than quietly listed as Pink.
Six more were mapped by hand where only the wording differs (their waist rise drops the word
"Rise"), recorded under their own `checkedSource` so a reader can tell which rows a person decided.

Walked end to end against the seeded register: a fully answered rida reads warned on Google and
incomplete on Flipkart, naming its nearest-fit category, one unanswered optional fact, and one
unmapped value — `nida`, which Flipkart spells "Nida Matte". That is one decision serving all 36
ridas, and the worklist is where it belongs.

Google's attribute mappings are **not** seeded. Its taxonomy was fetched and read; its product-data
specification was not, and seeding required fields from memory is the thing ADR-0046 forbids.

## [PR-261] 2026-10-04 — Where each thing is listed on Flipkart, Google and Meta [MIGRATION]

Forty-four category mappings, seeded as a data migration because without them the register is
empty and every product reads as having nowhere to go. The owner's calls, taken 2026-10-04.

Google's node ids come from its published taxonomy, fetched on the day and named in every row's
`checkedSource`. Flipkart's come from the template workbooks downloaded on 2026-10-01. **Meta
carries Google's values as its own rows** rather than sharing them: they are two channels that
agree on categories today and already disagree on values — Google writes `in_stock`, Meta
`in stock` — so separate rows are what let one move without the other, with no code change.

**Two of them stopped being compromises.** Flipkart's `trouser` node has a mandatory `Type` field
whose values include "Palazzos", and its `mat` node's `Type` includes "Prayer" — so a palazzo and
a prayer mat are exact matches, not nearest fits. The category is never the only slot a channel
gives you, and reading the permitted values rather than the field names is what showed it.

**Six are nearest fits, each with a note shown on every product it touches.** A rida has no node
on Flipkart and is listed as an abaya; bakhoor is neither perfume nor incense stick and goes with
incense; Google has no node for Islamic outerwear, so Clothing is its nearest parent.

**The inferred one is marked inferred.** Flipkart has an attar category whose template was never
downloaded, so its slug and required fields are unverified. It is seeded as a nearest fit whose
source reads "Inferred. No template obtained." rather than left out — the product still publishes,
and the note is visible every time until the sheet arrives.

**Combos are deliberately absent.** Gift, prayer and masalla sets sell on this store only. No row
is the truth about that rather than a gap, which is why a test asserts it rather than ignoring it.

A consistency guard checks every row names a product type and a kind that exist, that every
nearest fit carries a note, and that Meta has not drifted from Google. Six mutations of the seed
were each watched turning it red, including a combo appearing and a rida quietly moving.

## [PR-260] 2026-10-04 — Readiness advises; it never gates

Owner's decision, taken before the panel was built and while it still cost a rename. Nothing in
the channel registry refuses a publish, and nothing disables a control.

The reasoning is the spec's own second hazard, read in the direction it was not read the first
time: readiness that disagrees with the channel is worse than none — and it will disagree in
**both** directions until publishing has actually been watched. "Required" here is our reading of
a downloaded template, not something seen to fail. Refusing on it would stop listings that would
have gone through, and the rejection we would need in order to learn better is exactly the one we
prevented. A listing that goes and comes back refused teaches us something; one we never sent
teaches us nothing.

**The band is renamed `blocked` → `incomplete`.** If we never block, `blocked` is a name that
lies, and a lying name is an invitation to wire a refusal in later and call it consistent. The
three bands are kept, because the severity is real advice — "they mark this compulsory" is
different from "this is our nearest guess at a category" — but they now say what we expect the
channel to think, never what we will do about it.

A gate may still be right. The evidence for it will be real rejections, and there are none yet.
Recorded as D10, replacing a draft that refused with a `DomainError`; R7 and A2 move with it.

Costed nothing but a rename because the readiness panel had not been built — the pure function
and the register reads were in, with no caller that could have refused anything.

## [PR-259] 2026-10-04 — Where you sell, on the page that already asks what you sell

A "Where you sell" section on the org's listing screen: one row per channel, a switch, and a
sentence saying what turning it on actually buys. This storefront is not among them — a shop does
not opt into the place it already is.

Without this the registry was inert. Channels are off by default and nothing could turn one on,
so readiness could never appear anywhere, which made the rest of the feature undemonstrable.
That is why it comes before the readiness panel rather than after it.

**Off is a complete answer, and no row is written to say so.** A shop that has never been asked
reads as selling nowhere else rather than as having declined — the difference matters the first
time a channel is added to the set, because silence must not become a decision taken on the
shop's behalf.

**A channel the request does not mention is left alone, never switched off.** The form sends what
it showed; treating silence as "off" would turn off whatever a later release adds the moment a
page loaded before it posted.

Turning one on buys exactly one thing today: this shop starts hearing whether its products are
ready for that channel. No credential is asked for and nothing is sent anywhere.

## [PR-258] 2026-10-04 — The register, read: what a channel says about a product

The reads behind the gate. Two repositories and a service that assembles them into the shape the
pure function already takes, so every judgement stays where it was tested.

**The three maps are one repository**, because a register is a category, its attributes and their
values together and nothing reads one without the others. The shop's own enablement is a second
repository: the maps are the platform's dictionary, shared by every shop, and `OrgChannel` is one
shop's choice. They are written by different people for different reasons.

**The register is read per product type, not per product.** A listing screen asking per row would
read the same dictionary once per row; the type is what the mappings are keyed by, so products
are grouped by it and each group costs the five queries one product would. Asserted as an exact
query count, not a bound — and the count was watched going from 5 to 122 when the read was moved
inside the loop.

**A catch-all category mapping cannot go through `upsert`.** Prisma's compound-unique input will
not take a null, because a unique index does not constrain NULLs — so that one path matches by
hand, with the partial index from PR-255 as the real guard: a concurrent second create fails
there rather than quietly becoming a second answer. Correcting one twice makes one row, which is
checked against Postgres rather than reasoned about.

A mapping naming a fact this codebase no longer declares is ignored rather than cast through, so
a dictionary outliving a renamed fact degrades to silence instead of a wrong attribute.

## [PR-257] 2026-10-04 — The billed-operations budgets were measuring nothing

Found while writing a budget for new code. Every assertion in
`tests/integration/db-ops-budget.test.ts` is an upper bound, and the instrument behind them was
counting zero — so all eight read `expect(0).toBeLessThanOrEqual(n)` and could not fail.

The cause is import order. `PRISMA_LOG_QUERIES` has to be set before the Prisma client is
constructed, because the query event listener is attached at construction. The suite sets it at
the top of the file, but `tests/helpers/test-db.ts` imported the client at module scope, and an
import is evaluated before any statement in the file importing it. Asking whether a database is
disposable was enough to build a client that would never report a query.

The helper now reaches the client through a lazy accessor, and the budget suite's first test
asserts the instrument is live before any budget is checked. An upper bound over a dead
instrument is an assertion that cannot fail, which is worse than no assertion.

The budgets themselves were honest: with real counts, all eight still pass unchanged. What was
missing was the enforcement, not the performance — a query regression at any point in the last
two months would have gone through.

## [PR-256] 2026-10-04 — Whether a product could be listed, answered without asking anyone

The channel registry's gate, as a pure function with no caller yet. It takes the product's stored
facts, the channel's three mappings and what that channel calls required, and answers in the three
bands the TRD names: blocked, warned, ready.

**A nearest-fit category warns rather than blocks.** Blocking it would make this store's largest
line unlistable — a rida is 36 of 94 products and has no exact node on either marketplace. The
point of recording the fit was never to stop the listing; it was to show the shop, every time,
what it will be listed as and why, instead of approving it once and forgetting.

**A value the channel has no word for blocks, and is never guessed.** Google and Meta are the
closest pair in this space and still disagree on values; a tool that guessed would be wrong at
exactly the rate its guesses looked plausible. So an unmapped answer blocks that channel only,
and the worklist is keyed by value rather than by product — one mapping for "maroon" clears every
product that answers maroon, which is what keeps a long job finite rather than endless.

**Every problem is reported, not the first.** A shop fixing one, saving, and only then learning
of the next is the slow loop this phase exists to shorten.

An absent `OrgChannel` row is off, and a shop that has enabled nothing is asked nothing and warned
about nothing. A stored key that is no longer a declared channel is dropped rather than honoured,
so the `instagram` → `meta` rename cannot re-enable something nothing can publish to.

Purity is the point: twelve mutations of the rules were each confirmed to turn the suite red.
`fill-facts` now exports its rule for what counts as blank, because a second spelling of it is how
a fact comes to be answered in one place and missing in the other.

## [PR-255] 2026-10-04 — The channel set, declared, and the four tables under it [MIGRATION]

The channel registry's first piece. No behaviour changes: this is the vocabulary and the storage
the rest of [channel-registry](specs/channel-registry/) is built on.

**The channel set is now the real one.** `instagram` is gone and `meta` replaces it — one feed
serves Facebook and Instagram — and `google` and `meesho` join. Each channel now carries its kind
([ADR-0041](adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)), which is what decides
whether it gets a feed or the full marketplace machinery.

**A channel is declared in code, not stored as a row.** This corrects the spec's D1, which said
the opposite when it was committed yesterday. Reading the code settled it: a channel does nothing
until it has an image rule, a readiness rule and an adapter, all three of them code — so a row an
admin could add would be a row that sits there inert. What a *shop* chooses is data, and that is
`OrgChannel`. The TRD now says so; the entry above, written before, does not.

**One label, not two.** `onboarding-card.tsx` carried its own copy of the channel names beside
the one in the server types. Two spellings of one closed set is the drift Invariant 5 exists for,
and this set is the one every adapter, mapping and readiness answer keys on.

**Four tables:** `OrgChannel`, and the three maps — category, attribute and value — each keyed on
the channel plus what it maps, and each dated with what it was checked against
([ADR-0045](adr/0045-channel-mappings-are-versioned-data.md)).

**A partial unique index closes a hole that would have shipped.** `ChannelCategoryMap.kind` is
nullable, meaning "every kind of this type", and NULLs are distinct to a unique index — so the
declared `@@unique` permitted two of those for one channel and type. That is two answers to which
of their nodes a product publishes to, settled by whichever row the query returned first. Prisma's
schema language cannot say the rule, so the migration does, and a database test mutation-tested
against each of the four constraints is what keeps it honest.

Also fixed, on contact: `enhancement-settings` asserted absolute usage counts against a shared
dev database, so it passed the first run and failed every one after — it read 11 for a month it
had put one run into. It now measures the change it causes.

## [PR-254] 2026-10-04 — The channel registry, specified

What each selling channel is, what it calls the things this shop sells, and whether a product is
ready to go there. It publishes nothing: it is the dictionary and the pre-flight check that
`shopfront-feeds`, `channel-connectors` and `marketplace-publish` all need first, because none of
them would otherwise know what to send.

Most of it records decisions already taken rather than making new ones —
[ADR-0041](adr/0041-a-channel-is-classed-by-where-the-sale-completes.md) for what a channel is,
[ADR-0045](adr/0045-channel-mappings-are-versioned-data.md) for mappings as versioned data. Four
decisions are this spec's own.

**Three mapping tables, not one.** Category, attribute and value are filled at different times
and by different effort, so a shop can publish with categories mapped and values half-done, and
the gate says exactly which values are missing. One table would have made the job all-or-nothing,
which is how a mapping job never finishes.

**Readiness answers in three bands** — blocked, warned, ready — so a half-mapped register still
reports usefully rather than refusing everything.

**A nearest fit is a warning every time, not an approval once.** This store's largest line is the
case: a rida is 36 of 94 products and has no exact match on either marketplace. Shown once and
accepted, the mapping would then apply silently to every later product, including ones it suits
far less.

**The gate never disables a control**, per the owner's standing preference: the publish action
refuses with a message naming what is missing, through the error envelope this project already
has. A disabled button explains nothing.

D12 records what the owner closed today: a nearest fit is the **platform's** decision, shown to
every shop it affects. Choosing that a rida lists as an abaya is a commercial judgement, which
argued for the shop — but one mapping serves every shop selling that type, so a seller's choice
would silently change another's listings. It reopens the first time two shops want different
answers.

## [PR-253] 2026-10-04 — Where a value came from, and correcting it where it came from [MIGRATION]

The last two pieces of [inherited-facts](specs/listing-vocabulary/inherited-facts/). The fill
step has been recording which level answered each fact since PR-227; nothing showed it and
nothing acted on it.

**The form now says so.** A value filled in from the family, the brand or the shop's defaults
carries "from your brand" beneath it, and stays editable — editing makes it the product's own.
Only inherited values get the note: an answer marked as the product's own is the shop's, and
saying where it came from would be saying "from yourself".

**A correction at brand or family level offers to correct what took its answer from there.** The
preview says how many will change *and* how many are left alone, because the second number is
the reassurance — a product somebody deliberately edited keeps its answer. The preview and the
update are one predicate evaluated twice, so a shop cannot confirm one figure and have a
different set change.

**A column was missing and the typechecker could not see it.** `Product` had no `brandId`: a
brand answered what a product left blank at save time and was then forgotten, so a brand-level
correction would have matched nothing and reported zero — working, silent, useless. It survived
review because the `where` clause built it through an object spread, which TypeScript does not
check for unknown keys. Found by reading the schema rather than trusting the build.

`Product.brandId` is `Restrict`: a brand is retired rather than deleted, and a retired brand
still answers for the products that named it.

The correction reaches archived products deliberately, which the ADR-0029 census now records: an
archived product keeps the answer it inherited and can be restored, so skipping it would bring it
back carrying a value its brand has since corrected.

Mutation-tested three ways — ignoring the stored origin, letting the preview and the update
diverge, and marking a corrected answer as the product's own each turn it red. The first attempt
at the divergence mutation was logically equivalent and passed; it was rewritten until it
actually diverged rather than recorded as caught.

## [PR-252] 2026-10-04 — `sizes` and `colors` are gone, and bidding stops naming a variant [MIGRATION]

The two columns this whole phase replaced. They were free text: a colour typed three ways was
three colours to a marketplace. A colour is now chosen from a list and stored by its key, and a
size is derived from stored measurements rather than typed.

Dropped in a **later** migration than the one that replaced them, which is
[variants](specs/listing-vocabulary/variants/) D8 — if the new shape had read something wrong,
the old data was still there to re-read. Nothing had read either column since the product form
and the bulk sheet stopped offering them.

**Bidding was the last reader, and its rule is obsolete rather than broken.** An event named
exactly one item, so a product with options could not be auctioned without saying which. Every
colour is its own product with its own stock now
([ADR-0043](adr/0043-a-variant-is-a-product-in-a-family.md)), so "a product with options" no
longer exists: the guard could never fire and `BiddingEvent.size`/`color` could never be filled.
The step is gone from the form, the fields from the payload, and the columns from the table. The
owner confirmed production holds no bidding events, so nothing recorded is lost.

**Checkout lost a check it could no longer answer.** It refused a cart line naming a size the
product never offered. With no options list there is nothing to check against — the product *is*
the choice. The order line still records which size and colour were bought, and that record
stays: an order is history and never loses what was sold
([ADR-0020](adr/0020-money-bearing-records-never-cascade.md)). Only the validation went.

Worth being plain about what this costs: a cart line's `size` and `colour` are now recorded as
given, unchecked. They are vestigial for anything listed under the new model, and the honest
place to remove them is whenever `order-and-cart-lines` is next opened — not in a migration that
would rewrite order history.

## [PR-251] 2026-10-04 — A sheet row with a known SKU updates the product

The `sku` column's note has said this since PR-249; now it is true. A row whose SKU matches a
**live** product of this org replaces it, and anything else creates one. `planProductRows` says
which is which, so a person sees it before confirming — and the wizard reports both numbers,
because they are not the same event: a wrong create leaves a product to archive, a wrong update
has overwritten something.

Three things an update does deliberately. It **keeps the slug**, which is frozen at creation
because changing one 404s every link to the product. It **replaces the gallery and the stock**
rather than adding to them, the same semantics the admin form's edit has. And it **still refuses
an archived product's SKU**: an archived product holds its code, and an import must never
silently restore one.

That last rule is now the only SKU conflict left, which meant rewriting the all-or-nothing test.
It had doomed its row with a duplicate SKU — a legal update now — so it dooms with an archived
one instead, which is the real remaining case.

Mutation-tested three ways: regenerating a slug on update, adding media instead of replacing it,
and treating a live SKU as a conflict again each turn it red.

## [PR-250] 2026-10-04 — The bulk import reads the vocabulary, and two silent bugs with it

The sheet grew its question columns in PR-249; nothing read them. `bulk-vocabulary.ts` now turns
what a row said into what a product stores, and the import writes `productType`, `kind`, `facts`
and `measurements` alongside everything else. `sizes` and `colors` are gone from the row shape —
the sheet stopped offering them a PR ago.

A **label** becomes a **key**: the dropdowns offer "Maroon" and the product stores `maroon`,
because renaming a colour must not rewrite products. A key typed directly is accepted too, since
a sheet round-tripped through an export carries keys and refusing one would punish whoever did
the tidier thing. An answer matching nothing is kept as flagged free text rather than dropped —
a shop's data is not ours to discard for not fitting a list written afterwards.

A row is only asked what its type asks: an answer for a fact the type never asks is dropped
rather than stored, since it would answer a question this product was never put. The type comes
from the row when it names one — that is what lets one workbook span several — and from the
category otherwise. A row naming a type its category does not resolve to is **refused**: that is
the one case where guessing would publish a product under the wrong marketplace category.

A family named in the sheet is created once and reused by every later row naming it, so four
colours of one abaya arrive as four rows and one family.

**Two silent bugs, both found by tests rather than by the compiler.**

`sheet.ts` lower-cases every header, and fact keys are camelCase — so `sleeveLength` arrived as
`sleevelength` and a direct lookup dropped it. **Every camelCase question would have imported as
blank**: sleeve, pack quantity, scent family, waist rise. Only all-lowercase ones like `colour`
worked. Matching is case-insensitive now.

`categoryRepository.listTree()` returned `(id, parentId, slug)` and nothing else, so
`resolveProductType` walking it found no type on any node — **every bulk-uploaded product would
have been untyped**, which looks exactly like a catalogue nobody has typed yet. The tree carries
`productType` now. Both were mutation-tested after fixing: reintroducing either turns four tests
red.

## [PR-249] 2026-10-04 — The bulk sheet is built from what exists, not from a template

The sample sheet's columns came from a hard-coded list that still read `sizes` and `colors` — the
two the whole phase replaces. They now come from the product types the sheet is generated for,
its dropdowns from the permitted answers in the database, its stock columns from the org's real
locations and its category examples from current slugs.

**Nothing in it is fixed**, which the owner asked for and which matters more than it sounds: a
template written down once goes stale the first time a type or a colour is added, and the drift
is invisible until somebody's upload is rejected for a column that no longer exists. A test gives
the builder a `footwear` type this codebase has never seen and asserts its columns appear.

One workbook spanning several types — Amazon's shape rather than Flipkart's and Meesho's
one-sheet-per-category, so an org listing bags and attar fills one file rather than two.
`?types=a,b` narrows it; omitted, it spans every live type. A `Types` sheet says which columns
belong to which type, and the notes carry each type's own wording — cloth is asked its Fabric.

**A measurement column names its unit, because one measure takes two.** `length` is inches for a
garment and centimetres for a mat, so a single `length` column across both would mean two things
and the person filling it would have no way to tell which. They are separate columns and a row
fills the one its type uses. Checked against the real rows rather than assumed: six types declare
`length`, in two different units.

The sheet also now says that **a row whose SKU matches an existing product updates it** — the
import side of that is the next PR; the column and its note come first so the sheet is not
promising something before it exists.

**A bug found by reading the file rather than the code.** Applying the dropdowns materialises
every row down to 500, so `addRow` appended the two example rows at 501 — below five hundred
blanks, where nobody opening the sheet would ever see them. The examples are written first now.
It compiled, it passed every column test, and it was only visible by generating a workbook and
looking at row 2. `tests/unit/bulk-sheet-build.test.ts` builds one and reads it back, so the
regression is caught; verified by re-introducing the ordering and watching it go red.

## [PR-248] 2026-10-04 — A family can be made, which is what variants was waiting for

`ProductFamily` existed since PR-229 with nothing creating one. The owner's correction is why
this came first: *"my father will list his first variant as soon as this feature lands."*

`productFamilyService` makes a family from a category, which is where its type and its axis come
from — the same walk the product form does, so a family asks what its members will be asked. The
axis is **copied rather than referenced**, so reordering a type's declaration later cannot
silently regroup a shop's products. A family for a category with no type is legitimate and
carries no axis: the siblings still share a description even where nothing has named what makes
them differ.

The picker sits on the product form with **"On its own" as the default**, because that is the
normal case — one abaya in one colour is one product, and nothing asks a shop to declare a family
of one. A new family is made without leaving the form, since the moment one is wanted is the
moment a second colour is being listed.

**"Products" is two numbers now** (variants D6). The stats tile already said "Available" rather
than "Total", which avoided one ambiguity; it now reads "in 20 families" beside it once any
exist. Twenty abayas in five colours is twenty families and a hundred sellable things, and a
figure that does not say which it counts is the ambiguous one.

`POST /api/org/[orgId]/families` is under `/api/org`, not `/api/admin` — a family belongs to a
shop. `productType` and `variantAxis` are absent from its payload deliberately: both are resolved
from the category, so a request cannot group products by a fact their type never asks about.

Nine tests, mutation-tested three ways — referencing the axis instead of copying it, dropping the
org scope, and accepting a blank name each turn it red.

**One of those mutations poisoned the suite**, which is worth recording. The axis test mutated
reference data every other test reads and restored it on the line after the assertion — so when
the assertion failed, the restore never ran and two more tests failed for a reason that had
nothing to do with them. The restore is now in a `finally`, and that was verified by breaking the
assertion on purpose and checking the row came back.

## [PR-247] 2026-10-04 — The product form asks the type's questions

The screen the vocabulary was for. `ProductAttributeFields` — the free-text sizes and colours
boxes — is deleted, and `ProductFactFields` puts the questions this product's type actually asks
in its place. A colour typed three ways was three colours to a marketplace; now it is chosen from
a list.

The type is resolved **in the form the same way the server resolves it**, by walking the category
tree the form already carries for the gallery's slots. So what is asked is what will be stored,
without a second notion of the rules living in the client.

The answers for the category a page renders with are read **by the page**; changing the category
fetches the rest through `GET /api/org/[orgId]/listing-values`. That is a fetch triggered by an
interaction, which is what earns a route handler — the first load costs no round trip
([ADR-0034](adr/0034-render-on-the-server-by-default.md)). `useListingValues` does that one
thing, and tracks which lists it has asked for in a ref rather than state, so the effect never
depends on what it sets.

A category with no product type says so plainly rather than rendering an empty section: the
product saves and sells here, and cannot be published until a type is set. That is the untyped
part of this store's catalogue — masalla bags, beauty and health, kitchen and dining.

**Four gates caught four real things**, which is the part worth recording:

- `portal-boundary` refused the route: I had put an org-scoped read under `/api/admin`, guarded
  by org membership rather than platform admin. Moved to `/api/org/[orgId]/`, where the shop's
  own added answers belong.
- `form-error-display` refused the `kind` select and the fact fields: a field bound without an
  error output makes a form that refuses to submit while saying nothing. All of them now bind.
- `design-tokens` refused a stale `SHAPE_LEGACY` entry for the file I had just deleted.
- `react-hooks/set-state-in-effect` refused the first version of the fetching, which depended on
  the state it set — each fetch would have scheduled the next.

Both of the first two were mutation-tested afterwards: moving the route back under `/api/admin`
and unbinding the `kind` error each turn their gate red.

## [PR-246] 2026-10-04 — One value per concept, one spelling per value [MIGRATION]

The duplicate-values problem recorded on the backlog yesterday, closed. Twenty-one values
retired, none deleted.

**Where it was a judgement, the owner made it**: *"full sleeves is the correct term."* Not the
shorter word or the longer one — the trade's. The other two sleeve pairs follow it, so the list
reads Sleeveless, Full Sleeves, Half Sleeves, Roll-up Sleeves, Three-Quarter Sleeves: five values
where there were eight. `waistRise` goes from six to three, keeping High Rise, Low Rise and Mid
Rise, because an entry in a dropdown has to read on its own. `fit` keeps the `Fit` suffix it
already used for Athletic, Skinny and Slim.

**Where it was not a judgement, a stated convention settled it.** Thirteen more collisions were
one word spelled two ways — Cut-Outs beside Cutouts, Polka Dot beside Polka Dots, Aloe Vera
beside Aloevera. The rule, written down so it can be applied again: the spaced form and the
plural where the thing is naturally countable, except where one word is the established trade
term — Polycotton, Cutwork — which keeps its own spelling.

**Retired, not deleted**, and that is the part that matters. Every discarded form is what some
platform writes, and the mapping layer will need it: our Full Sleeves is Meesho's Long Sleeves.
Retiring hides it from every picker, keeps it readable on anything that stored it, and leaves the
word where [ADR-0045](adr/0045-channel-mappings-are-versioned-data.md)'s mappings can find it.
Deleting would have thrown away the evidence that made the mapping possible.

Checked afterwards rather than assumed: no spelling collision remains in any list, and 1,001
values are offered where 1,026 were.

## [PR-245] 2026-10-03 — One list was holding two questions [MIGRATION]

`listingValueRepository` is the one way to reach the permitted answers
([ADR-0003](adr/0003-one-repository-per-aggregate.md)) — always **by list**, never all of them,
since there are over a thousand rows and a form needs the handful its own type asks about.

Exercising it against the seeded rows found a defect in PR-230's generator. It mapped Flipkart's
`Sling Strap` and Meesho's `Shoulder Strap` onto one `strap` list, on the assumption they were
two platforms' words for one question. They are not: Flipkart asks whether the strap **comes
off** — Detachable or Non-Detachable — and Meesho asks whether it is **padded**. Merged, a seller
was offered four options to one question, two of which answered a different one.

Both are facts a shop can answer by looking at the bag, so both stay — as two facts, which is
what [ADR-0047](adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)
admits them as. `strapPadding` is now its own fact and its own list, and the bag type asks both.
Nothing stored either, so the migration moves rows rather than answers.

**A second, milder problem is recorded on the backlog rather than fixed**, because the fix is a
judgement. The union of two vocabularies gives one concept two entries wherever the platforms use
different words: `waistRise` holds High and High Rise, Low and Low Rise, Mid and Mid Rise;
`sleeveLength` holds Full Sleeve beside Long Sleeves. That is harmless for colour, where 188
values are genuinely different shades, and poor for a list of six that is really three. The
answer is one canonical value with each platform's word as a mapping — which is what the mapping
layer exists for — but choosing which word is canonical is the owner's call, not something to
decide quietly in a migration.

Worth stating plainly: neither of these was caught by a test or a review. Both came out of
running the repository against the real rows and reading what came back.

## [PR-244] 2026-10-03 — The product payload learns the vocabulary [CONTRACT]

`ProductFormInput` accepts five more fields, all optional: `kind`, `familyId`, `brandId`, `facts`
and `measurements`. Without them the route stripped everything the fill step was wired up to
receive, so PR-243's work could not be reached from a browser.

The answers travel as **bare values** — `{ "colour": "black" }` — never the stored
`{value, origin}` shape. Origin is the server's word for where a value came from, and a request
that could set it could claim a shop typed something it inherited, which is exactly what the
brand-level correction then skips.

**`productType` is absent deliberately**, like `slug` and `thumbnail`. It is resolved from the
category tree on save, so accepting it would let a payload put a product under a type its
category does not use. Both exclusions are tested, and both mutation-tested: adding `productType`
to the schema, and widening the answer map to `z.any()`, each turn a test red.

`PRODUCT_FORM_FIELDS` gains the five names too. A field missing from that list has its
server-side error routed nowhere, so the person sees no message against the input they have to
correct — the failure [ADR-0013](adr/0013-one-error-envelope-and-useserverform.md) exists to
prevent. A test now holds the list and the schema in step.

`docs/CONTRACTS.md` gains a listing-vocabulary section covering the wire shape, the separate
`ProductPersistInput` the repository writes, the category envelopes becoming factories, and the
new admin surface — where `DELETE` retires rather than deletes and answers with the usage counts,
because "it is in use" without a number is not something anybody can act on.

## [PR-243] 2026-10-03 — The fill step gets its caller

`fill-facts.ts` was written pure in PR-227 with nothing calling it. `listing-fill.service.ts` is
now that caller: it resolves the type from the category tree, gathers the levels — the family,
the brand, the org's defaults — and asks the pure step to walk them. The walking stays pure; what
lives here is the reading.

Wired into `createProduct` and `updateProduct`, so a product saved through the service comes back
carrying its resolved type and its answers, each marked with the level that supplied it. Nothing
here refuses a save: a product with facts unanswered still sells on this storefront and is told
what is missing.

**Two shapes that genuinely differ stopped sharing a type.** `ProductFormInput` is what a form
sends; `ProductPersistInput` is what the repository writes — the same fields plus a
`productType` the form never sends and answers carrying their origin. Forcing both through one
type is how a server-owned field comes to look like something a request may set (Invariant 4).
`syncMarkdown` now takes only the four scalars it reads, so it serves either.

**A bug the tests found rather than the compiler**: a family stores its facts the way a product
does, each with the level that supplied it, so reading one *as a level* has to take the value
back out. Passing the stored entry straight through made the inherited answer
`{value: "crepe", origin: "product"}` rather than `crepe`. It typechecked, because both sides are
JSON.

**A second gap the mutation testing found rather than the tests.** Breaking the type scoping —
asking every fact the vocabulary declares rather than the ones this type declares — left all nine
tests green. That is the central claim of the whole feature, untested. Two tests now cover it: an
abaya is never asked about plating, and an answer for a fact its type does not ask is dropped
rather than stored.

Eleven integration tests. Mutation-tested three ways, all caught once the gap was closed.

## [PR-242] 2026-10-03 — This store's catalogue gets its types [MIGRATION]

**The first migration in this programme that writes to the live catalogue.** Everything before it
added columns and reference rows; this one points the twelve existing categories at a product
type and copies the resolved type onto the ninety-four products under them.

The mapping was agreed against the survey of the live catalogue: hand bags to `bag`, the RIDAS
parent to `islamic-wear`, bottom wear to `trousers`, bukhoor and attar to `fragrance`, jewellery
to `jewellery`. Seventy-two of ninety-four products typed.

**Three categories are deliberately left untyped** — masalla bags, beauty and health, kitchen and
dining. Twenty-two products. A masalla bag is a combo and the owner points it there; the other
two have no type that fits and inventing one would be guessing at questions. Their products save
and sell on the storefront and are not publishable to a marketplace, which is what was chosen for
all three.

The four rida categories are not named anywhere in the migration. A recursive CTE expresses the
same walk `resolveProductType` does in code — a category's own type, else the nearest ancestor's
— so formal, semi-formal, casual and ohbat inherit from their parent. Verified against a replica
of the live tree rather than assumed: all four resolved to `islamic-wear`, and the three
intentional nulls stayed null.

Two safety properties, both checked rather than claimed. It is **idempotent** — re-running leaves
every row byte-identical. And every statement is guarded on the column still being NULL, so it
**never overwrites a choice an admin made later**: a product reassigned by hand keeps the hand
assignment when the migration runs again.

It is keyed by slug, so it is a no-op on the dev and CI databases, which carry fixtures rather
than this catalogue.

## [PR-241] 2026-10-03 — Rida, and a masalla bag that is a combo [MIGRATION]

The first change that would have needed a release and does not. Both are rows, written through
the path PR-236 to PR-240 built.

**`rida` is a kind of Islamic wear, not a type of its own.** It is thirty-five of this store's
ninety-four products and its largest line, which argued for a type. The mapping cost settles it:
`(type, kind)` resolves a platform node in either shape, so the number of mapping rows is
identical, and the questions are the same — the owner had already been mapping abaya and burqa
fields onto rida fields. One question set, one more kind.

The four rida categories — formal, semi-formal, casual, ohbat — stay categories. They are not
kinds, because all four hold the same kind and map to the same node. And they need no `style`
fact: neither Flipkart's `abaya-burqa` nor Meesho's `Abayas` asks for one, and the category
already says it. Recording it on the product would store the same fact twice.

**A masalla bag is a combo, not a bag.** A handbag and a prayer mat sold together; mapping it to
a bag node would send a buyer a mat they never read about. Eighteen products, the second largest
line. They stay typeless until the owner points the category at `combo` — the kind exists first
so that is one click rather than a release, which is the whole point of the four PRs before this.

One thing worth stating plainly: `rida` has no exact match on either platform. Flipkart's
`abaya-burqa` permits Abaya, Burqa and Naqab; Meesho has Abayas, Burqa, Niqab, Hijab and Other
Islamic Wear. So this store's largest line will publish under a **nearest-fit** mapping, which is
the case the readiness gate must show rather than resolve silently.

## [PR-240] 2026-10-03 — An admin builds a question set

The screen the whole product-types spec was for. `/admin/product-types` lists the types with what
each one costs to change, and the form creates and edits them: which facts it asks, what it
measures and in which unit, what makes two of its products sell separately, and the kinds it
holds.

**Every fact says which marketplaces demand it**, measured from the templates rather than
asserted — colour by all three, sleeve styling and stitch by Meesho alone, care by nobody. That
is spec R7's "the screen shows what each choice will demand", and it is the difference between
leaving a fact out as a decision and leaving it out as an omission discovered at the first
rejection. It refuses nothing on that basis: a type we would not have built may be a line we
have not met.

**Four coherence rules are enforced at the write**, the same four the integration suite makes of
the rows that shipped. There they catch a bad migration; here they catch a bad admin, which is
the case that starts mattering now the screen exists. A type may not vary on something it never
asks about, rename a fact it does not ask, read a size label from a measurement it does not take,
or ask one fact twice.

`key` is absent from the update envelope entirely. Products and categories store it, so renaming
one would orphan every row that named it — frozen after creation, exactly as a slug is.

Three gates caught things worth catching. Route reachability refused two handlers with no named
caller until the client wrapper existed. The primitives gate refused a raw `<select>` and four
raw inputs — `Checkbox` already carries its own label and 40px target, which is the thing the
hand-rolled version got wrong. And the vocabulary gate had caught "seller" for "org" a commit
earlier.

Twenty tests, mutation-tested three ways: dropping the axis rule, letting the update envelope
default its fields, and allowing a key to be renamed each turn it red.

## [PR-239] 2026-10-03 — Two decisions closed: the colour list, and what the bulk sheet does

**The colour list is the union**, which is what PR-230 already shipped: 188 values with the 31
both platforms spell identically sorted first. It was held open on a concern that turned out to
be overstated twice over.

The concern was that a wide list commits somebody to mapping 154 values onto Flipkart's narrower
vocabulary. But only the colours a shop *actually uses* ever need mapping — tens, not hundreds —
and [ADR-0045](adr/0045-channel-mappings-are-versioned-data.md) decision 3 already has them
decided lazily: an unmapped value fails readiness and the shop is asked to choose at the moment
it first blocks a publish. There was never an upfront session to dread. The narrow list, by
contrast, would leave a colour the shop genuinely sells unrecordable, which is the failure that
cannot be undone later.

That closes the last open question across all five listing-vocabulary specs.

**The bulk sheet creates and updates, keyed by SKU** (owner, 2026-10-03). The existing importer
is create-only, so a catalogue already listed can only be corrected one form at a time — ninety-four
of them here. Update-by-SKU turns that into one upload, and it is nearly free once the sheet
exists.

Its shape follows Amazon rather than Flipkart and Meesho: those publish one sheet per node, so a
seller in twelve categories downloads twelve files. Amazon lets several product types be selected
and returns one workbook. That is the better shape and it is far cheaper here — Amazon's costs 390
columns because it spans everything; ours spans a vocabulary of twenty-eight facts, so three types
is roughly twenty-five columns. Each choice column carries its permitted values as a dropdown read
from `ListingValue`, which stops "Maroon / maroon / Marron" at the source rather than cleaning it
up afterwards.

Recorded on the backlog as `product-form/bulk-sheet` rather than built now; the current importer's
headers still carry `sizes` and `colors`, the two columns this phase replaces, so it is rewritten
rather than extended.

## [PR-238] 2026-10-03 — The category pages hand the form the types that exist

PR-237 turned the schema into a factory and left the two category pages still calling the form
without any types to build it from. The prop defaulted to an empty list, so the resolver would
have refused every product type a shop chose — a silent bug introduced by the previous commit and
caught by reading the call sites rather than by any test.

Both pages now read the options server-side alongside the parents they already read, and
`adminCategoriesDAL.getProductTypeOptions` is `cache`d per request like its neighbours. A server
component reads and a client component receives ([ADR-0034](adr/0034-render-on-the-server-by-default.md)),
and the two reads go out together rather than in sequence.

The prop is **required rather than optional**, which is the part worth keeping. An optional one
with an empty default is how this bug happened: a page that forgets it compiles, renders, and
refuses every choice at submit. Required, the omission is a type error at the call site.
Verified by removing it from one page and watching the compiler object.

## [PR-237] 2026-10-03 — The types are read from the table, and the constants are gone [MIGRATION]

The second product-types PR, and the one where the table becomes authoritative.
`PRODUCT_TYPE_DECLARATIONS` is deleted. `server/catalog/product-type.ts` keeps only what stays
pure — the tree walk, the key parsing and the schema factory — and `product-type.repository.ts`
is now the one way to reach a type ([ADR-0003](adr/0003-one-repository-per-aggregate.md)).

**A second migration, because the first dropped something.** Emitting the nine as rows lost the
per-type relabelling: Flipkart asks cloth its `Fabric` and everything else its `Material`, which
is one question with two labels rather than two facts. `factLabels` carries it, backfilled onto
Islamic wear, trousers and socks. The test now asserts both halves — those three say Fabric, and
bag, prayer mat and jewellery say Material — because the omission was silent the first time.

**The zod schema is a factory**, which is how the runtime-known set keeps ADR-0013's property.
`categoryFormSchemaFor(keys)` is built by the form from the options it was handed and by the
route from `productTypeRepository.keys()`. Same function, same rules, both sides, with the
foreign key as the backstop underneath. A widened set widens what is accepted, which is the test
that proves it is a factory rather than a constant in disguise.

**`sizeLabelFor` now takes the type's row**, so the ring diameter-to-size table is nine rows
rather than a constant and nearest-match is the only code. A test builds a shoe type with a
UK-size scale the codebase has never seen and the derivation follows it — which is what
"configurable" has to mean to be worth the word.

The declaration-integrity checks moved from unit to integration, because they changed meaning.
They used to check constants the compiler already checked; they now check **rows**, which nothing
checks — a type naming a fact that does not exist, varying on something it never asks about,
relabelling a fact it does not ask, or reading a size label from a measurement it does not take.
That is the check on a type an admin creates, which is the case that will matter once the screen
exists. Mutation-tested: an axis on an unasked fact and a label on an unasked fact each turn it
red.

A vocabulary gate caught "never per seller" in a comment — this codebase says org — which is the
kind of thing only a test notices.

## [PR-236] 2026-10-03 — The nine product types become rows [MIGRATION]

The first product-types PR. `ProductType` exists, the nine declarations are carried across
unchanged, and both `Product.productType` and `Category.productType` now reference it. No
behaviour changes: the code still reads the constants, and this PR is what lets the next one stop.

**The foreign key references `key`, not `id`**, which is the decision that makes this free.
Postgres permits a foreign key against any unique column, so every existing row keeps the exact
string it holds and simply gains integrity — no backfill, no id rewrite, no touching the ninety-four
products. Null stays legal, because a foreign key never constrains one, which is what the untyped
categories need: masalla bags, beauty and health, kitchen and dining.

Before this, `Product.productType` was a loose string. The compiler checked it only where a
constant was used, so a typo written through any other path would have been stored and later
published. Now the database refuses it.

The rows are inserted **before** the constraints are added, in the same migration, so a database
where a `productType` had already been set during testing does not fail the moment the key
appears. Idempotent on the unique key.

`labelScale` carries the ring diameter-to-size table, and `labelFrom` which measurements each type
reads a label from — both of which were claimed un-configurable when this was first assessed and
turn out to be data. Only jewellery has a scale, which the test asserts.

Eleven tests against a real schema. Mutation-tested three ways: dropping the foreign key, changing
its `RESTRICT` to `CASCADE`, and corrupting a carried fact list each turn it red. Worth recording
that the `CASCADE` mutation genuinely deleted a type and its product before the restore — a
mutation that lets a delete through does delete, and the fixture had to be rebuilt from the
migration's own insert.

## [PR-235] 2026-10-03 — Product types become something an admin creates

The nine types were written as a TypeScript object, which made adding one a release. The owner's
own frequency estimate inverted the recommendation to leave it that way: for the first hundred
sellers a new product line arrives often enough that a developer in the loop is a bottleneck on
onboarding, which is the main growth activity. Later it becomes rare again, but the expensive
period is now.

[product-types](specs/listing-vocabulary/product-types/) specifies the move. The split is between
the **vocabulary** and the **selection**: a fact carries a way of being answered and a validation
rule, so it stays in code; a type is a list of fact keys, so it becomes a row. Both reference
implementations draw the line in the same place —
[Akeneo](https://help.akeneo.com/v7-build-your-catalog/v7-manage-your-attributes) creates
attributes and families in the UI with only the attribute *types* fixed, and
[Shopify](https://shopify.dev/docs/apps/build/metafields/definitions) ships a standard taxonomy
filled in and lets merchants add definitions with only the *data types* fixed.

The decision that makes this cheap is the foreign key: `ProductType.key` is unique and both
`Product.productType` and `Category.productType` reference it, so every existing row keeps the
exact string it holds and simply gains integrity — no backfill, no id rewrite. That the columns
were `String?` rather than a Postgres enum turns out to be what makes it free, and an enum would
have been exactly wrong, since adding a value needs a migration.

Three costs raised when this was first assessed are resolved rather than accepted. The zod schema
becomes a factory so form and route still build from one function. The form costs two indexed
queries in a render that already reads the category, with value lists fetched only for the lists
that type uses — no cache, which this project deliberately does not have. And the ring-size scale
turns out to be data after all: nearest-match is generic, so a type is fully configurable rather
than half, which was a modelling error on first assessment.

D11 records what the owner closed today: a type belongs to the platform, never to a seller. The
permitted *answers* stay org-scopeable, because a shop knowing a colour the platform does not is
harmless where a shop knowing a different question set would break publishing.

## [PR-234] 2026-10-03 — Checked the vocabulary against the channel that publishes first

The vocabulary was derived from thirty-four Amazon, Flipkart and Meesho templates. The owner asked
whether Google and Meta had been considered, and they had not — which is a real gap in the order
the checking was done, because those are the channels that publish *first*. A feed file at a URL
needs nobody's approval ([ADR-0041](adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)),
while every marketplace needs an account, an approval, or partner status. The vocabulary was
verified against the channels that come last.

Checked now, and it holds. Google demands more of apparel than of any other category and a single
missing attribute is an immediate disapproval: `color`, `size`, `gender`, `age_group`, and
`item_group_id` on every variant. Eight of the ten are already carried.

The interesting result is that **`Ideal For` answers two of Google's questions at once.** The
marketplaces ask one question whose values are Men, Women, Boys, Girls, Baby Boys, Baby Girls,
Kids and Unisex; Google splits that into `gender` and `age_group`. So `age_group` is a mapping of
an answer already held rather than a fact that was missing — one canonical question, two channel
fields, which is exactly what [ADR-0045](adr/0045-channel-mappings-are-versioned-data.md) exists
for. That the marketplace-derived vocabulary happened to cover a channel it was not derived from
is evidence for the answerability test in
[ADR-0047](adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md): a fact
admitted because the shop can answer it tends to serve channels nobody checked.

`size` is required for apparel and is derived rather than stored; `Free Size` is an accepted value
and is what everything this store sells resolves to. `condition` is required only when a product
is not new, so for this store it is a constant in the Google adapter rather than a product fact —
recorded so it becomes one the day anything used is sold.

The ordering lesson is worth more than the finding: the first channel to publish is the one to
verify against first, and it was checked last because it was the least documented in templates.

## [PR-233] 2026-10-03 — A category with no product type says what that costs

The product-type field on the category form was optional with a neutral hint, which made it a
blank somebody skips rather than a decision somebody takes. Leaving it empty is legitimate —
three of this store's twelve categories have no type that fits, and a wrong type is worse than
none because it asks the seller the wrong questions — but the consequence was invisible.

The hint now states it while the field is empty: products here save and sell on the storefront,
and cannot be published to a marketplace. It returns to the short wording once a type is chosen,
so the warning is not permanent furniture.

Still optional rather than required, deliberately. Forcing a choice on a mixed category — one
holding a mat, a Quran cover and a tasbih — would make somebody guess, and the guess would be
stored.

## [PR-232] 2026-10-02 — A read-only survey, because the dev database is not evidence

The listing-vocabulary migration was being designed against the dev database, and the owner
pointed out it is not evidence: it was seeded from the old product form, so it shows what the
seed invented rather than what the shop typed.

`scripts/survey-catalogue.sql` asks the live catalogue seven questions instead, `SELECT` only —
it writes nothing, locks nothing and prints no credential. How much there is; the category tree
and what hangs off each node; what `sizes` and `colors` actually hold per category; how many
stored colours the new vocabulary already knows the word for; how many products a colour-axis
migration would produce; how many vary on both axes at once; and what `ProductStock` holds.

That last one is the part no migration can derive. One stock number covers every colour today, so
splitting twelve units of an abaya across black and maroon is a decision somebody makes, not a
sum. Any plan that quietly divides or duplicates it would be inventing inventory.

The shape of the problem is already visible in the seeded data even if the numbers are not
trustworthy: `sizes` carries four different kinds of thing — garment letters, a capacity in
millilitres, a physical dimension like `110x70cm`, and free-size words — so one migration rule
cannot read it. A capacity belongs in `measurements`, a dimension becomes two measurements, and
only the letters were ever a size. The TRD's D7 assumed one rule and will be rewritten once the
survey comes back.

## [PR-231] 2026-10-02 — An admin says which product type a category uses

The question was whether adding categories stays something the admin can do. It already was:
`src/app/(admin)/admin/categories/` has create, edit, delete, a bulk importer and a tree with
cycle checks, all audited, and `Category.shotList` is already a per-category setting an admin
edits. So no new module and no new spec — `productType` is the same shape as `shotList` and
joins the same form.

One select on the category form, defaulting to "Inherit from parent". `productTypeSchema` lives
beside the declarations so the enum has one spelling; the form's resolver and the route's parser
are the same schema, so what a shop is shown inline is what the server enforces
([ADR-0013](adr/0013-one-error-envelope-and-useserverform.md)).

Twelve tests, three of them on the symmetry Invariant 4 asks for: create and update accept the
same types and refuse the same rubbish, and `slug` is still refused on both. The update envelope
stays `.optional()` rather than `.default()` — in zod v4 a default fires inside a PATCH and
rewrites what the caller never mentioned, which is the bug the schema's own comment already
warned about for `description` and `parentId`. Mutation-tested: widening the type to any string
turns three tests red, and giving the update envelope a default turns the PATCH one red.

## [PR-230] 2026-10-02 — The permitted answers, read off the templates [MIGRATION]

1,026 `ListingValue` rows across twenty-two lists, generated from the platforms' own bulk-upload
templates rather than typed: 188 colours, 195 materials, 145 patterns, 125 scent families, and
the smaller lists for sleeve, stitch, fit, plating, purity, gemstone and the rest.

A data migration rather than the seed, which is the project's own rule for reference data
(Invariant 7): `prisma/seed.ts` is permanently dev-only and deletes every table, while
`vercel.json` runs `prisma migrate deploy` before every build — so a migration reaches every
environment on merge and the seed reaches none. The test is whether production breaks without it,
and without these a product form has empty dropdowns.

**The union, not the intersection**, which settles the TRD's open question in the direction
already recommended. The platforms do not disagree about what to call a colour — 31 of the 35
Flipkart publishes appear on Meesho spelled identically — they disagree about how many exist, 35
against 185. The narrower list would mean a colour the shop genuinely sells could not be recorded
at all, and the mapping work is the same either way. Values both platforms name sort first, so
the common ones sit at the top of a list and the long tail is below them.

Idempotent on the partial unique index from PR-228, so replaying it is a no-op rather than a
duplicate-key failure — checked by running it twice.

`baseMaterial` is its own fact with its own list, so "base metal" was removed from the sources
feeding `material`; without that the material list carried the jewellery metals as well.

## [PR-229] 2026-10-02 — ProductFamily, which cannot be sold [MIGRATION]

The fifth listing-vocabulary PR. `ProductFamily` is a new aggregate with its own repository
([ADR-0003](adr/0003-one-repository-per-aggregate.md)), carrying what a set of separately-selling
products share — the description, the facts, the measurements — and `Product` gains a nullable
`familyId`. Nullable because one abaya in one colour is one product and nothing asks a shop to
declare a family of one, and because requiring it would refuse every row that exists.

No behaviour changes yet: nothing creates a family, and every existing product keeps a null
`familyId`.

**The family holds no price, no stock and no `ProductStock` relation**, and that is enforced by
the columns not existing rather than by a check — the only way it cannot be forgotten. If a
family kept a stock number at all, something would eventually sell it and the four real counts
would not move. `tests/integration/product-family.test.ts` asserts the absence against
`information_schema`, because a later migration adding such a column is exactly how the leak
would reopen silently. Adding a `stock` column turns it red, which was checked.

`Product.familyId` is `Restrict`, not `Cascade`: a family carries no money but its members do
([ADR-0020](adr/0020-money-bearing-records-never-cascade.md)). Deleting a family with members is
refused and the real operation is retirement
([ADR-0032](adr/0032-records-people-authored-are-retired-not-deleted.md)), which leaves every
member reading exactly as before. Switching the constraint to `Cascade` turns that test red too.

The repository scopes every read and write by `orgId`, writes through `updateMany` so the scope
is part of the write rather than a read-then-write two requests can interleave, and whitelists
field by field so create and update stay symmetric (Invariant 4). It gains the two counts
variants D6 requires — families and sellable things are different numbers, and a screen saying
"Products" has to say which it means.

It also joins the ADR-0029 census in `tests/unit/product-visibility.test.ts`, which caught the
new file reading products and required it classified. The sellable count spreads `AVAILABLE`
rather than respelling `archivedAt: null`; `memberCount` deliberately counts archived members,
because it previews which products a family-level correction would change and an archived product
can be restored.

## [PR-228] 2026-10-02 — The listing vocabulary's schema [MIGRATION]

`Category` gains a nullable `productType`, inherited down the tree like `shotList`. `Product`
gains `productType` and `kind` as columns and `facts` and `measurements` as JSON, each entry
holding its value and the level that supplied it. `ListingValue` holds the permitted answers.
Every column is nullable and the migration is purely additive; no existing row changes.

**Only the discriminators earn columns, and that is a decision reading the code changed.** The
TRD said what is filtered, sorted or searched on earns a column, and named colour among them.
Nothing filters on `colors` or `sizes` — they are selected and written and appear in no `where`
clause anywhere in `server/` or `src/`. So colour, material and pattern are answers like any
other, in JSON with their origin. `productType` is a column because it says how to read the rest
of the row, and `kind` because the channel mapping will resolve a platform node from the pair. A
column added for a filter nobody has written is a second place for a value to live.

**The unique index Prisma generated had a hole.** `@@unique([list, key, orgId])` does not
constrain rows whose `orgId` is NULL, because Postgres treats NULLs as distinct — so two
platform-provided answers could share a list and a key, which is the drift a single global list
exists to prevent. The migration adds a partial unique index over `(list, key) WHERE orgId IS
NULL`, which Prisma's schema language cannot declare, so nothing in `schema.prisma` shows it.
`tests/integration/listing-value-uniqueness.test.ts` is what keeps it honest: dropping the index
turns that test red, which was checked rather than assumed.

A value is retired rather than deleted, because products already store its key and a deleted
answer would leave them reading as unlisted text
([ADR-0032](adr/0032-records-people-authored-are-retired-not-deleted.md)). A shop's own answer
carries its `orgId` and cascades with the org, so one shop's vocabulary cannot widen another's.

Generated against a throwaway database created and dropped for the purpose; the local dev
database was left alone, being twelve migrations behind and holding whatever it holds.

## [PR-227] 2026-10-02 — The fill step, as an ordered list of levels

The third listing-vocabulary PR, and the last pure one. `server/catalog/fill-facts.ts` fills a
fact the shop left blank from the family, then the brand, then the shop's defaults, and records
which level answered.

Precedence lives in the order of a list rather than inside branching code, so adding a level is
inserting an entry rather than editing every fact's fallback — and so that *which level answered*
survives, which is what the brand-level correction acts on. It is generic over its key type, so
one implementation serves both the columns and the type-specific tail.

Three behaviours worth naming. **Blank is not an answer**: an empty or whitespace string is a
field somebody cleared, so the step keeps looking rather than inheriting it; `NaN` is likewise a
blank number input rather than a number. A meaningful zero and a `false` are answers and are kept.
**An answer on the product always records as the product's**, which is what later leaves it alone
when a brand is corrected. And **editing clears the mark even where the new value equals the
inherited one**, because the choice was still deliberate and leaving the mark would let the next
correction silently revert it.

`takeOwnership` takes its edited keys as `NoInfer`, so the key set comes from the stored answers
rather than from whichever handful was edited — without it, editing one field narrowed the
returned type to that one field.

Twenty-two tests. Mutation-tested four ways: reordering the levels, counting a blank as an
answer, not clearing the mark on an edit, and recording the product's own answer as inherited
each go red.

## [PR-226] 2026-10-02 — A size label is worked out, never stored

The second listing-vocabulary PR. Still pure, still no schema and no caller.

`server/catalog/size-label.ts` works a size label out from a product's measurements. For
everything this store sells the answer is `Free`, which is a permitted value on every category it
sells into, and the measurements it came from travel with it so a screen can show its reasoning.
Jewellery is the exception: a ring's inner diameter maps to a real scale, nearest step wins, and
beyond either end it clamps rather than inventing a size.

It is derived and not stored, which is the decision worth stating. A label held in a column
alongside the measurements it came from is two facts that can disagree, and the stale one wins,
because whatever reads the column never learns a fresher answer existed. Measurements are stored
because a measurement derives a label and a label derives no measurement.

Also here: the measurements a type requires and a product has not given, which is what readiness
will report. It reports rather than refuses — nothing in this feature blocks saving.

Eighteen tests. Mutation-tested three ways: returning a constant label, taking the first ring
step rather than the nearest, and never reporting a missing measurement each go red.

## [PR-225] 2026-10-02 — The listing vocabulary's declarations

The first of the listing-vocabulary PRs. Pure declarations and one pure function, no schema
change, no caller yet — so nothing in the product's behaviour moves.

`server/catalog/listing-facts.ts` declares the facts a product type may ask beyond the spine,
each with how it is answered and which value list it draws on, plus the measurements and their
units. A fact is in it because the shop can answer it from the product without knowing which
platform is asking, which is the only admission test
([ADR-0047](adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md)).
Flipkart's procurement terms and Meesho's returns price fail that test and are absent.

`server/catalog/product-type.ts` declares the nine types, the kinds each holds, the facts it
asks, its measurements and the axis its members vary on. `resolveProductType` walks the category
tree for the nearest ancestor that declares one, mirroring `resolveShotList` — same tree, same
walk, same `seen` set, because a self-referencing tree can hold a cycle.

Three details the templates decided rather than we did. The variant axis can be a measurement
rather than a fact, because the same attar in 6 ml and 100 ml is two sellable things and no fact
expresses that. `Material` and `Fabric` are one question with a per-type label, because that is
all Flipkart's two words are. And a stored answer carries the level that supplied it in the same
entry, so origin costs no second column.

Twenty-eight tests, of which eight are the declaration-integrity checks: a type may not ask for a
fact that does not exist, may not vary on something it never asks about, may not relabel a fact
it does not ask, and a choice fact must point at a list that exists. Mutation-tested — varying on
an unasked fact and dropping a required mat dimension each go red, and removing the cycle guard
hangs the suite until it is killed, which is the guard's point.

`docs/ARCHITECTURE.md` gains the new test file in its count, and loses its claim that there is no
background job runner, which the worker made false three PRs ago and nothing noticed.

## [PR-224] 2026-10-02 — A product type is not a browsing category

Reading the schema before implementing found the vocabulary spec conflating two things. It said a
product "sits in one of nine categories", and `Category` already exists as the buyer's
merchandising tree — hero image, accent, ordering, arbitrary depth, reorganised whenever
merchandising wants. Had that been built as written, moving an abaya under a seasonal heading
would have changed the questions asked of it.

They are separate concerns and the codebase already separates them correctly once:
`Category.shotList` declares the photo slots its products fill, inherited down the tree from the
nearest ancestor that sets one (`server/catalog/shot-list.ts`). The product type now attaches the
same way. A category says which type its products use, a category that says nothing inherits, and
the tree stays free to be reorganised.

The resolved type is stored on the product on save rather than read through the category, so a
product read stays one row and merchandising cannot move a product's stored answers. Re-pointing
a category at a different type becomes an explicit migration of its products, with a count and a
confirmation, reusing the correction mechanism the inherited facts already need.

Named `productType` because that is what Amazon names it, and it is the same concept: the thing
that decides which attributes apply. Flipkart calls it a vertical, Meesho a category. Naming ours
after the dominant published vocabulary costs nothing and makes every adapter's mapping read as a
mapping ([ADR-0046](adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md)).

Caught by reading the schema rather than by review, which is the order ADR-0046 asks for and the
reason the first implementation PR has not been written yet.

## [PR-223] 2026-10-02 — The listing vocabulary, specified as three features

Drafting it produced 156 readable lines against a 100-line cap, which
[ADR-0010](adr/0010-spec-convention.md) treats as the signal that a feature is more than one
feature. It was three: what a category asks, what makes two things sell separately, and what gets
filled in from elsewhere. Each is independently demoable and each carries its own hazards.

The field set is read off thirty-four platform templates rather than from our own product model,
which was written without market knowledge and would otherwise have been the thing the new model
was shaped to fit.

What the templates changed, against the draft that preceded them. The variant axis is declared per
category rather than assumed to be size, because Flipkart declares axes per node and no two of its
twelve agree. Measurements are stored and size labels derived, because twelve of Meesho's nineteen
nodes require a measurement and none requires a label without one. A kind — abaya, burqa, niqab —
is a fact on the product rather than a category, because Flipkart holds the three as one node with
a field while Meesho holds three categories, and only a stored fact serves both. A combo is an
ordinary product with its own stock, because the shop counts it that way.

Two questions closed during review, both by the owner reading the draft. Whether a member needs
its own description: it does, and the family holds it as the answer to fill from so it is typed
once. Whether the fill step needs cycle protection: it does not, the levels being a fixed list of
three, and the guard was removed as the over-engineering it was.

One question stays open and needs the owner: how rich the colour list should be. Implementation
proceeds on the recommendation — the union, 31 of whose values Flipkart and Meesho already spell
identically — because the choice seeds data rather than shaping the model, and seeded data is
cheap to revisit.

## [PR-222] 2026-10-02 — Correction: the reader was dropping empty cells, and two figures were inflated

The stdlib xlsx reader appended cells in document order without reading each cell's own column
reference. A spreadsheet omits empty cells from a sparse row, so every value after a gap shifted
left. Dense sheets were unaffected, which is why the Amazon extract re-reads byte-identical and its
18 required of 390 stands. Sparse sheets were silently wrong.

Meesho's `Validation Sheet` is sparse, which is why it looked like noise and was reported as
Meesho publishing no value lists. It publishes all of them, and they are the richest source in the
set: 185 distinct colours against Flipkart's 35, plus fabric, pattern, sleeve, stitch, size and the
measurement ranges, per category. `listing-node-templates/extracted/meesho.json` now carries them.

Two figures in [PR-220] and [PR-221] were inflated by a second fault in the same extraction: two
template files for one node — Socks and Deodorant—Fragrances each ship twice — had their field
lists concatenated rather than replaced. **Meesho requires 23 to 40 compulsory fields per node,
not 23 to 56**, and **twelve of nineteen nodes require a measurement, not thirteen**. Both
corrections leave the conclusions standing: Meesho is still the binding constraint against
Amazon's 18, measurements are still required twice as often as labels, and **no node requires a
size label without also requiring measurements**, which is what
[ADR-0047](adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md) decision 4
rests on.

The colour question this settles: for an abaya, sixteen of Flipkart's seventeen colours appear on
Meesho spelled identically. Across all nodes, thirty-one values are common and spelled the same.
The platforms do not disagree about what to call a colour; they disagree about how many colours
exist. That makes an unmapped value a question of granularity rather than of vocabulary, and it is
answered once per value rather than per product.

An extraction bug is invisible in a way a code bug is not — nothing fails, the mapping is simply
built on a wrong list. The reader now places each cell by its own reference, and the rule that
follows is that a sheet which looks like noise is a reading to check before it is a finding to
report.

## [PR-221] 2026-10-01 — What the platform templates actually ask for, measured

[INTEGRATIONS.md](INTEGRATIONS.md) carried an estimate of the cross-platform core written on
2026-09-29 from the published specifications, before any template had been read. It named colour
and size as part of the shared core and closed with the per-category value lists being "a
dependency on access, not a gap in research".

The access arrived and the estimate was wrong on both counts, so the section is replaced with what
thirty-four templates measure rather than what the specifications implied. Colour and size are not
in the three-platform core. The core is thirteen fields and it is barely descriptive — the seller's
own code, description, maximum retail price, stock, brand, images, tax code, country of origin,
manufacturer, packer, importer, net weight and a variant key — of which nine are stated once by
the shop rather than per product.

Also now recorded there, each of which bears on a design decision rather than being trivia:

Required counts, not field counts, are the constraint, and Meesho is the binding one at 23 to 56
compulsory per category against Amazon's 18 of 390. Flipkart encodes requirement level as a cell
colour decoded from each workbook's own legend. A platform's category sometimes holds what another
keeps in a field, so the mapping is many-to-many and must be allowed to resolve to nothing. Variant
axes are declared per node and no two of Flipkart's twelve agree. And sizes are asked for as
measurements more often than as labels — thirteen of Meesho's nineteen nodes require a measurement
and none requires a label without one.

The "field name agreeing is not its values agreeing" finding survives and is strengthened: it holds
inside a single platform, where Flipkart's own colour list differs per node and its `Size` is three
incompatible scales under one label.

Dated and sourced, because the previous version of this section was neither, and a confident
estimate in a reference doc is worse than an absent one.

## [PR-220] 2026-10-01 — A canonical fact is admitted by answerability, not by agreement

[ADR-0042](adr/0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md)
set the right criterion and then added a clause that said something narrower: that "Amazon
requires it" is never a reason for a canonical field. Read strictly, that excludes a fact only one
platform asks for even when the shop can answer it without being told who is asking.

The templates made the cost concrete. Meesho's `Abayas` node requires `Bust Size` and
`Length Size`; Flipkart's `abaya-burqa` asks for neither. A shop measuring an abaya can answer
both. Under the intersection they are one platform's demand and would have been left out of the
vocabulary, and the first abaya published to Meesho would have been rejected.

The asymmetry behind it was named by the owner: sending a fact a platform ignores costs nothing,
and omitting one a platform requires stops the listing. Two errors of different sizes do not want
a criterion balanced between them.

[ADR-0047](adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md) therefore
keeps ADR-0042's answerability test as the only admission test — can the shop answer it from the
product, without knowing which platform it is for — and drops the requirement that more than one
platform ask. One is enough and none is enough. ADR-0042's decisions 2 to 5 stand: a fact the
shop cannot answer is still a channel extra declared by its adapter as a schema, never a bag.

It also records two things the templates settled. **Store the fact that derives the other**: a
measurement derives a size label and a label derives no measurement, so a garment's length and
bust are stored and `Free` is computed. Thirteen of Meesho's nineteen nodes require a
measurement, six require none, and none requires a size label without also requiring
measurements — so the deriving fact is also the one asked for more often. And **the burden is on
the extra**: the listing form is one form, because a per-platform section on it means the seller
fills three, which is the cost this phase exists to remove.

ADR-0042 is immutable, so its decision 1 is not edited. Its Status line and a note above its
Alternatives point at the refinement, and the two are read together.

Also added: Meesho's `Trousers---Pants` node, which confirms Meesho asks for no size label on
trousers either — only `Length`. The Meesho core holds at 32 fields across all nineteen nodes.

## [PR-219] 2026-10-01 — Correction: Flipkart names the size scale as a field of its own

The extract committed in PR-218 read Flipkart's `Brand Size` wrongly for two nodes. In `trouser`
and `salwar` that column is not a list — it is a three-column lookup of Ideal For, then a
Qualifier, then the allowed value, and the extraction kept only the first column. So the data
said the permitted sizes were "Baby Boys, Baby Boys, Baby Girls…" repeated, and said those two
nodes had no free size.

Both claims were wrong. `Free` is permitted for women's trousers and salwars, under the `Regular`
qualifier, which matters because this store sells free size throughout.

The Qualifier is the more interesting half. Flipkart names the *scale* explicitly — Regular
letters, Number, Euro, UK, US, or Kids age bands — and the allowed values depend on it and on
Ideal For together. That is the same conclusion the vocabulary reached from the other direction,
reading three incompatible size lists under one label and deciding a category must declare its
scale. One platform already does exactly that, so the design is matching an established shape
rather than inventing one.

Also recorded from the same pass, since they bear on the category mapping: Flipkart's `mat` node
carries `Type = Prayer`, so a prayer mat is that node rather than a category of its own.
`Tote` appears in the Type list of both `hand-messenger-bag` and `sling-bag`, so one of our kinds
can have two candidate nodes and the mapping has to choose. And a standalone hijab has no
Flipkart node in this set — `abaya-burqa` permits only Abaya, Burqa and Naqab — so a mapping must
be able to say a product has nowhere to go on a platform without that being an error.

The extract is data derived from someone else's files, so a reading error in it is silent in a
way a code bug is not: nothing fails, the mapping is just built on a wrong list. Worth stating
plainly that the remaining 31 files were extracted by the same code and only these two were
checked by hand against the source.

## [PR-218] 2026-10-01 — The platform templates, and what thirty-three of them agree on

The vocabulary was being designed against two sheets and our own product model. Thirty-three real
bulk-upload templates now sit behind it: Amazon's single workbook covering ten product types,
twelve Flipkart verticals, and eighteen Meesho categories — every node this store actually sells
into.

The binaries are not committed. Nineteen megabytes of another company's undiffable spreadsheets,
on an account that is not ours to publish them from, and git never forgets a blob. What is
committed is `listing-node-templates/extracted/`: field names, requirement levels, variant axes
and permitted value lists, one JSON per platform, which a diff can actually show. The manifest
carries a checksum and a date per file so the extract can be traced to its source.

Flipkart marks a field's requirement level as a cell colour rather than a value, decoded against
the legend each workbook carries on its summary sheet: blue mandatory, purple conditional, yellow
recommended, green optional, grey filled by Flipkart.

What the extract shows, which the two sheets did not:

Amazon declares 390 fields and requires 18 of them, 187 being conditional on other answers.
Flipkart requires 19 to 32 per node out of 66 to 132. Meesho is the strict one, at 23 to 56
compulsory per node — so the binding constraint on a listing form is Meesho, not Amazon.

The three platforms agree, in every node, on thirteen fields, and they are almost all identity,
money, stock and statutory compliance rather than description. The descriptive tail that two
platforms agree on is one to six fields per category, and across all eight of this store's
product groups it is the same handful: colour, pattern, material or fabric, size, net quantity,
occasion.

A field name agreeing is still not its values agreeing, and the templates show this inside a
single platform. Flipkart's own colour list differs per node — sixteen values in all eleven that
have one, nineteen more in only some. Its size list is three incompatible scales under one label:
thirty-seven mixed age bands and letters for an abaya, five words for a mat, forty-five numbers
for a ring. `Fabric` and `Material` are the same question asked of cloth and of everything else.

[ADR-0043](adr/0043-a-variant-is-a-product-in-a-family.md) said a variant is a product in a
family and left the axis open. The templates close it in the direction of per-category: Flipkart
declares the axes per node and no two of the twelve agree — size for an abaya, capacity and
colour for a bag, plating and size and colour for a ring, set and quantity for incense. The axis
cannot be assumed, which is why the category declares it.

## [PR-217] 2026-09-29 — Check a new model against the field, not against ourselves

Drafting the listing vocabulary produced a design for storing a product's variable facts as one
row per attribute. It was internally sound and consistent with this codebase, which already holds
declared shapes as validated data in eighteen places. It was also entity-attribute-value, the
model Magento built its catalogue on and the one PostgreSQL's own community advises against by
name, where a JSON column is a fraction of the storage and a large multiple of the read speed.

Consistency with the house pattern produced the wrong answer, because the pattern was read at the
wrong level of abstraction. Nothing in the process caught it. Every gate here checks our code
against our rules, and none of them checks our rules against anybody else's experience. It was
caught because the owner asked whether it was standard.

So the TRD template now has a required **Prior art** section: name what the field does, with a
source, and say whether we follow it. Departing is allowed and argued. An existing pattern in
this repository is evidence and never authority — consistency is a reason to match and never a
reason not to check. A wrong pattern found already in the code gets written down rather than
quietly avoided, because working around one silently is how the next person copies it.

The spike's "verify, don't recall" rule already covered external services and now covers the
shape of a solution too.

No gate enforces this and none can: no test knows that a schema resembles an anti-pattern, and
one that tried would encode a fixed list of bad ideas and go stale. The section's presence in the
template is the whole of the enforcement, which is weaker than this project usually accepts and
is recorded as such.

## [PR-216] 2026-09-29 — The first spec of the new phase: one description of a product

`listing-vocabulary` is drafted. It is the phase's foundation and the only part of it that
depends on nobody outside: one declared attribute set, variants as real products in a family, and
one resolver that answers a product's facts by walking product, family, brand, then the shop's
defaults, returning each value with the level that supplied it.

Its shape is borrowed rather than invented. The shot list already declares a template as
validated JSON, parses defensively and resolves by walking to the nearest ancestor that answers.
This is that pattern with a different subject.

The spec names five hazards so the technical approach cannot pass over them, which is what the
convention asks of it. Two are worth repeating here. A vocabulary that still accepts free text is
not a vocabulary, and today's colours already contain three spellings of maroon. And "products"
stops meaning one thing the moment a garment in five sizes becomes five rows, so every screen
that counts them has to say which count it means — the dashboard, the listing grid and the
low-stock alert do not currently agree by accident.

The migration deliberately keeps values it cannot map, as free text against the product. A shop's
data is not ours to discard because it does not fit a list we wrote afterwards, and the leftovers
are what tell us which values the list is missing.

## [PR-215] 2026-09-29 — Five decisions, and a phase re-sequenced around what it costs to prove

The spike into what the marketplaces actually require turned five questions into decisions, each
recorded with the alternative it beat.

A channel is classed by where the sale completes, because Google and Meta never hold an order and
Amazon and Flipkart always do, and one abstraction would have given the first group machinery it
has no use for. The shared vocabulary is the intersection of what a shop knows, with each channel
declaring its own extras as a schema rather than a bag — which is the same pattern the photo shot
list already proves, and which is what lets a per-channel form generate itself. A variant is a
product in a family, because every marketplace needs a size to have its own stock and ours cannot
give it one. A marketplace order's money is reported rather than computed, which is Invariant 2's
shape rather than an exception to Invariant 1. And the three mapping layers are versioned data,
because the thing most likely to change under us is the thing that must not need a release.

The phase is re-sequenced to match. It now runs vocabulary, form, registry, feeds, connectors,
marketplace publishing, sync, reporting, with subscriptions beside the line rather than in it.
Two entries in it are scheduling dependencies rather than engineering ones and are named as such:
Amazon needs a Professional selling account and a public site before any API conversation, and
Meesho whitelists integrators by relationship.

The ordering principle changed too. It was ambition; it is now cost to prove. Shopfront feeds come
third not because they are the most valuable but because Google and Meta fetch a file and need
approval from nobody, which makes them the honest test of whether the mapping layer works before
anything is staked on it.

## [PR-214] 2026-09-29 — Where a shop can sell, named once instead of twice

`CHANNEL` was declared in two modules with identical members and nothing between them: beside the
image rules in content, and beside the readiness states in catalog. Neither imported the other.
That is the drift [ADR-0003](adr/0003-one-repository-per-aggregate.md) decision 5 forbids, and it
had gone unnoticed because two copies of the same four strings behave identically right up until
one of them gains a fifth.

The set now lives in `server/shared/channels.ts`, because it genuinely spans both domains and is
about to span more — catalog asks whether a shop is ready for a channel, content asks whether a
photograph meets one, and neither owns the vocabulary. Both former homes import it and re-export
it, so every existing caller is untouched.

A refactor with no behaviour change, done before the multi-channel work rather than during it,
because that vocabulary is the thing the whole of it keys on.

## [PR-213] 2026-09-29 — The media backfill has been run against dev

Recorded because the runbook asks for it, and to close the pair with the production run.

27 asset records stand behind what dev holds: 26 images and one YouTube reference, with every
product gallery, category hero, banner, org banner and org profile linked and nothing unlinked.
Every image carries its dimensions and a content hash.

Four carry an object key. The other 22 are the seed's `placehold.co` images, which belong to no
store of ours and correctly have none — the same honest answer the store check is built around,
and the reason four recognised URLs were enough for it to let the write proceed.

## [PR-212] 2026-09-29 — A button that starts the dev worker, so a tester needs no terminal

The worker serving the dev site runs only while somebody is testing, which until now meant
somebody with an SSH key had to start it. That is fine when the tester is the owner and useless
when it is anybody else. There is now a manually triggered workflow in the Actions tab: up or
down, and how long before it stops itself.

The shutdown timer runs on the machine rather than in the job, because a job that slept for eight
hours would spend eight hours of the Actions allowance doing nothing. Running the workflow again
cancels the previous timer before setting a new one, so asking a second time extends the session
instead of leaving two timers to fight over the container.

The whole hazard of a staging worker is which database its env file names, since that is the only
thing distinguishing it from the production one. The workflow compares the two secrets and refuses
to start if they name the same database, without either string reaching the log.

Worth knowing for whoever is testing: only video and photo improvement need the worker at all.
Everything else on the dev site works without it, so forgetting to press the button stalls two
things rather than breaking the site.

## [PR-211] 2026-09-29 — Every size this store makes an image in, declared once

The last part of the media library. A surface asks a picture for a size and gets a URL; the first
ask renders and records a derived image, and every later ask finds that one, because the pair of
source and surface is what identifies it.

Seven surfaces are declared in one table beside the stored ceiling, so no surface can ask for more
pixels than we keep — which would be an upscale of the original wearing a size's name. Adding a
channel is adding a row, and the guard that already held the zoom rule now holds every row to the
ceiling too.

The rule worth knowing is which picture a rendition is made from. A shop's own crop is used when
it has the pixels, and when it does not — a portrait asked of a square crop — the rendition reaches
back to the untouched original instead of enlarging what the shop cut. Losing the shop's framing is
the lesser harm: a stretched picture is one nobody chose. The record still belongs to the crop that
was asked, because that is the pair the next request looks up.

The first caller is the link preview on a shop's brand page, which a social host fetches itself, so
the optimizer never sees it and the full cover used to go over the wire on every share. It falls
back to the cover if anything goes wrong: a large preview beats none, and a metadata function must
not take a page down.

Retiring a source now retires its renditions with it, by query rather than a trigger, so the rule
is readable where it is owned and the sweep collects their objects on the usual schedule. A crop
and an improvement are pictures the shop made and outlive the source they came from.

## [PR-210] 2026-09-29 — The payment backstop moves onto the worker, and the cron is retired

The sweep that catches a payment we were never told about now runs on our own worker, hourly. The
Vercel cron and the route it called are gone, along with the last reader of `CRON_SECRET`.

It ran every fifteen minutes when it was written and became daily because the host's free plan
refuses a deployment whose cron fires more often — a property of where the schedule lived, not of
the work. The cost was real: an abandoned checkout held stock out of sale for up to a day, a buyer
whose webhook was lost waited as long to see their order confirmed, and only twenty orders were
examined per run.

It is hourly rather than back to fifteen minutes because the schedule floor is an hour and the
idle worker's modelled day already stands at 1441 operations against a declared ceiling of 1500.
Even a half-hourly floor models past it. Going faster is available and costs a raised ceiling,
which is a decision rather than a constant (ADR-0038 D8). An hour bounds a stuck checkout at about
seventy minutes instead of a day.

Every run now reports, including the quiet ones. The handler this replaces logged only when it had
recovered something, so a sweep that found nothing and a sweep that never ran produced identical
silence — which is no way to watch a backstop, and would have made the observation this move was
supposed to wait for impossible.

Nothing about what the sweep decides has changed. It still asks the gateway before touching
anything: captured confirms the order through the same routine every other trigger uses, in flight
holds the goods, and only what the gateway says was never paid gives its stock back.

## [PR-209] 2026-09-29 [CONTRACT] [MIGRATION] — The platform can see every library, and take one image down

The platform owner's read-only view across every shop's media, filterable to one shop or to the
platform's own collection, with the one write being a takedown carrying a reason.

The listing is the shop's own query with its organisation filter widened, not a second query, so
the two screens cannot come to disagree about what a library holds. The screen renders on the
server and pages by link; the only browser-callable route behind it is the takedown, because the
takedown is the only thing on it that writes.

A takedown differs from a shop retiring its own picture in two ways, both deliberate. It is not
refused while the image is still on a page — a breach comes down now, and the pages stop pointing
at it afterwards — and the reason is stored on the asset rather than only in the audit trail,
because the shop has to be able to read why without an admin to ask. The shop sees "Taken down by
Bhendi Bazaar" and the words, never which admin wrote them.

Two rules that were about to be spelled twice are now declared once: which picture stands for an
asset in a listing, and how this store prints a plain day.

## [PR-208] 2026-09-28 [CONTRACT] [MIGRATION] — The shop says who it is, and what to leave out

The last part of the brand page. A shop can now name the person behind it, write up to three
blocks on how it works, give its handles and its location, and switch off any of the parts it
wrote itself.

The person is invited, never required, and hangs on a name: a role, a photograph or a quoted line
without one are kept in the column and not shown, because a face with no name is not an
introduction and an unattributed line is copy. The person belongs to the story rather than sitting
beside it, so a shop that has named somebody but written nothing still has a story section.

Hiding is subtraction at the source. A hidden section's content never enters the payload, so there
is no renderer — a cached page, a link preview, something written later — that can show it anyway.
What a shop may hide is what it wrote. Reviews, orders filled and the goods are not on offer:
proof is derived and never typed, and a page whose reviews disappear when they turn unflattering
is not proof of anything. That reading of "any optional section" is the one judgement call in this
change and it is the owner's to overturn.

With no placeholders anywhere, a shop cannot tell a section it has not filled from one that is
broken. So both the storefront screen and the dashboard now say what the page shows, computed by
running the buyer's own extractors over the shop's own payload — never a second opinion — with the
one fact each missing section is waiting for, and no link where no form would supply it.

The checkbox primitive was fixed on the way past: its label was not associated with its input, so
the tap target was the sixteen-pixel box alone in all nine places it is used.

## [PR-207] 2026-09-28 — What the gate cannot see had drifted in every doc it does not check

`npm run docs:check` guards `Verified:` dates, the generated indexes and a handful of counted
things. Everything outside that had gone quietly wrong, and an audit of the last twenty-five
commits found it in all six of the long-lived documents.

The architecture diagram still said the object store held images only, four lines above a sentence
about video playing from it; it called images the one asset class with a delivery layer of its own,
which stopped being true when the worker started making renditions; it counted four inward
type-only imports where there are seven, and forty lint errors all of one rule where there are
thirty-seven of three. The contract for requesting an enhancement named `sourceAssetId` as though
it were required and did not mention `sourceRef` at all, so a client written from it would have
been refused by a schema that wants exactly one of the two. Dependencies carried a second
`## Removed` heading declaring the populated one above it empty, and credited `sharp` to two
callers when eleven import it — the material point being that it is now a worker dependency.

Testing was the stalest, being the only one untouched by any of those commits. Its tree listed
`utils/` as holding shared fixtures when it holds nothing, and omitted `helpers/`, which the same
document depends on two paragraphs later. Seven of the ten directories under `tests/` are empty and
now say so. Its guard table was missing the two guards added since. Operations described photo
enhancement nowhere in the worker's own section, although the worker is what runs it, so a machine
provisioned from that section alone would have failed every run; and it still offered to trim the
image "once a second job type exists", with four of them running.

One finding in the audit was wrong and is recorded here because a claim that a document lies is
worth checking before repeating: there is no sentence saying the project has no background job
runner. The statuses in the specs were otherwise sound, bar the parent of the brand page, which had
not noticed its own child shipping a second part.

## [PR-206] 2026-09-28 — The backlog said a finished feature was planned, twice

`BACKLOG.md` is the one index nothing generates and nothing gates, and it had drifted in three
places: image enhancement was still a draft after all five of its parts landed, the brand page was
missing the part that shipped beside it, and the worker still waited on an account for a machine
that has been answering its heartbeat for a day.

Image enhancement also appeared twice — once as the spec it became and once as the plan entry it
used to be, each carrying its own status. One of the two had to be wrong eventually, so the plan
entry is gone and the spec row is the single answer. The worker's own spec carried the same stale
sentence and now says what is actually left, which is moving the reconciliation schedule across.

## [PR-205] 2026-09-28 — The media backfill has been run against production

Recorded because the runbook asks for it. 336 asset records now stand behind what production
holds: 281 images and 55 YouTube references, with every product gallery, category hero, banner,
org banner and org profile linked and nothing left unlinked.

280 of the 281 images carry dimensions, a content hash and an object key. The one that does not is
a Vercel Blob URL on a test product, left from before the move to R2; it answers 403, so there are
no bytes to measure, and it belongs to no store of ours, so it correctly has no key. It will be
listed as without dimensions on every future run, which is the honest answer rather than a defect.

Dev has not been run. It needs its own connection string and the dev bucket's public base, and the
store check refuses the pairing if those two disagree.

## [PR-204] 2026-09-28 — The rehearsal now says what the real run will refuse

The store check added in the previous entry ran only on a write, so the report before it printed a
confident plan — counts, links, one image without dimensions — against a store it had not
recognised a single URL from. The first real use found exactly that: a production reference file
whose `R2_PUBLIC_BASE_URL` was still the example placeholder, caught by the write and not by the
report that preceded it. A report now carries the same finding as a warning.

## [PR-203] 2026-09-28 — A backfill that recognises none of its own library stops

The media backfill reads one database and one bucket, and nothing downstream noticed when they
were not a pair. Dimensions arrive over plain HTTP from the stored URL, so a run against the wrong
combination still wrote a full-looking record — missing only `objectKey`, which is the field crop,
improve and the deletion sweep all read. The run is idempotent on the reference, so the corrected
second run skipped every asset the first had made and the empty key was permanent.

A write now samples the references it is about to record and stops when not one of them belongs to
the configured store, which is the shape of a production database paired with a development
bucket. A library of genuinely external URLs is a real state, so the refusal is overridable with
`--allow-foreign` rather than being a rule. The runbook now also says how to aim the script at one
database, and that a variable the passed file omits falls back to the local `.env` without a word.

## [PR-202] 2026-09-28 — A shortfall is the same refusal wherever it is noticed

Two places can find that the units are not there: the allocation's availability read, before the
order transaction commits anything, and the guarded decrement inside it. Only the second named the
products, and naming them is what makes the caller release abandoned holds and retry
([checkout-abandonment](specs/checkout-abandonment/) D4) instead of turning the buyer away. So a
buyer meeting a unit held by a closed payment window got the retry or did not depending on which
check happened to fire, which is to say depending on who committed first.

Both now raise the same error with the product named. Nothing about the answer to the browser
changes — it was a 409 before and it is a 409 now — but the case the retry exists for is no longer
decided by a race. The concurrency test that caught this asserted the invariant correctly and
passed on a laptop while failing on CI, for exactly this reason; the comment beside it now says so.

## [PR-201] 2026-09-28 — Enhancement runs on the worker, and the worker's env file never said so

The tools that rework a photograph run as queue jobs, so their configuration has to reach the
worker as well as the web app. `.env.worker.example` listed the database, the environment and the
image store, and nothing about the hosted model — which meant a deploy built from it produced a
worker that refused every setting needing that model, while the same key sat correctly in Vercel.
The three variables are in the template now, with the sentence that explains why they are needed in
two places rather than one.

The staging block also now says to run that worker on the machine rather than on a laptop. It
publishes no port and mounts no named volume, so it sits beside the production stack for nothing,
and it keeps running once the laptop that started it is shut — which is the whole point when the
person testing is not the person who started it.

## [PR-200] 2026-09-28 — The three enhancement variables were documented everywhere but the file people copy

`OPERATIONS.md` describes `IMAGE_SEGMENT_PROVIDER`, `IMAGE_MODEL_API_KEY` and `IMAGE_MODEL_ENDPOINT`
in full, and `.env.example` — the file a new environment is actually built from — mentioned none of
them. A local setup therefore came up with background removal quietly unavailable and nothing to
suggest a variable was missing. They are listed now, in the optional section, each with the one fact
that decides whether it is needed.

The object store's comment also said the public base feeds `img-src`. It feeds `media-src` too, and
that omission is what the previous entry was about.

## [PR-198] 2026-09-28 — In a scene: the last improvement, and the one that must not redraw the product

The sixth improvement is here, and it is the one the whole feature was careful about. A shop picks
one of five settings — a wooden table by a window, a marble counter, a shop shelf, a fabric drape, a
plain studio colour — and the photograph comes back with the product standing in it. The settings
are the platform owner's list and nothing else: there is no box to type a description into, because
a free prompt is a way to ask an account we pay for for a picture nobody has seen, and a fixed list
is what makes the promise below checkable. Each setting carries the shape it is for, square where a
marketplace wants one and tall where an Instagram post does, so the member chooses a picture rather
than a geometry.

The promise is that the product does not change. A service is asked for a **setting**, never for a
result: whatever comes home is treated as a backdrop, our own cut-out goes back on top at a
placement we chose, and the product's pixels are compared to the cut-out's with no tolerance before
anything is encoded. If a service quietly re-rendered a logo, its version is covered by ours; if the
product in the composite differs by one channel of one pixel, the run fails rather than putting a
proposal in front of somebody. That check is the one `white` and `studio` already run, and it was
written for this case.

Painting sits behind its own interface with one implementation, which is a deliberate asymmetry: a
cut-out has a free route and a bake-off to choose between two, and a scene has neither, because
nothing we already pay for generates a picture. The seam exists so a second painter arrives as a
file beside the first rather than as a rewrite of the tool that calls it. The key and the host both
services buy from are now read in one place, since they are the same account.

A scene is also the first improvement that costs real money — about ₹3.50 a run, and a little more
when the cut-out came from the paid model too. The ledger records the sum of what one run actually
spent rather than the price of its last step, because the platform's daily cap counts money and not
steps. There is no second column for the breakdown: one number that is true beats two that can
disagree.

Which leaves the thing to know before trying it. The account has a key and no balance today, so a
scene will fail until one is added, and it fails legibly: the member is told "The picture service is
out of credit. Ask the platform owner to top it up.", the run is charged to nobody, and every other
improvement carries on. Nothing here needed a balance to build or to test — every suite stubs the
network, and the tool is exercised over generated pictures with both services stubbed, including the
case where the painter returns a scene with its own idea of the product in the middle of it.

## [PR-199] 2026-09-28 — A video would not play, and the policy said nothing

A hosted video mounted its player, took the poster, and then sat at nought. Every link in the chain
checked out: the file was in the bucket, it served `video/mp4` over a range request, the rendition
probed as valid, and the row that fed the player was complete. What was missing was a
Content-Security-Policy directive. A `<video>` draws its bytes under `media-src`, and the policy had
no `media-src` at all, so it fell back to `default-src 'self'` and the bucket domain was refused.

The poster beside it loaded throughout, because a poster is an image through the optimizer on our
own origin, which is why nothing about the surface suggested a policy problem. `media-src` now names
the bucket and nothing else: the hosts allowed to serve a thumbnail have no business streaming bytes
into a player, and an embedded video is an iframe under `frame-src`, which is a separate question
already answered. `tests/unit/security-headers.test.ts` fails if the directive goes missing again.

## [PR-197] 2026-09-28 — A stored file is filed under who owns it, not what it was for

Everything an organisation uploaded landed under `products/<org-code>/`, which was true while every
upload belonged to a product. A library that holds pictures belonging to no product, and videos that
are not products at all, made it false: a library upload was filed under `products/…/library/` and a
video beside it. An organisation's files are written under `org/<org-code>/` from now on, because an
owner is the one thing about a file that never changes, and the presign route signs nothing outside
the caller's own prefix exactly as before.

Files already written keep their keys. A key is opaque, nothing reads meaning from one, and moving
them would mean copying every object and rewriting every stored reference — risk spent on tidiness.
The bucket will show both shapes for a while, and that is the cost of not taking the risk.

## [PR-196] 2026-09-28 — Two lines in the library sheet that should not have been there

"Use the video's own frame" was offered on every video, including the ones showing exactly that
frame, where pressing it did nothing. It appears only where a photograph is standing in and there
is a choice to undo, which the asset now says.

"N pictures were made from this one" is true of a photograph, whose derivatives are the crops and
improvements somebody made deliberately. A video's derivatives are its playable copies and its
poster — machinery the library already hides from the grid — so the line said the plumbing out loud
and read as though the shop had made something. A video does not carry it.

## [PR-195] 2026-09-28 — A run counts when it runs, not when it is kept

A discarded improvement handed its slot back. By the time a proposal is on the screen the service
has been paid and the platform's day is that much shorter, so a shop could have spent the
platform's money without spending any of its own — and a shop asking for ten scenes and keeping one
would have shown as one. Use now counts every run but a failed one, which is the single case where
nothing was produced. The sheet says so before a tool is chosen rather than after: "Each one you run
counts, whether you keep it or not." The cost of a failure that had already reached a service stays
recorded against the platform's day, because that money did leave.

## [PR-194] 2026-09-28 — One video, one item: what the first real upload showed

Three faults, all visible in a single clip filmed on a phone.

The library listed the video's renditions and its poster frame as items of their own, so one upload
became three tiles. Those are the video's machinery, not pictures anybody would choose; the library
lists what an org member would use, so anything derived from a video is left out of it. A crop or an
improvement made from a photograph is a picture they made deliberately and stays.

A phone films landscape and writes an instruction to turn the picture, so a portrait clip's stream
reports itself as landscape. The probe asked only for the stream's own width and height, so a
240 by 320 video was recorded as 320 by 240 and every later number was measured against the wrong
one. It reads the turn now, from the display matrix or from the older tag, and reports the picture
as it will be shown.

The player told the browser not to load anything and then asked it to play, and between the two the
video sat at nought. The element exists only because somebody tapped play, so it loads, and starting
is asked for explicitly — a browser that declines simply leaves its own play button.

## [PR-193] 2026-09-28 — Make it big enough, and say which channel is asking

Image-enhancement spec R1, R6, A4. The fifth improvement is live: make it bigger. A phone photograph
that a marketplace calls too small is now something a shop can fix in one tap, and the result is a
proposal to compare and accept like every other improvement.

It is a plain resize on our own machines, with no service behind it and nothing to pay. That is a
promise about the product before it is a saving. An AI upscaler does not enlarge a photograph, it
reimagines one: it invents detail the camera never saw, which is precisely the redrawing this feature
refuses to let any service do to a product. A resize cannot change what the thing looks like. It only
makes the file large enough for a marketplace to take it. So a reconstructing upscaler is not deferred
until it is cheap enough, it is out, and the spec now says so. The picture grows by whole steps to the
smallest size that clears what the channels ask, never past what we store, and a photograph that is
already big enough is refused rather than proposed back unchanged, since a proposal that changes
nothing still costs a shop one of its monthly runs.

What the channels ask is now written down in one place, each number beside where it comes from:
Amazon's thousand pixels and the sixteen hundred that turns its zoom on, Flipkart's thousand,
Instagram's ten-eighty square. Our own store is in that list with no rule at all, and that is the
point of the list. The store takes what the shop has. A marketplace's minimum is asked at the moment
a picture is put to that marketplace, never when a product is saved, never on a page a buyer reads,
and there is now a test that reads the source and fails if that question turns up in the storefront,
in the product write path or in the server-side reads. A size rule that starts at the moment of use
and creeps inwards is how a shop with a real photograph of a real thing ends up unable to list it.

The warning a photograph already gets now offers the fix instead of only naming the fault. A dark one
offers to brighten it, a small one offers to make it bigger, and the sheet goes straight to work
rather than asking again which improvement was meant. A blurred one offers nothing, because nothing
un-blurs a photograph and pretending otherwise would cost a shop a run to find out.

## [PR-192] 2026-09-28 — Improve a photograph from the library, beside Crop

Image-enhancement spec R2, R3. The tools were reachable only from a gallery slot, which is where a
photograph is used but not where a shop keeps its photographs. The library sheet now offers Improve
beside Crop for any ready picture. A request names its photograph by the asset when the caller knows
it, as the library does, and by the URL its row carries when that is all there is, as the editor has;
never both. Accepting in a gallery hands the slot the result, as before. Accepting in the library
adds the improved picture beside the one it came from and the grid re-reads, because there is no row
to hand it to — which keeps the one rule the feature rests on: an improvement is a new picture, never
an edit of an old one.

## [PR-191] 2026-09-28 — Cut out, on white, in a studio: the first improvements that need a provider

Three of the six improvements are live, and they are the three a marketplace actually asks for. Cut
out takes the product away from whatever it was photographed against. On plain white puts it on a
square of pure 255,255,255 with an even margin, which is the shape Amazon and Flipkart check for. In
a studio puts it on a soft neutral backdrop with a contact shadow under it, which is the shape an
Instagram post wants. Each runs on its own, in the background, and comes back as a proposal to
accept or discard like the brightening did.

Cutting a product out is the first thing this store cannot do by itself, so it is also the first
capability with a seam. One interface, two services behind it: the image host our own pictures are
already served from, which does it as part of a delivery transform and is free for the first five
thousand a month, and a hosted vision model that is better on hard edges and costs about a fifth of
a paisa an image. Which one runs is one environment variable, it falls through to the other when the
preferred one is not set up, and two files in the whole repository know that either vendor exists.
Nothing an org member reads ever names one: a service that fails says the background could not be
removed just now, in their words, and the run fails where they asked for it rather than retrying
forever. Every call out is bounded at thirty seconds so one bad afternoon at a provider cannot stall
the queue.

The ledger now prices a run by the tool *and* the service that performed it, and records the service
that actually ran rather than the one the request planned for. A request for a cutting tool is
refused up front where no service is configured at all, before a shop spends a slot on a run nobody
could have performed.

The promise that matters is the one about the product. A backdrop is painted around it and never
over it: the cut-out is placed unresized, and every opaque pixel of it is compared to the composite
before anything is encoded, with no tolerance at all. A run whose product changed fails rather than
proposing it. The comparison happens before the WebP because WebP is lossy, and a check that had to
allow for the encoder would have to allow for a quietly redrawn logo too. The test moves one channel
of one pixel by one and expects red.

Choosing between the two services is a script rather than an argument. It takes a shop's newest
photographs, runs every service that is set up over each of them, and writes a plain page laying the
results side by side, on mid-grey where a halo shows and on white where it will be used, with how
long each took. It records nothing and creates no library image; the whole run lives under one
prefix in the object store that can be deleted afterwards.

One smaller thing, dropped out of the above: a proposal's format is no longer assumed to be WebP. A
cut-out is transparency, and flattening it would have thrown away the entire result, so each tool
now declares what it writes and the proposal's key carries that extension.

## [PR-190] 2026-09-28 — The enhancement allowance and the daily cap are the platform owner's to set [CONTRACT] [MIGRATION]

The two numbers deciding how much photo improvement the platform pays for were constants in a
source file, so answering the first provider bill would have meant a release. They are settings
now — edited on a new admin screen, in force on the next request — defaulting to 300 enhancements
per shop a month and ₹500 a day across every shop.

An allowance resolves through three declared layers: the shop's own number, the platform's setting,
then a constant that exists only so an unconfigured database still answers. A shop's row records a
*deviation* — a number of its own, or a pause — where it used to carry a copy of the platform's
allowance that would go stale the day that changed. A shop at the default now carries no row at
all, and setting one back to the default deletes its row rather than rewriting the same number.

The screen shows today's spend against the cap and a card per shop: this month's use, what it cost,
the allowance that applies, and a pause switch with the reason its members read. The cap is typed
in rupees and travels as paise. Both routes are platform-admin only and audited. Admin was the last
of the five planned PRs and is now the second, because the owner asked for it before the provider
work rather than after.

## [PR-189] 2026-09-28 — Crop a photo already in the library, and stop calling lineage a use [CONTRACT]

Three things the first real use of the library turned up.

A photograph already stored can be reframed: the library sheet gains Crop, the same frame opens on
it, and the cut is made on the server where its bytes already are rather than fetched back into the
browser. The result is a derived picture beside the one it came from, which is left exactly as it
was — so a reframe can be done again, from the original, as many times as it takes.

A picture made from another was being counted as a use of it, which read as though a product were
showing it and refused its retirement. It is lineage, not a use: nothing on a screen breaks when the
source leaves the library. Uses are now only the places an asset is *shown* — a gallery row, a
category hero, a shop's mark or cover, a banner, a video's poster — and a separate line says how
many pictures were made from it. The source's file is still kept for as long as any of them exists,
because that is what a rendition falls back to, so the promise the spec made is not quietly dropped:
the sweep leaves a retired source's object alone while it has children.

A library is mostly images used nowhere yet, so the "unused" tag said nothing on nearly every tile.
A tile carries a count when there is one and nothing when there is not; the Usage filter is how the
unused are found. The editor's row thumbnail also stopped centre-cropping: it contains the picture
now, so "use as is" looks like what was actually stored.

## [PR-188] 2026-09-28 — The crop frame shows the picture: the preview belongs to the queue

The frame was still empty after the stylesheet was imported, and this time it could not even be
used: the picture never loaded at all. The frame made its own preview URL while rendering and
released it in an effect's cleanup, which in development runs once before the second mount — so
every frame was handed an address that had already been given up. The queue that holds the photo
now makes the preview when the photo joins it and releases it when the photo leaves, which is the
one lifetime a remount cannot cut short, and the frame is handed a picture rather than making one.

## [PR-187] 2026-09-27 — What the first local test of the crop frame and the improve sheet found

The crop frame showed no picture and the dialog scrolled instead of fitting. Two causes. The crop
library ships a stylesheet rather than injecting one, and nothing imported it, so the frame had no
bounds and the picture was laid out by the page's own image reset — which is to say not shown at
all; the dependency register said the opposite and now says what is true. And the frame asked for a
square of its own inside a panel that then outgrew the screen: it takes the room the panel has left
instead, the panel's height is settled before its content is laid out, and nothing inside a canvas
task scrolls but the one part with more to see — the picker's tiles. On a wide screen the panel now
stops short of the edges.

Asking to improve an extra photo was refused with "please correct the highlighted fields": a photo
that fills no slot sends `null`, and the schema accepted only an absent field. Saying "this has no
slot" and saying nothing are both read as no slot now, and four cases pin the request's shape.

## [PR-186] 2026-09-27 — An overlay's surface follows its content

[ADR-0040](adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md). The bottom sheet was the
right answer for a phone and had quietly become the answer for everything: a country list, a date
range, a crop canvas, a before-and-after, a grid of pictures to choose from. On a laptop each of
those opened a narrow panel against the right edge — a two-month calendar cramped in it, a crop
canvas unusable, a three-up grid showing one and a half tiles. The rule is now four cases, and each
surface carries its own phone form so a component never chooses between screens: a value picked
from a set opens against its field as a popover from the desktop breakpoint and a sheet below it;
a task with a canvas is a dialog sized to its content and a full-screen sheet below; the details of
a selected item stay a side panel; a short flow the page hands off to stays a sheet.

`ResponsivePicker` and `TaskDialog` are the two pairs, and Radix's popover joins the dialog already
here, dressed in our tokens. The country field and the date range become pickers; framing a photo,
comparing a before and an after, and choosing from the library become canvas tasks — the first two
renamed to say so. `tests/unit/overlay-surfaces.test.ts` fails a new sheet outside the four cases
and keeps its allowlist honest, so the next overlay is a decision rather than a reflex.

## [PR-185] 2026-09-27 — Image enhancement, part one: the ledger, the quota, and a dark photo fixed [CONTRACT] [MIGRATION]

Image-enhancement spec R1–R3, R7, R9, R10, A1; trd D1, D2, D5, D6, D8, D9 — the first of five, and
the one that needs no outside service. A `content` domain is added for what is made from an image:
it reads catalog's assets through catalog's public surface and never its repositories. An
enhancement is a row and a job. Asking for one is refused, in words the form shows, when the shop is
paused by the platform owner, when it has used its month's allowance, when the platform has spent
today's cap, when the photo is the label — evidence to be read later, never enhanced — or when the
tool has no pipeline yet. Otherwise the row and the job are written in one transaction, so neither
can exist without the other.

The first tool is "fix the light": normalise, a gentle gamma and an unsharp mask, with sharp on the
worker and no provider, so it costs nothing and is deterministic. The result is a proposal, not an
image: it lives under a proposals key until the org member has seen it. The editor's "Improve…"
opens a sheet that runs the tool, waits, and shows before and after; Accept copies the proposal to a
final key and registers it as a derived image of the source, and the slot takes it with its cover
flag and description intact; Discard deletes the object and leaves no trace. The original is never
touched either way. `Enhancement` and `OrgEnhancementPolicy` arrive with the tools, the states, the
month's allowance of two hundred and the platform's daily cap, all declared once.

## [PR-184] 2026-09-27 — The brand page shows its proof: rating, orders fulfilled, and what buyers say [CONTRACT]

Part (c) of seller-profile PR 4 ([brand-page](specs/seller-profile/brand-page/) R1, R3, R4; trd D2,
D3). The proof strip part (a) left as a seam now draws the shop's rating with its review count and
its orders fulfilled, each only above a declared floor — three published reviews, ten paid orders —
and is absent when neither clears one. A new section, "what buyers say", quotes the shop's three
newest published reviews with stars, the frozen author name, the verified mark, a clamped line and
the piece linked, between the brands and the newest goods; it shares the rating's floor. Every
figure is derived through public surfaces: the review service's org-level rating and recent list
under the visibility rule and the catalogue's available shelf, and the order service's paid-order
count, orders not lines. The shop-level average applies the product rule per piece, so one shopper
is one voice. `BrandPageDto.proof` is filled and the DTO gains `buyersSay`; `ShopReviewDto` is a pick
of the review DTO plus the product's name and slug, never a `userId`.

## [PR-183] 2026-09-27 — Hosted video plays: the player, the poster you choose, and video into the library [CONTRACT] [MIGRATION]

Video-hosting spec R1, R4, R8, R9, A3; trd D5, D7, D8. The product page's video slide plays: a
native `<video>` behind the poster, mounted only on a tap, with no script from another host. A wide
screen starts on 1080p and a phone on 720p, or on the largest the worker made, and a button group
in the slide's corner switches rendition keeping the viewer's place; full screen is the browser's
own control. A swiped-away slide goes back to its poster so nothing plays unseen; a failed video's
slide says it is not available. The library sheet plays a ready video with the same player. An org
member can choose any of their ready photographs as a video's poster: the library picker, restricted
to photographs, sets it; "Use the video's own frame" clears it; one function resolves the chosen
photograph over the worker's frame for the product page and the library alike. A photograph standing
in for a video counts as in use, so its retirement is refused. The library's upload button accepts
photos or a video together. `MediaAsset.posterAssetId` is added; `MediaAssetDto` carries the
renditions so the sheet can play. The video-hosting subfeature is implemented.

## [PR-181] 2026-09-27 — Hosted video, part two: upload, transcode job and the poster [CONTRACT] [MIGRATION]

Video-hosting trd D1, D2, D3, D6, D7. `MediaAssetKind` gains `VIDEO`, `MediaAssetState` gains
`PROCESSING` and `FAILED`, `MediaAsset` gains `durationMs` and `failureReason`, and a gallery row's
`MediaKind` gains `VIDEO`. The presign accepts `video/mp4`, `video/quicktime` and `video/webm` up
to 200 MB, naming the limit when it refuses, and registers the pending row as a video; the confirm
moves it to PROCESSING and enqueues `media.transcode` in the same transaction, so neither exists
without the other. The web app enqueues from the job's spec — name, payload, group — while the
handler is registered only where the worker imports it, so the web process runs no ffmpeg plumbing.
The worker downloads the source, probes it, refuses a clip past the limit with the limit named and
its bytes deleted, otherwise stores the fitting renditions and a poster beside the source as
DERIVED assets and finishes the source READY; a re-run makes only what is missing, and any other
failure is the queue's to retry and park, the source kept processing. The gallery editor's "Upload
photos or a video" sends a video as picked — no downscale, crop or capture check; a video is never
the cover and never fills a slot, and links to its asset from confirm on. The library lists
processing and failed videos with a state badge, duration and the failure reason; the picker gains
a Videos tab; the product page shows the poster, or a placeholder while processing, with no player
yet. The media backfill skips VIDEO rows.

## [PR-182] 2026-09-27 — The shop's about page becomes a brand page, drawn from what the platform knows [CONTRACT]

Brand-page spec R1–R3, R6–R11; TRD D1, D4, D5, D7, D8, D10 — part (a) of seller-profile PR 4,
reading only what exists today. `/store/<handle>/about` is a fixed sequence of sections the platform
orders and each shop fills: a hero (cover, mark, name, tagline, location and since-when, with the
call to shop docked above the tab bar on a phone), the story, what they sell as the storefront's
category rail, the brands they carry as names only and only when there are two or more, their six
newest goods as the marketplace's own tiles, their terms in a collapsed disclosure, and the ways to
follow them. A section with nothing to show is absent rather than blank — the goods alone show the
storefront's honest empty state — so a shop with only a name has a page with no placeholder sentence
on it. Ways to follow are handles on four known networks; the platform composes every address and a
pasted URL yields no link. `BrandPageDto` is added and held to a literal allowlist; the proof strip
is a seam that draws nothing until part (c); the owner, pillars, social editor and section toggles
are part (b), with the migration.

## [PR-180] 2026-09-27 — Hosted video, part one: the limits and the transcoder

Video-hosting trd D3, D4. The declared limits — ninety seconds, two hundred megabytes, 1080p and
720p, a poster a second in — live in one module; the transcode module probes a clip, refuses one
past the limit with the limit named, makes the fitting renditions as H.264 MP4 with the index up
front, takes the poster, and runs one encode at a time. ffmpeg joins the worker image as a Debian
package and the CI test job, and the transcode test runs the real binary against a generated clip
rather than a stub. Nothing reaches a screen yet: the upload path, the job and the player follow.

## [PR-179] 2026-09-27 — The image-enhancement spec, and video-hosting accepted

Documentation only. The image-enhancement spec and TRD are drafted from the brainstorm the owner
closed today: six tools applied one at a time, on demand only, each result a before-and-after the
org accepts or discards; a scene painted around the org's own cut-out, never over it; the label slot
never touched; a warning that never blocks a save but blocks a channel at the moment of use; a
monthly allowance per org, a daily platform cap, and a per-org pause for the platform owner; one
provider seam with a bake-off before a provider is chosen; Photoroom out of scope. The video-hosting
defaults are accepted.

## [PR-178] 2026-09-27 — Rotate and crop at upload, kept as a derived image [CONTRACT]

Media-library R8a and A2a, trd D6a. Picking a photo for a slot or as an extra now opens a sheet
before anything uploads: the picture in a touch crop widget with 1:1, 4:5, 3:4 and free presets,
quarter turns left and right, pinch or scroll zoom, and no colour control, since a filter
misrepresents a product on a marketplace. "Use as is" uploads the untouched photo exactly as
before. "Use this crop" uploads the untouched photo as the source and the crop as a second object,
registered as derived from it with the rotation and rectangle recorded, and the crop's URL is what
the gallery row carries; a multi-file pick is framed one photo at a time, with "Use all as is" to
skip the rest. The upload token request may carry `derivedFrom`, accepted only for a ready source
the caller owns, and `uploadDirect` now returns the asset id beside the URL. `react-easy-crop` is
the one package added, for the gesture handling a hand-rolled crop gets wrong on a phone.

## [PR-177] 2026-09-27 — The gallery is a list of named slots, and a photo is checked before it is kept

Media-library R4 and R8, trd D4 and D6. The product editor's gallery was a strip of slot badges
with a select per photograph; it is now a vertical list of the category's slots. An empty slot
shows its name, its framing hint and a silhouette of the shot it wants, with one tap for the
phone's camera or a file and one for the library; a filled slot shows the photo with cover,
move-to-extra and remove. Extras and video sit beneath in their own order, and the saved order is
always the slots then the extras. Every uploaded photo is judged on a small canvas — dark, blurred,
or smaller than any marketplace accepts, by the slot's role — and a warning is a banner with
Remove and Keep anyway, never a refusal. Rotate-and-crop follows as its own unit.

## [PR-176] 2026-09-27 — Video will be hosted on our own store: ADR-0039 and the video-hosting spec

Documentation only. The owner decided on the 27th that short product videos are stored in our
object store and transcoded by the worker, which is what the worker was pulled forward for.
[ADR-0039](adr/0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md) records it
and supersedes ADR-0017's first and fourth decisions; YouTube links stay supported as embeds. The
subfeature spec and TRD are drafted under media-library with the defaults — ninety seconds, two
hundred megabytes, 1080p and 720p — left for the owner to confirm. The conventions index in
CLAUDE.md points at the new decision.

## [PR-175] 2026-09-27 — Onboarding shows its three steps, and the store's readiness

The three onboarding screens existed but nothing put them in sequence, so a new org landed on a
dashboard of zeros with no sense of what to do next. The org dashboard now opens with a card that
shows the three steps — open your shop, describe it, say what you sell — with each one's done state
and a link into the page where it is done. Beneath them sits per-channel readiness: the store's is
computed now, from an active pickup location and a product on sale, and names what is still missing
as a thing to do; Amazon, Flipkart and Instagram report unknown through the same seam until the
listing rules compute them, shown as one muted line rather than a placeholder each. Once every step is
done and the store is ready the card collapses to a single line. The rules are pure and unit-tested;
the card fails alone, like every widget below it.

## [PR-174] 2026-09-27 — One date-range field for the library, with a calendar

Two native date inputs were too many taps and never showed the range. The library's date filter is
one field: a button naming the range — "12 Sept – 27 Sept 2026", or "Any time" — opens a sheet with
a two-month calendar in range mode, the picked range highlighted, and presets for the last seven
and thirty days and this and last month. The range still travels as two day keys in the URL, so
nothing on the server changed. `react-day-picker` is added for the calendar, styled through our
tokens ([DEPENDENCIES.md](DEPENDENCIES.md)).

## [PR-173] 2026-09-27 — Library filters re-render the grid instead of reloading the page

Picking a filter navigated the whole page — a plain form submission — which read as a flicker, and
left a Filter button nobody needed. The filters now navigate on the client: the URL still carries
them, so the page is still a link, but only the grid re-renders. The button is gone.

## [PR-172] 2026-09-27 — The specs catch up with the side fixes

Documentation only. The seller-profile spec gains R11 (a change of default brand is announced, an
origin is chosen from a list) and its TRD gains D9 (a country is an ISO 3166-1 alpha-2 code, named
by the runtime, a table rejected) with the screen described as built. The stock-locations spec gains
R12 (the portal's product form never asks which organisation, and adds a missing pickup location
where it stands). From here every unit carries its spec and TRD changes in the same commit.

## [PR-171] 2026-09-27 — The worker card opens into the jobs behind its counts

Worker-foundation R5, trd D11. A count says a job is stuck or failed; the list says which one and
why. The card gains "Show recent jobs", closed by default: on a tap it fetches the newest twenty on
both queues through an admin route and shows each job's type, state, timing, attempt and, for a
failed one, the reason pg-boss recorded. Nothing is stored and the dashboard itself pays nothing
until the list is opened.

## [PR-170] 2026-09-27 — A video's uses are counted, "used by" is a summary, and filters apply as picked

A video carried by two galleries read "unused" in the library and offered Retire: product writes
linked only photographs to their asset rows, never videos. A write now links a video to the org's
own reference and creates that reference when the library has not seen the video yet, so the
count and the uses are true; the backfill's write links the rows written before this. The sheet's
"Used by" is a one-line summary — "2 products and 1 storefront banner" — that expands to the list
on a tap. The library's filters apply as each one is picked; the Filter button stays for a browser
without script.

## [PR-169] 2026-09-27 — The worker card says how much got done [MIGRATION]

The card showed waiting, running and failed, so a worker that had just run three jobs read
"0 · 0 · 0" and looked idle. The heartbeat now also counts what finished in the last 24 hours,
in the same single statement, and the card shows it as
"N done in 24h". `WorkerHeartbeat.completedDay` is added with a default, so an older worker's
beat still lands until the image is rebuilt.

## [PR-168] 2026-09-27 — A video in the library shows its poster and plays in the sheet

Library and picker tiles for a video showed a bare mark; they show the video's own poster now,
through one small component that carries the one image-optimizer bypass for it. The library's
detail sheet plays the video with the same tap-to-play embed the product page uses. Videos are in
the library by design (media-library R5a): a reference to reuse, never a file we host (ADR-0017).

## [PR-167] 2026-09-27 — Photos go into the library directly

The library page gains "Upload photos": several at once, downscaled and hashed in the browser,
stored under the org's folder with no product yet, and shown at the top when the page re-reads. The
gallery editor and the library now share one batch uploader (`src/lib/image/upload-batch.ts`), so
the downscale, the check, the concurrency and the duplicate handling cannot drift between them.
A photo the org already holds is reported, not stored again.

## [PR-166] 2026-09-27 — The same photograph is one image in an org's library [CONTRACT] [MIGRATION]

Media-library R13, trd D11. The browser hashes each downscaled file before asking to upload and
sends the digest with the request; when the org already holds those bytes as a ready image, the
token route answers with that asset instead of a signed URL, the client adds its URL, and nothing is
stored twice. The gallery says how many photos were added from the library that way. Deduplication is
within an org on purpose: ownership is the library's unit, and another org's identical file stays its
own. `MediaAsset.contentHash` is added and indexed with the org; the server upload path records it
from the bytes, and the backfill's write gains a pass that hashes images recorded before the column
existed, so older duplicates are recognised after the next `npm run media:backfill -- --write`.

## [PR-165] 2026-09-27 — The country field is a searchable picker

A native select of 249 countries is a long scroll on a phone. Both country-of-origin fields now
open a sheet with a search box over the ISO list: names that start with the typed letters come
first, accents are ignored, a code matches exactly, and Enter takes the first match. The code is
still what is stored.

## [PR-164] 2026-09-27 — What the first local test of PR-161 to PR-163 found

A photograph's slot was saved but reopened as an extra: the edit form's default values dropped it.
A "to" date on the library filters was read as the midnight that starts the day, so a range ending
today excluded today's uploads. The library's Retire button was greyed out with no reason; it is
always clickable now and a refusal says what still uses the image. A library pick can be undone by
tapping the tile again. The org portal's product form no longer asks which organisation — there is
one — and when the org has no pickup location yet it adds one from a dialog inside the form, the
new location joining the stock rows without a reload. Making a brand the default says which brand
stopped being it, and retiring the default brand warns first and says so after. A country of origin
is picked from the ISO list, with names from the runtime's own locale data, and stored as its code.

## [PR-163] 2026-09-27 — The library: browse, reuse, retire, and the first scheduled sweep [CONTRACT]

Media-library PR 3 of 6 ([spec](specs/media-library/spec.md) R6, R7; trd D2, D7). The org portal
gains "Library": every ready photo and video the org owns as the 3-up grid, paged as you scroll
with a button as the fallback control, filtered from the URL by kind, usage, source and date. A
tile opens a sheet with the asset's dimensions, size, format, date, and every place it is used —
a query over the referencing relations at read time, never a counter. An image nothing uses can be
retired; the state change is one conditional statement, so a reference landing between a check
and a write cannot be lost, and a refusal names what still uses it. The product editor gains
"From library", which adds an existing photo or video to a gallery without uploading anything.

The worker gains its first schedule: an in-process timer that enqueues a singleton job, the shape
`jobs.config.ts` reserved for it, with a floor of one tick an hour and a budgeted count that the
idle estimate now carries. `media.sweep` runs every six hours: pending uploads past an hour go, and
a retired image's stored object goes after thirty days unless a URL somewhere still shows it. The
record stays either way (ADR-0032). `MediaAssetDto` and `MediaUseDto` are added for the portal.

## [PR-162] 2026-09-27 — An org describes what it sells: brands and listing defaults [CONTRACT]

seller-profile PR 2 of 4 ([spec](specs/seller-profile/spec.md), trd D7–D8). The org portal gains
"What you sell", onboarding's third step: the brands the org carries — name, maker, packer or
importer, origin, one default — as cards with an add-and-edit sheet, and the org-wide defaults
beneath: origin, tax rate, and a tax code for each category it has products in. Only a brand's name
is asked for; nothing is marked required, and a blank saves (R5). A duplicate name within an org is
a conflict the form shows on the field; another org's brand id is not found. Retiring a brand hides
it and keeps it (ADR-0032). The `brand.service` and `org-listing-defaults.service` are the write
seam the product form will call; the "what would this change" previews of D7 wait for the product
link that listing-schema brings, since the count they would return has nothing to count yet. The
defaults repository could not clear its tax-code map — `null` read as "leave alone" — and now can.

## [PR-161] 2026-09-27 — Galleries fill named slots from a per-category shot list [CONTRACT] [MIGRATION]

Media-library PR 2 of 6. A category may carry a `shotList` — an ordered list of named slots, each
with a label, a framing hint and a role — inherited down the tree from the nearest ancestor that
sets one, with the generic front/back/detail/label/scale list in code as the default (D4). A
gallery photograph may name the slot it fills; a video never does, a slot holds one photograph,
and a key the product's category does not declare is refused at the boundary. The product editor
shows the category's slots as a strip and lets each photograph be assigned to one, clearing
assignments that stop existing when the category changes. `ProductMediaDto` gains `slot` and the
category shapes gain `shotList`, both additive. No category has a tailored list yet; tailored lists
follow the marketplace templates.

## [PR-160] 2026-09-27 — The worker card shows a short commit hash

The card printed the image's full forty-character commit as its version. A hash is shown as its
first seven characters now; a version that is not a hash, such as `dev`, is shown whole.

## [PR-159] 2026-09-27 — The runbook says what a Vercel redeploy does and does not do

The first dev deploy of the worker card was fixed twice over and still showed nothing, because a
dashboard Redeploy rebuilt an older deployment's source and left `dev.bhendi-bazaar.com` pointing
where it was. OPERATIONS.md now records that the domain moves only through the pipeline's alias
step, that a redeploy rebuilds the clicked deployment rather than the branch, that a variable reaches
only deployments created after it was saved, and that `NODE_ENV` is never ours to set.

## [PR-158] 2026-09-26 — The worker card fails alone, and APP_ENV is required in deployments

The first preview deploy of the dashboard's worker card returned a 500 for the whole admin page:
the preview environment had no `APP_ENV`, the environment lookup refuses to guess in a production
build, and the card let the throw reach the page. The card now catches and renders "status
unavailable" with the cause in the server log, the way every other dashboard widget fails alone
(dashboard-widgets R5), with a component test for both faces. OPERATIONS.md marks `APP_ENV`
required and says to set it in Vercel for Preview and Production.

## [PR-157] 2026-09-26 — The video player is admitted by the Content-Security-Policy

Every product video on the live store rendered as Chrome's "This content is blocked" while the
poster beside it loaded. ADR-0035's `frame-src` admitted the payment gateway and nothing else; the
YouTube poster host had been added to `img-src`, but the player iframe on `youtube-nocookie.com`
(ADR-0017) had no entry, and the header test asserted only what the ADR listed. `frame-src` now
names the embed origin, and `tests/unit/security-headers.test.ts` derives the embed and poster
hosts from the functions in `server/catalog/media.ts` that emit them, so the policy fails the
suite rather than the storefront if either moves.

## [PR-156] 2026-09-26 — The quota runbook names the quotas Oracle actually enforces

Creating the first machine was refused with "compartment quotas were exceeded" naming
`standard-a1-core-regional-count` and `standard-a1-memory-regional-count`: region-scoped variants
that a wildcard `zero` covers but the documented `set` lines did not reopen. OPERATIONS.md adds a
`set` for each, and records that the micro shape has no regional variant because Oracle rejects that
name. The machine was then created, and `infra/worker/provision.sh` ran clean on its first real
Ubuntu 24.04 the first time.

## [PR-155] 2026-09-26 — The worker loads the env file

`npm run worker` failed with "DATABASE_URL is not set" on a laptop whose `.env` had it: a plain
script does not get Next.js's env loading, and every local run so far had exported the variable
in the shell. `worker/main.ts` now starts with `dotenv/config`, as `prisma/seed.ts` and the
backfill script do. Harmless in the container, where compose supplies the environment.

## [PR-154] 2026-09-26 — The worker's image, machine script and deploy, ahead of the machine

worker-foundation PR 2 of 3, the half that needs no machine (trd D7–D9). `infra/worker/Dockerfile`
builds the worker from the lockfile with the Prisma client generated and only `server/`, `worker/`
and `prisma/` on a Node 22 base, run as `node --import tsx`; built locally, run against the local
database, it came up, wrote its heartbeat with the stamped version, and drained cleanly on SIGTERM
with exit code 0. `infra/worker/compose.yml` runs it restart-always from an env file the deploy
writes; `infra/worker/provision.sh` turns a fresh Ubuntu 24.04 into the machine — security updates,
firewall to SSH only, keys-only SSH, Docker, the stack as a boot service, weekly image prune — and is
idempotent, so it is also the rebuild. The `deploy-worker` job in CI builds the image for arm64 and
amd64 on every push, pushes it to the repository's container registry, and on `main` restarts the
stack over SSH; until `WORKER_HOST` exists it builds and skips.

OPERATIONS.md gains the runbook: the budget alert, the quota policy that makes paid shapes
impossible rather than merely noticed, the machine steps, the six repository secrets, the staging
worker by hand, and the rebuild. `.env.worker.example` names what the worker reads. The docs gate
now also checks path references under `infra/` and `worker/`. The image is 1.1 GB because it
carries the whole lockfile; trimming waits for a second job type.

## [PR-153] 2026-09-26 — The seed's two `any` casts are gone

`prisma/seed.ts` cast an order's address and a shipping provider's row to `any`, the two lint
errors the file had carried since before this phase. The address now goes through `toJsonColumn`,
which moved from `server/shared/prisma.ts` to `server/shared/json.ts` so a script can use it
without opening a connection pool (the old path re-exports it); the provider rows are typed as
`SeedShippingProvider[]`, whose three fields Prisma defaults became optional to match the data.
An unused `cart` binding went with them. No behaviour change.

## [PR-152] 2026-09-26 — Every stored image becomes a record [MIGRATION] [CONTRACT]

media-library PR 1 of 6 ([spec](specs/media-library/spec.md), trd D1–D3). `MediaAsset` is the one
record behind every image URL the schema holds: dimensions, bytes, format, owner, uploader, source,
what it was derived from, and a state. Every referencing column — gallery rows, category heroes,
profile logo and hero, both banner tables — gains a nullable asset reference that refuses deletion
while it points at one (R7).

Uploads register before they move (R1, D2): the two presign routes create a pending row and return
its id with the signed URL; `uploadDirect` PUTs the bytes and then calls a new confirm route, which
asks the store what it actually holds and takes the dimensions from the browser's canvas or, failing
that, from the object itself, so a ready asset always has them. A failed confirm is a failed upload.
Callers now pass an endpoint pair from `src/lib/image/upload-endpoints.ts`; the review photograph
path registers nothing and is untouched. The server-side upload path records its assets ready,
with dimensions from the same sharp pass that normalises them.

Gallery rows link to their asset by URL on every product write, admin and bulk alike, so nothing
in the form or the wire shape changed for that. Images already stored are brought under the record
by `npm run media:backfill`, idempotent and dry-run by default, which also records video references
as embed assets ([OPERATIONS.md](OPERATIONS.md) says when to run it). A sweep for uploads that never
confirmed exists as a service and waits for the worker's first schedule to be wired.

Database-backed suite run locally: pending to ready exactly once, only ready assets link, a
referenced pending row survives the sweep, and the backfill creates each asset once with dimensions
read from the bytes.

## [PR-151] 2026-09-26 — An organisation's public face becomes its own table [MIGRATION]

seller-profile PR 1 of 4 ([spec](specs/seller-profile/spec.md), trd D1–D4). The seven storefront
columns on `Org` — tagline, introduction, logo, hero, accent, delivery and returns terms — move to
`OrgProfile`, one row per organisation, created with it. `OrgListingDefaults` (origin, tax rate in
basis points, tax code per category) and `Brand` (name, manufacturer, packer or importer, origin,
retired-never-deleted) arrive as empty tables with their repositories; the portal screens that
fill them are PR 2. The migration is hand-ordered — create, copy every org's values, then drop —
because the generated script dropped first. Proven on a throwaway database: an org inserted with
the old columns comes out the other side with its profile row populated and the old columns gone.

The storefront reads the profile table only, taking identity alone from `Org`, through two
exported selects that `tests/unit/storefront-public-dto.test.ts` holds to an allowlist, so a
private column can no longer reach a buyer by being added to the row (seller-identity R5 made
structural). The about page's DTO is unchanged and pinned by the same test (spec A6). Admin's org
list keeps description and logo through the relation; the seed creates the profile beside the org.
No wire shape changed, so no `[CONTRACT]`; CONTRACTS.md gains a section naming the shapes and
their new source.

## [PR-150] 2026-09-26 — The job queue and the worker, with nothing in them yet [MIGRATION]

worker-foundation PR 1 of 3 ([spec](specs/worker-foundation/spec.md), [ADR-0038](adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)).
The queue is pg-boss's tables in our own Postgres, applied as a Prisma migration from the
library's exported construction plan, so the library never migrates at runtime and a deploy
runs one migration tool. One seam, `server/shared/jobs/`, is the only importer of pg-boss: a
typed `enqueue` that takes the caller's Prisma transaction, so a job commits or rolls back with
the row it concerns and the notify that wakes the worker fires only on commit; a registry that
parses every payload against its type's Zod schema before a handler sees it; and a status read
for admin. `worker/main.ts` is the second entrypoint — a composition root that registers each
domain's handlers and works one queue, with per-organisation concurrency through pg-boss groups.
The only job is `ping`, the smoke test that stays.

Every pg-boss timer is declared once in `jobs.config.ts`, in minutes, and `tests/unit/jobs-config.test.ts`
reads that same object: it asserts every interval the library exposes is named (an omitted one
takes the two-second default), none is under a minute, and the modelled idle total clears a
declared daily ceiling. The database bills every poll; this is ADR-0038 D8 made a gate.

Admin gains a worker card on the dashboard: last seen, waiting, running, failed, red past ten
minutes or if never seen, with a re-run action for the failed queue that writes an audit entry
(`POST /api/admin/jobs/redrive`). `APP_ENV` names the environment the heartbeat keys on
([ADR-0037](adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md) D2).

Database-backed suite run locally against a migrated throwaway database: enqueue commits with the
transaction, rolls back with it, refuses a bad payload before touching the queue, and Prisma
Migrate reports no drift with the `pgboss` schema present — the ADR's one open consequence,
closed. No machine yet; that is PR 2.

## [PR-149] 2026-09-26 — Index tables are generated, and five specs are accepted

The tables in `docs/adr/README.md` and `docs/specs/README.md` were hand-copied headers with
nothing checking them — 35 ADR rows and 32 spec rows, one folder away from the files they
described, and missing `home-banners` entirely. `scripts/docs-index.mjs` now renders them from
each file's own header, `npm run docs:index` rewrites them, and `docs:check` gains a gate that
fails while a committed table differs. Every `spec.md` gained a one-line `Summary` header, which
is the row; the 19 subfeatures get their own generated table for the first time. The skill and
the ADR README say "run the generator" where they said "add a row". `CLAUDE.md` records the
convention.

Also here, by the owner's decision on 2026-09-26: `worker-foundation`, `seller-profile` with
`brand-page`, and `media-library` with `renditions` move from Draft to Accepted, with brand-page's
three open questions closed on their proposed defaults. BACKLOG's Phase 11 rows follow.
## [PR-148] 2026-09-23 — A product photo left on the retired store reads as no image, not a crash

Two local products still held thumbnail and gallery URLs on the retired Vercel Blob host, and
the homepage offers strip handed one to `next/image`, which throws on a host missing from
`remotePatterns` and blanks the whole page. PR-122 closed this for banners; products were the
next of the eight columns OPERATIONS.md lists.

Both product mappings — the storefront DAL (`src/data-access-layer/products.dal.ts`), which feeds
the homepage, listings, product page and cart, and the org portal's — now route through
`isRenderableImageUrl`. A dead thumbnail becomes the brand mark; a dead photo is dropped from
the gallery by the new `renderableMedia` (`server/catalog/image-paths.ts`), so saving the edit
form clears it from the row, which is the runbook's re-upload remedy. Video refs are provider
ids and are never checked. Search suggestions, wishlist, cart, bidding and order lines read the
thumbnail by other paths and remain unguarded; OPERATIONS.md says so.

## [PR-147] 2026-09-23 — An org copies a product into a new one, and row actions move behind one menu

Most of an org's catalogue is families — one design in several fabrics or sizes — and every
member was typed from scratch. An org can now start a new product from one of its own: the
description, category, sizes, colours, tags and flags come across; name, price, SKU, photos
and stock do not, because those make a duplicate rather than a sibling ([copy-product](specs/copy-product/spec.md)).

Two entry points, one mechanism. The product list's actions column is now a single ⋯ menu
(View, Edit, Copy product, Archive/Restore, Delete…), and the new-product page has a
"Copy from product" picker over the org's on-sale products, searchable by name or SKU. Both navigate to
`/org/<orgId>/products/new?copyFrom=<id>`; the page reads the source on the server through
`productsService.getCopySource`, which scopes it with the existing `ownedByOrg`, so another
org's id opens a blank form rather than that product. No route handler, no DTO change.

The form is keyed on the source so a second pick replaces the first, and draft persistence
steps aside while copying — a restored draft would otherwise overwrite the copied fields on
mount. Delete keeps its confirmation dialog, now opened from the menu.

Adds `@radix-ui/react-dropdown-menu` behind a new `src/components/ui/dropdown-menu.tsx`
primitive. Tests: `tests/unit/product-copy.test.ts`; the product-visibility census gains the
picker's read (available shelf only).

## [PR-146] 2026-09-24 — The tests are audited, and two Invariants turn out to have had no guard

The nine unreachable handlers from PR-144/145 are deleted, along with `ProfileContext`,
`adminCartApiClient` and `reviewQuerySchema`. The docs gate caught two stale claims on the way
out — the handler count and two path references in BACKLOG.md — which is what it is for.

Then the harder question: are the guards themselves worth anything? Each Invariant was **mutated
in the source** to find out.

**Invariant 6 had no guard.** Deleting `quantity: { gte: n }` from the stock decrement — the
whole of [ADR-0007](adr/0007-conditional-stock-decrement.md), the difference between a reservation
and a read-then-write race — left all 1233 tests green. Two now cover it, and both were
mutation-tested: `tests/unit/conditional-stock.test.ts` on the shape of the write (the condition
is present, and its `count === 0` is actually read), and a concurrent-checkout case in
`order-transaction` that submits the same order twice for the last unit and requires exactly one
winner. The sequential version of that test passes with the condition deleted, which is how the
race survived unguarded; the two overlap on purpose.

**Invariant 4 had no guard either.** Swapping a handler's `schema.parse(await request.json())`
for `(await request.json()) as T` changed nothing in the suite.
`tests/unit/request-body-parsing.test.ts` refuses the cast, refuses a handler that reads a body
and validates nothing, and refuses a body spread into a Prisma `data`. It found two handlers
validating nothing: `POST /api/admin/users/[id]/block`, which read `body.isBlocked === true` off
an unparsed body so a malformed payload silently meant *unblock*; and the Shiprocket webhook,
which handed the raw body to an adapter that cast it and read `awb` and `shipment_status` off
whatever arrived. Nothing authenticates that route yet, so its parse was the only check standing.
Both are parsed now.

Invariants 1, 2 and 7 came through clean — eight tests fire when the charged price drifts from
the catalogue, one when an expired order becomes payable, two when the seed stops refusing a
deployed environment.

**Six integration suites had never run in CI.** They gated on
`url.pathname === "/bhendi_bazaar_dev"` while CI runs `bhendi_bazaar_ci`, so vitest printed
`↓ skipped` and the run read green: **43 of 51 integration tests**, `order-transaction` — the
guard on Invariants 1, 3 and 6 — among them. Nine suites had each written their own version of
that predicate and three of the spellings disagreed. There is one now, in
`tests/helpers/test-db.ts`, and fixtures come from `ensureFixtures`, which builds the world
instead of reading it out of the seed. **44 of 51 run in CI today, up from 8.** The seventh,
`join-equivalence`, needs a populated catalogue and declares it — and three of its cases had been
*passing* on the empty schema by comparing `[]` to `[]`, which a strategy-equivalence test over
no rows will always do. Every case asserts it compared something now.

`tests/unit/test-integrity.test.ts` holds the whole class: one definition of a throwaway
database, no suite writing its own, the integration layer required to run in CI, no `.only`, no
bare `.toThrow()` (satisfied by a TypeError from the test's own setup, so an authorisation hole
and a typo look identical), no test without an assertion, and a declared shrink-only list of
suites allowed to skip. `docs-integrity` now refuses to skip in CI rather than reporting nothing
if git history is missing.

**Seven scanning guards could pass having scanned nothing** — an empty offender list and an empty
scan are indistinguishable from outside, which had already bitten `module-boundaries` once. Each
states a floor now, and the floor was mutation-tested by pointing a scanner at a smaller tree.

## [PR-145] 2026-09-24 — No page in the tree is a client component any more [CONTRACT]

The last three: `(auth)/reset-password`, `admin/orders/[orderId]`, and `(main)/profile` with its
layout. **Both allowlists in `tests/unit/rendering-strategy.test.ts` are now empty** — when the
gate landed there were ten client pages and one client layout. The guard was mutation-tested at
zero, because an empty allowlist proves nothing on its own: it now also counts the pages and
layouts it scanned and the client components it recognised, so a scan that finds nothing fails
instead of passing.

**`reset-password`** read its token from `useSearchParams`, which is what made it a client page;
it reads `searchParams` on the server now and a link with no token never reaches the form. The
form itself moved to `src/components/auth/reset-password-form.tsx` and stopped hand-rolling
`AuthField`, `PasswordInput` and the primary button that the other three auth forms share.

**`admin/orders/[orderId]`** was the worst of them: 378 lines with eleven `as any` casts, all
downstream of one mistake — it typed `GET /api/admin/orders/[id]` as the storefront's `Order`,
which has no `shipments[].packageWeight`, no `fromCity`, and a differently-shaped address. Two of
the casts read a `Json` column as a typed object with nothing parsing it. `AdminOrderDetail` is
declared in `server/checkout/admin.order.types.ts` and built in the repository, where
`toAddressSnapshot` reads the address field by field and returns `null` for a malformed one
rather than throwing on `.city` halfway down the page. The screen is a server page, a read-only
aside and one client leaf for the tracking form.

While there: the shipment badge compared `shipment.status` against `ORDER_STATUS`, which shares
no values with the eleven-state vocabulary shipments have carried since PR-141 — every badge
rendered unstyled. `SHIPMENT_STATUS_LABELS` is a `Record<ShipmentStatus, string>`, so a twelfth
state cannot be added without the compiler asking what to call it, and the badge's tone is read
from `SHIPMENT_STATUS_EFFECTS.refundOwed` rather than a second list of status names — describe
what a state costs and it gets the right colour for free.

**`(main)/profile`** replaces `ProfileContext` (249 lines) with a server read. The provider was
mounted by the route's layout, fetched `/api/profile` on mount, held the answer in state and
applied optimistic updates to it; the page now reads the profile and the orders on the server and
`ProfileSections` posts and calls `router.refresh()`. There is one copy of the truth again. The
layout stopped being a `"use client"` wrapper around the provider and became what the route
actually needed a layout for: the heading both the signed-in and signed-out views were
duplicating.

Dead by the same conversions, and removed: `GET /api/admin/orders/[id]`,
`GET /api/admin/categories/[id]`, `adminOrderApiClient.getOrderById`,
`adminCategoryApiClient.getCategoryById`, `orderApiClient.getOrders`. Orphaned and awaiting
deletion, tracked in the reachability gate: `GET /api/orders`, `src/context/ProfileContext.tsx`.

`no-explicit-any` is down to **40 errors**, from 55 at the start of the day and 81 when it was
first counted.

## [PR-144] 2026-09-24 — The moderation queue renders on the server, and nine routes turn out to answer to nobody [CONTRACT]

Fifth and sixth of the seven admin screens — reviews, and the two category form pages. **Two
client pages remain, down from ten**: the profile editor and the order detail screen.

Reviews follows the shape the other four set: filters into the URL, page becomes a server
component, client leaves for the filter bar and for the table with its dialog and withdraw
action. The categories `new` and `[id]/edit` pages went with it, because the form under them
fetched all 100 categories on mount to populate its parent picker — a read the page could do,
and now does, handing them down as props. `getCategoryById` on the DAL returns `null` instead of
throwing, so a missing category is a `notFound()` rather than a 500 behind a hand-rolled panel.

**What the conversion exposed is the larger half of this entry.** A route handler's only caller
is a string in another file, and no compiler follows a string. Each of the five conversions so
far quietly orphaned the handler its screen used to read through — still routed, still
`requirePlatformAdmin`-gated, answering to nobody. `tests/unit/route-reachability.test.ts` now
resolves every `/api/...` string the app mentions (`${...}` as one segment, `baseUrl`-style
prefixes joined onto their suffixes) against every route file, and found nine:

- `GET /api/admin/{users, orders, reviews, abandoned-carts}` — orphaned by their conversions.
- `PATCH /api/admin/users/[id]` — could set `platformRole`, had no screen, and never has.
- `GET /api/admin/payouts/orgs`, `GET /api/admin/payouts/orgs/[orgId]`, `GET /api/org/[orgId]/earnings` — those screens already read through `payoutsDAL`.
- `PATCH`/`DELETE /api/admin/payouts/entries/[id]` — correcting and removing an unsettled ledger entry, built and never given a control. Different problem, same symptom: authority nobody can see.

The two handlers that share a file with a live one are gone (`GET /api/admin/categories`,
`GET /api/admin/reviews/[id]`); the rest are named in the gate's `UNREACHABLE` list, which may
shrink and must never grow. Mutation-tested: misspelling the one `fetch` that reaches
`/api/admin/settlements` makes it report that route and nothing else.

**The abandoned-cart reminder is gone, because it never existed.** The button reported "Reminder
sent successfully!" over a client method whose entire body was a `console.log` and a
`Promise.resolve()` — no route, no template, no send. An operator who believes a cart was chased
stops chasing it, so a control that lies is worse than an absent one. Reinstating it means an
actual reminder in `server/notifications/`.

Client surface removed with all of it: `adminReviewApiClient` is down to its one write,
`adminUserApiClient` to one, `adminCartApiClient` to nothing at all. Three of those files still
used the pre-ADR-0013 `error.error || "Failed to…"` pattern and now read the envelope, since
touching them is what the rule asks for.

`ReviewsFilters` derives its state options from `REVIEW_STATES` keyed by the union rather than
restating the list, so a fourth state cannot be added without the compiler asking what to call
it — the same reason the sort vocabulary is resolved against a declared set instead of cast.

## [PR-143] 2026-09-24 — `admin/categories` renders on the server

Fourth of the seven admin screens. **Five client pages remain, down from ten.**

The usual shape: search into the URL, page becomes a server component, client leaves for the
search box and for the table's reorder and delete controls. `sortBy: key as any` is gone with it,
resolved against the declared set like the others.

One thing this one needed that the earlier three did not: `categories.dal.ts` already had a
`getCategories` that fetches a flat 100 for pickers and forms. The console wants one filtered,
sorted page, so `list` is a second method rather than a parameter on the first — a picker wants
every category and a console wants a page of them, and one method serving both ends up doing
neither well.

Converted its markup to the shape tokens while there, so the page came straight off the
`SHAPE_LEGACY` backlog — **77 files left**. The ratchet noticed and demanded the list be
tightened, which is what makes it a backlog rather than an exemption.

**A tsc error slipped through earlier in the session and is fixed here.** Adding the `legacy`
field to the token rules made the `RULES` array's inferred union inconsistent; I verified that
change with vitest and `docs:check` but not `tsc`, so it went unnoticed until the next typecheck.
`RULES` is now explicitly typed as `TokenRule[]`. Vitest does not typecheck — running it is not
running `tsc`.

**Verification:** `tsc --noEmit` exit 0, 1213 tests pass across 108 files, `next build` compiles,
`npm run lint:boundary` exit 0, and the DAL exercised directly for search, sort and paging.


## [PR-142] 2026-09-24 — Two enforcement gaps closed: shape tokens, and a lint gate that blocks

Prompted by the right question — are the strategies we keep applying actually enforced going
forward? Auditing that found two places where the answer was no.

**Shape was a documented token axis with no gate.** CLAUDE.md lists `rounded-card` /
`rounded-field` alongside colour, type, tracking and elevation, and `design-tokens.test.ts`
enforced every axis except that one. **78 files** still use Tailwind's raw radius scale. The
tokens are real — `--radius-card` and `--radius-field` are defined and used — so this was
under-enforcement rather than a missing token, which is what a first grep suggested and a second
disproved.

Added as a ratchet with the 78 files listed under one shared reason: they predate the tokens, and
converting them is a change of its own rather than a line in someone else's. **A new file cannot
join the list** — mutation-tested with a fresh component using `rounded-lg`, which fails. A
companion assertion removes an entry once it is converted, so the list is a backlog rather than a
permanent exemption. `rounded-full` and `rounded-none` are deliberately outside the rule: a pill
and a square corner are not points on the radius scale.

**Lint enforced nothing at all.** It carries `continue-on-error: true`, so every rule in it —
including `no-explicit-any`, which CLAUDE.md calls a defect at a trust boundary — was advice. The
55 remaining errors are all in admin pages, hooks and the shipping provider layer, so the flag
cannot come off yet. But four trees are already at zero: `src/app/api`, `server/checkout`,
`server/payments` and `src/lib`.

`npm run lint:boundary` lints exactly those, `--quiet`, and is a **blocking** CI step. Route
handlers reached zero `any` in PR-128 and nothing was stopping the next one; now something is.
Mutation-tested by reintroducing `(await request.json()) as any` in a route, which fails it. The
scope grows as trees are cleared and never shrinks.

**One bug in my own guard, worth recording.** The shape ratchet's "backlog only shrinks"
assertion used `RAW_RADIUS.test()` — a regex carrying the `g` flag, whose `lastIndex` advances
between calls, so it skipped every other file and reported converted files that were not. Fixed
with a fresh non-global copy.

**Verification:** `tsc --noEmit` exit 0, full suite green, `npm run lint:boundary` exit 0, both
new gates mutation-tested.


## [PR-141] 2026-09-24 — `admin/carts` renders on the server, and two bugs an `as any[]` was hiding

Third of the seven admin screens. Six client pages remain, down from ten.

The conversion is the usual shape — filters into the URL, page becomes a server component, client
leaves for the filter selects and the table with its detail dialog. What made this one worth the
time is what fell out of it.

**The cart detail dialog has been rendering blank product names.** It mapped
`(selectedCart.items as any[])` and read `item.name`; the field is `productName`. Typing the
array — it was already typed, the cast was gratuitous — turned that into three compiler errors
immediately. An `as any[]` on a value that already had a type bought nothing and hid a
user-visible defect.

**The dialog's line totals did not sum to the total printed beneath them.** Each line rendered
`price × quantity` — the list price — while `totalValue` was computed from the offer price where
one applied. So a cart with any discounted item showed lines that did not add up. Rather than
repeat the "offer if lower" rule in the UI, `AbandonedCartItem` now carries `effectivePrice`,
decided once in the repository where the total is computed from the same field
([ADR-0018](adr/0018-one-effective-price-function.md)). Verified against the dev database: lines
and totals now agree on every seeded cart.

Also: the Cart Value column no longer claims to be sortable. It was marked `sortable: true` while
the server cannot order by it (PR-140) — the UI offered a sort the database refuses.

**Verification:** `tsc --noEmit` exit 0, 1211 tests pass across 108 files, `next build` compiles,
and the DAL exercised directly to confirm line sums match totals.


## [PR-140] 2026-09-24 — A guard for sort vocabularies, and the third broken one it found

PR-139 found two sort keys that had been throwing since 2026-08-04, by running them rather than
reading them. Five more listings had the same shape and nothing had ever asked them either, so
this asks all of them.

`tests/integration/sort-vocabularies.test.ts` calls every listing with every key it declares, in
both directions, against a real database. **It found a third: `?sortBy=totalValue` on abandoned
carts** — a cart's value is summed in JavaScript from its items, so no `orderBy` can serve it,
exactly like `totalSpent` on users. Removed rather than mapped; sorting a page of already-fetched
rows would order the page rather than the result. Serving either properly needs a denormalised
column, and neither is wanted today.

The guard is worth having because **no compiler sees both ends**: the mismatch is between a
TypeScript union and a Postgres column, and the route's `as any` used to carry an invalid key all
the way to the query builder looking valid. A declared vocabulary nothing exercises is a promise
nobody checked.

It also earns its keep by distinguishing real handling from breakage. `?sortBy=stock` on products
looks broken — `Product.stock` is not a column — and passes, because
`admin.product.repository.ts` handles that case on a separate path. A grep would have "fixed"
a working feature; running it did not.

A second assertion counts the `sortBy?:` declarations in `server/` against the rows here, so a
listing added without a row fails rather than quietly escaping the guard.

Mutation-tested: reverting the `total → grandTotal` map from PR-139 turns it red.

**Verification:** `tsc --noEmit` exit 0, 1211 tests pass across 108 files, `npm run docs:check`
clean.


## [PR-139] 2026-09-24 — `admin/orders` renders on the server, and two sorts that always threw

Second of the seven admin screens, following the `admin/users` template. Seven client pages
remain, down from ten.

Filters move into the URL, the page becomes a server component reading through
`src/data-access-layer/admin/orders.dal.ts`, and two client leaves remain — the filter bar and
the per-row status control. The filter's eleven hardcoded status options are now derived from
`ORDER_STATUS` and `PAYMENT_STATUS`; a retyped option list is how a filter comes to offer a
status the domain has stopped using.

**Two sort keys have been throwing since 2026-08-04, and the conversion is what found them.**
Not by reasoning about the code — by running every declared sort against the database, which is
a thing worth doing to any list endpoint:

- **`?sortBy=total` on orders** reached Prisma as an unknown argument. `OrderListFilters` has
  declared `total` for seven weeks; the column is `grandTotal`. It survived because the route
  cast the query string with `as any`, which made an invalid key look valid all the way down to
  the query builder. Fixed with a `SORT_COLUMNS` map rather than a rename — the API's vocabulary
  need not be the column's.
- **`?sortBy=totalSpent` on users** is worse, because no mapping can fix it: `totalSpent` is
  summed in JavaScript from each user's orders, so no `orderBy` can serve it, and sorting a page
  of already-fetched rows would order the page rather than the result. Removed from the
  sortable set; offering a sort that throws is worse than not offering it. Serving it properly
  needs a denormalised column or a raw aggregate.

The second one also shows the value of the `resolveSortBy` change in PR-128: with the declared
set now enforced at the boundary, removing the key from the union made the compiler point at the
one remaining caller that still offered it.

**Verification:** `tsc --noEmit` exit 0, 1209 tests pass across 107 files, `next build`
compiles, and every declared sort key on both listings exercised against the database.


## [PR-138] 2026-09-24 — Proving the owed figure actually drops

A follow-up to PR-137 with no production change: the assertion that was missing.

PR-137 wrote the reversal entry and reasoned that it would reduce what the platform owes,
because `balancesFor` sums `payablePaise` without filtering by kind. Reasoning is not evidence,
and the figure an operator pays against is not a detail to infer. `shipment-effects.test.ts` now
asserts it directly — record a sale, return the parcel, and both `owedPaise` and
`unclaimedPaise` come back to exactly where they started.

Mutation-tested: switching `rto_delivered` from `reverse` to `unchanged` leaves ₹255 owed where
zero is correct.

**The return-window framing is dropped from the spec.** Settlement here is bookkeeping — the
platform records what it owes, pays outside the system, marks it settled. There is no window to
wait for and none is wanted; the rule is simply that a return reduces the owed figure.

**Verification:** `tsc --noEmit` exit 0, 1209 tests pass across 107 files, `next build` compiles.


## [PR-137] 2026-09-24 — A returned parcel puts its stock back, and un-owes the money

Completes [shipment-lifecycle](specs/shipment-lifecycle/). PR-135 declared what each status
*means*; nothing read it. The gap was live: the Shiprocket webhook can produce `rto_delivered`
today, and when it did, **the units stayed decremented** — inventory the shop physically had and
could not sell.

**Restock is conditional and idempotent, in the same shape as the reservation that took the
units.** `restockedAt` is claimed with a guarded `updateMany`
([ADR-0007](adr/0007-conditional-stock-decrement.md)) inside the same transaction as the status
change, because a parcel recorded as returned while its stock stayed out is the failure this
exists to prevent. **`LOST` and `DAMAGED` still do not restock** — the owner's decision: those
units are gone and crediting them invents inventory.

**The ledger needed reversing after all, for a reason nobody had written down.** The design
assumption was that settlement waits for the return window, so there would be nothing to reverse.
Checking the code found otherwise: `recordSale` runs from `payment-confirmed.ts` — at *payment*,
not delivery — `Org.returnsPolicy` is free text rather than a duration, so no window exists in
code at all, and settlement is a manual claim over whatever is unsettled. Between a return and a
payout there is a real window where an entry for returned goods is sitting claimable.
`reverseSale` closes it by writing the mirror entry: every figure negated, the original
untouched, so the two sum to nothing and both survive
([ADR-0020](adr/0020-money-bearing-records-never-cascade.md)). The `REVERSAL` kind already
existed in the schema and had never been written.

**No refund is executed.** Recorded as an entitlement only, by decision: a gateway refund is
irreversible, so a human presses the button.

**A test of mine passed for the wrong reason, and the mutation check caught it.** "Does not
restock twice" was green because a repeated terminal event is answered as `same-status` *before*
restocking is reached — the transition table refuses it, not `restockedAt`. Deleting the
`restockedAt` guard changed nothing, which is the definition of an unasserted mechanism. The test
now reaches the restock path a second time deliberately, and deleting the guard fails it
(`expected 13 to be 10`).

**Verification:** `tsc --noEmit` exit 0, 1208 tests pass across 107 files, `next build` compiles,
`npm run docs:check` 55/55, both new guards mutation-tested.


## [PR-136] 2026-09-24 — The order service goes from eight domains to two

Finishes the decomposition started in PR-130. `server/checkout/order.service.ts` was the largest
and most-changed file in the repo — 826 lines, 26 commits in three months — because eight other
domains each had a standing reason to edit it. It now has two.

Two more extractions, each a concept rather than a slice of lines:

**`basket-discounts.ts`** — the bridge between a priced basket and the offer engine. Checkout
knows lines; promotions needs each line's org and category to decide which offer reaches it
([ADR-0019](adr/0019-discount-is-one-winning-offer.md)). That translation was eleven lines in the
middle of the transaction, and it was the only reason checkout imported the promotion engine at
all. It also carries the reason both halves must stay inside the transaction: offers are decided
from persisted rows at one instant, and `applyToOrder` *claims* a limited coupon with a
conditional write, so one with three uses left cannot be spent four times by concurrent
checkouts.

**`payment-confirmed.ts`** — what happens once the money is real. Three domains meet here by
definition: the ledger records what each org earned, identity supplies a recipient when the
delivery address has none, and notifications sends the confirmation. That convergence is the
module's purpose, so it is a recorded exception in `file-cohesion` with the reason — and it took
three domains off the order service in one move.

**`order.service.ts` is no longer a recorded exception at all.** It reaches `cart` (emptying the
bought lines inside the transaction) and `shipping` (booking parcels in `fulfillOrder`), which is
within the free limit. 826 lines to 722.

The gate drove every step: it failed on "a recorded set that has shrunk is narrowed here" after
each extraction until the record was tightened, and refused `payment-confirmed.ts` until its
three domains were justified in writing.

**Verification:** `tsc --noEmit` exit 0, 1203 tests pass across 106 files, `next build` compiles,
`npm run docs:check` clean.


## [PR-135] 2026-09-24 — One shipment vocabulary, and the transition table is the guard

Builds the vocabulary half of [shipment-lifecycle](specs/shipment-lifecycle/). `Shipment.status`
held three vocabularies at once — a type declaring nine values, a schema comment naming four
others, and code writing `"shipped"`, which the type did not contain.

**Eleven states, declared once, with what each one costs.** `SHIPMENT_STATUS` replaces the bare
type union, and `SHIPMENT_STATUS_EFFECTS` sits beside it saying for every state whether it
restocks, whether a refund is owed, and what the org's ledger should show. That table is next to
the declaration because "what does this status cost" must not be answerable only by reading four
call sites. **`LOST` and `DAMAGED` deliberately do not restock** — decided 2026-09-24: the units
are gone, and crediting them back invents inventory.

**The return leg is two states, not a mirror of the forward one.** Couriers report RTO in detail
(`rto_ofd`, `rto_ndr`, `rto_acknowledged`); the only distinction that changes what we do is *has
it arrived*, because that is when stock returns and the refund is owed. The finer wording stays
verbatim on the row. `DELIVERY_FAILED` is non-terminal, because three attempts before a
non-delivery report is the Indian norm rather than an exception.

**`SHIPMENT_TRANSITIONS` is the guard, not a diagram.** One table gives "cancel only before
pickup" and "never move backwards" — and makes a retried or late webhook a **no-op rather than a
corruption**, which matters because couriers retry and occasionally deliver events out of order.

**The adapter now refuses to guess.** `normalizeShipmentStatus` returned a substring-matched
guess and fell back to `pending`, which is how a lost parcel looks healthy for a week. It now
returns `null` for anything unmapped; the caller leaves the shipment where it is, keeps the
courier's wording, and logs it — an unmapped status is a table entry somebody needs to add, and
it can only become one if it is visible. Tables for Delhivery and Maruti are written now rather
than later, because the point of an adapter is that a new courier is a table, and an empty one
would not prove that.

**`Shipment.status` has one writer.** Two route handlers wrote it directly with literals; both
now go through `server/shipping/shipment-status.service.ts`, which is what makes the transition
table, the raw-wording capture and the effects lookup unavoidable. The Shiprocket webhook also
stops concluding "the order is delivered" from a single event — order status is recomputed from
all its parcels ([shipment-lifecycle](specs/shipment-lifecycle/trd.md) D10).

**Migration:** `pending`/`processing`/`packed`/`created` → `packing`, `shipped` → `in_transit`,
`returned` → `rto_in_transit`, `failed` → `lost`, and the column default stops naming a state
nothing recognised. `shipped` → `in_transit` was the judgement call, taken on the grounds that
the next courier event corrects it within hours and over-reporting progress to a buyer is worse
than under-reporting it. A data migration, not a seed ([Invariant 7](../CLAUDE.md)).

**Not built, deliberately:** nothing yet *acts* on the effects table — restocking, refund
entitlement and settlement reversal each touch money and get their own change. D5's `direction`
column for customer returns is absent because no customer-return flow writes it, and a column
nothing writes is a guess about an unspecified feature.

**Verification:** `tsc --noEmit` exit 0, 1203 tests pass across 106 files (30 new), `next build`
compiles, migration applied and verified against the dev database.


## [PR-134] 2026-09-24 — Spec: one shipment vocabulary, and what each state costs

Research and design only, no code. [shipment-lifecycle](specs/shipment-lifecycle/) answers the
`Shipment.status` conflict recorded in PR-131, and answers it for three couriers rather than one.

**The adapter was never the problem.** `server/shipping/utils/statusNormalizer.ts` already maps
per courier into one internal set and already carries tables for Shiprocket, Delhivery and
BlueDart. The architecture anticipated the second courier correctly. What it maps *into* was
never designed, which is why the type, the schema comment and the code each say something
different.

**The design turns on one observation: a parcel has two journeys, not one.** It goes out, and
when that fails it comes back. Status lists that model only the forward leg end up bolting the
return on as peers of `delivered` — `rto`, `rto_ofd`, `rto_ndr` — which is how "cancelled" comes
to mean four things. Three operations get separated instead:

- **Cancel** — only before the courier collects it. Nothing has moved.
- **RTO** — after collection, the only way back, and a journey of its own that can also fail.
- **Customer return** — after delivery, a *new shipment* in the other direction on the same
  order. The original parcel really was delivered; rewriting its status would falsify that.

Eleven states, and a table beside the declaration saying what each means for **stock, refund and
settlement** — because "what does this state mean for the money" must not be answerable only by
reading four call sites. `LOST` deliberately does not restock: those units are gone, and
crediting them invents inventory.

`DELIVERY_FAILED` is non-terminal, because in India three attempts before an NDR is the normal
case, not an exception — a model without it either loses the fact or misreports it as a return.
Transitions are a declared table that *is* the guard, which gives "cancel only before pickup" and
"never move backwards" from one mechanism, and makes a late or duplicated webhook a no-op rather
than a corruption.

**One open question is recorded rather than guessed:** whether `LOST` restocks depends on whether
the org writes those units off against the courier claim or expects the count kept whole. It
needs the org's answer before that row is built, not after.

**Verification:** docs-only. `npm run docs:check` 55/55, full suite unchanged at 1173.


## [PR-133] 2026-09-24 — The query-budget suite runs in CI

`tests/integration/db-ops-budget.test.ts` is the only thing that catches a regression in how
many SQL statements a page costs, and on Prisma Postgres every statement is a billed operation
against a 100k monthly allowance. It has never run in CI. It ran when somebody happened to have
a seeded local database and remembered to run the suite.

**The guard was wrong, not the test.** `skipIf(!isLocalDb)` conflated two different things:
*do not run against a metered database* — correct — with *needs the seed* — which was never
true. Every budget here is structural: `getHeroProducts` issues one LATERAL JOIN whether it
returns six rows or none. Verified by pointing it at a freshly migrated, completely empty
schema: **all eight budgets hold.**

So the predicate is now `isDisposableDb` and accepts CI's throwaway database as well as the
local dev one, and the test job gained a Postgres service plus `prisma migrate deploy`.

**Scoped deliberately to the one suite that qualifies.** Every other integration suite was
pointed at the empty schema too, and they all failed — `product-archive`, `order-transaction`,
`bulk-upload`, `bidding-concurrency` and `join-equivalence` genuinely need seeded orgs,
categories, addresses and a carrier row, and the seed refuses to run under CI by design
([Invariant 7](../CLAUDE.md)). They stay local-only. The two ways to bring them in — own their
fixtures like `order-transaction.test.ts`, or ship the reference rows as a data migration — are
recorded in [TESTING.md](TESTING.md) rather than guessed at here.

**Verification:** `tsc --noEmit` exit 0, 1173 tests pass across 105 files, the budget suite
passes against both a seeded and an empty database, `next build` compiles.


## [PR-132] 2026-09-24 — Domains stop reaching into each other's repositories: 13 violations to 1

[ADR-0033](adr/0033-a-domain-is-reached-through-its-public-surface.md) landed with thirteen
allowlisted cross-domain repository imports and the note that each names the service method the
owning domain needs to grow. Twelve of those methods now exist.

**Stock is a concept, so it got a service.** `stockByLocation`, `lockStock` and
`takeOneFromLocation` were reached directly by `bidding` from `catalog/product.repository`.
Inventory lives in catalog but is *moved* by whoever is selling — checkout reserves it in the
order transaction, bidding locks it while an event opens and takes a unit when one is won.
`server/catalog/stock.service.ts` is that surface, and every operation takes the caller's
transaction, because a reservation that commits separately from the order it belongs to is the
bug [ADR-0007](adr/0007-conditional-stock-decrement.md) exists to prevent.

**Commercial terms likewise.** `findCommercialTerms`, `listCommercialTerms` and
`updateCommercialTerms` were read out of `catalog/org.repository` by both `payouts` and
`promotions`. The rate lives on the `Org` row that catalog owns, but nothing in catalog uses it.
`server/catalog/commercial-terms.service.ts` names it — a module rather than three more methods
on `org.service`, because it has a life beyond the row: a base rate, per-category overrides in
`OrgCommissionRule`, and the ceiling on what an offer may give away. `org.service` answers *what
is this organisation*; this answers *what does it cost to sell here*, and keeping them apart is
what stops the first becoming the home for anything attached to an `Org`.

**The rest were single reads that simply belonged on a service:** `listForPicker`,
`listingFacts` and `countOutsideOrg` on `product.service`; `findEmailContact` and a new
`isMember` on `org.service`; `listForPicker` on `category.service`; `categoryParents` on
`promotion.service`; `findLoginEmail` on `profile.service`. `isMember` returns a boolean rather
than the membership row, because that is the whole question bidding asks — anything needing the
*role* is making an authorisation decision and belongs in `src/lib/org-auth.ts`.

**One violation remains, and it is the genuinely hard one.**
`payments/payment.service.ts -> checkout/order.repository`: the paid transition is a conditional
write that must stay a single statement ([ADR-0005](adr/0005-payment-state-server-only.md),
ADR-0007). Routing it through a service method would either leak the condition into the caller
or reintroduce a read-then-write. It needs checkout to expose a `confirmPaid` *command*, which
is a design decision rather than a move.

Two dead fragments surfaced while rerouting: a `settlement.service.ts` dynamic import of
`org.repository` left behind by its own replacement, and an unused `productsRepository` import in
`admin.bidding.service.ts`. Both removed.

**Verification:** `tsc --noEmit` exit 0, 1173 tests pass across 105 files, `next build`
compiles, `npm run docs:check` clean.


## [PR-131] 2026-09-24 — Both coupling gates were blind to `await import(...)`

**Correction to [PR-130], which claimed `order.service.ts` went from six domains to four.** It
went from **eight to six**. The measurement was taken with a gate that could not see dynamic
imports, and `order.service.ts` reaches `payouts` and `identity` through
`await import("@server/…")` inside `onPaymentConfirmed`. The extraction was real; the number
was not.

**The hole was in both gates, and it hid two violations as well as two dependencies.**
`file-cohesion` and `module-boundaries` matched only `from "@server/x"`. Once they also match
`import("@server/x")`, two cross-domain repository calls appear that had never been counted:
`checkout/order.service.ts -> identity/profile.repository` (reading the buyer's account email
when the address carries none) and `payouts/settlement.service.ts -> catalog/org.repository`
(addressing the payout email). Both are now allowlisted with what each needs.

A deferred import is still a reason to change. Deferring it changes when the module loads, not
who depends on whom — which is exactly what these gates measure.

**The seam that prompted it.** `payouts/ledger.repository.ts` reached into
`checkout/order.repository` for two questions — which paid orders have no ledger entry, and how
many. Both were pure pass-throughs that existed only to cross the boundary. They now sit on
`orderService`, `ledgerService` asks them directly, and the two wrappers are deleted. The query
stays in checkout because checkout owns `prisma.order` ([ADR-0003](adr/0003-one-repository-per-aggregate.md)):
the join to `OrgLedgerEntry` does not make it a payouts query, it makes it a question payouts
asks. Twelve allowlisted repository violations remain, down from thirteen.

Worth recording while it was checked: neither query spreads `VISIBLE_ORDER_WHERE`, and that is
correct — a sweep worklist is the documented exemption, and it is moot anyway, because
`confirmPaid` refuses an expired order and the release path refuses a paid one, so the two
states are mutually exclusive by construction.

**`ledger.service.ts` is now a recorded exception at three domains**, and the gate was right to
ask. Settlement genuinely sums across what was ordered, the category and terms that set the
rate, and the promotion behind an attribution. Gaining `checkout` there is still an improvement
— it replaced the same coupling one layer lower, past the service that owns the rules. The
durable fix is for checkout to *push* a settlement view rather than payouts pulling four ways,
which is an events change rather than a rename.

**Verification:** `tsc --noEmit` exit 0, 1173 tests pass across 105 files, `next build`
compiles, `npm run docs:check` clean.


## [PR-130] 2026-09-24 — The order transaction stops importing two domains to ask one question

First cut at `server/checkout/order.service.ts`, the largest and most-changed file in the repo.
Its reach drops from **six other domains to four**.

**The three sale gates were one concept wearing three imports.** Bidding
([ADR-0023](adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)), archiving
([ADR-0029](adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md)) and org withdrawal
([ADR-0030](adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md)) each arrived
separately, and each was added to the transaction where the previous one sat — the exact
pattern [ADR-0036](adr/0036-a-files-reasons-to-change-are-a-decision.md) describes. They ask one
question: *is this line still saleable at the instant we take the money.*
`server/checkout/sale-gates.ts` asks it once. `bidding` and `catalog` leave the order service
with them, and the next reason to refuse a sale has an obvious home instead of becoming a fourth
`await` in a 400-line method.

A pure move — same calls, same order, same place in the transaction, after the stock reservation
where the lock ordering makes it race-safe. That reasoning moved into the new file's header,
where it is next to the code it constrains.

**Verified as a move, not a rewrite.** Each of the three gates was deleted in turn and the full
suite re-run: every removal is caught. Worth recording how that nearly went wrong — an earlier
probe ran only `product-archive` and `order-transaction`, saw nothing fail, and briefly looked
like a coverage hole in the assertion ADR-0029 calls *the* enforcement point. It was an
under-run, not a gap. A mutation test proves nothing unless the whole suite runs.

**The ratchet demanded the tightening rather than accepting it.** `file-cohesion` failed on "a
recorded set that has shrunk is narrowed here" until `order.service.ts` was re-recorded at four
domains. `sale-gates.ts` itself is *not* recorded: it reaches two, which is within the free
limit, and the record list means exceptions — a compliant file's rationale belongs in its own
header.

**Verification:** `tsc --noEmit` exit 0, 1173 tests pass across 105 files, `next build`
compiles, `npm run docs:check` clean.


## [PR-129] 2026-09-23 — `admin/users` renders on the server, and the upload ceiling gets a gate

**The console's user list is a server component.** Filters moved from `useState` into the URL,
which is what lets the server answer the question the URL asks — and is the better answer
anyway: a filtered view is now shareable, bookmarkable and survives the back button. Two client
leaves remain for the two things that genuinely need a browser: typing in the filter bar
(`UsersFilters`) and blocking a user (`UsersTable`). `router.refresh()` after a mutation re-runs
the server read, so there is no client cache to invalidate and no second source of truth for
what the table shows. Eight client pages remain, down from ten.

The query string is parsed the way a request body is (Invariant 4): `resolveSortBy`,
`resolveSortOrder`, `resolvePageSize` and `platformRoleSchema.safeParse` resolve every value
against a closed set. That also removed the last `sortBy: key as any` on this screen.

**A count-based ratchet was removed, for the second time today.** The client-*component* ceiling
failed this conversion: turning one client page into a server page plus two leaves is a strict
improvement and *raises* the file count, because pushing `"use client"` down to the leaves is
what creates leaves. A tally that punishes the refactor it exists to encourage is noise.
[ADR-0034](adr/0034-render-on-the-server-by-default.md) now says so, and the boundary rule —
no client `page.tsx` or `layout.tsx` — carries the weight alone. Same lesson as the line budget
discarded in PR-128: measure the boundary, not the tally.

**Monthly-allowance audit, both meters.** The image pipeline holds: `MAX_IMAGE_EDGE` and
`IMAGE_QUALITY` come from one budget in `server/catalog/media.ts`, both upload paths re-encode
to WebP, and the presign schema signs the content type *and* the exact byte count, so a
presigned URL is a limit rather than a claim. What was missing was enforcement on the caller:
a presigned PUT writes whatever bytes the browser hands it, so only the caller can downscale,
and all four did by habit rather than by rule. `tests/unit/image-delivery.test.ts` now fails a
`uploadDirect` caller that skips `downscaleImage` — mutation-tested. An original upload costs
storage for ever and makes the optimizer transform a huge source on first request, which is
both meters at once.

**Still open on the DB meter:** `tests/integration/db-ops-budget.test.ts` still only runs
against a local seeded database, so no query-count regression is caught automatically. Making it
own its fixtures the way `order-transaction.test.ts` now does is what would let it run in CI.

**Verification:** `tsc --noEmit` exit 0, 1173 tests pass across 105 files, `next build`
compiles, `npm run docs:check` 55/55.


## [PR-128] 2026-09-23 — A file's reasons to change become a decision, and payment state gets a name

Two changes, one idea: make the thing that produced the debt harder to do than the right thing.

**Diagnosis first, measured across the whole tree.** `server/checkout/order.service.ts` is 825
lines and the most-changed file in the repo — 26 commits in three months — with
`createOrderWithShipments` about 400 of them on its own. **No individual change to it was
wrong.** Promotions needed a discount written at order time, bidding a suspension check inside
the transaction, the ledger a hook on confirmation; each went where the order was already being
written, which was locally correct every time. Review does not catch that, because every diff
is small and sensible.

**The first gate measured the wrong thing, and was discarded before it shipped.** It budgeted
file *length*. Length is a symptom: a 200-line file that quietly acquires five unrelated
dependencies passes a line budget, and a long file of small cohesive functions fails it. The ADR
for it was written, superseded within the hour, then deleted outright rather than left as a
tombstone — it was never committed, so "superseding" it would have recorded a decision the
project never actually made.

**What replaced it — [ADR-0036](adr/0036-a-files-reasons-to-change-are-a-decision.md).** The
cause is coupling, and it is measurable: `order.service.ts` reaches into **six other domains**,
so six unrelated feature areas each have a standing reason to edit it. The moment of drift is
also precise — **it is the import.** Adding `from "@server/bidding/…"` to a checkout file gives
that file a new master, in one line that looks harmless in review.

`tests/unit/file-cohesion.test.ts` fires exactly there, on every file, **at any size**. The
threshold is the tree's own: 445 files reach no other domain, 168 reach one, 12 reach two, five
reach more. Two is free; beyond that the exact domain set and the reason are recorded, and a
recorded file may not quietly gain a seventh. Mutation-tested — adding two cross-domain imports
to `cart.service.ts` makes it red.

Change-coupling from git says what the reach costs: `order.service.ts`, `order.types.ts`,
`order.repository.ts`, `order.schemas.ts` and `useCheckoutPayment.ts` change together in 71–100%
of the commits touching any of them. One concept, five files that must agree.

**`paymentStatus` had no declared set at all** — the one closed set
[Invariant 2](../CLAUDE.md) is entirely about. It existed as a schema comment
(`// pending, paid, failed`) and 34 copies of the literal `"paid"` across thirteen files, while
`ORDER_STATUS` sat two declarations away in the same file. A literal comparison does not fail
when a set changes; it silently stops matching. `PAYMENT_STATUS` is now declared beside it,
including `REFUNDED`, which nothing writes yet but the admin console already renders — a value
the UI knows and the domain does not is how the two drift. Every literal in `server/` is
replaced; `src/` is the next slice.

**Verification:** `tsc --noEmit` exit 0, full suite green, `next build` compiles,
`npm run docs:check` clean.

## [PR-127] 2026-09-23 — `/orders` renders on the server, as the worked example

The first conversion under [ADR-0034](adr/0034-render-on-the-server-by-default.md), chosen
because it is the smallest honest one: the whole page was a client component so that a search
box could filter a list.

**Before:** `page.tsx` was `"use client"`, read `useAuth()`, and rendered `OrdersClient`, which
called `useAsyncData(() => orderApiClient.getOrders())` → `GET /api/orders` →
`orderService.getOrdersByUserId`. Five hops, a loading spinner and an error state, for data the
server had before it rendered anything.

**After:** the page is a server component. It reads the session, and either renders
`OrderLookup` for a guest or passes `await ordersDAL.listForViewer()` into `OrdersClient` as a
prop. `OrdersClient` keeps its `useState` for the query and its `useMemo` for the filter, and
loses the fetch, the spinner and the error branch — there is nothing left to fail.
`ordersDAL.listForViewer()` reads the session itself, matching `wishlist.dal.ts`: the question
is "what has *this* viewer bought", so plumbing a user id through the page would only move the
same read. Both DAL reads now share one row→DTO mapper instead of two copies.

`GET /api/orders` stays — `(main)/profile` is still a client page and still calls it. It goes
when that one converts, which is the point of counting route handlers that exist only to feed a
client component.

**The ratchet tightened in the same change**: the page came off the `CLIENT_PAGES` allowlist, so
`tests/unit/rendering-strategy.test.ts` will now fail if it ever goes back. Nine remain, each
with the conversion it needs written beside it.

**Verification:** `tsc --noEmit` exit 0, 1165 tests pass across 104 files, `next build`
compiles, and `GET /orders` answers 200 with server-rendered markup and no `api/orders`
reference in the delivered HTML.


## [PR-126] 2026-09-23 — The rules that were only written down are now enforced

CLAUDE.md is 32% smaller and three architectural rules stopped being advice. No behaviour
change; two new guard suites and three ADRs.

**CLAUDE.md was 215 lines against its own 200-line limit, and 46% of it was one section.**
The conventions index is specified as "each line points; detail lives in the ADR so it cannot
drift" — its bullets had grown to a 460-character mean, restating the ADRs they point at. Two
rules were stated *twice in two wordings*, in Conventions and again in Development Principles,
which is exactly what [ADR-0009](adr/0009-docs-reference-code-never-copy-it.md) D6 forbids.
Trimmed to a 145-character mean: **~7,524 → ~4,950 tokens, paid on every session before any
work starts.** Invariant 7 lost 1,300 characters to `prisma/seed-guard.ts`, whose header
already carried the reasoning. Nothing was deleted — 29 ADRs are lazy-loaded and cost nothing
until read; the index summarising all of them was the expense.

**Three conventions had no ADR to point at.** One was the CSP, added in PR-117 with its only
wording in the always-loaded rules file — the thing the index exists to avoid. Recorded now as
[ADR-0035](adr/0035-every-response-carries-a-nonce-based-csp.md), alongside two new ones.

**Domain decoupling — [ADR-0033](adr/0033-a-domain-is-reached-through-its-public-surface.md).**
"A domain calls another domain's public surface, never its internals" has been in CLAUDE.md
since ADR-0012 and was never checked; **13 cross-domain repository imports** accumulated under
it. The rule was unfollowable as written, because nothing said what a *surface* was:
`catalog/product.visibility` is meant to be shared (ADR-0029 requires every buyer-facing read
to spread it) while `catalog/product.repository` is not, and both are just a file in a
directory. Each domain now declares its surface as data, and
`tests/unit/module-boundaries.test.ts` also holds the layering rules that were equally
unchecked: no component imports Prisma or a repository, no page reaches a repository instead
of the DAL, `server/` never value-imports from `src/`.

**Server-by-default — [ADR-0034](adr/0034-render-on-the-server-by-default.md).** This is the
answer to why a change touches thirty files. **106 of 173 components under `src/components`
are `"use client"`, ten `page.tsx` are, and so is one `layout.tsx`.** A client page cannot
reach the database, so every read it needs travels page → hook → client service → route
handler → schema → domain: six or seven files where a server component needs two. It is also
why several of the 93 route handlers exist at all. `tests/unit/rendering-strategy.test.ts`
refuses a client page or layout and ratchets the component count down.

**Both gates are ratchets, and that is deliberate.** Each landed on a tree that already
violated it. Failing on day one would have got them suppressed — which is what happened to
lint here. So each allowlists what exists *with the reason it survives*, asserts that reason
is longer than a shrug, and fails when an entry no longer matches a real violation. The list
can only shrink, and it is the backlog in the one place that cannot go stale.

**Two of my own gates were wrong on the first run, which is the argument for writing them.**
`module-boundaries` collected only `.ts`, so it scanned zero pages and two assertions passed
vacuously; both scan-based suites now assert they found files before asserting anything about
them. And the client-component figure first quoted as "121 of 173" conflated all of `src/`
with `src/components` — 106 of 173 is the real number, corrected in the ADR.

**Verification:** `tsc --noEmit` exit 0, 1165 tests pass across 104 files, `npm run docs:check`
55/55, `next build` compiles.

## [PR-125] 2026-09-23 — Nothing a buyer wrote is deleted, and a review photograph has to be the reviewer's `[CONTRACT]` `[MIGRATION]`

Review of [PR-124](specs/product-reviews/) found one bug with teeth and a set of gaps. Fixing them settled a rule the project had never written down, so this carries [ADR-0032](adr/0032-records-people-authored-are-retired-not-deleted.md).

**The bug: a reviewer could delete a product's photograph from storage.** The service asked only whether a photo URL was in our bucket (`isOwnObjectUrl`) — and every product image, every org logo and every other shopper's review photo is in our bucket. So a reviewer could cite a product's own cover, hotlinking it onto their review, and then **remove it from R2** by editing it back out, because an edit deletes the refs it drops. The presign route had always signed only under `reviews/<the caller's own id>/`; that rule is now enforced on the way back in as well, and `forgetImages` re-checks it, because a function that destroys objects should not trust its caller. Both directions are pinned by tests, including a path that merely *looks* like the author's folder (`reviews/u10/` against author `u1`).

**The rule: a record a person authored is retired, never destroyed.** ADR-0029 settled this for products and ADR-0020 for anything carrying money; nothing settled it in general, so reviews came out the other way. The admin console hard-deleted a buyer's words and photographs, and `Review.userId` was nullable with `onDelete: SetNull` — a column shaped for deleting the people who wrote them. That nullable key was not free: it bought an "anonymous voice" branch in the rating arithmetic, a nullable `userId` in every projection, and a `viewerId !== null` guard so `null === null` could not make a stranger's review look like yours. All three are gone.

**`isApproved` becomes two columns, because it was standing for two different acts.** Nothing ever approved a review — they publish on write — and when an author deleted their own, the row was destroyed rather than marked, so the queue could not tell "we took this down" from "they took it back". There is now `withdrawnAt` (the platform) and `deletedAt` (the author), `NULL` is live, and a restore returns to `NULL` — the shape `Product.archivedAt` already used. Restoring a withdrawal cannot republish what an author retracted. `VISIBLE_REVIEW_WHERE` is exported and spread by every buyer-facing read, the same seam `ON_SALE` uses, because two reasons to hide a row means a read that remembers one and forgets the other shows content that was taken down.

**Vocabulary, settled per audience.** The buyer's control still says **Delete**, because that is the outcome they get — the review leaves the product page, the count, the average and the org portal at once. The admin console says **Withdrawn** or **Deleted by author**, because it is the audience that needs to know which act occurred. Calling it *Archive* to a buyer would suggest they can get it back.

**A user is deactivated, never deleted.** `User.deactivatedAt`, kept separate from the existing `isBlocked`: the platform shutting someone out and an account being closed are different acts needing different answers, and an admin panel that cannot tell them apart can act on neither. Every key onto a user from a review is now `Restrict`, so a stray `user.delete()` is a bug Postgres catches.

**The moderation queue can finally show a review.** It clamped the comment to two lines with no way to open one, and the route file's own docblock advertised a `GET /api/admin/reviews/[id]` that no handler implemented. That handler exists now and backs a detail dialog with the full text and photographs at 112px. `DELETE` is gone with it. The queue's query string is parsed by `reviewQuerySchema` instead of cast — `sortBy` and `sortOrder` were `as any` off `searchParams` and reached Prisma's `orderBy` as keys, which is `any` at a trust boundary and an arbitrary column name (Invariant 4). Dead code removed: `getReviewStats`, `countByAuthor`, `findById`.

**The org portal was telling sellers the opposite of what happened.** It rendered `!isApproved` as *"awaiting moderation"* — for reviews that publish on write, so unapproved always meant *withdrawn*. It also read `user.name` live instead of the frozen `userName`, which is R11 broken in the one place the frozen column exists and is not used, and showed "Anonymous" for rows whose user was null. And it computed pagination it never rendered, so an org saw twenty reviews and no more. All three fixed; the join to `User` is gone entirely. Reviews an author retracted are filtered out for orgs — a retraction is not a moderation outcome.

**Video is withdrawn from reviews.** Not a storage decision — [ADR-0017](adr/0017-video-is-embedded-not-hosted.md) meant nothing was ever hosted — but a moderation one: a link to somebody else's host is content the platform cannot see, cannot take down, and which can change after a moderator has looked at it. Acceptable from an org on its own product page; not from any signed-in stranger on someone else's. `MediaKind` keeps `YOUTUBE`, so it is a field to re-add rather than a migration to reverse.

**Seeds: 22 reviews become 5**, each one a behaviour rather than flavour text — two by one shopper on one product (R8 shown, R10 averaged as one voice), one with photographs, one withdrawn, one retracted. Two pre-existing seed breaks surfaced getting there and are fixed: the wipe never cleared `Bid`/`BiddingEvent` before products, both of which hold `Restrict` keys on `Product`, so `db seed` failed outright on any database that had held a bidding event; and the runner could not resolve `@server/*`, which needed `tsconfig-paths` promoted from a transitive dependency to a declared one, plus `baseUrl` in `tsconfig.json`. Dev-only is unchanged and was never at risk — `prisma/seed-guard.ts` already refuses any target that is not a named local database.

**Migration note.** Making `Review.userId` `NOT NULL` **refuses rather than repairs** if author-less rows exist, naming the count: re-attributing them is not something a migration can guess. Ten such rows existed on the development database and were cleared before applying. There is deliberately no `DROP INDEX` for the old composite — Postgres drops an index along with a column it names, and an explicit drop afterwards fails 42704 and takes the whole migration with it (which it did, once, before being fixed).

**A review photograph opens in the product gallery's lightbox, and the lightbox is finally full screen.** Review photos opened a default `DialogContent` — a small centred box with no zoom — on the one surface where a buyer most wants to look closely, since judging weave and stonework off somebody's phone photograph is the entire reason the photograph is there. They now open `ImageLightbox`: full screen, pinch and wheel zoom, drag to pan, swipe and arrow keys, a strip when there is more than one. It is entitled to `ZOOMABLE_IMAGE_SIZES` because a review photograph is reduced to the same `MAX_IMAGE_EDGE` ceiling as a product's, so ADR-0027's rule holds unchanged. **All three surfaces mount the same component** — product page, moderation queue and org portal, at 72px, 48px and 112px — and the org portal had been showing no photographs at all, because the query never selected them.

**That exposed a bug in `cn` that had been silently disarming every token override.** `tailwind-merge` only de-duplicates classes it can assign to a group, and it knows nothing about `rounded-card`, `max-h-overlay`, `text-4xs`, `shadow-raised` or `tracking-eyebrow` — this project's own tokens ([ADR-0022](adr/0022-design-decisions-go-through-tokens.md)). So `max-h-none rounded-none` layered over the dialog's `max-h-overlay rounded-card` kept **all four** classes and let stylesheet order decide, which is why a viewer asking to be full screen was neither full height nor square-cornered. `cn` now declares every custom token (`src/lib/utils.ts`), pinned by `tests/unit/cn-tokens.test.ts` — a token added to `globals.css` and not to `cn` still renders, it just stops being overridable, which is the failure mode that hides. Found along the way: tailwind-merge 3.4 omits `none` from its own `max-h` group, so `max-h-none` was not recognised either. The lightbox also cancels `DialogContent`'s centring transform rather than fighting it, and uses `inset-0` instead of `w-screen` — `100vw` includes the desktop scrollbar, which was the sliver of page showing at the edges — and respects `env(safe-area-inset-top)` so the close button clears a notch.

**No image could be uploaded from a browser at all, and the CSP was why.** `connect-src` listed the payment gateway, Vercel analytics and `'self'` — not the object store. Every direct upload (product gallery, bulk wizard, profile picture, review photograph) PUTs from the browser to R2 (ADR-0028), so all of them were blocked. A CSP-blocked `fetch` *rejects* rather than answering, which surfaces as `Failed to fetch` with no status and no server-side trace: the signed URL was valid, the bucket's CORS preflight passed, the route answered 200, and a hand-made PUT to the same URL succeeded — three layers cleared by hand before the policy was suspected.

The trap is that the store has **two hosts and they are not interchangeable**. `img-src` already allowed the public bucket domain images are *read* from; writes go to the credentialed S3 endpoint in `R2_ENDPOINT`, which nothing allowed. `uploadHosts()` now derives it the way `imageHosts()` derives the read host, and `tests/unit/security-headers.test.ts` asserts both that the write host is in `connect-src` and that it is *not* in `img-src` — they answer different questions and must not drift into one. This is two features meeting rather than either being wrong: the CSP landed in PR-117 and browser-direct R2 uploads in PR-119, on separate branches that had not met until this merge.

**A failed browser-to-store upload now says what failed.** `uploadDirect` threw `Upload failed for <path> (<status>)` and discarded the store's own answer, and a `fetch` that never completed surfaced as a bare `Failed to fetch`. Both are now distinguished at the point they differ: a rejected `fetch` reports that the request never completed — so it is the network or the bucket's CORS rules, and *not* the signature or the permission — while a completed non-OK response carries R2's XML `<Code>` (`SignatureDoesNotMatch`, `AccessDenied`, `EntityTooLarge`). The first message it produced pointed at the right layer within seconds, after the signed URL, the CORS preflight and a hand-made PUT had all been checked by hand and all passed.

**A production seed no longer carries an admin password in clear.** `prisma/seed/prod.ts` hashed the literal string `'STRONG_RANDOM_PASSWORD'` onto a platform ADMIN account on a real address — a placeholder that reads as advice and behaves as a credential, so anyone who could read the repository could sign in as an administrator wherever it had been run. CLAUDE.md Invariant 7 already said it: no credential literal lives in a seed, and this was the one script that may legitimately be pointed at production. It now takes `PROD_ADMIN_EMAIL` and `PROD_ADMIN_PASSWORD` from the environment, refuses a placeholder value, refuses to run without both, is idempotent, and **will not reset an existing account's password** — re-running a bootstrap must not be a route to taking over an administrator's login. Its Shiprocket block is gone too: a carrier's catalogue row is reference data that already ships as the `register_shiprocket_provider` data migration, so the script was a second writer for a row that arrives on its own. The file had also never invoked `main()`, so none of it had ever run.

**Environment files are now a committed shape rather than folklore.** `.env.example` and `.env.production.example` carry every variable the code actually reads, with sample values and no credentials; `.gitignore` admits exactly those two out of `.env*`, which previously hid them along with the real ones. Verified mechanically that no value from the live `.env` appears in either. Two errors in `OPERATIONS.md`'s table were corrected while mirroring it: `NEXT_PUBLIC_RAZORPAY_KEY_ID` was marked required and is read by nothing (the checkout widget is handed the key id in the server's response), and `MIGRATE_DATABASE_URL` was absent despite `prisma.config.ts` reading it for every migration.

**Accepted and written down rather than hidden:** reviews and their photographs now accumulate for ever. No reaping job, and a retired review's objects stay reachable at their URLs. [ADR-0032](adr/0032-records-people-authored-are-retired-not-deleted.md) records that as the cost of keeping the record; a media-only purge stays available later.

`tsc --noEmit` clean. 1122 tests pass, including the docs-integrity gate. Verified against the running app on a reseeded development database.

## [PR-124] 2026-09-22 — Reviews a buyer can read and write, and a rating that is computed rather than stored `[CONTRACT]` `[MIGRATION]`

Builds [product-reviews](specs/product-reviews/) and [review-media](specs/product-reviews/review-media/): the product page shows published reviews with a summary and a star breakdown, a signed-in shopper writes one with up to four photographs and a video link, the platform withdraws one, and the rating every tile and search result carries is derived from the reviews instead of from a column.

**The two columns are gone, and nothing replaced them.** `Product.rating` and `Product.reviewsCount` had been written by nothing since the catalogue existed, so every product advertised itself as unrated however many reviews it held, and moderating one moved no number anywhere. Recomputing them on write was the obvious repair and was rejected: it buys a second place the truth can be wrong plus a backfill for the rows already wrong. Both numbers now come from `server/catalog/review-rating.ts`, memoised per request the way the offer price and the bidding lock already are — one query for a page of tiles, not one per tile — so the product page, the tile, the lane and the search result cannot disagree, and a withdrawal is visible on the next render with no job, no refresh and no cache to invalidate. The wire shape keeps both fields and changes source, which [CONTRACTS.md](CONTRACTS.md) records because that is the change a review does not notice.

**R10 is the part that had to be got right, and it is not an `AVG`.** All of a shopper's reviews are shown and counted, but the average counts only their most recent, so twenty five-star reviews from one account move a rating exactly as far as one does. Prisma cannot express "latest row per user" and this repository has no `$queryRaw` anywhere, so one projection query per render feeds one reduce that produces the average from the latest row per voice, the count from every row and the histogram from every row — three numbers from one pass, which is what makes them consistent by construction rather than by discipline. `tests/unit/review-rating.test.ts` pins it: repetition, same-instant ties, input order, anonymous rows as separate voices, and bars that sum to the count.

**`isVerified` stays stored while the rating becomes derived, which is a deliberate asymmetry.** The badge is a fact about one review at one moment whose input — a paid order — does not change, and deriving it would mean a cross-domain query per rendered row; a product's rating changes whenever any review does. It is computed at creation from `orderService.hasPurchased`, which is the only question `catalog` asks `checkout` here, and it is **no longer an admin input** — `updateReviewSchema` accepted `isVerified` and now takes `{ isApproved }` alone, because the store awards that mark and neither a reviewer nor an admin may grant it. Accepted gap: buying after reviewing does not retro-badge.

**Photographs take the path an org's photographs already take.** Reduced in the browser against `MAX_IMAGE_EDGE`, then written straight to R2 with a presigned PUT; the new token route signs only under `reviews/<the caller's own id>/` and keeps nothing the browser sends but the file name, so one reviewer cannot write into another's folder and an abusive upload says who made it. Video is a reference to somebody else's host, click-to-play through the same `YouTubeEmbed` the gallery uses — [ADR-0017](adr/0017-video-is-embedded-not-hosted.md) decision 4 anticipated reviews and is applied unchanged. `ReviewMedia` is its own table rather than a `reviewId` on `ProductMedia`, because every gallery, cover and thumbnail query reads that one and a review's picture there would be one forgotten `where` from becoming the product's own. Deleting a review deletes its files through the object-store seam; **withdrawing one does not** — the photographs leave every surface while the object stays public at its URL, which is recorded as the honest limit rather than fixed by proxying reads back through a metered path.

**Moderation stops saying "Pending".** Reviews publish on write, so nothing is ever pending: the admin queue reads Published or Withdrawn, the toggle says Withdraw or Restore, `ReviewStats.pendingReviews` becomes `withdrawnReviews`, and the audit actions are `REVIEW_WITHDRAWN` / `REVIEW_RESTORED`. The queue also shows each review's photographs inline, because a list that shows only words cannot moderate pictures.

**Schema:** two columns dropped, `ReviewMedia` added, and `Review`'s indexes follow its queries — one composite on `(productId, isApproved, createdAt)` replaces single-column indexes on a boolean and a 1–5 integer that no planner could use selectively. Two migrations, applied with `prisma migrate deploy` — which also landed `product_archive` and `org_storefront`, two that had been pending on the development database and were breaking every buyer-facing product read (`Product.archivedAt` and `Org.isActive` did not exist, so both visibility fragments failed).

Verified against the running app, not only the suite: the homepage's tiles carry real ratings where they read 0.0 before, a product page renders its summary, breakdown and **Verified purchase** badge, `GET /api/products/prod-1/reviews` answers `average 4.6, count 5, histogram {4:2, 5:3}` with the bars summing to the count, and an anonymous `POST` to either write route answers 401. `tsc --noEmit` clean, lint clean on every touched file. 48 new tests across `review-rating`, `review-write`, `review-routes` and `review-media`; the visibility census gained `isOnSale`, which is the guard test doing its job. Six suites still fail on this machine only — the allowlists in `design-tokens`, `image-delivery`, `admin-audit-trail` and `rate-limit-detached` compare forward-slash paths against Windows backslashes, and `org-schema`'s sampling test passes in isolation — none of them touch this change.

## [PR-123] 2026-09-21 — A spec for product reviews, and the decision that one shopper may review a product twice

Adds [docs/specs/product-reviews/spec.md](specs/product-reviews/spec.md), its [review-media](specs/product-reviews/review-media/spec.md) subfeature, and [trd.md](specs/product-reviews/trd.md). Documents only — no schema and no code. The feature is not built; this states what must be true when it is, and how it will be done.

**Reviews are half-built, and the visible half is the wrong half.** Rows are stored, the admin portal moderates them and an org can read the ones on its products — but no buyer can read or write one, and [src/components/product/reviews.tsx](../src/components/product/reviews.tsx) says so in as many words. The costlier part is quieter: `Product.rating` and `Product.reviewsCount` are written by nothing. They are seeded to zero and never recomputed, so approving or deleting a review in admin moves no number anywhere, and every product on every tile, lane and search result advertises itself as unrated however many reviews it carries. Moderation today is cosmetic. R6 states the requirement the store currently fails.

**The decision that needed making: a shopper may review the same product more than once (R8).** Amazon and Flipkart both enforce one review per customer per product, editable; Etsy attaches a review to a transaction instead. We take neither. A repeat buyer, or someone returning after six months of wear, has a genuinely new thing to say, and an edit would overwrite the earlier experience rather than add to it — for textiles, how a fabric lasts is among the most useful things a review can carry. R9 follows: each review is independently editable and deletable by its author, because there is no longer one canonical review to edit.

**That opens a rating-manipulation path, so R10 closes it by capping influence rather than volume.** Unlimited repeat reviews plus `RATE_LIMITING_ENABLED = false` ([src/lib/rate-limit/index.ts](../src/lib/rate-limit/index.ts)) would let one account set a product's rating by repetition. All of a shopper's reviews display; the average counts their most recent. Nobody is blocked from writing and nothing is hidden, and the average stays a measure of how many people liked a piece rather than how many times one person said so.

**Both open product calls are decided, and two more with them.** Reviewing does not require a purchase: buying earns the *Verified purchase* mark (R4), not the right to write, so a young catalogue has something to show and the badge carries the trust a gate would have. Reviews publish immediately (R15), with hold-for-approval kept as the narrower fallback if spam becomes real. Photographs and a video link move *into* scope, which this spec's out-of-scope list previously refused and which [product-video](specs/product-video/) deliberately left to reviews — a buyer's own photograph is the one thing a review can supply that the seller structurally cannot. Its requirements, hazards and costs are the new [review-media](specs/product-reviews/review-media/spec.md) subfeature, split out to keep both files inside [ADR-0010](adr/0010-spec-convention.md)'s cap (parent 101 readable lines, subfeature 92). Video inherits [ADR-0017](adr/0017-video-is-embedded-not-hosted.md) decision 4 unchanged: a link to somebody else's host, never a file of ours.

**`Product.rating` and `Product.reviewsCount` are to be dropped rather than repaired (R6a).** Nothing has written either since the catalogue existed. Recomputing them on every write and every moderation is the obvious repair, and it buys a second place the truth can be wrong plus a backfill for the rows already wrong; how many people liked a product is a question about its reviews, not a fact about the product. The drop is a migration and a DTO change, so it belongs to the implementation PR and its TRD rather than to this spec — what it will touch: [prisma/schema.prisma:63-64](../prisma/schema.prisma#L63-L64), the product types and DALs that carry both fields, [server/analytics/dashboard.repository.ts:198](../server/analytics/dashboard.repository.ts#L198) (a `getTopProducts` placeholder ordering by a column that is always 0, so its ordering means nothing today), the seeds, and [CONTRACTS.md](CONTRACTS.md) line 19. No write path accepts either field, so Invariant 4 is not implicated.

**The TRD's load-bearing decision is D4: R10 is reduced in TypeScript, not computed in SQL.** "The average counts that shopper's most recent review" is not an `AVG` — it is an average over the latest row per user, which Prisma cannot express and which no `$queryRaw` exists in this repository to copy. One projection query per render (`productId, userId, rating, createdAt`, published only, newest first) feeds one reduce that produces the average from the latest row per voice, the count from every row, and the histogram from every row — so the three numbers cannot disagree with each other or with the list below them (R6). `groupBy(['productId','userId'], _avg)` was rejected because it averages each shopper's reviews rather than taking their latest, which is a different rule than the one the spec sets; raw `DISTINCT ON` was rejected for now and named as the upgrade, which D5 keeps behind the same two functions. In-memory resolution has precedent in the offer-price sorts ([src/lib/product-paging.ts:17-25](../src/lib/product-paging.ts#L17-L25)).

**D3 makes the rating the third thing to travel as a request-memoised context**, beside the offer price and the bidding lock ([server/bidding/bidding-lock.ts:29](../server/bidding/bidding-lock.ts#L29)) — one query per page of tiles, not one per tile, and ADR-0018's rule applied to a second number: a read path that needs a rating and does not call the resolver is a defect. D7 then explains why `isVerified` stays *stored* while the rating becomes derived, which is the asymmetry a reviewer would otherwise flag: the badge is a fact about one review at one moment whose input does not change, and deriving it would mean a cross-domain query per rendered row. D8 keeps that query behind one exported `hasPurchased` on checkout rather than joining `OrderItem` from catalog.

[docs/specs/README.md](specs/README.md) gains its index row and the subfeature note. Still no dependency, no migration and no DTO change in this PR — the schema work is specified, not done, and lands `[CONTRACT]`-flagged with the first implementation PR.
## [PR-122] 2026-09-21 — A stored image URL we cannot serve reads as no image, not a crash

A single `Banner` row still holding a Vercel Blob URL from before ADR-0028 was taking down
two whole pages. `next/image` has no degradation path for a host missing from
`remotePatterns` — it throws `Invalid src prop` during render — so one dead URL blanked the
storefront homepage *and* `/admin/banners`, which is the page OPERATIONS.md tells you to
re-upload the image on. The remedy was locked behind the failure it treats.

`isRenderableImageUrl` (`server/catalog/image-paths.ts`) now answers whether a stored URL can
be handed to the optimizer at all, and the three banner surfaces — `toHeroBanner`,
`storefrontDAL.promotionsFor` and the admin list — route through it. A dead URL falls into the
no-image branch each of them already had. It is a check for the one *retired* host rather than
an allowlist of live ones, because the live host is `R2_PUBLIC_BASE_URL`, which is server-only
configuration, and this has to answer in the browser too.

A dead image and no image are no longer indistinguishable to whoever has to fix it: the admin
row shows a struck-through icon and says *Image needs re-uploading*.

**OPERATIONS.md was wrong about the symptom** — it said such a row "renders as a broken image".
Corrected, along with the fact that the other seven columns it lists (`Category.heroImage`,
`Product.thumbnail`, `ProductMedia.ref`, `Profile.profilePic`, `Org.logoUrl`,
`OrderItem.thumbnail`, `ShippingProvider.logoUrl`) are **not** guarded and will still take a
page down. Dev currently has one affected row and it is in `Banner`; production is a separate
database and has to be checked with the query in that runbook.

## [PR-121] 2026-09-21 — A banner's heading is optional, and a wordless banner keeps its picture clean [CONTRACT] [MIGRATION]

`title` was the one word on a banner that was still required, on both the platform hero and
an org's own promotions. Artwork that already carries its own typography had a headline laid
over it with nothing to say — and, worse, it carried the reading scrim with it.

**The scrim is the real change.** It exists to make words legible over a photograph, and it
fades out on hover from `md`. On a phone there is no hover, so it is simply always on: a
banner with nothing to read was a permanently dimmed picture. `HeroBanner` now derives
`hasWords` from eyebrow, title, description and actions together, and where there are none it
does not render the scrim or the text column at all — not rendered, rather than faded, because
fading is a desktop-only escape a phone does not have.

Blank and absent are one value. `""` and whitespace normalise to `null` in both schemas, so
the renderer has a single thing to branch on; an empty string would still read as text and
would keep the dimming.

Around it: `bannerLabel` (`src/lib/banner-label.ts`) names an untitled banner once for the
admin list, its screen-reader labels, the delete confirmation and the edit page header, rather
than six literals that drift. Both forms drop the required marker and say what leaving it
blank does. `Banner.title` and `OrgBanner.title` drop NOT NULL; the migration also nulls any
whitespace-only title that predates the rule. Widening only — every existing banner keeps its
heading and every existing client still parses.

`tests/unit/home-hero.test.tsx` pins the scrim's presence against each word that can bring it
back; `tests/unit/home-banners.test.ts` and `tests/unit/storefront-service.test.ts` pin blank,
absent and null landing on the same value.


## [PR-120] 2026-09-21 — The documentation gate grows the two holes it had

A sweep of every living doc against the tree after PR-117..119, and two new gates for the
classes of drift the sweep caught by hand. Docs only; no behaviour change.

**Two blind spots in the gate, both found the hard way.**

*Environment variables.* `CSP_REPORT_ONLY` was added in PR-117 and never documented — the
table in OPERATIONS.md read as complete while missing the switch that turns enforcement off.
`ORG_HANDLE_HOLD_DAYS` and `PRISMA_LOG_QUERIES` had been missing longer. An undocumented
variable is the worst shape of stale doc: a deployment built from the table is missing
something nobody knows to look for. Gate 6 now asserts every `process.env.X` the code reads
appears in that table, less the five the platform sets itself.

*Directory references.* Gate 1 only matched paths with a file extension, so
`server/repositories/**` — a tree ADR-0012 dissolved — sat in DEPENDENCIES.md untouched while
every file reference around it was checked. Gate 7 now resolves backticked directory paths
too, skipping `<placeholder>` and `*` forms.

**DEPENDENCIES.md was breaking its own rule.** It says a removed package moves to `## Removed`
with its date and reason, and is not deleted — and PR-118/119 deleted three rows. There was no
`## Removed` section to move them to; there is now, holding `razorpay`, `@vercel/blob` and
`baseline-browser-mapping`. Also corrected: Prisma pinned at `^7.1.0` where it is `^7.10.0`,
with the note that CLI and client must move together and that the adapter decides the *shape*
of a constraint error; `sharp` still said uploads reach "Blob"; `@vercel/analytics`,
`@vercel/speed-insights` and `vite` had no rows at all.

**TESTING.md claimed a rule the pipeline does not follow.** "`continue-on-error` on a lint,
typecheck, or test step is forbidden" — while `.github/workflows/ci.yml` carries exactly that
on lint. The section now states where each gate actually stands, including that lint is the
one still non-blocking and why (56 `no-explicit-any`, down from 81, none of them in
`src/app/api/` any more). It also gains a table of the guard suites — tests whose subject is
the repository rather than a module — and the rule that a guard which has never been red is
not yet a guard.

**Also:** BACKLOG Phase 4 moves from "Not started" to "In progress" with what is and is not
done, and gains a watch-list entry for the unauthenticated Shiprocket webhook — it verifies no
signature, so a guessed tracking number can mark an order delivered. Nothing reads `delivered`
for settlement, which is the only reason it is a watch-list entry. `server/checkout/CLAUDE.md`
gains the batched-write rule from PR-119, including that returned ids are keyed by field and
never by position.

**Verification:** `tsc --noEmit` exit 0, 1067 tests pass, `next build` compiles,
`npm run docs:check` 55/55 (was 40).


## [PR-119] 2026-09-21 — Vercel Blob removed entirely, and the order transaction stops looping

**The Blob store is gone, not retired.** Its own contents now answer `403` — the block
ADR-0026 describes — so nothing could be recovered from it and nothing was left to keep it for.
Removed: `@vercel/blob`, `scripts/migrate-blob-store.ts` (leaving `scripts/` empty), the
hostname from `next.config.ts` `remotePatterns` and from the CSP's `img-src`, the
`.blob-migration/` ignore rule, and the `BLOB_READ_WRITE_TOKEN` row. That also takes the
`undici` HIGH advisory with it.

Keeping the hostname allow-listed had been justified as "so a partially migrated catalogue
still renders" — but with the bytes unreachable, allow-listing the host renders nothing. One
active banner in the development database still holds such a URL and has been showing broken
for some time; OPERATIONS.md now carries the query that finds any of the eight URL columns
still pointing there, and the only remedy, which is to re-upload through the admin UI. Run it
against production and development separately.

**The order transaction issued one INSERT per row.** `createOrderWithShipments` looped
`orderItem.create` per line, `orderDiscount.create` per attribution and `shipmentItem.create`
per parcel line — every one a billed operation, and every one held inside the transaction that
already holds the guarded stock decrement's row locks (ADR-0007), so the cost was checkout
contention as well as money. Now `createManyAndReturn` and `createMany`. Measured on a
six-line, one-parcel order: **28 statements before, 18 after**; `OrderItem` 6 inserts to 1,
`ShipmentItem` 6 to 1. The saving grows with the basket.

The ids are still needed, so they are read back — but keyed off **each returned row's own
fields, never its position**, so nothing depends on the driver returning rows in the order they
were sent. A parcel line that resolves to no order item now throws instead of writing a null
`orderItemId`, which is how an allocation bug would otherwise have reached settlement.

**Nothing covered this transaction.** It holds Invariants 1 and 6 and ADR-0019's attribution,
and it had no test at all — which is why a batching change could not be made safely.
`tests/integration/order-transaction.test.ts` now creates its own products and stock rather
than reading seeded fixtures (the first draft did, and broke immediately on how the seed
happens to be shaped), then asserts the linkage per line **by identity through the join**,
with distinct prices and quantities so a mismatched pairing cannot hide. It was mutation-tested:
mapping the ids positionally makes it fail. It also pins that the server prices every line from
the catalogue and that totals stay integer paise.

**Verification:** `tsc --noEmit` exit 0, 1052 tests pass across 96 files, `next build` compiles,
`npm run docs:check` 40/40, `npm audit` 6 (unchanged — all Prisma-7 CLI transitives).


## [PR-118] 2026-09-21 — Dependencies cleaned and upgraded, and `any` leaves the trust boundary

Follows PR-117's audit. 49 advisories to 6; 23 `any` in route handlers to 0.

**Two dead dependencies were carrying live advisories.** `razorpay` was never imported —
`razorpay.repository.ts` calls the REST API with `fetch`, which DEPENDENCIES.md had flagged
since 2026-08-03 — and it was the only thing pulling `axios` (HIGH: prototype-pollution
credential theft). `baseline-browser-mapping` was a declared devDependency nothing referenced
and the only package with no row in DEPENDENCIES.md. Both gone. `@vercel/blob` is also unused
outside `scripts/migrate-blob-store.ts` and carries the `undici` HIGH, but it stays until the
production store is confirmed empty — the local database has zero old-store URLs, and that is
a different database.

**`next` 16.0.10 → 16.3.5** clears a CRITICAL set that is all reachable from a public
storefront: a DoS through the Image Optimizer's `remotePatterns` handling, HTTP request
smuggling in rewrites, unbounded `next/image` disk-cache growth. **`sharp` 0.34.5 → 0.35.4**
clears inherited libvips and libheif CVEs, which matter here because `normalizeImage` parses
buyer- and org-supplied uploads server-side. The remaining 6 advisories are Prisma 7's own CLI
transitives (`mysql2`, `deepmerge-ts`) and an `exceljs` → `uuid` path; npm's only offered fix
is a downgrade to Prisma 6, so they are accepted rather than taken.

**`npm audit fix` bumped the Prisma CLI to 7.10.0 and left `@prisma/client` at 7.1.0**, which
produced `Cannot find module './query_compiler_fast_bg.js'` on every query. Both, plus
`@prisma/adapter-pg`, are now pinned together.

**That bump also silently broke every friendly uniqueness message.** Under
`@prisma/adapter-pg`, Prisma 7.10 reports a P2002 as
`meta.driverAdapterError.cause.constraint.index` — the constraint's *name* — where 7.1
reported `.fields`, the columns. `uniqueViolationFields` read only `.fields`, so it returned
its unattributed `[]` fallback, every `isUniqueViolation(error, field)` answered false, and a
duplicate SKU surfaced as a raw `Unique constraint failed on the constraint` instead of "that
SKU belongs to an archived product". Nothing threw and nothing logged. The helper now parses
`<Model>_<field>…_key`, and `tests/unit/constraint-shapes.test.ts` pins all three shapes
against fixtures captured from real errors. The two hand-written partial indexes
(`ProductMedia_one_thumbnail_per_product`, `BiddingEvent_one_open_per_product`) correctly stay
unattributed — neither names a field a form could highlight.

**`any` is gone from every route handler.** The two patterns behind 22 of the 23:
`(session.user as any).id` in six handlers that hand-rolled their own session check —
now `requireSession()`, which also gives them the ADR-0013 envelope — and
`searchParams.get("sortBy") as any` in five admin listings, which laundered an
attacker-controlled string into `orderBy: { [sortBy]: sortOrder }`. Each filter type already
declared its closed set; `resolveSortBy`/`resolveSortOrder` in `server/shared/pagination.ts`
now resolve against it the way `resolvePageSize` always has. Admin-gated, so the exposure was
limited to error-based disclosure — but it is the compile-time fiction Invariant 4 is about,
one layer along from a request body. 56 `any` remain, none in `src/app/api/`.

**No handler returns a raw `error.message` any more** — `orders`, `orders/lookup`, `profile`,
`products/check-stock` and the Razorpay webhook were the last five. The webhook keeps its
deliberate non-2xx on an unmatched payload (D5); `toErrorResponse` preserves a `DomainError`'s
status.

**Verification:** `tsc --noEmit` exit 0, 1049 tests pass across 95 files, `next build`
compiles 86 routes, `npm run docs:check` 40/40.


## [PR-117] 2026-09-21 — Docs that cannot go quietly stale, and a CSP

A project-wide audit of documentation, security and cost, plus the two controls the audit
said were missing. No behaviour changes on any buyer-facing path.

**`Verified:` was an honour-system header, and it did not hold.** ADR-0001 and ADR-0009 both
claim `/bb-review` flags a doc older than the last structural change to the code it
describes. Nothing implemented that — the skill's line 196 asks a reader to notice, which is
not a control. The state it left behind: `ARCHITECTURE.md` carried a three-day-old date while
asserting Vercel Blob (retired by ADR-0028), `src/containers/**` (dissolved by ADR-0031), 86
api handlers (93), 518 tests (983), 38 models (40), 44 migrations (46) and a
`verifyAdminSession()` that does not exist. Thirty-six code-path references across seventeen
docs pointed at files that had moved. `OPERATIONS.md` told an operator that rate limiting was
required, configured and failing open — it has been detached since PR-55 and allows
everything. Six `CLAUDE.md` files carried no `Verified:` line at all, against the project's
own Golden Rule 5.

**So the date became a gate.** Each living doc now declares `Covers:` — globs of the code
whose *shape* it asserts — and `tests/unit/docs-integrity.test.ts` fails when a file matching
them was added, deleted or renamed after the date. Structural changes only: gating on every
edit inside a covered file is noise, and a noisy check gets deleted. Four more gates ride
along: a broken path reference in a living doc, a path in an ADR or spec that the repository
*never held* (checked against `git log`, since an immutable ADR legitimately names files that
are gone — this is what caught the home-banners spec asserting `src/lib/home-banners.ts`, a
file that never existed), a fenced code block outside ADR-0009's exceptions, and every count
in `ARCHITECTURE.md` against the tree. CI checks out with `fetch-depth: 0` for it.

**Razorpay: the forgery paths were already closed; the scripting path was not.** Re-verified
end to end — `createPaymentOrderSchema` has no `amount` field, so the charge is read from the
persisted order; the browser return is an HMAC over `order_id|payment_id` compared with
`timingSafeEqual`; `decideConfirmation` refuses a signal whose `gatewayOrderId` is not the one
persisted at creation, so a signature from a cheap order cannot be replayed onto an expensive
one; the webhook HMACs the raw body, not the parsed JSON; `partial_payment` is never set, so
a gateway order cannot be part-paid; `RAZORPAY_KEY_SECRET` is server-only and no
`NEXT_PUBLIC_*` but the app origin exists. None of that is reachable from a browser.

What *was* reachable was everything else, because the app sent no security headers at all.
`src/lib/security-headers.ts` now holds a nonce-based CSP built per request in
`src/middleware.ts` — `script-src` with no `'unsafe-inline'`, so an injected `<script>` does
not execute — plus HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` and
`Permissions-Policy` in `next.config.ts`, where they also reach static assets. Verified
against a running server: all 51 inline and 25 external script tags carry the nonce, and the
portal gate and the 410 permalink rule still behave. `CSP_REPORT_ONLY=1` downgrades
enforcement without a code change.

**The middleware matcher is now a catch-all**, because a CSP has to reach every document. It
still does not exclude paths containing a dot — the conventional static-file exclusion is
what once let `/admin/orders/abc.def` past the gate entirely. `tests/unit/portal-guards.test.ts`
now applies the matcher to real paths instead of reading its spelling.

**Also corrected:** `wishlist` was a bounded context under `server/` with no row in
CLAUDE.md's domain table (a gate now asserts the two agree); `INTEGRATIONS.md` documented
Vercel Blob and not the Cloudflare R2 that replaced it; `docs/README.md` said eight domains
and listed three domain docs, against thirteen and five.

**Verification:** `tsc --noEmit` exit 0, 1040 tests pass across 94 files, `npm run docs:check`
40/40, security headers confirmed on a live server.


## [PR-115] 2026-09-20 — Delete stops pretending, and moves out of the way

Deleting a product now deletes it, or refuses and says what is holding it. It no longer archives silently. The control moves off the row into an overflow dialog, since it is the only irreversible thing there.

**The degrade was a workaround for a button that no longer exists alone.** When archiving shipped it had no control of its own — Delete was the only button in the row, so degrading it (delete when nothing depends on the product, archive otherwise) was the only way the common case could work at all. PR-113 gave Archive its own button in every row, and at that point the degrade only meant one control did two jobs and its label was wrong for whichever one it did. An org pressing *Delete* on a sold product got an archive, which is a different act with a different remedy.

**So Delete refuses, and the refusal is now actionable.** `This product cannot be deleted — 1 order still refers to it, and deleting it would break that record. Archive it instead to take it off the storefront.` That sentence was a dead end when Delete was the only control, which is exactly why it was replaced by the degrade; with Archive sitting beside it, it is a signpost. The message is the same one PR-112 built, plus the remedy.

**Delete still has a job Archive cannot do.** An archived product keeps its SKU and its slug forever, because a restore has to find its own code and URL free (R6, R9). That is right for a product that was really sold and wrong for a typo: mistype a SKU, archive it, and that code is burned until someone restores the junk row to edit it. Archive retires something real; Delete discards something that never was. Removing Delete entirely would have made every bad import row and every fat-fingered SKU permanent, which is why it stays.

**It moves behind the row's `…` button.** Delete sat one `gap-2` from Archive, a control an org uses routinely — flagged as a mis-tap risk in this feature's own review and left standing at the time. It now opens a `Dialog` that says what deletion means and names Archive as the alternative, in prose a native `confirm()` cannot format and an icon tooltip cannot say at all. That dialog is the confirmation, so the `confirm()` on the path is gone. A dialog rather than a dropdown menu: `Dialog` is already a dependency and brings focus handling and Escape with it, a dropdown would have meant adding `@radix-ui/react-dropdown-menu` for one item, and a hand-rolled menu would have meant reimplementing focus and outside-click badly.

**Contract:** `DELETE /api/org/[orgId]/products/[id]` answers `{ success: true }` again, not `{ outcome }` — with the two acts separated there is nothing to discriminate. [CONTRACTS.md](CONTRACTS.md) and the product-archive spec (R8, R8a, A5) and TRD (D9, UI) move with it; no schema change, no new dependency.

`tsc --noEmit` clean, lint clean. 983 tests pass. The integration test now asserts the refusal *and* that the product is genuinely untouched by it — a refusal that quietly archived anyway would have passed a test that only checked for a throw.

## [PR-114] 2026-09-20 — "Off sale" becomes "Archived", because sale means a discount here

The product console's archive control now reads **Archive** / **Restore**, its filter reads **Available / Archived / All**, and its catalogue figure is labelled **Available**. Nothing about the behaviour changes.

**"On sale" already means something else in this store, and it means it in code.** `promotionService` has a method called "put one product on sale, or take it off" — that is a markdown, a reduced price. `ProductPricingFields` hints "leave empty if not on sale". So a control reading *Take off sale* invited exactly the wrong reading: an org looking at it could reasonably think it ended a discount rather than removed the product from the storefront. The word was wrong on a control whose real effect is not reversible by guessing.

**"Withdrawn" had become ambiguous too, which is the part that mattered more.** Since org-withdrawal landed, `assertOrgNotWithdrawn`, `fromWithdrawnOrgAmong` and `FROM_ACTIVE_ORG` use *withdrawn* for a shop the platform has withdrawn from the marketplace. A product being off the storefront and a shop being off the marketplace are different acts with different owners and different remedies, and both were called "withdrawn" — the doc comment on `FROM_ACTIVE_ORG` had to spell out which one it meant. That is the state a vocabulary test exists to prevent, and it arrived through two features meeting rather than through anyone choosing it. Products are now *archived*; only orgs are *withdrawn*.

**Renamed with the labels, so the two cannot drift apart:** `ON_SALE` → `AVAILABLE`, the `ProductShelf` union `"on-sale"` → `"available"` (so the URL reads `?shelf=archived` or nothing), and `ProductStats.withdrawnProducts` → `archivedProducts`. Comments, error messages and the product-archive spec and TRD moved with them. The buyer-facing refusal drops its trailing "and has been removed from sale" — *archived* is the org's word for its own shelf, and a buyer only needs to know the item is no longer available.

`[CONTRACT]`-adjacent but **not** flagged: `ProductStats` is an internal admin shape rather than a DTO in [CONTRACTS.md](CONTRACTS.md); the two sentences there that named the old labels were corrected in place, as was the `ProductShelf` union it documents. No wire shape changes meaning, only the spelling of one enum value — and that value is read from a query string the console itself writes.

**Left alone deliberately:** `product.sale-gate.ts` keeps its name, paired with upstream's `org.sale-gate.ts` — "the gate on selling this" is accurate, internal, and breaking the pair to chase a UI word would cost more than it buys. [ADR-0029](adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md) keeps its title and prose: ADRs are immutable, the decision it records is unchanged, and "a product leaves sale by archiving" is still a true sentence about it.

`tsc --noEmit` clean, lint clean, 843 tests pass. No behaviour changed, so no test was added — the existing archive tests assert the new strings, which is what caught the SKU-clash message still saying "off sale".

## [PR-116] 2026-09-19 — The product gallery uploads browser-to-store

Editing a product's photographs on a phone returned `FUNCTION_PAYLOAD_TOO_LARGE` before any of our code ran. The gallery posted the picked files as multipart to `/api/org/[orgId]/upload`, and a Vercel function's request body is capped at 4.5MB — one phone photograph clears that alone, and a multi-file selection clears it easily, since the cap is on the whole request rather than per file. The guard, the Zod parse and sharp's downscaling all sat downstream of a limit that rejected the request at the edge, so the server-side normalisation that exists precisely to keep stored images small never saw the bytes it was meant to shrink.

**Nothing new was decided here.** ADR-0028 and bulk-catalog-upload D10 already answer this — the bulk wizard has uploaded browser-to-store against a presigned PUT since it shipped. The single-product editor was simply never converted. It is now: `downscaleImage` re-encodes in the browser to the same `MAX_IMAGE_EDGE`/`IMAGE_QUALITY` budget the server path uses, then `uploadDirect` asks `/api/org/[orgId]/upload/token` to sign one PUT per file. Bytes never pass through a function, so the source file's size stops mattering; `MAX_IMAGE_BYTES` is now measured against what will actually be stored.

**The naming rules had to become client-safe.** `buildImagePath` and friends moved out of `image-upload.ts`, which imports sharp, into `server/catalog/image-paths.ts` — the browser now builds the path, and it must be the path the server would have built or the presign route's prefix check refuses it. The two sides reach that prefix by different functions (`sanitizeIdentifier` vs `toLowerCase`), so `tests/unit/image-upload.test.ts` pins their agreement across generated org codes rather than leaving it to coincidence.

**A batch is validated whole and uploaded per file.** Every file is downscaled and checked before any of it is sent, so a bad selection is refused outright as before. Uploads then run three at a time with a visible count. A network failure part-way through keeps what landed and names what did not — there is no undo for an object already written, and discarding nine good photographs to keep the old all-or-nothing promise would be the worse trade.

The multipart route stays: the storefront's mark and banners and promotion art still use it, on desktop-picked art that has not hit the cap. They need the same conversion when they do.

## [PR-115] 2026-09-19 — Every organisation gets a storefront of its own [MIGRATION] [CONTRACT]

An org now has a public address it can print on a card. `/store/<handle>` is its landing page, `/store/<handle>/about` its story, `/store` the directory of every shop trading. Spec and TRD: [org-storefront](specs/org-storefront/) — seven subfeatures; decision and rejected alternatives: [ADR-0030](adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md).

**A storefront is a projection, not a second shop.** Same catalogue, same effective-price function, same basket, same checkout, read through one more filter and dressed in the org's chrome. Nothing on the money path moved. A basket spanning two shops still checks out once and still splits into per-org shipments, because none of that was touched.

**It is a path, not a subdomain.** One domain, so search authority pools instead of scattering across dozens of weak new sites, and no wildcard DNS or per-domain certificate has to be operated. `/store` is public and crawled; `/org` remains the gated portal. `/product/<slug>` stays canonical — a storefront links to products, it never re-serves them, so no ranking signal is split.

**The handle is the part that cannot be got wrong twice.** Generated from the name at creation and changeable by its owner thereafter. A retired handle is *held* for a configurable window (180 days) — redirecting to the current one and unavailable to anyone else, so a card printed last quarter still arrives and the org can revert — then *released*, answering 404 rather than 410 because it may later belong to somebody else. Taking a handle back deletes the redirect pointing away from it, or a revert would be a loop. Changing one is its own authorised operation, owners only, behind a dialog that states all four consequences with the real handles and the real date.

**`Org.isActive` now means something.** It was set by the console and read by nothing a buyer could see — the platform believed it had a compliance control it did not have. `FROM_ACTIVE_ORG` sits beside `ON_SALE` in `product.visibility.ts` and is spread by every public product read, and `assertOrgNotWithdrawn` refuses the purchase inside the order transaction beside `assertNotArchived`, after the stock reservation for the same locking reason. Hiding is not refusing.

**An org composes its own shop from fields, not blocks.** Mark, banner, tagline, introduction, its own delivery and returns terms, and banners it can order and take down without deleting. The accent is a token name from a fixed palette, never a colour value, so nothing an org supplies can break a layout. A banner may point at that org's own storefront or its own products and nowhere else — checked as a shape by the schema and as ownership by the service, since only the service knows whose product a slug names.

`[MIGRATION]`: `20260919090000_org_storefront` — `Org.handle` (backfilled from each org's name, deduped by creation order, then constrained NOT NULL UNIQUE), six nullable presentation columns, and the `OrgHandleHistory` and `OrgBanner` tables. The backfill deliberately does not use `unaccent`: the extension is not guaranteed on a managed Postgres and a migration that needs one it cannot create fails the deploy. Applied and verified against the dev database.

`[CONTRACT]`: `OrgSummary` gains `handle`, so a product card can link to a shop without a second round trip. Every product page now names who sells it.

**Not done, deliberately:** no subdomains or custom domains, no page builder, no per-shop checkout, no approval before a shop goes live — review is a manual pass over shops that are already live, and `isActive` is the remedy. [contact-us](specs/contact-us/) stays platform-scoped, so a storefront publishes no channel of its own.

## [PR-114] 2026-09-15 — The share button stops landing on the bidding page's heading

On `/bid/<slug>` the share control rendered its icon on top of the product title, with the hover background sitting beside the icon rather than under it. Both were one cause. `ShareButton` defaulted `showLabel` to `true`, and the bidding page asked for `size="icon"` without turning it off — that size is a fixed `size-9` square (`src/components/ui/button.tsx:27`), so icon plus label overflowed it, and the base `justify-center` centred the too-wide content on the box, pushing the icon outside to the left onto the `<h1>` next to it. The highlight was the square, in the right place all along, which is why it looked like a second bug.

Fixed in the component rather than at the call site: the label now follows the size unless a caller says otherwise. The two call sites that already paired `size="icon"` with `showLabel={false}` (`order-summary.tsx`, `product-details.tsx`) were the tell — a prop pairing that three callers have to remember is one that a fourth will get wrong. Also dropped the label's `ml-2`, which double-spaced against the button's own `gap-2`; no surface renders a labelled share button today, so nothing moves.

`tests/unit/share-button.test.tsx` pins it, and was checked against the old default first to confirm it fails without the fix.

Unrelated, found while verifying: `libphonenumber-js` was declared in `package.json` and absent from `node_modules`, which failed typecheck and twelve test files on a stale local install. `npm install` fixed it with no change to `package.json` or the lockfile.
## [PR-111] 2026-09-19 — [CONTRACT] Rows-per-page on every table, server-side

Every paginated table in both portals showed ten rows and offered no way to change it. All nine now carry a rows-per-page control (10 / 25 / 50 / 100), and in every case the choice is a new server query — nothing is fetched and then sliced.

**One declaration of the page sizes.** `PAGE_SIZE_OPTIONS`, `DEFAULT_PAGE_SIZE`, `resolvePageSize` and `resolvePageNumber` live in `server/shared/pagination.ts`, alongside the `Pagination` shape that was previously declared there *and* in `src/types/shared.ts` — two declarations of the same concept, which is the drift Rule 1 exists to stop. `src/types/shared.ts` now re-exports.

**`limit` is parsed, not coerced.** Six route handlers read it as `parseInt(searchParams.get("limit") || "20")`, which happily accepts `limit=1000000` — an unbounded `take` any caller could ask for. Every handler now resolves against the closed set, and `page` through `resolvePageNumber` so a negative page cannot become a negative `skip`. This is Invariant 4 at a read boundary: the payload is untrusted whether or not the caller is an admin.

**The admin orgs listing was not paginated at all.** It fetched every organisation with its product count and per-location stock, then searched, filtered and sliced in the browser — the page's cost grew with the platform, and `Showing 1 to 10 of N` counted rows already downloaded. `orgRepository.findPageWithStats` now filters, orders, pages and counts in one query pair; search and status are query parameters. `GET /api/admin/orgs` therefore returns `{ orgs, pagination }` rather than a bare array, and `includeStats` is gone — stats were the only caller. `adminOrgService.getAllOrgs` was left with no callers and is deleted.

**The pagination bar no longer unmounts.** `DataTable` returned early on both loading and empty results, so the whole card — controls included — vanished on every page change, and a filter that emptied the table took away the control needed to widen it. Header and footer now stay mounted; only the body swaps. Its prev/next and sort controls are `ui/button` rather than raw `<button>`, and prev/next disable correctly at both ends (`currentPage >= totalPages`, previously `=== totalPages`, so the next button stayed live past the last page whenever a filter shrank the result set mid-session).

Default page size is now **10 everywhere**. Users, orders, reviews and carts previously defaulted to 20 and categories to 50; neither is in the offered set, and a one-click selector makes the cheapest first load the right default.

Surfaces changed: org products, org orders, admin products, admin users, admin orders, admin reviews, admin abandoned carts, admin categories, admin orgs.

Not included: the org reviews page and the offer and bidding lists are card lists, not tables — the reviews DAL already returns `pagination` and renders no control for it, which is a pre-existing gap rather than one this PR introduces.

## [PR-111] 2026-09-18 — Sign in without leaving the page, and finish what prompted it

Signing in, creating an account and asking for a password reset now happen in a panel over the current page — a bottom sheet on a phone, a right-hand panel from `md` — opened by **Login** in the header and the tab bar. On success it closes, the shopper is where they were, and the chrome, cart, hearts and page content update without a reload. Spec and TRD: [seamless-sign-in](specs/seamless-sign-in/).

**One form per flow.** `SignInForm`, `SignUpForm`, `ForgotPasswordForm` and `GoogleSignInButton` in `src/components/auth/` own their fields, schema and submit; the `(auth)` pages and the sheet are a heading plus the form, so a message cannot differ between them. The pages became server components that pass `callbackUrl` through `safeCallbackUrl` — a same-origin path or `/` — and return the shopper there instead of the home page. A signed-out visit to a portal still goes to the sign-in page and comes back.

**A prompt to sign in finishes its action.** The heart, for a guest, opens the sheet ("Sign in to save this") with a `wishlist.save` intent, which runs after a password sign-in, a new account, or the Google round trip, where it rides in `sessionStorage` for at most ten minutes and is removed before it runs. It is a save, never the toggle, so it cannot unsave. Closing the sheet discards it, and so does coming back from Google signed out. The wishlist page shows a guest a sign-in prompt instead of redirecting, and the profile page's prompt opens the sheet — that prompt was unreachable before, because `ProfileProvider` never left its loading state for a guest.

**Checkout.** A guest sees **Already have an account? Sign in** above the delivery form. After signing in, the guest's address is cleared for the account's saved ones, offers are re-quoted for the buyer (the quote key now includes the user), and the items being checked out stay as snapshotted — whatever the sign-in merge brought into the cart stays in the cart.

**An order removes only what it bought.** The order transaction used to delete the whole cart row, Buy Now included. It now calls `cartService.removeBoughtLinesIn(tx, …)`, which deletes the lines matching the order's `(productId, size, color)` and bumps `version`, and the client drops the same lines with `removeLines` instead of `clear()` — on the free-order path too, which previously cleared nothing locally. The order service no longer touches `tx.cart` directly (ADR-0003). [inventory-reservation](specs/inventory-reservation/) R6 is reworded to match. A 409 on the next cart write now only announces "updated in another tab" when the merge actually changed something, since an order this tab placed produces one.

Tests: `auth-forms`, `auth-sheet`, `auth-intent`, `safe-callback-url`, `checkout-sign-in`, `order-removes-bought-lines`; `wishlist-button` and the removal-rule check in `wishlist.test.ts` updated. No schema, no migration, no DTO change. The 6 failures already on `develop` (design-tokens ×2, image-delivery ×2, rate-limit-detached, admin-audit-trail) reproduce unchanged.

## [PR-110] 2026-09-18 — Review fixes for the R2 switch: two blockers the tests did not catch

Pre-merge review of [PR-108] found two defects that would have surfaced during testing, and one control with no coverage at all.

**Bulk upload would have rejected every R2 URL.** Both bulk schemas validated image URLs against a hardcoded `.public.blob.vercel-storage.com` hostname, so the wizards' own uploads — now on `images.bhendi-bazaar.com` — would have been refused by the route that receives them. Replaced with `isOwnObjectUrl`, checked against the configured store. It is a real security control, not a formality: it is the only thing stopping a crafted payload pointing a product at any image on the internet. A host-specific literal inside a validator is how a storage migration silently starts rejecting itself.

**That control had zero tests.** The integration suite calls the bulk *service* and never reaches the route schema, which is exactly how the hardcoded hostname survived. Now covered — our own URLs accepted, the retired store rejected, arbitrary external URLs rejected, and a prefix that merely starts the same (`images.example.test.evil.test`) rejected as not-containment.

**The site's own logo and favicon pointed at the dead store.** Nine hardcoded URLs in `src/lib/config.ts` — logo, favicon, OG image — all 403 in production, and nothing in the database to repoint. Brand assets now ship in `public/brand/`: they change on a rebrand, not on an upload, and keeping them in the repository means a storage outage cannot take down the site's own identity, which is precisely what happened. `metadataBase` is now set from `appUrl()` so the root-relative paths resolve to the custom domain for scrapers rather than the deployment URL. The icon `type` also stopped claiming `image/png` beside an `.svg` value.

**`minimumCacheTTL` was 30 days against immutable objects**, re-transforming the whole catalogue monthly for nothing — against a Hobby allowance of 5,000 transformations. Now a year, matching the `immutable, max-age=31536000` that `object-store.ts` writes.

**A pre-existing bug found by the inventory:** `ShippingProvider.logoUrl` is set to a `shiprocket.in` URL by the `register_shiprocket_provider` data migration, and that host was not in `remotePatterns` — so the admin shipping page threw whenever a provider had a logo. Added, rendered `unoptimized` for the same reason as the YouTube posters: a third party's already-sized asset is not worth a transformation.

**`src/lib/env.ts` was wrong in both directions, and never ran.** It named `BLOB_READ_WRITE_TOKEN` as required — the app stopped reading it in [PR-108] — and omitted all five R2 variables, the ones a boot genuinely cannot proceed without. Corrected, and its header now says plainly that **nothing calls `validateEnv()`**: it documents rather than enforces, which `OPERATIONS.md` points at it as doing. Flagged rather than quietly fixed because a guard that silently does nothing is worse than no guard — the same failure as a `font-*` class generating no CSS ([ADR-0022](adr/0022-design-decisions-go-through-tokens.md)). Wiring it to `instrumentation.ts` is left as a decision, not assumed.

`NEXT_PUBLIC_ASSETS_URL` is now gone from every doc; the only surviving mention is the [PR-109] entry recording its removal.

Also removed five unreferenced `create-next-app` SVGs from `public/`.


## [PR-109] 2026-09-17 — Delete the Vercel Blob tooling the R2 move made dead

Three scripts and one environment variable, removed rather than left to rot. [ADR-0009](adr/0009-docs-reference-code-never-copy-it.md) is about docs going stale; the same applies to tooling that describes a system no longer in use.

- **`scripts/upload-images.ts`** — uploaded local folders to Blob for seeding. Superseded: uploads go through `server/catalog/object-store.ts` and are normalised on the way in ([ADR-0026](adr/0026-images-are-delivered-through-the-optimizer.md)), which this predated. `QUICK_START.md` pointed at it twice and now points at the admin UI.
- **`scripts/backfill-blob-images.ts`** — re-encoded stored originals in place. Premise gone twice over: the old store cannot be read while blocked, and nothing new is written there.
- **`scripts/cleanup-orphan-blobs.ts`** — reclaimed storage by deleting unreferenced blobs. Pointless against a store being abandoned, and R2's allowance is ten times larger. Its one hard-won idea is preserved in [PR-106] and in `scripts/README.md`: the keep-set is the **union across every database sharing the store**, because computing it from one deletes the other environment's live images.
- **`NEXT_PUBLIC_ASSETS_URL`** — documented as required-ish in `OPERATIONS.md`, referenced by no code at all.

**`scripts/migrate-blob-store.ts` stays, deliberately.** The old store still holds the only copy of anything not reproducible from local originals, and its `copy` phase is the fallback if that turns out to be true. It goes, with `@vercel/blob`, once the catalogue is confirmed intact on R2.

**`OPERATIONS.md` gained the R2 setup procedure** — bucket, scoped API token, public access, and the CORS policy, which is the step that silently breaks browser uploads because CORS applies to presigned URLs too. The Blob transfer section is kept but relabelled as historical: R2 has no egress meter, so that failure mode is gone rather than managed.

## [PR-108] 2026-09-17 — Images move to Cloudflare R2, behind one seam [CONTRACT]

The free Vercel Blob allowance was exhausted and the store blocked — every content read returning `403 Your store is blocked`, our own included. [PR-105] and [PR-107] fixed how much we send and store; neither can fix the shape of the allowance. Decision, the comparison, and the rejected alternatives: [ADR-0028](adr/0028-images-live-in-cloudflare-r2.md).

**R2 removes the meter rather than raising it.** Against Hobby's 1 GB storage / 10 GB egress / 2,000 write operations, R2's free tier is 10 GB / unmetered / 1,000,000. Egress is not a billable dimension on any R2 storage class, so the failure that blanked the catalogue cannot recur. The operations limit was the worst fit of the three: transfer and storage scale with traffic, but operations scale with how much you *work on* the catalogue — and dashboard browsing counts — so a shop in build-out spends them exactly when it can least afford to. This was also the cheapest moment to move: 321 images had to be re-uploaded from local originals anyway, because the old store could not be read.

**Hosting does not move.** Nothing that happened was a hosting failure, and the architecture is Vercel-shaped — cron in `vercel.json`, migrations on deploy ([ADR-0014](adr/0014-deploys-run-their-own-migrations.md)), and a deliberate dependency on the image optimizer ([ADR-0026](adr/0026-images-are-delivered-through-the-optimizer.md)).

**One seam.** `server/catalog/object-store.ts` owns every write, delete and URL derivation. This migration touched ten files precisely because "where images live" was spread across two upload routes, two bulk wizards, a profile handler and three scripts. Reads deliberately do not pass through it — an object is public and fetched straight from `R2_PUBLIC_BASE_URL`, because proxying reads through a function would rebuild the metered egress path being escaped.

**[CONTRACT] The upload handshake changed.** `POST /api/{admin,org/:orgId}/upload/token` now takes `{ pathname, contentType, size }` and returns `{ uploadUrl, publicUrl }` — a presigned S3 PUT instead of a bearer token, with the path and content type signed so neither can change after approval. The body is parsed by a Zod schema like any other (Invariant 4).

**One guarantee is weaker, and is written down rather than glossed.** `Content-Length` is a forbidden header — the Fetch `Request` constructor strips it — so size cannot be signed into a presigned PUT, and S3 PUT has no `content-length-range`. The declared size is validated but not bound: an authenticated uploader bypassing our client could exceed `MAX_IMAGE_BYTES`. The bound is authentication, not cryptography. A test pins it so it is not later misread as enforced. A stricter version is available if needed — the bulk-create route already receives every uploaded URL and could `head()` and reject.

**`aws4fetch` over the AWS SDK** — one small file against two packages and several megabytes in a function, to issue PUT, DELETE and a presigned URL. The old Vercel Blob host stays in `remotePatterns` until `migrate-blob-store.ts check` reports zero, so a partially repointed catalogue still renders; `@vercel/blob` survives only in the three scripts whose job is to empty the old store.


## [PR-107] 2026-09-17 — Zoom is sharp again: the stored ceiling is derived from the zoom, not guessed

[PR-105] capped stored photographs at 1600px and required `sizes` to describe the CSS box. Both are wrong on a surface that magnifies, and this catalogue has two — the gallery pinches to 3× and hover-zooms to 2×, the lightbox zooms to 3× with pan. Decision, measurements and rejected alternatives: [ADR-0027](adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md).

**A zoom scales bytes already downloaded; it does not fetch a sharper image.** So a zoomable element's real slot is its box times the zoom, and describing only the box guarantees softness at magnification — the exact defect [ADR-0026](adr/0026-images-are-delivered-through-the-optimizer.md) existed to prevent, arriving through the rule it wrote. The gallery's active slide and the lightbox now use `ZOOMABLE_IMAGE_SIZES`, the one sanctioned overstatement; the listing tile stays honest, because overstating *there* is what cost the transfer allowance.

**Measured against a pristine source, not argued.** At 3× zoom, 1600px q82 showed 6.63 mean absolute error against 3.33 for 2000px and 1.28 for the original — twice the error for 67KB less. At tile and page sizes the difference was negligible (2.50 vs 2.46), so PR-105's listing gains are untouched; the loss was confined to the surface where a buyer inspects weave and stonework. 3000px measured no better than 2000px (4.08) while storing twice as much, so the ceiling is 2048px and not higher: past `MAX_ZOOM_SCALE` nothing requests the pixels.

**The zoom cap is now declared once.** It was spelled three times — `MAX_SCALE = 3` in the lightbox, `Math.min(3, …)` in the gallery, and implicitly in the chosen ceiling. `MAX_ZOOM_SCALE` lives in `server/catalog/media.ts`, `MAX_IMAGE_EDGE` is derived from it, and `tests/unit/image-delivery.test.ts` fails both on a second spelling and on a ceiling that no longer clears the zoom.

**`scripts/backfill-blob-images.ts` brings existing images in line.** Measured on the real store: 321 blobs, 299 of them over 400KB totalling 649.5 MB — an average of 2.17 MB each. Each blob is overwritten at its own pathname so no URL changes and no database column is touched, with `contentType: image/webp` even where the pathname still says `.jpg`. This inverts the rule `migrate-blob-store.ts` follows, deliberately: a new pathname would mean rewriting eight columns and risking a half-migrated catalogue for a cosmetic gain.

**Also:** the three hand-run Blob scripts now load `.env` themselves — `tsx` does not, unlike Prisma's tooling, so every Blob call failed with "No token found". `dotenv` was already a devDependency.


## [PR-106] 2026-09-17 — A blob store can be migrated or garbage-collected, and the runbook says what each costs

Follow-on to [PR-105]. `scripts/migrate-blob-store.ts` copies every blob from one Vercel Blob store to another and repoints all eight URL columns — `Category.heroImage`, `Product.thumbnail`, `ProductMedia.ref`, `Profile.profilePic`, `Org.logoUrl`, `OrderItem.thumbnail`, `ShippingProvider.logoUrl`, `Banner.imageUrl`. Two phases (`copy`, `rewrite`) plus a `check`, dry-run by default, each resumable through `.blob-migration/manifest.jsonl`.

**Rewriting is a host swap, not a lookup.** Pathnames are preserved on copy, so the old and new URLs differ only in hostname, and both phases are idempotent. Rows are matched on the old host rather than on a type column, which is what keeps `ProductMedia.ref` safe — a `YOUTUBE` row holds a bare video id, not a URL ([ADR-0017](adr/0017-video-is-embedded-not-hosted.md)) — and leaves `placehold.co` and external carrier logos alone. A URL with no copy in the new store is reported, never guessed: a wrong URL is worse than a stale one, because the stale one still says where it came from.

**`OrderItem.thumbnail` is migrated despite being a deliberately frozen snapshot.** The freeze protects it from the catalogue changing, not from its store being retired; leaving it would 404 every historical order's images.

**Storage has its own ceiling, and its own lever.** Hobby includes 1 GB of storage against 668 MB in use, and exceeding *any* Hobby limit withdraws Blob access the same way transfer does. `scripts/cleanup-orphan-blobs.ts` deletes blobs no row refers to — the one storage lever that works while transfer is blocked, since `list()` survives the 403 and `del()` costs neither transfer nor a billed operation. Storage is charged as a monthly average (GB-month), so a mid-month deletion lowers what the rest of the month averages against.

**Its keep-set is the union across every database, not one.** One Blob store serves every environment, so a keep-set from a single database marks the other environment's live images as orphans and deletes production's catalogue. `CLEANUP_DATABASE_URLS` is therefore plural and the script refuses to guess; `--single-database` is the explicit escape hatch. It also keeps anything younger than 24 hours, because the bulk wizard uploads every image before creating any row — a blob with no row may be an upload in flight — and refuses outright when a named database yields no referenced URLs, which is far likelier a wrong `DATABASE_URL` than an empty catalogue. This replaces `scripts/cleanup-flat-blobs.ts`, which the runbook documented but which was not in the repository.

**Two facts the runbook was missing, both from Vercel's own pricing page.** A new store in the same account gets no new allowance — storage, operations and transfer "aren't affected by how many stores you create", because the included usage belongs to the plan. And an overrun blocks reads with `403`, including your own: `list()` still works, so the blobs are visible and unreadable, which makes exporting *after* the fact impossible. [OPERATIONS.md](OPERATIONS.md) now records both, and corrects the reset window from "billing anniversary" to the 30 days Vercel documents.


## [PR-113] 2026-09-16 — A product leaves sale by archiving, not deletion [CONTRACT] [MIGRATION]

An org can now take any of its products off sale and put it back, at the same URL, without touching the orders, payouts or ledger entries it appears on. Spec and TRD: [product-archive](specs/product-archive/); decision and rejected alternatives: [ADR-0029](adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md).

**The operation orgs wanted did not exist.** PR-112 made the refusal honest — a product with an order against it cannot be deleted, and never will be, because an order line records what was sold and for how much ([ADR-0020](adr/0020-money-bearing-records-never-cascade.md)). It did not make the refusal avoidable. Nothing on `Product` expressed a lifecycle: no status, and flags that are display badges. So an org whose product had a single abandoned unpaid order against it could not remove it from the storefront at all, and zeroing the stock — the only available lever — leaves the product listed, browsable and indexed, reading as a shop that cannot restock.

**One nullable timestamp, one `where` fragment, one assertion.** `Product.archivedAt` says when a product left sale; `ON_SALE` in `server/catalog/product.visibility.ts` is how every buyer-facing query asks about it; `assertNotArchived` inside the order transaction is what actually refuses a purchase. The first two are presentation. The third is the control, for the reason [ADR-0023](adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md) gives for bidding suspension: hiding a product from a listing does not stop a cart filled before the withdrawal, a page rendered a minute ago, or a request typed by hand.

**A timestamp rather than a `ProductStatus` enum.** The enum is the textbook model and it loses on honesty: nothing in this product drafts a listing, so `DRAFT` would be declared and never set, and a two-state enum is a boolean wearing ceremony. A nullable timestamp answers "is it" and "since when" in one column. This is also not an exception to ADR-0023 but an application of it — that ADR stores nothing on `Product` for bidding because a *clock* decides bidding suspension, and nothing about a clock decides whether an org wants a product off sale.

**The race has an unambiguous winner, because archiving takes the stock lock.** `setArchived` runs `lockStock` inside its transaction before writing the column. The order path locks those same rows when it reserves stock, and `assertNotArchived` runs behind that lock — so a withdrawal and a checkout serialise instead of interleaving: whichever takes the lock first wins and the other sees the result. The gate sits at order *creation*, which precedes payment, so a withdrawal either refuses the order before the buyer is charged or lands after the order stands. A buyer is never charged for an order the store then declines.

**Thirty-five product reads now differ by intent, so a test holds the census.** `tests/unit/product-visibility.test.ts` classifies every `prisma.product` read across eleven files and fails when one is added or removed, naming what to decide. Some must exclude withdrawn products; several must not, and those are the interesting ones — the slug pool a catalogue import checks against (an archived product keeps its slug, so an import must not reuse it), the cart's existence check (filtering there would delete a cart line that a restore should bring back), and `orgRepository.countProducts`, which guards org deletion where `Product.orgId` is `Restrict`, so filtering would let the guard pass and leave the database to refuse. A rule remembered at thirty-five call sites is missed at one.

**One control, two outcomes, and it says which.** `DELETE` deletes a product no record depends on and archives anything else, returning `{ outcome }`; Archive and Restore are their own actions, because an org may withdraw a product it has never sold. A live bidding event refuses the withdrawal — the event is a standing commitment to the people bidding, and cancelling it stays the org's separate act. Archive and restore are audited in-transaction with `recordAdminActionIn` ([ADR-0021](adr/0021-audit-trail-never-fails-the-action.md)), so the trail cannot record a withdrawal that rolled back; product create and update remain unaudited, which is a pre-existing gap this did not widen.

**Where a withdrawn product is still felt.** A cart keeps the line and `check-stock` reports it unavailable *by name*, reusing the state the cart already renders, so a restore brings it back rather than the line having silently vanished. A withdrawn product holds its SKU, so re-listing that code collides with something the org cannot see — the refusal now says so, in the form and in a catalogue import, rather than reporting a mysterious duplicate. Inventory value, low-stock and out-of-stock exclude withdrawn stock, and the org's figure is labelled **On Sale** with withdrawn reported as its own count: "not for sale" now has two meanings on the shelf, and no figure should be silently ambiguous about which it counts.

`[MIGRATION]`: `20260916090000_product_archive` — one `ADD COLUMN` and one index (`Product_orgId_archivedAt_idx`). Nullable with no default, so every existing row is on sale and no backfill runs. Nothing is dropped.

`[CONTRACT]`: the org-facing product shape gains read-only `archivedAt`; the buyer-facing shape deliberately does not carry it. `DELETE …/products/[id]` answers `{ outcome }` where it answered `{ success: true }`, and `PATCH …/products/[id]/archive` takes `{ archived: boolean }`. `ProductStats` gains `withdrawnProducts`. [CONTRACTS.md](CONTRACTS.md) moves in this PR.

`tsc --noEmit` clean, lint clean. 696 tests pass: 8 new in `tests/unit/product-visibility.test.ts` and 9 in `tests/integration/product-archive.test.ts`, the latter against the local database because the claims worth testing are claims about what Postgres returns and refuses — that six buyer-facing reads go blind, that the transaction refuses by name even though the listing already hid it, that an order keeps its line and its price, and that a restore undoes all of it. The census guard was verified to fail by adding a product read and watching it report the file.

**Two open questions were closed by assumption, and are recorded in the TRD rather than silently settled:** a catalogue import refuses a row whose SKU matches a withdrawn product rather than restoring it (putting a product back on sale must be an explicit act), and a withdrawn product's URL answers 404 rather than 410, since 410 tells a crawler to retire a URL an org may restore tomorrow. The latter is entangled with the standing soft-404 item on the [BACKLOG](BACKLOG.md).

## [PR-112] 2026-09-15 — A refused product delete says why

Deleting a product that has been ordered now fails with `This product cannot be deleted — 1 order still refers to it, and deleting it would break that record.` It previously failed with `One of the selected records no longer exists`, which named nothing that was true.

**The constraint was right; the reporting was wrong.** `OrderItem.productId` is `onDelete: Restrict` ([ADR-0020](adr/0020-money-bearing-records-never-cascade.md)) because an order line carries `unitPrice` — the price as it stood at purchase — so orphaning it would destroy the record of what was sold and for how much. Postgres refused correctly. What reached the org was a 409 claiming something they had selected had vanished, and an offer to pick another.

**Two separate defects produced that sentence.** First, `constraintFields` in `server/shared/constraint.ts` read the column from `meta.field_name`, `meta.column` or `meta.target` — none of which `@prisma/adapter-pg` sets. The constraint arrives at `meta.driverAdapterError.cause.constraint` instead, as `fields` for a unique violation and as `index` (the constraint *name*) for a foreign key. The file's own header warns that checking one shape silently disables whatever depends on it; `uniqueViolationFields` right above it reads both, and this function read neither. So **every** foreign-key failure in the app has been losing its field attribution, not just this one — a form could never highlight the offending input.

**Second, P2003 was assumed to be the child side of the key.** The same code covers two opposite situations: a value pointing at a parent that is not there (the caller picked wrong — "pick another" is correct), and a delete refused because rows elsewhere still point here (nothing the caller typed is wrong). `constraintFields` now distinguishes them and returns a `restricted` kind for the second, carrying the referencing table and no field attribution. Postgres states the direction in its own wording — `update or delete on table …` against `insert or update on table …` — which is the signal used; the constraint's table compared against `meta.modelName` is the fallback for the non-adapter shape.

**The good message comes from the domain, not from a constraint name.** `ProductsService.deleteProduct` now counts the three referrers that do not cascade — order lines, promotion targets, bidding events — and throws a `ConflictError` naming them with their counts. Promotions and bidding events were blocking deletion exactly as orders were, and would have produced the same nonsense; they are covered by the same check. `toErrorResponse`'s new `restricted` branch is the fallback beneath it, for a race or an unanticipated referrer, and reports `This cannot be deleted while existing orders still refer to it`.

**The count is for the message; the foreign key is still the enforcement.** Counting and then deleting is read-then-write, so an order placed in between still loses to the constraint — which is the point. The check exists to phrase the refusal, never to authorise the delete.

**A product with no orders, promotions or bidding events now hard-deletes as before**, its media, cart lines, wishlist entries and stock rows cascading with it. That is the right outcome for a listing created by mistake, and it is the only case where deletion was ever safe.

**What this does not do.** There is still no way to withdraw a product that *has* sold. Nothing on `Product` expresses "exists but is not for sale" — no status column, and `flags` carries only display badges — so an org whose product has one abandoned unpaid order against it cannot remove it from the storefront at all. That is a feature, not a message fix: it needs a column, a filter on every storefront read, and a re-check inside the order transaction the way bidding suspension does ([ADR-0023](adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)). Specced separately; on the [BACKLOG](BACKLOG.md) watch list. Decided in advance: when it lands, Delete stays one button — unsold hard-deletes, sold archives, and the response says which happened.

No schema change, so no `[MIGRATION]`. Not a `[CONTRACT]` change: the envelope in [CONTRACTS.md](CONTRACTS.md) is unchanged and a `restricted` failure simply omits `details`, which the shape already permits. `tsc --noEmit` clean, lint clean. 679 tests pass, 11 new in `tests/unit/delete-refusal.test.ts`; its two P2003 payloads were captured from Prisma 7.1 + `@prisma/adapter-pg` against the local dev database rather than written from documentation, since the discrepancy between documented and actual shape is what caused the bug.

## [PR-105] 2026-09-16 — Images are stored small and delivered through the optimizer

The Vercel account exhausted the free tier's 10 GB monthly Blob **Data Transfer** allowance before launch. On that tier the allowance is withdrawn rather than billed, so the failure mode was every product image on the storefront going blank. Spec and TRD: [image-delivery](specs/image-delivery/); the decision and its rejected alternatives: [ADR-0026](adr/0026-images-are-delivered-through-the-optimizer.md).

**Three causes, none of which changed how anything looked.** The product tile — the most-rendered component on the storefront — used a raw `<img>` from `2d3027b`, so a listing fetched twelve full-size originals to paint twelve ~105px thumbnails: about 7 MB of image for 120 KB of visible pixels. `unoptimized` had been added to the product gallery and lightbox in `1b844b2` and `4e3f301`, which read as someone fixing a broken optimizer and worked on screen, while moving the cost onto a meter on a different dashboard page. And `server/catalog/image-upload.ts` stored whatever was uploaded up to 5 MB with no resize, which multiplied both.

**Delivery and storage are now capped independently.** Every image in `src/` renders through `next/image` — the tile, the wishlist grid, the search dropdown, the admin product/cart/category tables, profile pictures, the read-only product gallery — and the five `unoptimized` props on Blob URLs are gone. Photographs are downscaled to 1600px and re-encoded as WebP before upload. Either ceiling alone was rejected: delivery-only leaves the optimizer as the single thing between a 5 MB original and the browser, and storage-only makes every future `<img>` look harmless.

**Both upload paths enforce the budget, because only one of them is ours.** The bulk wizards upload browser-to-Blob directly to dodge the 4.5MB function body cap ([bulk-catalog-upload](specs/bulk-catalog-upload/) D10), so no server code ever sees those files — the largest single source of images would have been missed entirely. `server/catalog/image-upload.ts` normalises with sharp; `src/lib/image/downscale.ts` does the same on a canvas before `upload()`. `MAX_IMAGE_EDGE` and `IMAGE_QUALITY` are declared once in `server/catalog/media.ts`, which both sides already import.

**`fill` without `sizes` is enforced as its own rule.** Absent `sizes` resolves to `100vw`, so a 64px avatar downloads the width of the viewport — the same overrun in `next/image`'s clothing, and invisible to a rule that only bans `<img>`. Upload previews now render the file still held in the page rather than fetching back the copy just sent (`useLocalPreviews`).

**The reason this went unnoticed for nine months is that it was never written down.** `tests/unit/design-tokens.test.ts` fails the build over a `text-[0.7rem]`; nothing failed over a raw `<img>` on a Blob URL. `tests/unit/image-delivery.test.ts` now blocks all three causes in the same style — file named, allowlist entries carrying their reason, and an honesty check that fails when an exemption stops being needed. Chosen over an ESLint rule because `@next/next/no-img-element` was already enabled and every offending site carried a disable comment. `/bb-review` picks up what a test cannot judge: whether a stated `sizes` is honest. [OPERATIONS.md](OPERATIONS.md) records both meters and that local development spends the same allowance.

Modelled at 10,000 monthly page views, Blob egress falls from ~55 GB to under 1 GB. Existing objects are deliberately not backfilled — their URLs and bytes stay as they are, and the optimizer means they no longer cost full size to serve.
## [PR-108] 2026-09-17 — A new product starts blank, not as the last one created

Opening "Create New Product" prefilled the form with the product just created. The create form persists a draft to `localStorage` (`product-creation-form-draft`) and restores it on mount, but nothing removed it after a successful create.

**The clear was lost in a refactor.** Before `8057071` the old `product-form.tsx` passed `clearSaved` to `useProductForm`, which called it on success — the category form still works this way. The split into `ProductAddContainer` / `ProductForm` / `useProducts` moved the save into `useProducts.createProduct` and left `clearSaved` destructured and unused. The later move to `useServerForm` did not wire its `onSuccess` either. `ProductForm` now clears the draft in `useServerForm`'s `onSuccess`, so it goes only once the server has accepted the product.

**Cancel abandons the draft.** On a create, Cancel resets the form and clears the saved draft before leaving, and the products page is refreshed on the way back, so it never shows a cached list. Editing an existing product is unaffected.

**The debounce never debounced.** `useFormPersist` returned a cleanup from inside the `watch` callback, which react-hook-form ignores, so every keystroke queued its own save — and one still pending could land after `clearSaved` and restore the draft. The pending save is now one timer in a ref, cancelled on change, on unmount, and by `clearSaved`.

No contract, schema or migration change. `tsc --noEmit` shows no errors in the changed files; no automated test covers the draft yet.
## [PR-107] 2026-09-16 — Contact us: WhatsApp, or a message emailed to the store

Every storefront page now has a **Contact us** control. On desktop it is an outline pill left of **Cart** in the header, shown to signed-in people and guests alike. On a phone it is the first tab of the bottom bar, which now reads **Contact · Cart · Home · Orders · Account**, so Home is in the middle. Either one opens a sheet with two options. **WhatsApp** opens a chat with +91 84529 59340 with an opening line typed in. **Send a message** swaps in a form with **Subject** and **Message**, sends it, and confirms without leaving the sheet. Spec and TRD: [contact-us](specs/contact-us/).

**The message is an email and nothing else.** It goes to support@bhendibazaar.com with the sender as **Reply-To**, so answering it is an ordinary reply. Nothing is stored, and there is no admin-portal page, table or migration. The store's inbox already keeps the history, and a second inbox would be one more place to check. The email is a template and a `sendContactMessage` method in `server/notifications/`, following that domain's rule for adding an email, and `SendEmailOptions` gained an optional `replyTo`.

**A signed-in sender is asked for nothing but the subject and message.** The reply address comes from the signed session, and an `email` in the body is ignored, because the session is the one input the sender cannot write. A guest also gets an **Email** field, since otherwise there would be nobody to reply to. The route and the form share one pair of schemas (`contactMessageSchema`, and `guestContactMessageSchema` which adds the email), so a guest who leaves the email out gets the error on that field (ADR-0013).

**The route waits for the send.** Other emails are sent without waiting because they follow an action that has already been saved. Here the email *is* the action, so a failed send returns a 500 telling the sender to retry or use WhatsApp, and what they typed stays in the form.

**Unthrottled, on purpose.** `withRateLimit` allows every request while the cache is detached, and with no table there is nothing to count. The call stays in so this route is covered once the limiter is reconnected.

**The sheet is a bottom sheet on a phone and a right-hand panel from `md` up.** `SheetContent` gained a `side="adaptive"` option instead of a second component, so focus trapping and Escape behave the same in both layouts. At `md` the vertical slide is reset so it does not combine with the horizontal one into a diagonal. The grab handle hides on desktop, and a close button was added. The header pill is `hidden md:inline-flex`, which ADR-0015 permits because the tab bar provides the phone equivalent in the same change. One `ContactLauncher` holds the open state and mounts the sheet for both placements.

`tests/unit/contact-email.test.ts` covers the route and template, `contact-sheet.test.tsx` the UI, and `contact-whatsapp.test.ts` the link builder, and the new template is added to the shared-shell check in `email-templates.test.ts`. No schema, no migration, no money path, and no CONTRACTS.md entry, because the route has one consumer. The 4 pre-existing failures (design-tokens ×2, rate-limit-detached, admin-audit-trail) are Windows path-separator mismatches in files this PR does not touch, and they reproduce unchanged.

## [PR-104] 2026-09-16 — An abandoned checkout releases its goods, and is shown to nobody [CONTRACT]

Closing the Razorpay window without paying left the item held and unbuyable. Spec and TRD: [checkout-abandonment](specs/checkout-abandonment/); the order-code decision and its rejected alternatives: [ADR-0025](adr/0025-order-codes-are-random-not-sequential.md).

**The release existed; nothing called it in time.** `expireAndRestock` has been correct since PR-40 — it returns stock to the location it came from and releases the coupon claim in one transaction. Its only caller was the reconciliation sweep, whose only caller is a Vercel cron running `30 3 * * *`, and which then waited a further hour. So an abandoned checkout held its goods until the next 3:30 am: up to a day, on a catalogue where most items are single units. [inventory-reservation](specs/inventory-reservation/) R4 and [payment-confirmation](specs/payment-confirmation/) R7 both already required this; the mechanism was written and the trigger was not.

**One routine, three triggers.** `paymentService.releaseIfUnpaid` asks the gateway what actually happened, then confirms, holds, or releases. The browser's dismissal calls it, a blocked checkout calls it, and the cron calls it — none of them decides anything. The browser may ask and may not decide, and a browser that never asks changes nothing.

**The gateway is asked a wider question than before.** `fetchCapturedPayment` only ever looked for a capture, which would have been wrong to release on: a UPI collect request sits `created` or `authorized` while the buyer approves it in their banking app, often after closing our window. `fetchOrderPaymentState` returns `captured`, `in-flight` or `none`, and only `none` releases. This matters because `confirmPaid` deliberately refuses an expired order — releasing early would have turned a real payment into a manual refund.

**Release happens when someone is actually blocked.** The order transaction now throws `OutOfStockError` naming the products; the create route releases abandoned holds on exactly those and retries once. This is what makes the fix independent of the cron — the hold is released at the moment it is demonstrably costing a sale, and a gateway call is spent only then. The cron is left at daily as a backstop; tightening it is a Vercel plan question (TRD D5), not a code one, and nothing now depends on the answer.

**Abandoned orders are kept and hidden.** Nothing is deleted — the rows carry who nearly bought what, which is the raw material for following those buyers up, and money-bearing children could not be deleted anyway ([ADR-0020](adr/0020-money-bearing-records-never-cascade.md)). `VISIBLE_ORDER_WHERE` is applied inside the repositories rather than at nineteen call sites, so the next order query cannot forget it. It covers the admin list, detail, stats and bulk update, the org list and detail, the buyer's own order list, and the analytics revenue, status and chart reads. The sweep's two worklists are the deliberate exemptions.

**`Order.status` is now declared once.** It was a bare `String` whose schema comment named `processing, partially_shipped, completed` — none of which the code writes. All ten real values are in `ORDER_STATUS` (`server/checkout/order.types.ts`), which is what visibility now turns on.

**Order codes are random.** `generateOrderCode` read the highest existing code and added one: a read-then-write against a `@unique` column, so two simultaneous checkouts minted the same code and one died on a constraint violation — likelier now that abandoned attempts multiply orders. Codes are `BB-` plus eight characters from an alphabet without `I L O U 0 1`, generated without touching the database. A second, differently-shaped generator in `order.repository.ts` was dead and is deleted. Old codes stay valid for ever and the lookup accepts both shapes.

`[CONTRACT]`: `POST /api/payments/abandon` is new. Order creation now answers **409** for a sold-out item rather than 400 for everything, through `toErrorResponse` — the handler was on the old error pattern and touching it meant converting it ([ADR-0013](adr/0013-one-error-envelope-and-useserverform.md)). It also dropped an `(session.user as any)`.

**No migration.** `"expired"` was already written and `status` was already a free string, so hiding an order needs no column. `Order.code` keeps its type and its unique index.

**The orders already holding stock were corrected by hand before this shipped**, through the same `releaseIfUnpaid` the live paths use — so the gateway was asked about each one and nothing that had been paid for was released. The script that did it is not part of this PR: it was a one-time correction for a backlog this change stops accumulating, and a remediation kept after its cause is fixed is one someone eventually runs by mistake. The daily sweep covers the ongoing case.

`tsc --noEmit` clean. 693 tests pass, 25 new across `checkout-abandonment.test.ts` and `order-visibility.test.ts` — the release decision including the in-flight hold and the ownership rule, the visibility predicate on every affected query, and the code generator's alphabet, uniqueness and agreement with the lookup pattern it is deliberately declared apart from.
## [PR-106] 2026-09-15 — The search dropdown shows rupees, and shows the offer price

The suggestion row rendered `{product.currency} {product.price}` straight out of the database, so a ₹1,299 product read **"INR 129900"**. Money is integer paise everywhere inside the system ([ADR-0004](adr/0004-money-as-integer-paise.md)) and leaves as a string in exactly one place — `formatCurrency` — which this surface never called. It was the only price in the storefront doing its own formatting.

**The same line broke the pricing rule underneath it.** `searchProducts` selects `price` off the product row and nothing resolved an offer, so the dropdown quoted the list price while the product page one click later quoted the discounted one. [ADR-0018](adr/0018-one-effective-price-function.md) is explicit that a read path needing a price and not calling the resolver is a defect, not an optimisation — this was that defect, and the formatting bug is what made it visible. Fixing only the formatting would have left a dropdown confidently showing the wrong number in better-looking type.

The row now goes through `productService.toSuggestion`, which calls `resolveProductPrice` against the request's shared `loadPriceContext` — the same function and the same instant the product page, the cart and the order transaction use — and returns `{ price, salePrice }` in paise. Rendering is `PriceDisplay` at `size="xs"`, so the strike-through and the offer treatment match every other tile rather than being re-derived here.

Two supporting changes. `searchProducts` selects `orgId` and `categoryId`, which the resolver keys on and the response does not carry; and the suggestion row gets **one declaration** (`ProductSuggestion` in `server/catalog/product.types.ts`, re-exported by `src/domain/product.ts`) in place of the hook typing a six-field row as the full `Product` — the mistyping that let the raw `currency` field look legitimate at the call site. No CONTRACTS.md entry: one route, one consumer, which [CONTRACTS.md](CONTRACTS.md) says does not need one.

**Migrate on contact** ([ADR-0013](adr/0013-one-error-envelope-and-useserverform.md) decision 7). The handler was still building its own `{ error }` body, and the hook was storing whatever came back as state — so a 500 put `{ error: "..." }` where the suggestion list goes and the next render read `.products` off it. The handler now returns `toErrorResponse`, the hook checks `response.ok` and falls back to an empty list. Nobody hit it because the route rarely fails; that is the kind of defect this rule exists to sweep up while the file is already open.

`tests/unit/search-suggestions.test.ts` pins both halves — the formatted output, and that a live automatic offer reaches the dropdown. 537 unit tests pass; the 4 pre-existing failures (design-tokens, rate-limit-detached, admin-audit-trail) and the 2 pre-existing `profile.*` typecheck errors reproduce unchanged on a clean tree. No schema, no migration, no money written.

## [PR-105] 2026-09-15 — A bidding window may run at most ten days

`biddingFormSchema` bounded a window on three sides — ends after it starts, does not end in the past, quick-bids below the maximum increase — and left its length open, so an org could open an event and close it a year later. It is now capped at ten days from `startAt`.

**The cap is measured from the start, not from now.** An event scheduled to open in a month still gets its full ten days; the rule is about how long bidding runs, not how far ahead it may be scheduled. The refine reports against `endAt`, because that is the field the org can move to fix it.

**The picker stops where the schema stops.** `MAX_BIDDING_DAYS` is exported and the "Bidding closes" input computes its `max` from it, so the dates past the cap are unselectable rather than accepted-then-rejected. That is ADR-0013's rule about a form and its route sharing one schema applied to a bound rather than a field: a literal `10` in the component would have been a second declaration free to drift from the first. The bound follows the start date as it is edited, and lifts while a half-typed value cannot be parsed, so typing a date never fights the picker.

Enforcement is still the schema, not the input. `max` on a `datetime-local` is a convenience a request does not have to honour, and the create route (`POST /api/org/[orgId]/bidding`) is the only path that parses this shape — there is no edit route that moves dates.

`tests/unit/bidding-window-length.test.ts` pins the boundary on both sides: exactly ten days passes, one minute more fails, a start a month out keeps its full run, and the existing order rule still reports its own message. No schema change, no migration, no money path. 643 unit tests pass; the 4 pre-existing failures reproduce unchanged on a clean tree.

## [PR-104] 2026-09-15 — Products can be narrowed to the ones people have saved

The product tables gained a demand column in PR-37. The filter card now carries a **Wishlisted only** switch beside Categories and Stock: on, the list is just the products at least one person has saved; off, it is the whole catalogue. Both portals get it — `ProductsFilters` is one component behind `/org/[orgId]/products` and `/admin/products`.

**It is a filter, so it had to resolve before the query, not after it.** The demand column works by a second round trip: the catalog query picks ten rows, then the wishlist domain is asked for those ten counts. Nothing about that can narrow a result set — filtering that way would hand back a page of ten with three rows on it and a total that disagrees. So the order is inverted for this: the wishlist domain answers with product ids, the DAL passes them to the catalog query as `productIds`, and paging and totals come out of SQL intact.

Neither domain learns to read the other's table ([ADR-0003](adr/0003-one-repository-per-aggregate.md), [ADR-0012](adr/0012-modules-are-vertical-slices-by-domain.md)). Catalog gains a `productIds` filter that says nothing about where the list came from — the alternative, a `wishlistItems: { some: {} }` relation filter, would have given `WishlistItem` a second reader. `wishlist-demand-column.test.ts` already pinned that rule and caught a first draft of this change naming the table in a *comment*, which is the test working as intended.

**Two things that look like details and are not.** The id list is filtered on `productIds !== undefined`, not on truthiness: `[]` is truthy in JavaScript, so a truthiness test would have worked by accident here and returned the entire catalogue the day someone tidied it. And the switch resets to page 1 — page 4 of everything is not page 4 of the saved ones.

The lookup is scoped to the org in the portal, which is what bounds it; the platform's cross-vendor view asks unscoped. That set grows with saves rather than with the catalogue, and is the cost of keeping the join out of catalog.

The control is the project's existing Radix `Switch` rather than a second switch implementation: it grew an optional `thumbIcon`, so a heart rides where the dot normally sits, and the three existing switches pass `undefined` and are unchanged. A 24px switch is under the 36px touch floor, so the label is wired to it with `htmlFor` — `button` is a labelable element — making the whole 40px row the target ([ADR-0015](adr/0015-mobile-first-design.md)).

`tests/unit/wishlisted-only-filter.test.tsx` covers the client half (param written, param dropped, page reset, column unaffected) and `tests/unit/wishlisted-only-resolution.test.ts` the server half (ids resolved, org scope, empty list preserved, flag never forwarded). No schema, no migration, no wire shape, no money path. 651 unit tests pass; the 4 pre-existing failures reproduce unchanged on a clean tree.

## [PR-103] 2026-09-12 — One phone number can back any number of accounts [MIGRATION]

A phone number is contact data, not an identity key. Signing up or saving a profile with a number another account already uses now succeeds. Spec and TRD: [shared-phone-numbers](specs/shared-phone-numbers/); decision and rejected alternatives: [ADR-0024](adr/0024-phone-is-contact-data-not-an-identity-key.md).

**The constraint claimed something untrue about the world.** `User.mobile` had been `@unique` since the first auth migration, which made a phone a second identity key without anyone deciding it should be one. But a number belongs to a device and a household: the only phone in a family, the counter of a shop where several people sell, a buyer ordering for a relative who has none. Each is a separate account with its own cart and orders, and the second of them could not be created — the refusal named a number the person genuinely holds, offered no way to prove it, and pointed at an account they may never have heard of. This reverses R4 of [international-phone](specs/international-phone/spec.md), whose *one spelling* half stands and whose *one account* half does not.

**Four places enforced it; all four go.** The unique index `User_mobile_key`; the `OR` arm in the signup handler; the `ConflictError` in `profile.service.ts`; and a duplicate of that check in `profile.repository.ts` that re-read the user to reproduce a decision the service had already made. Validity is untouched — an unparseable number is still refused through `server/shared/phone.ts`. Signup's check narrows to a typed `findUnique` on email, which removes an `as any` it needed to hold an optional clause on an auth path.

**Sign-in never depended on it.** `src/lib/auth-config.ts` resolves a credential login by email and has never consulted `mobile`. Email stays `@unique` and remains what identifies an account.

**The index is dropped, not relaxed to a plain one.** With the three checks gone nothing looks a mobile up exactly, and the only remaining reader — the admin user search — is a `contains` scan a btree cannot serve.

**It also unblocks a backfill that was left half-done.** `phone_numbers_e164` (PR-102) skipped any user whose `+91` spelling was already taken, because this index would have refused the write, leaving those rows as bare digits outside the E.164 every reader assumes. The guard existed only for the constraint, so the new migration re-runs that `UPDATE` without it, after the `DROP`, and raises a notice with the count still outside E.164 rather than failing the deploy.

`[MIGRATION]`: `20260912090000_phone_is_not_an_identity_key` — one `DROP INDEX`, one `UPDATE` on `User.mobile`, one notice. No other table is touched; `UserAddress.phone`, `OrgAddress.contactPhone`, `Org.phone` and `Bid.guestPhone` were never unique. Applied by `prisma migrate deploy` on deploy.

**Not a `[CONTRACT]` change.** No DTO changes shape and phones still cross the wire as E.164; [CONTRACTS.md](CONTRACTS.md) § Phone numbers never claimed exclusivity. The only wire difference is a 409 that stops happening, and the message on the one that remains, which now names email alone.

**What this closes off, deliberately:** OTP sign-in, recovery by phone and dedupe-by-number all assumed one number names one account. Each now needs a way to say *which* account before it can be built, recorded on the [BACKLOG](BACKLOG.md) watch list and in ADR-0024 decision 5. Phone is also no longer any signal against throwaway accounts — it was a weak one, since `mobile` is optional, but it is now none.

`tsc --noEmit` clean. 631 tests pass, four of them new in `phone.test.ts`, pinning the schema and the migration; its existing block over `phone_numbers_e164` is unchanged, that file being history. The same four fail on the Windows machine this was built on as in PR-102 — `design-tokens`, `rate-limit-detached` and `admin-audit-trail` compare backslash paths against forward-slash allowlists — all in files untouched here, and identical on HEAD. Lint reports nothing new; the two warnings in `profile.repository.ts` (`DeliveryAddress`, `addresses`) predate this change.

## [PR-102] 2026-09-11 — Phone numbers from any country, stored as one spelling [CONTRACT] [MIGRATION]

Every phone field — account mobile, saved and guest delivery addresses, organisation phone, pickup contact, a guest bidder's phone — now takes a number from any country, with India preselected. Spec and TRD: [international-phone](specs/international-phone/).

**The rule had copies, and they disagreed.** `common.schemas.ts` required a 6–9 leading digit; `address.schema.ts`, the guest checkout schema and `order.service.ts` accepted any ten digits; `profile.service.ts` carried its own `\d{10}`; `shipping/utils/validators.ts` had an unused fifth. There is now `server/shared/phone.ts`, and every check calls it.

**The same number could hold two accounts.** Seeded users stored `+91…` while signup stored bare digits, and `User.mobile`'s unique index compares strings. Phones are now E.164, normalised in the schema. The `phone_numbers_e164` migration prefixes `+91` to bare 10-digit values in `User`, `UserAddress`, `OrgAddress`, `Org` and `Bid`; it skips a user whose `+91` spelling already belongs to another account rather than failing the deploy, and raises a notice with the count of values it left. `Order.address` is a snapshot and is not rewritten — `formatPhone` displays both spellings alike, as do the admin and org order pages, the users and orgs tables, the bid ladder and the confirmation email.

**Validation uses `libphonenumber-js/max`**, 39 KB gzip. `min` is half that and validates most countries by length alone: it accepts `0123456789` as Indian, which the old rule refused.

`PhoneInput` (`src/components/ui/phone-input.tsx`) is a native `<select>` under an `IN +91` label, so a phone opens its own picker, beside a 16px `tel` field. A pasted or autofilled `+44 …` switches the country; a typed trunk `0` stays on screen while E.164 is submitted. `FormPhoneInput` reads its error from field state rather than an `error` prop, so it cannot be rendered without one.

`ProfileCard`'s account form was hand-rolled `useState`; touching it converted it to `useServerForm` (ADR-0013 decision 7), and `ProfileContext` now reads failures through `readApiError`, so a server-side phone error lands on the field. **`BidPanel` was not converted:** its phone field is now `PhoneInput`, but the panel's several amount buttons and its own 409 handling make the conversion a rewrite of the bid submit flow, so it is recorded on the BACKLOG error-envelope entry instead.

`[CONTRACT]`: phones cross the wire as E.164; inbound accepts any valid spelling, and bare digits still parse as Indian — [CONTRACTS.md](CONTRACTS.md) § Phone numbers. `[MIGRATION]`: data only, applied by `prisma migrate deploy` on deploy.

`tsc` clean. 627 tests pass, 26 of them new (`phone.test.ts`, `phone-input.test.tsx`); `guest-address.test.tsx` passes unchanged with the mobile field now a `PhoneInput`. Four fail on the Windows machine this was built on, all in files untouched here — `design-tokens`, `rate-limit-detached` and `admin-audit-trail` compare backslash paths against forward-slash allowlists. Lint reports nothing in the changed lines; the admin order and user pages keep their pre-existing `any`s.

## [PR-101] 2026-09-10 — `develop` deploys to a stable preview domain, so a change can be tested before it reaches production

Until now `develop` had never been tested — it deployed nowhere, and the deployment it *claimed* as its origin was production's. Preview's `NEXTAUTH_URL` was `https://bhendi-bazaar.vercel.app`, which is the project's default production alias, so every link a preview generated pointed at the live store. A per-deployment URL cannot be registered as an OAuth redirect URI or a webhook endpoint either, which is the mechanical reason a preview was never testable.

The deploy job now aliases each `develop` deployment to `dev.bhendi-bazaar.com` (`.github/workflows/ci.yml`). `main` gets no alias step — `vercel deploy --prod` assigns the production domains itself.

An audit of the two environments' variables, since a public preview changes what sharing one costs:

- **Preview's `DATABASE_URL` and `MIGRATE_DATABASE_URL` were empty strings**, which is why `develop` had no working environment to deploy into. Both are now set to the preview database. Note that production's copies are `Secret`-type, so `vercel env pull` returns `[SENSITIVE]` rather than the value — the two environments' database URLs cannot be compared from the CLI at all, and neither can `ENCRYPTION_KEY`. That they differ has to be confirmed in the Prisma console, not inferred from a pull.
- **Shared with production, and now being split:** `NEXTAUTH_SECRET` (a session minted on a public preview was valid on production), `BLOB_READ_WRITE_TOKEN` (test uploads landed in the production store, against the allowance ADR-0017 exists to protect), `RESEND_API_KEY`/`EMAIL_FROM`, and the four `KV_*`/`REDIS_URL` values (preview traffic could throttle real buyers through one limiter).
- **Absent from Preview entirely:** all three `RAZORPAY_*` keys, so checkout could not be exercised there at all, and `BLOCK_CRAWLERS`, so a public preview would be indexable.
- **`NODE_ENV` was overridden to `"Non-prod"` in Preview** — not a value Node recognises, so preview builds ran React in development mode. Removed.

**Correcting [PR-88](#pr-88):** the deploy job no longer builds on the GitHub runner. `vercel pull` cannot read Sensitive (`Secret`-type) variables back — it substitutes the literal `[SENSITIVE]` — and `DATABASE_URL` and `MIGRATE_DATABASE_URL` are Sensitive in both environments. A `vercel build` on the runner would therefore have run `prisma migrate deploy` against a placeholder connection string and failed, on `main` as well as `develop`. The job now runs plain `vercel deploy`, which uploads the source and builds on Vercel where those values exist — which is what the Git integration always did. The prebuilt route existed only to spend GitHub's minutes instead of Vercel's; that is not worth a pipeline that cannot deploy.

Found while auditing and *not* fixed here, each wanting its own change: `CRON_SECRET` and `NEXT_PUBLIC_RAZORPAY_KEY_ID` are absent from **both** environments though `OPERATIONS.md` lists them required; and Vercel's Attack Challenge Mode is enabled project-wide, so every request that cannot run JavaScript is answered with a `429` "Security Checkpoint" (`x-vercel-mitigated: challenge`) — including `/api/webhooks/razorpay`, `/api/webhooks/shipping/shiprocket` and `/api/cron/reconcile-payments`. A browser solves the challenge and passes; a payment gateway does not. While it is on, the verified-signal handler of [Invariant 2](../CLAUDE.md) cannot be reached from outside.

## [PR-100] 2026-09-10 — The CI build job gets a real database, because `next build` prerenders two routes that need one

The PR build job failed on `Export encountered an error on /robots.txt`. The cause was the job's own environment, not the code: it ran `next build` against `postgresql://test:test@localhost:5432/test`, which nothing is listening on, and with no `NEXT_PUBLIC_APP_URL`. `src/app/robots.ts` and `src/app/sitemap.ts` are the only two routes prerendered at build — the build's own route table marks them `○` and everything else `ƒ` — and between them they call `appUrl()` and read the catalogue. So a compile check was failing on code that is correct and works in production, where Vercel supplies both.

The job now runs a `postgres:16` service container, applies migrations to it, and passes placeholder `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` / `NEXTAUTH_SECRET`. Placeholders rather than real values on purpose: the artifact is discarded (deploys build via `vercel build` against pulled environment), and a `NEXT_PUBLIC_*` value is inlined into the client bundle, so a real secret there would be published. Giving it a real database rather than stubbing the two routes keeps the job an actual rehearsal of the deploy build — the alternative, setting `BLOCK_CRAWLERS=1` to make both routes short-circuit, would have made the check pass by not performing it.

Noted while reading the build output, neither addressed here: `next build` warns that the `middleware` file convention is deprecated in favour of `proxy`, and `baseline-browser-mapping` is over two months stale.

## [PR-99] 2026-09-09 — The bidding docs say why there is no cron, and TESTING.md stops claiming the database is untestable

Documentation only; no behaviour changed.

**[ADR-0023](adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)** records the decision Phase 8 was built on and that only its spec and domain CLAUDE.md held: `BiddingStatus` stores what a person chooses, never what the clock decides, and both the phase and the purchase suspension are derived on every read. It exists because the rejected options are the interesting part — a scheduled flip (the textbook answer, impossible on a Hobby plan that offers daily cron and wrong regardless, since it makes every consumer depend on a job having run), a lazy flip on read (turns the most-read public route into a write path and still races), and a denormalised flag on `Product` (two sources of truth for one fact, plus a cleanup step for the expire-with-no-bids case that decision 4 avoids). Its honest cost is stated: every read path must ask, the compiler cannot check that it did, and an ended-but-unsettled event still blocks a new one on that product. The root [CLAUDE.md](../CLAUDE.md) conventions line and [server/bidding/CLAUDE.md](../server/bidding/CLAUDE.md) now point at it.

**[TESTING.md](TESTING.md)** carried two statements that were no longer true. It said `vitest.config.ts` lacks the `@server` alias `tsconfig.json` defines — it has had it. And its "Database behaviour is currently untestable" section was written before any of the four files in `tests/integration/` existed; all four now run against a real Postgres behind an allowlist guard (loopback host *and* the database named `bhendi_bazaar_dev`, the shape Invariant 7 requires of the seed). Rewritten to say what is actually true, including the part that matters more than the good news: **they are green by absence in CI**, so a passing pipeline is not evidence that any constraint holds. The remaining gap is a disposable Postgres in the pipeline, not the tests. Coverage targets added for bidding's phase arithmetic and its concurrent writes, and `critical/` is now recorded as empty with its Invariant tests living in `unit/`, rather than the layout implying otherwise.

Also corrected: [BACKLOG.md](BACKLOG.md) (two rows) and [CONTRACTS.md](CONTRACTS.md) credited the bidding feature to PR-89, which is the email-shell PR from 2026-09-03. Bidding is PR-97.

**No edit path for a bidding event remains deliberate but under-documented.** The feature ships create, cancel, bid, record-sale and record-unsold, and no update at any layer. [spec R10](specs/bidding/spec.md) justifies immutability *after the first bid* — a bidder commits money against a stated deadline and cap — but nothing states the position on an event with no bids yet, where cancel-and-recreate is currently the only route and costs a new link. Left as-is rather than invented here; R10 already names the guard (`bidCount === 0`) if it is ever wanted.

## [PR-98] 2026-09-09 — Guest checkout: the required-email check no longer loops forever

`GuestAddress` made email mandatory by calling `setError("email", …)` from an effect that also listed `errors.email` as a dependency. `setError` writes a fresh error object, so the effect's own write re-triggered it, forever — a render loop with no exit. In the browser that pins the tab on the guest checkout's first paint; in `tests/unit/guest-address.test.tsx` it blocked the event loop synchronously, so vitest printed nothing at all and `--testTimeout` never fired, which is the shape of the bug that made this hard to see.

The requirement now lives in `guestAddressSchema` where the rest of the form's rules already are, and the manual effect is gone. It is a `.refine` over the shared `emailSchema` rather than a required field, because `useForm<DeliveryAddress>` types the resolver's *input*, and `DeliveryAddress.email` is optional — the reason the original code reached for `setError` in the first place. Reporting the address is now gated on `isValid` alone, since the schema covers email.

The test file gains an assertion that the address is withheld while email is blank, and its docblock now records both regressions it guards. Typecheck clean, 602 unit tests pass.

## [PR-97] 2026-09-09 — Bidding: an item can be sold by timed auction on a shareable link [CONTRACT] [MIGRATION]

A new `bidding` domain ([spec](specs/bidding/spec.md), [trd](specs/bidding/trd.md), Phase 8). An organisation puts one product up for timed bidding from its own console and gets back a public link; while the event runs the item stays listed but cannot be bought; when the clock runs out the platform sees every bid with its bidder's contact details, sells the item directly, and records what it fetched. The organisation is told the amount and never who bid.

Two design decisions carry the whole feature and are worth stating here because neither is visible from the file list.

**Stored status answers less than you would expect, on purpose.** `BiddingStatus` is `OPEN | CANCELLED | SOLD | UNSOLD` — only what the clock cannot decide. Whether an open event is scheduled, running or finished is derived from its two timestamps on every read (`server/bidding/bidding-window.ts`). Consequently **nothing in this feature runs on a schedule**: an event ends because its end time passed, observed whenever it is next looked at, and no read can be stale because nothing was cached. That also sidesteps the fact that this project's Vercel plan cannot run a minute-granularity cron at all.

**Every contested write is decided by Postgres, not by application code that read first.** A bid is one guarded conditional update carrying the clock, the event's state and the price together (`biddingRepository.acceptBid`), so two bidders racing produce one winner and one "the price moved to ₹X" — never two bids at one amount, never a bid a millisecond after the close. Two constraints Prisma cannot express are added in the migration and are load-bearing rather than defensive: a **partial unique index** on `productId` where the status is open, so two simultaneous creations cannot both succeed; and `@@unique([eventId, amountPaise])`, so a tie cannot exist in the data whatever the guard does. Plus `CHECK`s for an ordered window, positive money, a complete sale record, and a bid attributable to either an account or a named guest.

**The purchase gate is the first one this store has had.** Adding to cart checked nothing before this and stock was enforced in exactly one place — the order transaction — so suspension had to hold there or not at all. It is derived, never stored: nothing is written to `Product` when an event opens or closes ([spec](specs/bidding/spec.md) R32). Display surfaces read a request-memoised set of locked product ids (`loadBiddingLockContext`, the shape `loadPriceContext` already uses — one small query per request however many products a page shows); `cartService.updateCart` refuses early for a good message; `assertNotUnderBidding` inside `order.service.ts`'s transaction is the authoritative refusal. That call sits **after** the stock reservation deliberately: the reservation takes the row lock that event creation also takes (`productsRepository.lockStock`), so checking afterwards is what makes the two decisions serial instead of merely close together. Checking first left a window in which an item could be sold and auctioned at the same instant. A locked item also drops out of the sign-in cart merge, the way one whose product has vanished already did.

**Settlement is by hand, by decision.** The platform speaks to the winning bidder off the platform — no payment link, no claim window, no address collected anywhere — and records which bid won and for how much. That figure is what the organisation is owed, so it reaches the ledger as an `OrgLedgerEntry` of kind `ADJUSTMENT` via a new `ledgerService.recordBiddingSale`, which org-payouts R5 anticipated and nothing had needed yet. An `Order` was rejected: it would show the organisation its buyer, and it would have to be marked paid with no gateway signal, which [Invariant 2](../CLAUDE.md) forbids. Commission resolves through the same arithmetic a normal sale uses, so the two settle on one set of rules. Recording an outcome takes the unit out of stock with the guarded `updateMany` ([ADR-0007](adr/0007-conditional-stock-decrement.md)) and audits inside the same transaction ([ADR-0021](adr/0021-audit-trail-never-fails-the-action.md)). An event that nobody buys is recorded unsold and the product returns to sale.

`[CONTRACT]`: the product wire shape gains read-only **`biddingSlug?: string`** — see [CONTRACTS.md](CONTRACTS.md) § Products. `[MIGRATION]`: `20260909120637_bidding`.

Smaller notes: the outbid email is fire-and-forget with the same reasoning as the purchase confirmation — a mail failure must not unwind an accepted bid — and a bidder who left the email blank is simply skipped, which the bid form tells them at the point of choosing. Guest email is optional by decision, not oversight. The bidding page is the first dynamic `opengraph-image` in the repo (`next/og`), and it states an **absolute** closing time rather than a countdown, because scrapers cache and a frozen "2 hours left" keeps being wrong. The countdown on the page runs against a server clock shipped with the render, not the device's. Quick-bid amounts and the maximum one bid may add are set per event by the organisation; that maximum is also the only thing bounding a bad-faith bidder, since rate limiting remains parked. `LedgerLineInput.orderItemId` widened to `string | null`, which its own comment already anticipated. Root [CLAUDE.md](../CLAUDE.md)'s domain table was three domains out of date (`promotions`, `payouts`, now `bidding`) and is corrected.

Doc corrections made while updating [ARCHITECTURE.md](ARCHITECTURE.md), all pre-existing drift: the shape diagram claimed 46 API handlers (83), ~14 admin pages (24) and no `(org)` portal at all, and listed **Upstash Redis as wired for rate limits** when PR-81 detached it — the last one directly contradicts what this feature was designed around, so it is now stated as detached with a pointer to the test that keeps it honest.

27 new tests: 17 pure phase-and-arithmetic, 10 concurrency against a real local database — mocks cannot test what Postgres does under contention. Typecheck, lint and build clean.

Merged with the email rework that landed in PR-88/PR-89 while this was in progress. Those fixed the missing purchase-confirmation line items and moved every template onto one shell, so the outbid email is rendered through `renderEmail` and formats money with `formatPaise` rather than carrying its own document — and a duplicate fix of the same currency bug was dropped in favour of theirs.

## [PR-96] 2026-09-09 — Deploys move to GitHub Actions so a collaborator's push actually ships

Vercel Hobby only git-deploys commits authored by the Vercel account owner, and Hobby has no members to add — so every push from the repo's collaborator built nothing and the branch quietly diverged from what was live. The Git integration is therefore off (`vercel.json`, `git.deploymentEnabled: false`) and deployment is a job in `.github/workflows/ci.yml` that runs `vercel pull` → `vercel build` → `vercel deploy --prebuilt` under an account token, where commit authorship is irrelevant. `main` deploys `--prod`; `develop` deploys a preview. Requires repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

The deploy job is gated on `test`, so a red typecheck or suite now blocks a deployment rather than racing it — which the Vercel trigger never did. The standalone `build` job is scoped to pull requests, since `vercel build` compiles the same commit on a push and building twice bought nothing. Workflow-level concurrency cancels superseded PR runs but never a push run, which may be mid `prisma migrate deploy`. The dead `SKIP_ENV_VALIDATION` env (read by nothing in the repo) is dropped.

Unchanged: migrations still run inside the build ([ADR-0014](adr/0014-deploys-run-their-own-migrations.md)) — they now run on the GitHub runner against the environment `vercel pull` fetched, which means a push to `develop` migrates whatever database Vercel's Preview environment points at. Noted in [OPERATIONS.md](OPERATIONS.md).

## [PR-95] 2026-09-09 — Wishlist demand shows up in the product tables

Both product tables — the org portal's own catalogue and the platform's cross-vendor list — now carry a **Wishlisted** column: how many users have saved that product. Zero reads as an em dash, so the products people actually want stand out from the ones nobody has hearted; a saved product shows a filled heart and the count, with the exact wording ("Saved by 3 users") on hover.

**One column, both tables, because they were already one component.** `ProductsTable` is shared by `src/app/(org)/org/[orgId]/products/page.tsx` and `src/app/(admin)/admin/products/page.tsx`, and org scoping is a filter on the path's `orgId` that the repository already applies — so an org sees demand for its own catalogue and only its own, with no second query path to keep in step.

**The count is read through the wishlist domain, not joined in catalog.** `wishlistRepository.countByProductIds` groups in SQL on the existing `@@index([productId])`; `wishlistService.countSavesByProduct` is the public surface, and `products.dal.ts` merges it into the rows the same way it already merges markdown prices out of `promotions`. The tempting shortcut — `_count: { select: { wishlistItems: true } }` on the catalog `select` — would have given `WishlistItem` a second reader and put a wishlist projection inside the product repository, which is the drift ADR-0003 exists to stop. Composition happens at the DAL, where cross-domain composition already happens (ADR-0012).

**One extra query per page render, bounded by the page size**, not the catalogue: only the ten ids actually being rendered are counted, and an empty page skips the database entirely. A product nobody saved has no row, so absence defaults to zero at the mapper rather than being stored.

**Deliberately not sortable.** The counts are merged after the page has been selected, so sorting on the column would reorder ten already-fetched rows and present it as a ranking. Sorting by demand needs the count in the SQL that paginates, which is a different change.

No migration, no schema change, no new route — the rows already existed and the lists are server-rendered. No buyer identity leaves the wishlist domain: the count is the whole of it, so a selling org learns that fourteen people want a product without learning who they are. Six new tests in `tests/unit/wishlist-demand-column.test.ts` pin the grouping, the zero default, the empty-page skip, and the boundary itself — that `admin.product.repository.ts` never mentions the wishlist and the DAL reaches the service rather than the repository. `tsc` exits 0.

## [PR-94] 2026-09-08 — Only the heart removes a saved product

**Corrects [PR-93] below, which has not shipped.** A confirmed payment cleared any wish the buyer had opened from `/wishlist` and carted. That is one removal the buyer never asked for, and the provenance rule made it unpredictable rather than safe: the same product, the same order, kept or forgotten depending on which page it was opened from three steps earlier. A saved product now leaves the wishlist when — and only when — the buyer un-hearts it, on the tile, the product page or `/wishlist`.

Everything that existed to support the other rule is gone rather than left dormant: `WishlistItem.cartedFromWishlistAt` and its migration, `markCartedFromWishlist` and `removePurchased` through the repository and service, `PATCH /api/wishlist`, the `?from=wishlist` link parameter the wishlist grid appended, and `orderRepository.findPurchasedProductIds`, whose only caller was the sweep. `onPaymentConfirmed` no longer touches the wishlist at all. A column nothing reads is a column someone re-wires later.

`wishlist.repository.ts` now holds exactly one `deleteMany`, and the test suite pins that: one delete path, no PATCH on the route, no `wishlistService` inside `onPaymentConfirmed`, and one `DELETE` fetch in the client context. The old purchase-rule tests are replaced by these — five in place of four, 25 across both wishlist suites, `tsc` exits 0.

No migration to run. The dropped column was added on this branch and never deployed; a dev database that already applied `20260908000000_wishlist_carted_origin` needs `npx prisma migrate reset` (or a manual `ALTER TABLE "WishlistItem" DROP COLUMN "cartedFromWishlistAt"`) to match the folder.

Not addressed: four unrelated suites fail on this branch already — audit-trail, design-tokens (two) and rate-limit-detached. They are untouched here and predate this change.

## [PR-93] 2026-09-08 — Buying the thing you saved clears the wish; buying it elsewhere does not [MIGRATION]

The heart now sits beside Share on the product page, not only on grid tiles — the one surface where a shopper decides is the one that was missing it.

**And a purchase can now tell "I bought the thing I saved" from "I happened to buy something that is also saved".** Both are the same product and the same order, so the difference is provenance: opening it from `/wishlist` and adding it to the cart records `WishlistItem.cartedFromWishlistAt`, and `onPaymentConfirmed` removes only marked rows. The same product reached from the home page is never marked, so it stays saved — buying a second one as a gift must not silently forget the first.

**The mark lives on the row rather than in the tab it started in.** The journey from a product page to a confirmed payment crosses refreshes, a payment redirect and sometimes a different device, and a tab-local flag loses the origin on all three — silently keeping an item the buyer expected to be gone. One nullable column carries it instead, and NULL is the safe default for every row that predates the distinction: it keeps the item, which is the harmless direction.

Removal is scoped to the buyer's own wishlist and to products actually in the order, so an order can never reach another person's saved items. Like the ledger write beside it, it logs rather than throws — a wishlist that failed to clear must not unwind a payment that succeeded.

Purchased products are read from `OrderItem` via `orderRepository.findPurchasedProductIds` rather than walked out of the shipment tree, where a product split across two parcels appears twice and the line shape depends on which mapper ran.

**A defect this branch introduced, fixed here:** `wishlist.dal.ts` wrapped `getServerSession` in a try/catch, and reading the session is how a route declares itself dynamic — by throwing. The catch swallowed Next's control-flow signal and turned a correct render into seven `Failed to fetch saved product ids` errors per build. `unstable_rethrow` now lets framework errors through and catches only real ones.

Saving also confirms itself with an "Added to wishlist" toast, fired after the write lands rather than beside the optimistic fill — a toast that says "Added" and is followed by an error toast has told the buyer two contradictory things about one tap. Removal stays silent; the emptying heart is the feedback.

**26 new tests** across both wishlist suites. 554 pass, `tsc` exits 0, `next build` compiles with a clean log. **Run `npx prisma migrate deploy`.**

Not addressed: a wish is cleared by payment confirmation, so a cancelled or refunded order does not put it back. Buy Now marks the origin on the same rule as Add to Cart, but a buyer who abandons checkout keeps both the mark and the item — harmless, and re-marked next time.

## [PR-92] 2026-09-07 — A wishlist is rows, and there is no guest one [MIGRATION]

The README has advertised "Wishlist: save products for later (coming soon)" since the storefront existed. It exists now: a heart on every product tile, a `/wishlist` page in the profile menu, and removal only on an explicit un-heart.

**Saved products are rows, not a `productIds String[]`.** The array was the shape originally proposed and it is the shape this repo has lifted out three times already — `Profile.addresses` in PR-41, `Shipment.items` in PR-43, `Cart.items` in PR-44, each still carrying its `legacy*` blob as the audit copy. Three things decided it rather than precedent alone. Postgres cannot put a foreign key inside an array, so a deleted product would leave an id nothing resolves and the page would silently render seven of eight tiles. Every add would be a read-modify-write of the whole array, so hearting on a phone and a laptop at once loses one heart with nothing to show it happened — the same race `Cart.version` exists to catch, needed here for a feature that has no other reason to want optimistic locking. And an array has nowhere to put `savedAt`, which is what "recently saved first" sorts by and what a price-drop alert would hang off later.

`WishlistItem.productId` is `Cascade`, deliberately the same as `CartItem` and the opposite of `OrderItem`: a saved product is a wish, not history. [ADR-0020](adr/0020-money-bearing-records-never-cascade.md) governs rows carrying money or attribution, and this one carries neither.

**No `wlId` on `User`.** `Wishlist.userId` is `@unique`, which is the entire relationship; a column on the other side would be a second copy that can disagree with the first and a two-table write to keep them agreeing. `Cart` has never had one either — `User.cart` is a back-relation and nothing more.

**There is no guest wishlist, so there is no sign-in merge.** A signed-out visitor who taps the heart gets `Sign in to add to wishlist` and nothing is stored — no localStorage, no anonymous row, and none of the union-of-two-sets logic `cart.merge.ts` needs. The cost is stated rather than hidden: the heart does not survive the sign-in, and the visitor taps it again afterwards. The toast is a message and not a gate — `/api/wishlist` 401s on its own, and `/wishlist` redirects to `/signin?callbackUrl=/wishlist`, neither of which cares what the client believed.

**The saved set is read on the server.** `(main)/layout.tsx` reads it once through `wishlist.dal.ts` and hands it to `WishlistContext`, so hearts are painted in the first render instead of flashing hollow and re-filling after a fetch — a route handler is for mutations, not for data a server component already had. The state is shared rather than per-button because one product appears twice on a product page (the grid tile and the similar-products rail), and two hearts for one product must not disagree. Writes are optimistic and revert on failure, with the server's own message in the toast.

A saved product stores the fact of the wish and nothing else: name, image, stock and price are derived from the product join at read time, priced through the same resolver the product page and checkout use ([ADR-0018](adr/0018-one-effective-price-function.md)), so a wishlist cannot advertise a price checkout would refuse.

`--favorite` joins the semantic colours in `globals.css`. A filled heart wanted red and `destructive` was the only red available, but `destructive` means "this will break something" — the opposite of what a saved product means — and ADR-0022 asks for roles, not nearest-available values.

**20 new tests** (the wire mapper including offer resolution, the schema and migration contracts, and the heart: the guest toast writing nothing, optimistic fill, revert on failure, two hearts staying in step, a still-loading session never being told to sign in, and the confirmation toast firing on a landed save but never on a removal or a failure). 550 pass, `tsc` exits 0, `next build` compiles. Four suites fail on Windows only and did so before this branch — `design-tokens`, `admin-audit-trail` and `rate-limit-detached` compare allowlist paths with `/` against `path.join`'s `\`. **Run `npx prisma migrate deploy`.**

Not addressed: the wishlist is not reachable from the mobile tab bar, only the profile menu. Nothing moves a saved product into the cart in one tap. And no page counts how often a product is wishlisted, though `@@index([productId])` is there for the day one does.
## [PR-89] 2026-09-03 — One email shell, four templates that only carry their content

Each of the four transactional emails rendered its own complete document: doctype, head,
`<style>` block, accent bars, header with the logo, and a footer with the copyright line.
Four copies of the same chrome meant a brand change was four edits, and they had already
drifted — the payout email's total sat at 22px against the order's 20px, and the same
"can't click the button?" fallback existed twice, worded identically and maintained
separately.

`server/notifications/templates/layout.ts` is now the only file that knows what an email
looks like. `renderEmail` takes a title, an optional tagline and banner, a body and an
optional footer; the shared stylesheet is injected once, by it. A template supplies only
what differs, composed from blocks that live beside it — `greeting`, `paragraph`,
`closingNote`, `button`, `noticeBox`, `alternateLink`, `detailPanel`. The purchase
confirmation drops from 405 lines to ~300, most of that its own line-item table CSS; the
other three are under 45 lines each. `.success-banner` and the detail/total row styles moved
into `baseEmailStyles.ts`, since two templates had each declared them.

**Interpolated data is escaped now.** Customer names, addresses, order notes and product
titles reached the HTML raw — an order note containing `<` produced broken markup, and the
same path would have carried a `<script>` into anything that renders the mail as HTML. All
of it goes through `esc()`. Invariant 4 is about the payload being untrusted, and that does
not stop at the parse.

`formatPaise` in `formatters.ts` replaces the `formatCurrency(paiseToRupees(x))` pair
repeated at every call site. No visual change beyond the payout total's 2px and class
renames backed by equivalent CSS — verified by rendering all four emails before and after
and diffing. New rules in `server/notifications/CLAUDE.md`; covered by
`tests/unit/email-templates.test.ts`.

## [PR-88] 2026-09-03 — Transactional email reaches its recipient, and shipping recovers from an empty init

Two unrelated silences, both of the same kind: code that ran, logged nothing, and did not do the thing it was there for.

**The purchase confirmation was reaching almost nobody.** `onPaymentConfirmed` in `server/checkout/order.service.ts` guarded the send on `deliveryAddress.email`, but that field is per-address in the address book and is only ever asked for when *adding* an address — checkout never collects it for a signed-in buyer. So the branch was live only for guests, and a logged-in customer's confirmation was skipped without an error. The address email is now a first choice, not the only one: absent it, an order with a `userId` falls back to the account's login email via `profileRepository.findEmailById`. The email also carried no line items — the template rendered totals over an empty list — so the shipment lines are flattened into the view. If neither email resolves the path now logs loudly rather than returning quietly, because by then a payment has been taken.

**A guest had no account to fall back to**, so `orderService` refuses a guest order that carries no email (`!input.userId && !input.address.email`) rather than discovering at payment-confirmation time that there is nobody to notify. The guest checkout form asks for it as required to match, through a new `emailRequired` prop on `AddressFields` — the client rule and the server rule come from the same intent, per [ADR-0013](adr/0013-one-error-envelope-and-useserverform.md). That form was also permanently invalid on a field the user cannot see: its schema requires `id`, which a guest does not have and the form never registers, so `isValid` never became true and the Continue button never enabled. It is seeded empty in `defaultValues`.

**The guest order-lookup response was the whole row.** `orderRepository.findByCode` backs an unauthenticated route — anyone holding a code reaches it — and returned everything on the order, including `userId`, notes, gateway ids and the full delivery address. It now returns a projection, with the address reduced to city/state/pincode/country; the name, phone and street belong to the order's owner, not to anyone who knows its code. Separately, `findByCode` never loaded `shipments` at all, so the orders page crashed on `order.shipments.flatMap` — the projection includes them. No DTO recorded in [CONTRACTS.md](CONTRACTS.md) changed, because this response was never recorded there; it should be.

**Settlements now tell the organisation they were paid.** `setSettlementStatus` fires a payout email after the transaction commits, on the same reasoning the order confirmation uses: the transfer has already happened, so a failed email must neither look like a failed payout nor undo one. New template at `server/notifications/templates/payoutEmail.ts`; `orgRepository.findEmailContact` reads name and email and nothing else.

**And shipping could not recover from booting with no carrier.** `initializeShippingModule` set `isInitialized = true` even when it loaded zero providers, so the recovery path in `src/app/api/shipping/rates/route.ts` — which notices an empty provider map and re-initialises — returned at the guard without reloading, and every quote 503'd until someone restarted the server. It now latches only on a provider actually loading. The matching half is that `AdminConnectionService.connect` wrote credentials and never told the running orchestrator, so a carrier connected through the admin console was invisible to the process that quotes with it; connect and disconnect now refresh the live map. Together these are what make "an operator connects a carrier without a developer or a deploy" ([server/shipping/adr/0002](../server/shipping/adr/0002-credentials-via-admin-not-env.md)) true rather than aspirational.

**One more found while wiring that up:** the orchestrator's provider map is keyed by carrier `code`, but the Shiprocket webhook route looked it up by record `id` — `"shiprocket_001"` against a key of `"shiprocket"` — so every tracking webhook failed as "Provider not found". The route passes the code, and the dead `reloadProvider` that baked in the same id/code confusion (it would have registered one carrier twice and quoted it twice) is replaced by `refreshProvider`/`removeProvider`, both keyed the way `loadProviders` keys. `init.ts` also stopped declaring its own carrier list and uses the `PROVIDER_FACTORIES` registry, so a second carrier cannot be added to the registry and silently not load at boot.

## [PR-87] 2026-09-02 — Cut the Prisma-ops bleed: kill the admin poll, stop per-page profile fetches, close the N+1s

A four-layer audit traced why a store with no customers was burning ~3,500 Prisma operations a day against a 100k/month budget. Almost none of it was page views. The fixes, in order of ops recovered:

- **The admin dashboard polled every 60s** (`src/admin/dashboard-live.tsx`) — 14 ops/tick, no `visibilityState` gate, so one forgotten open tab was ~17k ops/day and could exhaust the month in under six days. Interval removed; the manual Refresh button stays.
- **`ProfileProvider` fetched `/api/profile` on every page load** for every signed-in user (mounted app-wide in `src/app/providers.tsx`), for data only the profile page renders. It now scopes to `src/app/(main)/profile/layout.tsx`; the chrome's one need, `isEmailVerified`, rides the session token (stamped in the same sign-in query that already read `platformRole`, refreshed via `session.update()` on the verification-success redirect). See `src/lib/auth-config.ts`, `src/types/next-auth.d.ts`.
- **The cart-sync debounce was defeated** (`src/hooks/cart/useCartSync.ts`): `updateCart` in the effect deps fired a write on the raw change *and* again after the debounce, and a rehydrating persisted cart wrote on every page load. Now reached through a ref, guarded by a last-written snapshot, and silent on the mount rehydrate.
- **Payouts overview was 4N+2 queries** (grew with every org onboarded). `ledgerRepository.balancesByOrg`/`entryCountsByOrg` group once across all orgs — a constant six queries. No arithmetic changed; the per-org methods stay for the single-org views.
- **Missing `relationLoadStrategy: "join"`** added to the admin order/product, org-review, banner (every homepage), address (every signed-in page) and commission-rule reads — one LATERAL JOIN instead of a statement per nested relation.
- **Unbounded storefront product reads** now carry `take` (the validated `limit`/`offset` wired through, plus a 200-row safety cap); the sitemap reads slugs only via `productsRepository.listSlugs` instead of the full priced catalogue; `products/new` reads one org by id instead of every platform org with stats. Home and category pages `Promise.all` their independent reads.
- **`requirePlatformAdmin` is now request-memoised** with `cache()` (like `requireOrgMember`), halving the guard read on the nine admin pages that call it after the layout already did. The ADR-0021 per-request re-read is preserved.
- **Security bycatch:** `/order/[orderId]` now passes the viewer's id so a signed-in user can only open their own order (a mismatch reads as "not found"). Guest orders remain readable by id — closing that needs an order-scoped token in the post-checkout URL, a product decision left for its own spec.
- **Ops config:** `BLOCK_CRAWLERS=1` set in Vercel Production (the PR-84 crawl block had never been enabled); doc-drift fixed in `OPERATIONS.md` (the reconcile cron is daily, not every 15 min).

Three checkout-flow defects surfaced while testing the above and are fixed in the same batch (all pre-existing, none introduced by the ops work): (1) an infinite `effect→setState→re-render` loop in the guest address form — `handleGuestAddress` and `useAddressManager.selectAddress` both changed identity every render, so `GuestAddress`'s `onAddressChange` effect never settled; both are stabilised (a ref for the options callback, `useCallback` for the handler). (2) `useAddressManager({ autoFetch: true })` fired `GET /api/addresses` on every checkout mount including for guests, who have no saved addresses — a guaranteed 401; auto-fetch is now gated on `!!user`. (3) the addresses GET handler read `(session.user as any).id`, an `any` at an auth boundary (Invariant 4); now the typed `session.user.id`, which the session augmentation already provides.

Not done here, deliberately: moving `getServerSession` out of the root layout to make pages cacheable (a baseline change that intersects ADR-0018 and needs its own spec). 568 tests pass, typecheck and lint clean on touched files.

## [PR-86] 2026-09-02 — A failed payment attempt no longer strands the stock reservation

`payment.failed` from the gateway was treated as the end of the order: `markPaymentFailed` set `status: "failed"` terminally, which removed the order from the reconcile sweep's worklist (`paymentStatus: "pending"` filter) and made it ineligible for `expireAndRestock` (`status: "pending_payment"` guard). The reserved stock never came back — every failed payment attempt permanently leaked its quantity until manual correction.

The premise was also wrong: Razorpay fires `payment.failed` per *attempt*, and the buyer can retry inside the same checkout, so a failed attempt is not a dead order. Now the handler records `paymentStatus: "failed"` only (never over a captured payment, never on an expired order) and the order stays `pending_payment` — the reservation deliberately holds for a retry, and the existing sweep expires and restocks it after the hold window, exactly as it does for a closed-modal abandonment. The sweep worklist now includes `paymentStatus: "failed"` so those orders are asked about at the gateway (a retried capture whose webhook was lost is recovered, not expired), and `expireAndRestock` also accepts the legacy `status: "failed"` rows this bug already created, so the historical leaks drain through the same path (at the sweep's cap of 20 per run).

Known limitation, unchanged here: the sweep cron runs daily at 03:30 (`vercel.json`), so release takes up to ~24h, not the designed 60 minutes. Tests: `tests/unit/payment-failed-restock.test.ts` pins the conditional-write shapes. 568 tests pass, typecheck clean.

## [PR-85] 2026-09-02 — Guest checkout unstuck, and admin pages stop showing paise as rupees

Two production defects, both display/validation only — no schema, no wire shape, no money-path change.

**Guest checkout never fetched shipping rates.** `GuestAddress` validates with a Zod schema requiring `id: z.string()`, but the form never registers an id field, so the resolver failed on the missing `id` on every keystroke, `isValid` never went true, `onAddressChange` never fired, and the checkout sat on "Please select a delivery address" with every field filled. Fix: the form's `defaultValues` now carry `id: ""` (a guest address has no id until submit). The schema's `email` also rejected `""` despite the UI labelling it optional — an empty text input yields `""`, not `undefined` — so it now accepts blank while still validating a typed address. Debug `console.log`s removed; `landmark` added to the memo deps it was missing from. Regression tests in `tests/unit/guest-address.test.tsx` render the form, fill it, and assert the callback fires (verified failing without the fix). The 401 from `/api/addresses` in the same console was a red herring — the saved-addresses fetch correctly refusing a guest.

**Four admin pages formatted raw paise as rupees — everything showed 100× too big.** `admin/orders`, `admin/orders/[orderId]`, `admin/carts` and `admin/users` each hand-rolled a local `formatCurrency` with no ÷100, violating the "one module knows money is paise" rule (`src/lib/format.ts`, [ADR-0004](adr/0004-money-as-integer-paise.md)); `ProductsStats` did the same with a template string. All five now import the shared `formatCurrency`. Same bug in reverse on the carts value filter: its "₹500+" options sent rupee numbers that the repository compared against paise totals, filtering at ₹5+ — option values are now paise. The dashboard widgets (admin and org portal) were already correct end-to-end; if the org dashboard looks wrong next to the old admin pages, it was the admin pages that were inflated.

563 tests pass, typecheck clean.

## [PR-84] 2026-09-01 — Pre-launch crawl block behind one env switch

The store is not live, yet production logs show search crawlers (PetalBot, Bing) steadily working through the domain's old WooCommerce URL space — each hit a function invocation bought for nothing. `BLOCK_CRAWLERS=1` in the deployment environment now turns every compliant crawler away: `src/app/robots.ts` answers disallow-all with no sitemap reference, `src/app/sitemap.ts` returns an empty set instead of reading the catalogue (crawlers that already know the URL keep polling it), and `next.config.ts` stamps `X-Robots-Tag: noindex, nofollow` on every response for bots that skip robots.txt but honour the header. Unset, nothing changes — the launch flip is deleting one variable.

Two deliberate consequences, documented in `src/lib/crawl-block.ts` and OPERATIONS.md: while blocked, the 410 purge of the old WordPress index (PR-era `src/middleware.ts` rule) is paused, since a crawler that may not fetch never sees the 410; and non-compliant scrapers are unaffected — those are a Vercel Firewall concern, not code. Tests: `tests/unit/crawl-block.test.ts`.

## [PR-83] 2026-08-31 — Prefetch goes off in the portals too, where the only live traffic is

PR-82 turned prefetch off across the storefront and left the admin, org and auth links alone, reasoning they were low fan-out and behind a login. Both halves of that were wrong, and the Prisma dashboard is what showed it: 23,592 operations in ten days on a store with no customers, while the only people using the site were uploading products in `/admin`. The half that was optimised is the half nobody is using.

**The fan-out is larger in admin than on the storefront.** `ProductsTable` renders its View and Edit links from a per-row column renderer, so a listing at its `limit: 10` puts ~20 links in view at once — and unlike a product grid, a ten-row table is entirely on screen, so every one of them prefetches. Each target is an admin product page: `requirePlatformAdmin` plus the product tree.

**And each of those speculative renders re-reads the admin row.** `requirePlatformAdmin` is deliberately not memoised — it re-reads `User` so a demoted or blocked admin is revoked immediately rather than at token expiry ([ADR-0021](adr/0021-audit-trail-never-fails-the-action.md)), and its own comment justifies the cost as "one primary-key read per admin request. The platform portal is low-traffic." That reasoning is sound for a navigation and silently false under prefetch, which turned one auth read per click into roughly twenty-one. The re-read is correct and stays; what was wrong is how many times it was being asked for.

So one admin listing view cost on the order of **90 operations instead of 8** — the page's own ~8 (PR-71's measurement) plus ~20 discarded renders at ~4 each. At that rate, fewer than thirty listing views a day accounts for the entire ten-day meter, and a team uploading a catalogue opens that list far more often than thirty times.

`prefetch={false}` now covers the remaining **37 link sites across 25 files** — admin, org portal, and the auth pages, where a signin page prefetching `/signup` is the same discarded round trip. Nothing is left prefetching. The per-row site in `ProductsTable` carries a comment saying why, as the two storefront sites do.

**The estimate is not a measurement.** What share of the 23,592 is admin rather than crawlers or storefront is not knowable from here; the Queries tab in the Prisma console answers it, and the next few days of daily bars answer it better. Crawl volume is ramping at the same time — PR-81's `robots.txt` and sitemap went live on 2026-08-30 — so a smaller-than-expected drop is confounded, not a refutation.

Presentation only — no schema, no wire shape, no money path. 554 tests pass, typecheck clean, lint unchanged (the one error in `admin/categories/page.tsx` is a pre-existing `as any` on a sort key, untouched here).

## [PR-82] 2026-08-31 — Storefront links stop prefetching pages the router throws away

A production log showed 26 page requests in four seconds with no navigation behind them: nine `/category/*`, four `/product/*` and `/cart`, each fetched twice. Nobody clicked anything — the shopper scrolled, and every `<Link>` that entered the viewport prefetched.

**The prefetches were never used.** Next's client router cache defaults to `staleTimes.dynamic: 0`, and that value applies whenever the `prefetch` prop is left unspecified, which it was at all 62 call sites. Every storefront route is dynamic — no `revalidate`, no `generateStaticParams` — so each prefetched payload arrived already stale and the tap refetched from scratch. There is no `loading.tsx` anywhere either, so `prefetch="auto"` had no boundary to stop at. Next floors the `static` stale time at 30s expressly "to ensure prefetching is not completely wasteful"; nothing floors `dynamic`.

So this was not a cache with a poor hit rate. It was speculative rendering with no reader.

**It cost more than the wasted queries.** A category render is roughly three sequential round trips, so one scroll was on the order of 70 Postgres queries. Worse, thirteen simultaneous requests make Vercel scale out — `✅ Rate limiter initialized` appears twice inside that four-second window, two instances booted for work nobody would read — and they queue against the connection pool. The shopper's actual tap could land behind speculation, or on a cold instance that existed only because of it. Removing prefetch should *lower* tap latency, not raise it, which is the opposite of the usual trade.

`prefetch={false}` now sits on 24 storefront link sites across 14 files. The two that produced the burst — `ProductCard` and `CategoryLanes`, up to twelve and nine links in view at once — carry a short comment saying why, so the prop is not read as an oversight and removed.

**Deliberately not done here.** Page-level ISR would cut more, and [ADR-0018](adr/0018-one-effective-price-function.md) forbids it: offer resolution is capped at one request, and response caching must not outlive an offer window. A fixed `revalidate` would advertise an expired offer's price, which is the divergence [ADR-0002](adr/0002-server-holds-pricing-authority.md) exists to prevent. The remaining work is caching the reads that carry no resolved price — the category tree and catalogue rows — while prices stay resolved per request. That helps real traffic rather than only speculative traffic, and is tracked in [BACKLOG.md](BACKLOG.md).

Prefetch is not wrong here, it is misconfigured. Once those reads are cached, a `loading.tsx` plus a non-zero `staleTimes.dynamic` would make it pay off, and it is worth revisiting then.

Presentation only — no schema, no wire shape, no money path. 554 tests pass, typecheck clean, lint unchanged.

## [PR-81] 2026-08-30 — The admin portal gates itself, and rate limiting stops pretending

**`/admin` was reachable without signing in.** The middleware matcher excluded any path containing a dot — meant to skip static files — so `/admin/orders/abc.def` never reached the gate. Thirteen admin pages carried no guard of their own, on a comment in the layout that said "middleware already gates /admin to platform admins; this fetch is for display". Unauthenticated, `/admin/orders` redirected and `/admin/orders/abc.def` returned 200.

Nothing was disclosed: every `/api/admin/*` route independently returns 401, and a dotted id matches no record, so the bypass rendered an empty shell. That is two accidents standing in for a control, and it holds only until an admin route keys on something that legitimately contains a dot — an email, a slug, a filename.

**The layout owns the gate now**, as the org portal always has: `requirePlatformAdmin` in `src/app/(admin)/admin/layout.tsx`, which re-reads the row rather than trusting a JWT claim that outlives a demotion ([ADR-0021](adr/0021-audit-trail-never-fails-the-action.md)). The middleware still runs — an unauthenticated request should be turned away before anything renders — but it is a fast rejection, not the authority, and it now names `/admin` and `/org` explicitly instead of inheriting a catch-all that excluded them by punctuation. Every path that returned 200 above returns 307. `tests/unit/portal-guards.test.ts` fails if a portal layout stops guarding or the matcher goes back to the catch-all.

**Rate limiting is detached, deliberately and visibly.** It had three implementations — an Upstash module, an in-memory `Map`, and a third copy inline in the middleware — and all three allowed everything whenever Redis was absent or unreachable. The middleware copy also marked itself initialised before its async setup finished, so cold-start concurrency skipped it, and every copy derived the caller's identity from the first `x-forwarded-for` entry, which the caller supplies: rotating that header defeated each per-IP window.

`src/lib/rate-limit/` is now one seam that allows everything and says so (`RATE_LIMITING_ENABLED === false`). No live module imports `@upstash/*`, so the request path carries no cache dependency while the cache is unwired. Both implementations are parked beside it, unimported and intact, and reconnecting is an edit to one file. `getClientIp` there already ignores caller-supplied headers, so what returns is not what left.

**These endpoints are unthrottled until the cache is wired**, and are listed in the seam's header so the next reader does not have to infer it: `POST /api/auth/signup`, `/api/auth/forgot-password`, `/api/payments/create-order`, `/api/orders*`, `/api/cart*`. `reset-password`, `resend-verification` and `verify-email` never had limits. A control that silently does nothing is worse than an absent one, because it gets budgeted for as protection.

**The site now states what it is, and what it no longer is.** This domain served a WordPress site before this one — 4,682 URLs in the archive: genuine Bhendi Bazaar posts from 2019–2020, then from March 2021 Indonesian gambling spam, scraped filler and adult posts, still serving 200s as late as September 2025. Bing is still working that index; two such requests arrived 0.74 seconds apart on 2026-08-30.

`src/app/robots.ts` and `src/app/sitemap.ts` did not exist, so crawlers had no statement of the real URL set and kept working the remembered one. Both exist now, built from `appUrl()` rather than a hardcoded origin. And `src/middleware.ts` answers the `/YYYY/MM/DD/` permalink shape with **410 Gone** instead of 404: 404 means "not here right now" and invites a retry for months, 410 means "gone, stop asking". Nothing this app serves begins with a four-digit year, and `isDeadPermalink` is exported so that claim is tested against real paths rather than against the file's text.

What is left needs an account rather than a commit — Search Console and Bing Webmaster verification, a manual-action check, and a backlink review — and is recorded on the watch list in [BACKLOG.md](BACKLOG.md).

Presentation and routing only — no schema, no wire shape, no money path. 554 tests (21 new), typecheck clean, lint one error below its prior baseline: the middleware's `any` is gone.

## [PR-80] 2026-08-30 — Banners become the platform owner's, not the deploy's [CONTRACT] [MIGRATION]

The hero's three banners were a TypeScript array. Changing a campaign — new artwork, new copy, a different order, taking one down for Eid — was a code edit and a deploy, done by the person who does deploys rather than the person who decides what the shop is selling. `/admin/banners` now owns it. See [docs/specs/home-banners/](specs/home-banners/).

**Two tables.** `Banner` holds copy, artwork and position; `BannerAction` holds the buttons as rows rather than JSON, so a label and a destination are columns the database can constrain. `BannerAction` cascades from `Banner` — the correct side of [ADR-0020](adr/0020-money-bearing-records-never-cascade.md), since an action carries no money and no attribution and has no meaning apart from its banner.

**`order` is server-owned and absent from the write schema.** A create appends to the end; `PATCH /api/admin/banners/reorder` is the only thing that writes it, in one transaction over the whole set, because a half-applied reorder is a duplicate order value. Accepting `order` in the form body — even optionally — is how the field a form forgot to send silently resets the hero. `[CONTRACT]`: `BannerFormSchemaInput` is recorded in [CONTRACTS.md](CONTRACTS.md).

**The upload field states the size before the picker opens and checks it before uploading.** `BANNER_IMAGE` in `src/lib/config.ts` is read by the label, by the check, and by the empty-state placeholder, so the number an admin is told cannot drift from the number enforced — a file that is too small or the wrong shape is refused with the dimensions it actually had. The check is client-side on purpose: the uploader is already a platform admin, and re-measuring server-side would mean an image library to defend nothing.

**Reordering is move-up / move-down, not drag-and-drop.** Drag-and-drop needs a package, and a pointer-only reorder fails [ADR-0015](adr/0015-mobile-first-design.md); buttons are reachable by touch and keyboard for free.

**`isActive` separates "taken down" from "deleted"**, which is what makes a campaign re-runnable — an inactive banner keeps its copy and artwork and stays listed in admin. With no active banners the hero renders nothing and the homepage is still a shop.

**`[MIGRATION]`: one, and it creates tables only.** No rows ship — the three banners live in `prisma/seed/banners.seed.ts` instead, so a developer who pulls and seeds gets a populated hero while production gets an empty one. That split is Invariant 7's own test applied honestly: the seed is destructive and permanently dev-only, and reference data goes in a migration **only when production breaks without it**. Production does not break without a banner. The hard-coded banners were house copy written during development, not the owner's, and putting unapproved words on the shop's most prominent surface would make removing them the owner's first task rather than their first decision. **So a fresh environment deploys with an empty hero, by design** — the homepage renders its categories and products and reads as a shop; the first banner is one the owner wrote. `src/lib/home-banners.ts` is deleted in the same change: keeping it as a fallback would be two sources of truth for one shelf, and would smuggle the same copy back in through code.

**No new dependency, and no new domain.** Banners live in `catalog` — merchandising over catalog content, whose links point at categories ([ADR-0012](adr/0012-modules-are-vertical-slices-by-domain.md)). `HeroBanner` and `HeroSlider` did not change shape; the DAL returns the props type they already took, so they stay unaware of where the words came from.

**On desktop the artwork stands alone until you point at it.** From `md`, a banner that has an image renders just the image; the scrim and the words fade in on hover, and fade out again — the picture is the point, and a permanent dim costs it. On a phone nothing changes: touch has no hover, so the base state keeps the overlay exactly as it was, and the reveal is a `md:` addition rather than a mobile removal ([ADR-0015](adr/0015-mobile-first-design.md)). Two details that are not optional: `group-focus-within` rides alongside `group-hover`, or a keyboard tabs to an invisible button, which is worse than a hidden one; and the reveal is conditional on there *being* an image, since hiding the words on the gradient scene would leave an empty coloured box. The dots gained their own translucent ground for the same reason the scrim left — they had been relying on it to stay visible.

**Deliberately not built:** scheduling (an unset date field is a worse answer than no field) and per-banner colours (a per-banner palette is how a shop stops looking like one shop).

**Found by review and fixed before merge.** The admin list held `useState(banners)`, and `router.refresh()` preserves client state — so a deleted banner stayed on screen and a toggled switch stayed put, both while reporting success. It derives from props now; a reorder's optimistic order is held against the server's list and dropped when the two agree, **not** when a transition settles — `router.refresh()` returns on dispatch, so anything keyed to that lets go while the write is still in the air, snapping the list back and re-arming the buttons mid-flight. `tests/unit/banner-list.test.tsx` holds an open request to cover exactly that window.

Three more went with it: the toggle got its own `PATCH .../active` route, carrying only what it changes (the content PATCH replaces action rows wholesale, so flipping a switch had been rewriting copy and re-minting button ids — and `bannerService.setActive` was dead code); delete moved out of arm's reach of edit, behind a `Dialog`, with 40px touch targets; and the artwork's 5:2 shape became one `--aspect-banner-source` token derived from `BANNER_IMAGE`, replacing four literals and a hand-written `2.5`.

**The banner is cropped, and the field now says so.** The hero is a fixed-height box, so its ratio runs from about 1.4:1 on a 360px phone to 2.8:1 on a wide desktop; one artwork ratio cannot be the rendered shape, because a box that must hold a headline on a phone cannot also be a letterbox. The token is named for the *source* rather than pretending otherwise, and the upload hint states what survives — the middle ~55% at 360px — instead of implying the preview is what a shopper sees.

Verified end to end against the running app and a live database, not just a build: deactivating a row dropped the hero to two slides, changing `order` changed which banner led, deactivating all three made the hero vanish while the page still rendered its products, and restoring brought all three back. 518 tests pass (20 new), typecheck clean, lint at baseline.

## [PR-79] 2026-08-30 — The hero becomes a configurable banner, and the banners become a rail

`HomeHero` held one hard-coded banner: its copy, its two category links and its background were all markup. It is now three pieces — `HeroBanner` (`src/components/home/hero-banner.tsx`) takes a background, words and calls to action as props and knows nothing about a campaign; `HeroSlider` (`src/components/home/hero-slider.tsx`) is the rail around N of them; and `src/lib/home-banners.ts` holds the content. Adding a banner is a config entry.

**Built on scroll-snap, not a transform track** — the same pattern `OffersStrip` and `CategoryLanes` already use. A phone gets native momentum swipe for free, and the rail is the source of truth for which slide is showing, so a swipe and a dot press converge instead of fighting. No carousel dependency was added; one would have needed a TRD to earn.

`"use client"` is earned by the rail alone. `HeroBanner` stays a server component.

**Every banner is the same box.** Height is fixed per breakpoint (`h-60 sm:h-80 lg:h-96`) and the copy is clamped to fit it, because a content-sized banner makes the rail jump on every swipe — one banner's second CTA or third line is another's blank space.

**Auto-advance pauses on hover, on focus, and while a finger is held on the rail, and never starts under `prefers-reduced-motion`.** There is no pause button: reaching for a dot or an arrow stops rotation for good instead, which is the durable stop that hover and hold are not. Arrows are pointer-only (`hidden sm:flex`); swipe and the dots are the affordance that exists on a phone, so hiding them costs nothing.

**Known gap:** hover, hold and focus each pause only for as long as they last, so the stop mechanism is now "press a control" rather than a labelled pause. That is weaker than WCAG 2.2.2 asks for on an auto-updating region. Accepted deliberately — a visible pause button on a phone hero was judged the worse trade.

**Banner images are a slot, not a decision.** `image` is optional and the banner falls back to the brand gradient scene without one; artwork goes to Blob like every other image and its URL comes back to the config. Content lives in code rather than a `Banner` table on purpose — a table needs a migration, an admin CRUD surface and a scheduling story, none of which is worth building until the copy changes often enough to hurt.

**Fixed on contact:** the two decorative overlays were raw `rgba()` literals inside `bg-[radial-gradient(…)]`, which the design-token rules do not catch because they only scan named palette classes and bare hex. They are token gradients now. And the page keeps exactly one `h1`: each banner titles itself with an `h2`, and which banner is "first" changes as the rail rotates, so `src/app/(main)/page.tsx` carries an `sr-only` `h1` naming the store.

Presentation only — no route, wire shape, or server behaviour changed. Verified rendering against a running dev server: three slides with correct `aria` labelling, arrows and dots present, no pause control, and identical dimension classes on all three. 498 tests pass, typecheck clean, lint two below its prior baseline.

## [PR-78] 2026-08-30 — Every design axis goes through tokens, not just colour

Colour had been governed since PR-33 — semantic tokens, a `.portal` scope, and a test that refuses a raw palette class — so a rebrand was a one-file edit. No other axis had any of that, and a redesign is mostly the other axes: **a rebrand cost one file, a redesign cost more than a hundred.** This closes that asymmetry. 182 call-site literals across 53 files became 15 tokens. (See [ADR-0022](adr/0022-design-decisions-go-through-tokens.md).)

**Two live font defects, fixed.** `--font-mono` was aliased to `var(--font-heading)`, so the twelve places rendering SKUs, order codes and payment ids drew identifiers in Playfair Display. Worse, `--font-heading` was set by `next/font` but never registered as a theme token — so `font-heading`, present in twenty files including every page title, **generated no CSS at all** and every heading silently rendered in DM Sans. The two faces were exactly inverted. The `next/font` variables are now `--font-heading-face` / `--font-body-face`, `--font-heading` is a real theme token, and `font-mono` keeps Tailwind's system mono stack.

**New tokens in `src/app/globals.css`.** A type scale below `text-xs` (`--text-2xs/3xs/4xs`) where the 3-up phone tile lives; four tracking steps (`--tracking-label`, `-eyebrow`, `-eyebrow-wide`, `-display`) replacing nine spellings of one eyebrow across 32 files; four elevation *roles* (`--shadow-raised`, `-lifted`, `-overlay`, `-inset-field`) — Tailwind's scale answers "how big", these answer "what is this"; two semantic shape steps (`--radius-card`, `--radius-field`); and `--container-page`, so the verification banner cannot drift from the column it sits above. The type steps carry size only: the literals they replaced set `font-size` alone, and pairing leading here would have reflowed ninety call sites under cover of a refactor.

**`PageShell` and `PageHeader`** (`src/components/shared/page-shell.tsx`) own page width and the page title. Eight `mx-auto max-w-*` literals over eight widths, and eight verbatim copies of one `<h1>`, are now one component each; widths are named for the page's job (`narrow`/`form`/`default`/`wide`), not its pixel count.

**`src/lib/social-brand.ts`** holds the third-party share colours. Not ours to theme — Facebook blue is Facebook blue in either mode — so they live in one module like `category-accent.ts` rather than at the call site. X moves from `#000000` to `text-foreground`, which is what makes it visible in dark mode at all.

**`tests/unit/design-tokens.test.ts` now enforces every axis**: arbitrary sizes, arbitrary tracking, raw hex, raw Tailwind shadows and ad-hoc page containers all fail the suite. It additionally fails on any `font-*` class with no matching `--font-*` theme token — the check that would have caught `font-heading` the day it was written.

**Visible changes ship with this**, each a drift the tokens exist to remove: headings change face to Playfair; page titles on the four offer pages and `/org/new` move to the shared `text-3xl` treatment; `select` and `multi-select` corners move 2px to match `input`; dialog and alert corners move 4px to the card step.

No wire shape, route, or server behaviour changed — this is presentation only. 498 tests pass, typecheck is clean, and lint is at its exact prior baseline (226 problems, all pre-existing).

## [PR-77] 2026-08-27 — Categories come out of the dropdown and become a lane row

The storefront's category navigation was a desktop dropdown plus a phone bottom-sheet, both fetching the list from the browser on every page. It is now one flat, scrollable row of tiles that every page renders inline — no trigger, no client fetch, no second component for the phone.

**The rule is descend-only.** A page draws its own descendants and nothing else: home draws the whole tree, a category draws its entire subtree, a leaf draws nothing and the row disappears. The current category, its ancestors and its siblings are all absent, so the set shrinks with every descent and there is no active state to draw. `flattenDescendantIds` (`server/catalog/category.tree.ts`) is breadth-first so the shallowest lanes reach the visible left end of a single scrolling line, and preserves input order within a level — which is how siblings inherit `order` without the pure module knowing the column exists.

**Fixed on contact: the home page was rendering the whole category table flat.** `categoriesDAL.getCategories()` returns every row, and home fed it straight to `CategorySections` — so the first child category created in the admin would have appeared on the homepage beside its own parent. Home now asks for the tree from the root, and the answer is ordered.

`CategoryLanes` and `CategoryBreadcrumb` are **server components**: display over data the page already reads, so a route handler for either would be a round trip bought for nothing. Both ride `allCategories()`, the repository's request-memoised read, so the tiles cost no database operation the product grid was not already paying for. The breadcrumb exists because descend-only leaves no route back up the tree — a shopper landing on a leaf from search would otherwise have only the logo.

**Removed:** `CategoriesDropdown`, `CategorySheet`, `CategorySections` — the first two replaced, the third an unordered second rendering of the same list on the same page. `GET /api/categories` and `categoryApiClient` go with them: their only two callers were the deleted components, and a route handler with no browser caller is a fetch of data a server component already had. `categoryService.getCategories()` stays — search suggestions still use it. The phone tab bar drops to four tabs; browsing is now something the page shows rather than a destination.

`ServerCategory` and the storefront `Category` both gain `id` and `parentId`, which the repository was already returning and the types were under-declaring. No wire shape changed — the only route that sent this DTO is the one deleted — so this is not a `[CONTRACT]` change.

**Known gap:** tiles centre-crop the 1200×600 `heroImage`, which is often the wrong 600×600. A nullable square `thumbnail` with this crop as its fallback is the follow-up; it needs a migration plus its field in the category form and the bulk sheet, and is deliberately not in this PR.

## [PR-76] 2026-08-23 — The category sheet takes names, and the theme colour is a dropdown

Three fixes to bulk category upload, all of them about a sheet not telling you what it wants.

**`parent` accepts the parent's name.** It was compared literally against slugs, so a category named `Men's Clothing` could not be referenced at all: its slug is `men-s-clothing`, which nobody guesses and nothing in the sheet or the wizard ever showed. `Abayas & Kaftans` was `abayas-kaftans`; `mens clothing` and `Mens Clothing` both failed on a space. The cell is now normalised with `slugify`, which is idempotent on a slug — so the name and the slug both resolve, and you write the parent exactly as you wrote it in its own `name` cell.

Resolution runs off one index shared by validate and create, so the two cannot disagree about which category a cell meant. Existing categories are indexed by slug *and* by name, because a category renamed after creation keeps its original slug (Invariant 4) and the two stop being derivable from each other. A key that reaches two different categories — one's slug is another's name — is refused rather than settled by precedence: a subcategory silently attached to the wrong parent is a wrong tree that says nothing about itself. The one case where precedence is unavoidable is two categories sharing a name; the exact slug wins there, because refusing the word would leave the first unreachable.

**A parent below its child now says so.** The rule that a parent must appear above its children is what makes a cycle unrepresentable, so it stays — but the error said *"neither an existing category slug nor an earlier row of this sheet"* about a row that was plainly in the sheet. It now names the row and says to move it up. A row naming itself is called what it is.

**The accent column is a dropdown.** Eight theme colours existed only as prose on the instructions tab, so the column was free text an admin had to guess at. The sample sheet now carries Excel list validation on `accent` for all 300 rows, set to reject rather than warn, plus a *Theme colours* tab generated from `CATEGORY_ACCENTS` — the same module the UI renders from, so the sheet cannot drift from the palette.

Also: `createCategories` derived `maxOrder` with its own `ORDER BY` query over a table the request had already loaded and memoised. It reads the loaded rows now.

## [PR-75] 2026-08-22 — A completed admin action stops reporting itself as failed

Creating a category in production returned `409 — That adminId no longer exists — pick another`. So did deleting one. Both had worked: the row was created, the rows were deleted. The retry that message invited then failed on the unique slug of the category the "failed" attempt had already created.

The cause was two statements pretending to be one. Every admin service mutated, then appended to `AdminLog`. `AdminLog.adminId` is a foreign key onto `User`, and `session.user.id` is a JWT claim (`token.sub`) that nothing re-checked — so an admin whose row was no longer in the production database kept passing `requirePlatformAdmin` while every trail write raised `P2003`, after the mutation had already committed. `toErrorResponse` did exactly what it should with a foreign-key violation naming a column; the column just happened to belong to a table the request was not about.

Services no longer write the trail themselves. `recordAdminAction` (after a committed mutation — never throws, reports the dropped entry to the platform logs) and `recordAdminActionIn` (inside the caller's transaction — throws with it, so both roll back) replace all sixteen `adminLogRepository.createLog` call sites across catalog, checkout, identity, shipping and payouts. Why not simply wrap everything in a transaction is on the record in [ADR-0021](adr/0021-audit-trail-never-fails-the-action.md): shipping logs `PROVIDER_CONNECTION_FAILED` from a `catch`, and an entry recording a failure must outlive the operation it records.

The dangling id is fixed where it originates. `requirePlatformAdmin` now re-reads the row behind `session.user.id` and refuses a session whose user is gone (401, "sign out and sign in again"), demoted, or blocked (403) — one primary-key read on a low-traffic surface, which also revokes a demoted admin immediately instead of at token expiry. `createLog` stopped joining `User` to return a name nothing reads, so the net query cost of an admin mutation is unchanged.

Two things found alongside: the categories page fired `toast.success("Category deleted successfully!")` twice on every delete — once from `useMutation`'s `successMessage` and once from a `.then` on the same call — and its API client hand-read the error envelope, dropping `details` before a form could attribute anything ([ADR-0013](adr/0013-one-error-envelope-and-useserverform.md)). Both corrected; the reorder path gets its success message from the hook now too.

Diagnosed from `vercel logs --environment production --since 24h`, which had all five requests with their Prisma errors attached.

## [PR-74] 2026-08-21 — The seed guard becomes a control, and gets tested

Invariant 7's protection rested on one procedural rule: never set `SEED_ALLOWED_DATABASE_URL` in a deployment environment. That variable is matched before any host check, so setting it in Vercel would have made `prisma db seed` wipe production — a documented "don't" as the last line of defence, which is the same shape of gap that left the invariant unimplemented for months.

A deployed environment is detectable, so it is now detected: `VERCEL`, `VERCEL_ENV`, `CI`, or `NODE_ENV=production` refuses the seed before `DATABASE_URL`, the destructive flag, or the allowlist is consulted. It can only ever refuse more, never allow more.

The guard also had no test and was not exported, which makes an untested guard indistinguishable from a missing one. The decision is now a pure function in `prisma/seed-guard.ts` — called as the seed's first statement, so it still holds when someone types the raw command — with 13 cases in `tests/unit/seed-guard.test.ts` covering every route to destruction: cloud host, another database on the same local Postgres, missing flag, unparseable URL, unrecognised host (fails closed, as a denylist would not), and the fully-armed deployed case where every permitting variable is set and it must still refuse.

Verified end to end by running the real `npx prisma db seed` against the production connection string: refused. Against it with the destructive flag, the allowlist variable, and `VERCEL=1`: refused. Against the local development database: seeds normally.

## [PR-73] 2026-08-21 — Bulk catalogue upload, and SKUs become the org's own `[CONTRACT]` `[MIGRATION]`

Implements [bulk-catalog-upload](specs/bulk-catalog-upload/spec.md) as five changes in one PR set.

**SKU uniqueness is org-scoped.** `Product.sku` was globally unique, so one org using `ABAYA-001` locked every other org out of it — a platform-wide identifier for a thing that is an org's internal code. Now `@@unique([orgId, sku])`. Loosening cannot collide on existing data, so the migration is a constraint swap. The single-product create and update paths gained the graceful refusal they never had: a duplicate now names the product already wearing the SKU, as a `ConflictError` on the `sku` field, instead of surfacing a raw P2002.

**Blob paths gained structure, and `unnamed-` is gone.** Images now land at `products/<org-code>/<product>/<original-name>-<ts>.<ext>`. The upload utility always accepted an identifier for exactly this; no client ever sent one, so every image since day one took the `"unnamed"` fallback. The forms send it now. Existing flat blobs keep their URLs and stay put.

**The upload itself.** An org member uploads one sheet plus the photos it names; an admin does the same for categories. Validation is a dry run that writes nothing and reports every problem at once with row numbers — unknown category, unknown pickup location, SKU taken (in the sheet or in the org), missing image file, cover that is not one of the row's images, unparseable video link. Only a clean sheet proceeds, so a rejected upload leaves no orphaned blobs. Images go browser → Blob directly through scoped client-upload tokens: a function body is capped at 4.5MB, which is one large photo. Creation is one transaction of `createMany` per table — 3 statements for 300 products, not 1,200 — which is what makes all-or-nothing affordable. Videos ride the existing embedded-reference model ([ADR-0017](adr/0017-video-is-embedded-not-hosted.md)); the cover column names a photo, defaulting to the first. Pickup locations and categories must pre-exist: a location is an address a courier collects from, not a name a column header can invent. The sample sheet is generated per org from live locations and current slugs, so it cannot drift from what validation expects.

**Photos are matched by path, not by name.** Keying the dropped files on their bare filename meant two products could not each have a `front.jpg` — the second silently replaced the first, and one product would have shown the other's photograph. Both wizards now accept a folder (`webkitdirectory`, with plain multi-select kept for phones) and identify files by relative path. A sheet reference resolves against the trailing segments of that path, so `front.jpg` and `emerald-abaya/front.jpg` both work when unambiguous — and when a bare name could mean two files, it is a row error listing the candidates and showing the qualified form to use. The matcher is one pure module shared by the wizard preview and server validation.

Two things the folder picker surfaced on the way: a folder hands back everything it holds, so `.DS_Store` and stray PDFs were being counted and previewed as photographs — the selection is filtered to images now; and the blob-path sanitiser allowed `..` through, because dots are legal inside a segment (they carry the extension) and a traversal segment therefore survives character filtering. It is dropped as a segment now, and both client-upload token routes refuse `.`/`..` outright — a `startsWith` prefix test is not containment when `products/<org>/../elsewhere` satisfies it.

**A cleanup script** (`scripts/cleanup-flat-blobs.ts`) deletes old flat-layout product images once a catalogue is re-onboarded — dry-run by default, deletion behind `CLEANUP_ALLOW_DELETE=1` plus `--delete`, and never touching a file any product still references. It reports which database supplied the keep-set, because the Blob store is shared across environments and that is the one way to get this wrong.

Also here: `tests/integration/` share one local database, and Vitest runs files in parallel — a file creating products raced a file counting them. `fileParallelism: false` fixes it; the suite is ten seconds.

## [PR-72] 2026-08-21 — Dashboards aggregate in the database, not JS

`getDashboardStats` fetched every order row in four date windows to sum one column in JS, asked five separate counts for what one `GROUP BY status` answers, and ran three product queries whose answers all live in one (threshold, quantities) row-set. Consolidated to database-side aggregation: 15 queries → 9, and the payload drops from every-order-this-year to a handful of aggregate rows — the shape that was always going to degrade first as order history grew. A value-equivalence test (`tests/integration/dashboard-stats-equivalence.test.ts`) recomputes every figure the old way and pins equality, and the ops budget (≤9) joins `db-ops-budget.test.ts`.

The widget registry keeps its one-entry-per-widget architecture (dashboard-widgets R1–R4) but widgets now share request-memoised reads — the `loadPriceContext` pattern: products + low-stock share one row-set, platform revenue + average-order share one paid-orders aggregate. Admin dashboard page 7→5, org dashboard 7→6.

Hygiene found on the way: the recent-users activity feed selected full user rows — password hash included — for a feed that renders three fields. It selects those three now.

**Measured**: admin dashboard page+API+activities 8+16+5 → 5+9+3 (29→17 per load).

## [PR-71] 2026-08-21 — Relation reads become one join `[MIGRATION-FREE]`

The remaining per-page cost after PR-70 was pure relation fan-out: every `PRODUCT_INCLUDE` read ran one query per related table — Product, Category, Org, ProductMedia, ProductStock, OrgAddress, Address — seven billed operations for one logical read, because the client ran Prisma's per-relation strategy. The `relationJoins` preview flag is now on, and **every relation-carrying `find*` read in `server/` (35 sites across 16 repositories — storefront, org portal, admin, payouts, analytics) passes `relationLoadStrategy: "join"`**, collapsing each to a single `LATERAL JOIN`. Applied per-read, never on writes.

One real semantic difference surfaced and was handled: the join strategy returns *unordered nested lists* in arbitrary order, where the query strategy's order was accidental-but-stable. Nested lists that reach a screen now carry an explicit `orderBy` (shipments by `code`, shipment lines / promotion targets / admin cart items by `id`); lists that are only aggregated stay unordered on purpose. `tests/integration/join-equivalence.test.ts` pins deep equality between the two strategies over the seeded catalogue for each aggregate's real include shape, so a Prisma upgrade that changes join semantics fails there, not in production.

Equivalence was proven, not assumed: both strategies were run over the entire seeded catalogue (including the filtered nested `stockLocations` include and the promotion targets) and returned deep-equal results. The three `@map` columns in the schema sit on legacy JSON blobs outside every join tree, clear of the known query-compiler issue.

**Measured across the full surface** (authenticated sweep, dev server, second hit): storefront home/product/category 21/17/12 → 5/4/4; search page 10→3; org portal dashboard/products/offers/orders/earnings 10/16/8/9/13 → 7/10/4/4/9; admin products/orders-API/carts-API/dashboard-API 13/7/7/16 → 8/2/3/15. The budget tests in `tests/integration/db-ops-budget.test.ts` are tightened to ≤1 query per product read, so a client regeneration that loses the preview flag fails the suite instead of silently re-inflating the bill sevenfold.

## [PR-70] 2026-08-21 — Development moves to a local database, and reads stop paying twice

The Prisma Postgres workspace hit its 100K-operations month and blocked every query, prod included. Two causes, two fixes in this PR (the relation-join strategy is a follow-up):

**Dev now runs on a local Postgres** (`bhendi_bazaar_dev` on `localhost:5432`) — a metered database was billing every hot-reload render. The seed's wipe list is completed for the ten models added since it was last touched (child-first, per ADR-0020's Restrict rules), and the Invariant 7 guard is tightened: this machine's localhost also hosts unrelated work databases, so a local *hostname* no longer passes alone — the *database name* must be allowlisted too. Verified refused against a non-allowlisted local database.

**Read paths stop re-buying data the request already holds:**
- The "on offer" filter re-ran the price context's two queries per listing and read the clock a second time, so filter and price labels could straddle an offer boundary. Coverage is now a pure function over the request's `PriceContext` (`offerCoverage` in `server/promotions/targeting.ts`); `productsOnOffer` is deleted.
- One category page read the category table four times in four shapes. All category reads now derive from one request-memoised query (`server/catalog/category.repository.ts`).
- Search suggestions ran the full product include tree plus the admin category listing (with its per-category counts) per keystroke — ~9 operations for a dropdown of name+thumbnail rows. The service now uses the lean `searchProducts` select it had been bypassing, and the storefront category list: 2 operations.
- Each cart row fetched its own stock check; `CartLineItems` now asks once for the whole cart (`/api/products/check-stock` always took an array): a 5-item cart drops 10 queries to 2.

**Measured** (dev server, second hit, `scripts/measure-db-ops.sh`): homepage 21→18, category 12→11, product 17→17, search keystroke 9→2, cart×5 10→2. Product-read fan-out (7 queries per `PRODUCT_INCLUDE` read) is the dominant remaining cost — that is the join-strategy follow-up.

**Guardrails:** `PRISMA_LOG_QUERIES=1` makes the client print every SQL statement; `scripts/measure-db-ops.sh` measures per-page counts end-to-end; `tests/integration/db-ops-budget.test.ts` pins a per-call query budget (skips off the local dev database); `tests/unit/offer-coverage.test.ts` covers the extracted pure function.

## [PR-69] 2026-08-16 — The seed guard Invariant 7 already promised

Invariant 7 has described a guard on `prisma/seed.ts` since it was written, and the guard did not exist. `npx prisma db seed` against a production `DATABASE_URL` would have wiped the store — documented protection with nothing behind it, which is worse than no protection, because the doc is what people trust.

`assertSeedTargetIsAllowed()` now runs as the first statement of `main()`, before any delete. It lives in the seed rather than a wrapper so it holds when the raw command is typed.

**Hostname alone cannot decide this, which is likely why it was never written.** Invariant 7 specified an allowlist of `localhost` / `127.0.0.1`, but this project's development database is Prisma Postgres at `db.prisma.io` — the same host that serves production. Implementing the invariant literally would have blocked development seeding outright, and allowlisting the host would have permitted production. So a non-local target must instead be named exactly by `SEED_ALLOWED_DATABASE_URL`, which distinguishes two databases sharing a hostname. Production is protected by never holding that variable, nor `SEED_ALLOW_DESTRUCTIVE=1`, which remains a separate gate so seeding and wiping stay separate intents.

Both gates are allowlists. An unset, unparseable, or unrecognised `DATABASE_URL` is refused.

Invariant 7 in [CLAUDE.md](../CLAUDE.md) is corrected to describe the mechanism that exists, and [OPERATIONS.md](OPERATIONS.md) documents both variables and why a cloud development database needs the second one.

## [PR-68] 2026-08-16 — A carrier's catalogue row ships as a migration, not a seed `[MIGRATION]`

Production had no shipping providers, so `/api/shipping/rates` returned 503 on every checkout while dev quoted normally. The Shiprocket row existed only in `prisma/seed.ts`, and that seed deletes every table, so it can only ever run against a developer's machine — leaving no path by which the row could reach production. The admin console could not close the gap either: it exposes list, connect and disconnect, all keyed on a provider id that must already exist.

`20260816030000_register_shiprocket_provider` inserts the row with `ON CONFLICT ("code") DO NOTHING`, so it is a no-op where the seed already created it. `vercel.json` already runs `prisma migrate deploy` before the build, so merging is what carries it to production.

The general rule this establishes: **a fixture belongs in the seed, reference data belongs in a migration.** The test is whether production breaks without it. Anything the app cannot function without must ride the migration pipeline, because the seed is destructive by design and therefore permanently dev-only.

No credentials are in the migration — `isConnected` is false, and an operator still connects the account from the admin console ([shipping ADR-0002](../server/shipping/adr/0002-credentials-via-admin-not-env.md)).

## [PR-67] 2026-08-16 — Offers, and a ledger of what each organisation is owed `[CONTRACT]` `[MIGRATION]`

The platform and each organisation can now run time-boxed offers — applied automatically to the price a buyer sees, or unlocked by a coupon at checkout — and every paid order records what each organisation earned. Specs: [promotions](specs/promotions/), [org-payouts](specs/org-payouts/). Decisions: [ADR-0018](adr/0018-one-effective-price-function.md), [ADR-0019](adr/0019-discount-is-one-winning-offer.md), [ADR-0020](adr/0020-money-bearing-records-never-cascade.md).

**Offers compete; they never stack.** A line's discount is the single largest offer covering it, allocated across lines by largest-remainder rounding so per-line shares sum to the scope total exactly. Every discount records its funding split — the organisation bears its own best offer, the platform bears only the remainder needed to reach what the buyer got, floored at zero. A check constraint asserts the two halves sum to the buyer's discount, so no settlement can be computed from a split that does not reconcile.

**`Product.salePrice` is gone.** A markdown is an organisation's own offer at a fixed selling price; one that sat outside the comparison could be neither weighed against a platform campaign nor charged to whoever paid for it. Three ordered migrations: the tables, then markdowns backfilled into offers, then the column dropped. The product form still collects a sale price inline — what moved is where it is stored.

That retirement had to land with the display change rather than after it, contrary to the delivery order both TRDs first described. Splitting them diverges the two sides: display would take the better of a markdown and an offer while the order path applied the offer *on top of* the markdown, and every dual-priced product would then fail the displayed-total guard. Recorded here because the sequencing looks separable and is not.

**Commission is charged on what an organisation's goods earned after its own discount**, and before any discount the platform funded — basing it on what the buyer paid would quietly make the organisation co-fund the platform's campaign. Rates resolve per item by walking a product's category ancestry, so one entry can carry several and the rate lives on the line rather than the entry.

**A ledger write cannot fail a payment** — the gateway already has the money. So the omission is a query (`paidOrdersMissingEntries`) rather than a log line, and the nightly reconcile sweep writes whatever is missing. Idempotent per `(order, organisation)`.

Ledger entries are editable until paid out and fixed afterwards, because a paid entry records a transfer that happened and the record has to keep matching the bank. Corrections after that point are new entries. Every change is captured in `AdminLog`.

Nothing in either feature cascades on delete. This closes a trap rather than following a preference: an offer with no target rows applies to everything in scope, so a cascading category delete would have silently turned a category campaign into a store-wide one.

`[CONTRACT]`: order creation accepts an optional `couponCode` — a string, never an amount; a new quote endpoint returns per-line discounts and rejection reasons; product and cart DTOs keep `salePrice` as a field name but it is now the offer-adjusted price, resolved server-side, not a column.

## [PR-65] 2026-08-13 — A shared link carries a picture, and a product can be shared from its page

`src/app/(main)/product/[slug]/page.tsx` gains `generateMetadata`: title, description, canonical URL, and `og:image` set to the product's cover. Until now the route exported no metadata at all, so a link pasted into WhatsApp fell back to the root layout's site-wide card — the shop name and tagline, and no picture.

The missing picture had a second cause: `OG_IMAGE` was the brand SVG, and no scraper renders one, so the site-wide card had never had an image either. `OG_IMAGE` now points at a 1200×630 PNG (`logos/og-image.png`, 45 KB — comfortably under the size at which WhatsApp gives up on a large preview), composed from the existing logo lockup on its own ground with the `--primary` / `--accent` greens as a footer rule, converted from the oklch in `globals.css` rather than picked by eye. `OG_IMAGE_SIZE` sits beside it because a scraper renders the card before it has fetched the image, and the root layout also gains `twitter: summary_large_image`.

A product page still prefers its own cover; the site-wide PNG is what everything else falls back to.

No pixel dimensions are declared for a product cover — nothing stores its size (`prisma/schema.prisma`, `ProductMedia`), and a guessed ratio is what makes a scraper crop the card wrong. The product read is wrapped in React `cache()` so `generateMetadata` and the page share one query rather than hitting Prisma twice.

The product page also gains the `ShareButton` the order summary already uses (`src/components/product/product-details.tsx`), beside the title rather than with the cart buttons — those dock to the bottom bar on a phone, where a third target crowds the primary action.

## [PR-66] 2026-08-13 — A cleared stock box reads as zero

Emptying a stock input showed `Invalid input: expected number, received NaN` — [PR-64](#pr-64-2026-08-13--a-product-with-no-stock-anywhere-can-be-saved) allowed a zero-stock product but left the field unable to express zero by being blank. `register`'s `valueAsNumber` is what produces the NaN, so the fix is a `setValueAs` in the one input that has the problem (`src/components/shared/forms/product/ProductOrgShippingFields.tsx`), not a looser rule in `productFormSchema` — the schema is also the server's authority, and every caller would inherit it.

Two near-misses worth recording. `.nullable()` does not apply: `valueAsNumber` yields NaN, not null, and NaN fails `z.number()`'s type check before any refinement runs. Relaxing the floor to `.min(-1)` does not either — it never sees NaN, and it makes `-1` a valid stock level on the server. `.min(0)` stands, with a test pinning it.

## [PR-64] 2026-08-13 — A product with no stock anywhere can be saved

`productFormSchema` no longer requires a positive quantity at some location (`src/lib/validation/schemas/product.schema.ts`). Sold out is a state a product spends real time in, and the rule made the one edit an org member most wants to make — everything except the stock — impossible until they invented a number. Choosing at least one pickup location is still required, so origin is never guessed.

Nothing downstream changed: the write path has always dropped zero rows as "not stocked here" (`server/catalog/admin.product.repository.ts:217`, `:332`), so an all-zero save simply stores no join rows and the product reads as out of stock. `tests/unit/product-schema.test.ts` now asserts the acceptance rather than the rejection.

## [PR-63] 2026-08-13 — Product video, and the gallery becomes rows [CONTRACT] [MIGRATION]

A product page can show video, and the picture that represents a product is now a choice rather than a side effect of gallery order.

Video is **embedded, never uploaded**: Blob's transfer allowance is metered per account and shared with every product image, and overrunning it withdraws access for thirty days rather than billing — so a popular clip would have taken the whole catalogue's images down with it. Reasoning, the four rejected alternatives, and the standing rule for every future video surface: [ADR-0017](adr/0017-video-is-embedded-not-hosted.md), with a pointer in `CLAUDE.md`. A video is stored as a bare id (`server/catalog/media.ts` parses the five link shapes YouTube hands out), rendered click-to-play against a poster derived from that id, so no player script is in the initial HTML and a product with no video weighs exactly what it did. `i.ytimg.com` joins `next.config.ts`'s `remotePatterns`, without which `next/image` refuses the poster.

`Product.images String[]` becomes `ProductMedia` rows — `kind`, `ref`, `position`, `description`, `isThumbnail` — so an org composes one ordered sequence with video anywhere in it, including first. `docs/specs/product-video/trd.md` D3 records why a relation rather than the lighter `creatives Json[]`, and D8a why the table is `ProductMedia` and not a shared `Media` library (the asset is reusable; a position and a description never are).

**This inverts PR-61.** That PR made `thumbnail` follow `images[0]`, which stopped an edited gallery leaving a stale card image but also meant nobody could choose the card picture. The cover is now an explicit flag on a media row, mandatory at creation, and **reordering the gallery deliberately changes nothing outside it**. `deriveThumbnail` and the form effect that mirrored it are deleted, and `tests/unit/thumbnail-sync.test.ts` is replaced by `tests/unit/product-media.test.ts`, whose first case pins the inverted rule. `Product.thumbnail` survives as a cache of the flagged row, recomputed inside the same transaction as any media write, with no fallback branch — a resolver that could invent a cover is how an unset one becomes survivable instead of loud. Two constraints Prisma's schema language cannot express go in as raw SQL and are asserted against the migration text: a partial unique index (`WHERE "isThumbnail"`) makes one cover per product a database fact, and `CHECK (NOT "isThumbnail" OR kind = 'IMAGE')` makes "the cover is a photograph" one too. "At least one photograph" and the ten-item cap are counts across rows, so they stay boundary rules in `productFormSchema`.

`OrderItem` gains a picture snapshot beside `unitPrice`, written server-side at order creation from the same catalogue read: without it, changing a cover would have silently rewritten what completed orders look like. It preserves which picture was chosen, not a copy of the file — see trd D19a. `CartItem` deliberately does not snapshot; a cart line is a wish, not history.

The gallery editor is a new component (`src/admin/product-media-manager.tsx`) rather than a change to `ImageUpload`, which stays for categories: one row per item at base, every control a visible button rather than a hover reveal, move-up/move-down instead of drag-only, and a "Cover" action that is absent on a video rather than present and rejected. Nothing pre-selects a cover — a default standing in for a missing choice is what made `weight` invisible for months.

Two migrations, deliberately separate so the cutover was reversible: `20260813000000_product_media` is additive and backfills rows from `images` (flagging the one matching each product's existing `thumbnail`, so no card changes appearance) plus order pictures from today's covers, and aborts rather than committing a product without exactly one cover; `20260813010000_drop_product_images` drops the old column. Spec and TRD: [product-video](specs/product-video/).

## [PR-62] 2026-08-11 — The phone storefront is an app shell

ADR-0015 fixed what was broken on a phone; this fixes what it *was*. The storefront now renders as an app shell below `md`: a bottom tab bar (`src/components/layout/mobile-tab-bar.tsx` — Home, Categories, Cart with live badge, Orders, Account) is the primary navigation, so PR-59's second header row folds away and the top bar becomes one 56px row of logo + search + account. Nothing that row carried was dropped — categories moved into a bottom sheet opened from the tab bar, cart/orders/sign-in into tabs. Product listings are 3-up on a phone and category lanes 2-up, declared once as `PRODUCT_GRID_CLASSES` in the new `src/components/shared/product-grid.tsx` (which replaces `components/category/product-grid.tsx` and is now used by category, search, home lanes, and similar-products alike). The card was redesigned at ~105px rather than shrunk to it: `text-[0.6875rem]` name, `p-2` content, a corner `% OFF` chip in place of the word badge, the tracked-out overline and the healthy-stock line dropped below `sm`; `PriceDisplay` and `StockStatus` gained `xs` scales and a `warn-only` variant for it, and `ProductCardSkeleton` was rebuilt to match so the loading state no longer jumps. Heroes, section headings, and the product page were re-proportioned for 360px, the gallery bleeds edge-to-edge, and Add-to-cart docks above the tab bar — one element repositioned at `md`, not a second copy. Shell plumbing: `viewportFit: "cover"`, a `--tab-bar-h` token with `pb-safe`/`pb-tabbar`/`bottom-tabbar` utilities, no tap-highlight flash, no overscroll bounce, no iOS text inflation — the same pages are meant to run inside a native WebView later, so those tells are gone now. `src/components/ui/sheet.tsx` adds the bottom sheet primitive. Reasoning and the boundary of the single-column exception: [ADR-0016](adr/0016-mobile-app-shell.md), with pointers in `CLAUDE.md`. No wire change, no migration.

## [PR-61] 2026-08-11 — The thumbnail is the first gallery image [MIGRATION]

Editing a product's images left every listing card on the old picture while the product page and edit form showed the new ones. `thumbnail` is a column of its own, and the form's auto-set effect only fired when it was blank (`!product?.thumbnail`) — i.e. on create, never on edit — so an edit resubmitted the thumbnail from creation time and the repository faithfully persisted it. Listings read `thumbnail`; the gallery reads `images[]`. That split is now closed by deriving one from the other: `deriveThumbnail` in `server/catalog/admin.product.service.ts` sets `thumbnail = images[0]` on create and update symmetrically, and the form effect mirrors it so client and server agree. This is not a new rule — `src/admin/image-upload.tsx` has always badged `images[0]` as "Thumbnail" and its reorder arrows have always been the only way to pick one; nothing ever wrote that promise to the column. Safe because `productFormSchema` requires at least one image and both callers parse before the service sees the payload. A data-only migration realigns rows edited before the rule was enforced; it is idempotent. Regression test `tests/unit/thumbnail-sync.test.ts` covers the case that caused the report — a new image added *in front of* the old one, which stays in the gallery, so any "is the thumbnail still one of the images" check would pass and do nothing. No wire change.

## [PR-60] 2026-08-09 — Org members can upload product images

The org portal's image upload had been admin-only the whole time: the shared `ImageUpload` component hardcoded `/api/admin/upload`, whose first line is `requirePlatformAdmin()`, so a seller picking a file got a 403. It had *looked* functional because the one existing org product was created from a form draft carrying a URL uploaded days earlier under an admin session — the upload route is only hit when a new file is picked. Now: the Blob upload logic (type/size validation, name sanitising, `put`) lives once in `server/catalog/image-upload.ts`; a new `POST /api/org/[orgId]/upload` wraps it in `withOrg` (any member may upload — the images belong to the org's own products; categories stay platform-only); and the endpoint is a prop threaded from the page down (`ImageUpload` defaults to the admin route, org pages pass their member-guarded one). Touching the admin route converted its hand-rolled error bodies to `DomainError` + `toErrorResponse` (ADR-0013). Unit tests cover the validation and sanitising rules.

## [PR-59] 2026-08-09 — Mobile-first: the phone is the primary device

A full-app audit found the desktop assumption baked in everywhere it could hurt a phone buyer, and this PR fixes the lot. Storefront: the navbar hid search, categories, and sign-in below `md` with no replacement — they're back on every width (mobile gets its own row, the header goes sticky, the logo shrinks); the checkout address modal couldn't scroll, making Save unreachable — it and the shared `DialogContent` now cap at `dvh` and scroll; the product gallery's `touch-pan-x` trapped vertical scrolling on the largest element of the product page, and its nav arrows were invisible on exactly the devices that can't hover — both inverted to correct; the checkout bill now precedes Place Order in the DOM (a buyer sees the total before the button that commits to it) and the CTA is sticky on mobile. Admin/org portals: the fixed 256px sidebar (which left ~118px of content on a 375px phone) becomes an off-canvas drawer below `md`; the data-table pagination no longer clips its buttons; filter bars, header rows, and the portal header wrap or shed detail instead of overflowing. Throughout: sub-40px touch targets raised (cart stepper, remove, share, close, eye toggles), address inputs gain `autoComplete` tokens and a numeric PIN keyboard, `text-xs` input overrides that reintroduced iOS focus-zoom removed, `flex-shrink-0` (removed in Tailwind v4) renamed to `shrink-0`, and the v4-dead `bg-opacity-50` cart overlay replaced with `bg-scrim/50`. Overlay height caps are one token — `max-h-overlay` (85dvh) in `globals.css` — replacing three divergent arbitrary values across dialogs and hand-rolled modals. The direction is now a standing rule: [ADR-0015](adr/0015-mobile-first-design.md), a Development Principles entry in `CLAUDE.md`, and a mobile-first section in `/bb-review`. No wire change, no migration.

## [PR-58] 2026-08-09 — Category filter on the product tables

Both product listings (admin and org portal) gain a category dropdown beside the stock filter. The plumbing already existed end-to-end — the pages parsed `?category=` into `categoryId` and the repository applied it — only the control was missing. Fixing the wiring surfaced a latent bug: `updateFilters` wrote filter-field names (`sortBy`, `sortOrder`, `categoryId`) as URL params while the pages read the short names (`sort`, `order`, `category`), so header sorting had never round-tripped through the URL; a key map in the container now covers all three. Categories come from `adminCategoriesDAL` in the same parallel fetch as the products. No wire change, no migration.

## [PR-57] 2026-08-09 — Deploys run their own migrations [MIGRATION]

`vercel.json` gains `"buildCommand": "npx prisma migrate deploy && next build"` — every Vercel build now applies pending Prisma migrations to that environment's `DATABASE_URL` before compiling, so code and schema can no longer go live out of step. Consequence, accepted: a merge to main *is* a prod schema change, and preview builds migrate whatever database the Preview environment points at. `migrate deploy` only applies pending migrations in order — it never resets or drops.

## [PR-56] 2026-08-10 — A blocked submit says so

The product form's create button could "do nothing": a draft saved while the org had no pickup locations restored `stockLocations: []` over the fresh rows, the hidden `orgAddressId` inputs then failed validation — and a hidden field can neither render its error nor take focus. Three layers fixed: location rows are excluded from draft persistence (the poison's source, and old poisoned drafts are ignored on load); a sync effect re-asserts the rows from the offered locations whatever restored or reset the form, keeping typed quantities; and `useServerForm` gains an invalid-submit handler — any validation failure now shows "Please fix the highlighted fields" plus a console warning naming the fields, so no form in the app can fail silently again.

## [PR-55] 2026-08-10 — A backstop must not become the outage

Signup 500'd before it could even validate: the Upstash rate limiter is the first thing every auth route calls, its keys (`KV_REST_API_URL`/`KV_REST_API_TOKEN`) weren't present locally, and the throw happened *outside* the error envelope — a raw HTML 500 the client could only report as "Request failed". The limiter now **fails open, loudly**: keys absent → requests allowed with a one-time warning; Upstash unreachable at runtime → request allowed, error logged. When configured, behaviour is unchanged. Rate limiting protects the service; it must never be the reason the service is down.

## [PR-54] 2026-08-10 — The reconciliation sweep runs daily

Vercel's Hobby plan rejects any deployment whose cron runs more than once a day — the `*/15` reconciliation schedule was blocking every deploy of the new code. The sweep is a backstop, not a hot path (browser-return confirms payments on its own), so it now runs daily at 03:30. Consequence, accepted: a paid order missed by both browser-return and webhook waits up to a day for rescue, and abandoned stock holds release daily rather than hourly. Restore a tighter schedule on a Pro plan, or when `CRON_SECRET` is set and the store is live enough to care.

## [PR-53] 2026-08-10 — Parcels bill at whole kilograms

[product-weight-and-rates](specs/product-weight-and-rates/) closes. Most of it had already fallen out of other work — weight persisted since PR-22, and since the allocation cutover (PR-48) every parcel sums its items' **real** weights server-side. What remained was the billing rule, decided today: weights are entered in kilograms with gram precision (0.6 = 600 g), and each parcel is quoted on its summed weight **rounded up to the next whole kilogram, floor 1 kg** — ceiling because couriers bill the ceiling, so a quote never undercharges shipping.

The rule is one pure function (`server/shipping/billable-weight.ts`), gram-settled so float dust from adding decimals cannot cross a slab boundary (2.9999999996 and 3.0000000004 both bill as 3). Applied in the allocate preview (response carries the real sum *and* `billableWeightKg`) and again at the rates route, so every quote is whole-kilogram whatever the caller sends. The parcel card shows "billed as N kg"; the shipment record keeps the real sum. The weight input states its unit and takes gram-precision decimals (`step 0.001` — the browser's native step no longer rejects 0.6).

Swept out with it: `calculateCartWeight` — the helper that hardcoded every item at 0.5 kg, the bug this spec was opened for — and the callerless `useShippingRates`, both dead since the cutover. Also recorded in BACKLOG: shipping is still charged at the client-selected quoted rate without a server-side re-quote at order time — a known watch item, not changed here.

**236 tests pass** (billable-weight boundaries pinned), `tsc` exits 0, `next build` compiles. No migration.

## [PR-52] 2026-08-10 — The last forms on the old pattern

The four auth pages — sign-in, sign-up, forgot-password, reset-password — move onto `useServerForm` + the shared error envelope, closing the ADR-0013 conversion that every other form finished long ago. The password rules a user sees inline are now literally the rules the route enforces (same `auth.schemas` on both sides, Invariant 4); a server detail like a taken email lands on its field instead of a generic banner; the reset flow's token rides the schema so an expired link surfaces like any other refusal, and its mismatch refine lands on the confirm field. Sign-in keeps next-auth's single-failure shape as the form-level error. Visuals unchanged; the hand-rolled `useState`-per-field plumbing (~150 lines) is gone.

**231 tests pass**, `tsc` exits 0, `next build` compiles, 0 lint findings in the four pages. No wire change — the routes already spoke the envelope.

## [PR-51] 2026-08-10 — The audit trail survives its admin [MIGRATION]

`AdminLog.adminId` moves **`Cascade` → `RESTRICT`** — deleting an admin user erased every audit record of what they did, which is the record wanted most when removing one. Flagged in the data-model review's referential-actions table; no application path deletes users, so the change forbids only a manual delete from doing silent damage. Block or deactivate accounts instead (`User.isBlocked`). Test pins both the schema relation and the migration clause.

Also records a product decision: **[shipping-fulfilment](specs/shipping-fulfilment/) stays as-is by choice (2026-08-10)** — live rates quoted and charged, booking remains the placeholder, parcels fulfilled manually. Real booking is future scope, now unblocked by data (every parcel carries a courier-collectable pickup location) and waiting only on the decision to build.

**231 tests pass**, `tsc` exits 0. **Run `npx prisma migrate deploy`.**

## [PR-50] 2026-08-10 — One dashboard, assembled from declarations

[dashboard-widgets](specs/multi-vendor-marketplace/dashboard-widgets/) lands — and with it **the marketplace programme's build is complete: 9 of 10 subfeatures, org-team deferred by decision.** A widget is one entry in `server/analytics/widgets.ts`: key, audience (`platform` / `org` / `both`), a stated org scoping when it serves both (R2), and the audience-gated query. Both dashboards render `widgetsFor(audience)` — adding a widget edits no page (R4).

**The gate is structural** (R3, the 2026-08-08 decision): widgets fetch server-side in an RSC, there is no widget endpoint for a browser to call, and `fetchWidget` throws if an org context ever reaches a platform-only widget — a figure an org may not see has no route to the browser, the same posture as per-location stock on customer responses. A failed widget renders an error card and the rest of the grid survives (R5).

**Org money widgets exist because order lines do**: an org's revenue is its parcels' item value on paid orders (`ShipmentItem × OrderItem.unitPrice`) — shipping deliberately excluded until [shipping-fulfilment](specs/shipping-fulfilment/) settles courier invoicing. The admin dashboard's key-metrics row moved onto the registry (server-rendered, one client round trip fewer; a `customers` widget added so nothing was lost); its period-revenue, status overview and activity feed stay a client island because refresh is interactivity.

**230 tests pass** (registry invariants + the structural gate), `tsc` exits 0, `next build` compiles. No migration.

## [PR-49] 2026-08-10 — Origin has one home [MIGRATION]

[stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) PR 6 (destructive) — **the feature closes** (8 of 10 marketplace subfeatures). Dropped: `Product.stock`, `Product.shippingFrom{Pincode,City,Location}`, `Org.default{Pincode,City,State,Address}`, and their indexes — every one unread since the cutover. A separate migration from the cutover on purpose: PR-48 was reversible by redeploying the dual-write build; this is the point of no return.

`OrgSummary` slims to `{ id, name, code }` — one edit, because PR-45 collapsed its ten copies first. The org form loses its address section (a new org adds pickup locations in the portal, which the product form already requires before a product can be saved); the orgs admin table shows contact and email where a single city/pincode used to pretend to be "the" location. Seeds rewritten: each org seeds one pickup location (Address + OrgAddress), products seed `ProductStock` rows there, seeded shipments carry `orgAddressId`. The wire keeps `Product.shippingFromPincode` as the *indicative* origin (largest active holding) — display-only; allocation decides the real one.

**226 tests pass**, `tsc` exits 0, `next build` compiles. **Run `npx prisma migrate deploy`** — destructive; the additive backfill (PR-46) must already be applied, which the migration chain guarantees.

## [PR-48] 2026-08-10 — Orders ship from where the stock is [CONTRACT]

[stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) PR 5 — **the cutover**, the one PR in the ladder that changes what a customer sees.

**Allocation** (`server/checkout/allocation.ts`, pure): fewest parcels, then the nearest origin — "nearest" is shared-pincode-prefix length, honest without a geocoder because Indian pincodes are geographically hierarchical. One location covering the basket is one parcel; 3 at the shop + 10 at the godown fulfils an order for 13 as two parcels (A2/A3); a location holding zero is never chosen; a short total refuses with the product's name and what is left. The same function runs in the checkout preview (**`POST /api/checkout/allocate`** — new, [CONTRACT]) and inside the order transaction, so what the customer saw is what gets decremented (D6). Client-side origin grouping (`groupItemsByOrigin`) is deleted — with it dies the bug where a parcel carried one location's pincode beside another org-level city (the TRD's founding example): a shipment's pincode, city and state now all come from one location row, snapshotted (D5), with `orgAddressId` persisted.

**The stock guard is re-pointed** (D7): the availability check is still the where clause of the write (ADR-0007), now against the allocated `ProductStock` row — the last unit *at one location* sells once. `reservationPlan` carries the merge+sort deadlock discipline onto the join row; `expireAndRestock` returns units to the exact location each parcel drew from (legacy no-location shipments fall back to the product's largest row, loudly). A line split across two locations becomes two `ShipmentItem`s pointing at one `OrderItem` — order-and-cart-lines R5, exercised for the first time.

**Every read is the aggregate** (D3): storefront and cart totals sum **active** locations (an inactive location's units are held, not offered — R11's one figure, A9's no-leak on `check-stock` and the allocate response); admin truth sums **all** rows (R9), with stock-dependent filters and sort-by-stock computed in memory — D3's open question measured and closed at this catalogue size. Org rollups and the analytics dashboard flipped the same way. `Product.stock` the column is now **read by nothing** — PR 6 drops it.

**Checkout says what will arrive** (D12/R10/A8): parcels are numbered and led by the location's own name (two warehouses can share a city), and a split order shows "everything arrives by" — the latest of the chosen rates' estimates — before payment.

**226 tests pass** (allocation cases from the spec's own list, reservation-plan merge+sort; the Product.stock-era reservation tests retired with their module), `tsc` exits 0, `next build` compiles. No migration in this PR.

## [PR-47] 2026-08-10 — Stock is entered where it sits [CONTRACT]

[stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) PR 4 (dual-write): the product form's single stock number and the three-field origin override are **gone**, replaced by one quantity input per pickup location — nothing preselected, a product cannot be saved without naming a location that holds it (R2/A1), and an inactive location is only offered if it still holds the product's stock. The all-or-none override refine from PR-22 is deleted with the fields that made it necessary: origin no longer has two homes.

`ProductFormInput.stockLocations` replaces `stock` + `shippingFrom*` **[CONTRACT]**, and the service refuses a row naming a location the product's own org does not own — otherwise one org could park stock at (and attribute parcels to) another org's address. Writes are dual: join rows are created/replaced in a transaction while `Product.stock` keeps the sum, so **every reader stays correct** — storefront, checkout, admin filters all still read the column until the cutover PR flips them.

**225 tests pass** (override-group tests retired with the feature; location rules and the ownership check added), `tsc` exits 0, `next build` compiles. No migration.

## [PR-46] 2026-08-10 — Pickup locations exist [MIGRATION]

[stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) PR 3 (additive): **`OrgAddress`** — an org's pickup location, hanging off the shared `Address` table exactly like the customer address book, with a courier nickname, a pickup contact, and the aggregator reference D11 designed for — and **`ProductStock`**, the composite-keyed join row where a product's quantity-per-location will live. `Shipment` gains a nullable `orgAddressId` (D5: old parcels keep `NULL`, never a guessed attribution). **Nothing reads the new tables yet**; `Product.stock` and `Org.default*` stay authoritative until the cutover PR.

R8 is in the database: `RESTRICT` on the org link, the address link, the stock join's location side, and the shipment link — a location holding stock or named by a parcel cannot be deleted, whatever the application forgets. The service pre-checks the same counts to say *why* ("still holds stock for 3 products"), and deleting a location clears only its zero-quantity join rows first.

The backfill runs inside the migration: one location per org from `Org.default*` ("Primary pickup"), one per distinct product origin override (empty street line marking rows a human must complete), and one `ProductStock` row per product at its resolved location carrying today's `Product.stock` — deterministic ids, `RAISE NOTICE` counts.

The org portal gains **Locations** (`/org/[orgId]/locations`, `withOrg` like everything else): card list with active badges and the stocked/shipped counts that explain a disabled delete, add/edit in a dialog reusing `useServerForm` + the shared form fields. New locations require a pickup contact; the TRD's placement question is closed with a dated note (the org portal postdates the TRD).

**227 tests pass** (10 new), `tsc` exits 0, `next build` compiles. **Run `npx prisma migrate deploy`** — additive, with the backfill inside.

## [PR-45] 2026-08-10 — One declaration per shape

[stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) PR 1 (its rename and reservation prerequisites landed long ago as PR-24..28 and PR-40): pure consolidation, zero behaviour. The org summary block — id, name, code, and the four `default*` origin fields — was spelled out **ten times** (`server/catalog/product.types.ts`, `server/cart/cart.types.ts`, `src/domain/product.ts`, `src/domain/cart.ts`, and six inline prop types across the product form tree). It is now declared once as `OrgSummary` (`server/catalog/org.types.ts`) and imported everywhere, so the destructive migration that eventually drops `default*` edits one file, not a hunt. `ProductFormInput` and `CartItem` lose their client-side twins — each is declared server-side and re-exported (`src/admin/products/types.ts`, `src/domain/cart.ts`), closing the two drift sites CONTRACTS.md has carried since PR-22.

**217 tests pass**, `tsc` exits 0, `next build` compiles. No wire change, no migration.

## [PR-44] 2026-08-10 — A cart stores the choice, not the price [MIGRATION]

[order-and-cart-lines](specs/multi-vendor-marketplace/order-and-cart-lines/) PR 2 of 2 — **the subfeature closes** (7 of 10). `Cart.items` blobs become `CartItem` rows holding exactly what the buyer chose: product, quantity, size, colour. **Nothing else is stored** — prices, names, thumbnails, `weight`, `shippingFromPincode` and the `org` block are derived from the product join at read time, so a cart can never hold a stale price or a spoofed one, and the blob-era "refresh prices on sync" pass is now just what reading a cart means. `CartItem.productId` is `Cascade`, deliberately opposite to `OrderItem`'s `Restrict`: a cart line is a wish, not history, and deleting a product simply removes it from carts.

The sign-in merge is pure set logic (`server/cart/cart.merge.ts`): union by (product, size, colour), the device's quantity winning where both sides hold a line — same rule as before, now unit-tested. `syncCart` goes through the repository like everything else (its direct `prisma.cart` access is gone, Invariant 5 on contact), the boundary casts in `/api/cart` and `/api/cart/sync` are deleted (`as CartItem[]` twice), and the abandoned-carts admin view values carts at today's catalogue prices. A caught regression from the rewrite itself: sync's failure path must echo the device's items back — returning `[]` would have wiped the local cart the client faithfully `setItems`s.

The optimistic `version` guard is unchanged and still the where clause of the write. The lift keys rows by line position (two sizes of one product are two blob lines), lifts no price, skips deleted-product lines with a `RAISE NOTICE`, and leaves the blob one release as nullable `legacyItems`.

**217 tests pass** (guard suites scale with source files; 10 new here: merge, wire mapper, migration pins), `tsc` exits 0, `next build` compiles. **Run `npx prisma migrate deploy`** (applies PR-43's lift too if pending).

## [PR-43] 2026-08-10 — What was bought is a relation [CONTRACT] [MIGRATION]

[order-and-cart-lines](specs/multi-vendor-marketplace/order-and-cart-lines/) PR 1 of 2: `Shipment.items` — a JSON blob per parcel — becomes **`OrderItem`** (the missing order→product relation, `unitPrice` integer paise from birth per ADR-0004) and **`ShipmentItem`** (what one parcel packs, pointing at the order line, so a future split stays linked to the one thing the customer ordered). `OrderItem.productId` is `RESTRICT`: a sold product cannot be deleted out from under its order history. Per-product revenue is now a SQL question.

**The lift reads the blobs as they actually are.** money-as-paise multiplied the total columns ×100 but left the blobs alone, so old blobs are rupee floats and new ones paise — indistinguishable by wall clock, distinguishable by arithmetic: an order whose lines sum ×100 to its already-paise `itemsTotal` is a rupee blob (D3). Rows are keyed by line *position* (`WITH ORDINALITY`) because the same product can appear twice in one shipment (old carts split sizes into separate lines). Lines whose product was deleted cannot get a row under `RESTRICT` — skipped with a `RAISE NOTICE` count, never silently (D4). The blob stays one release as nullable `legacyItems` (`@map("items")`), read by nothing.

**Fixed on contact: checkout dropped the chosen variant.** The cart records size and colour; the wire sent `{ productId, quantity }` — so no order said which size to pack. Items now carry optional `size`/`color` **[CONTRACT]**, validated in `priceGroupItems` against the product's declared options ("not available in size XXL" is refused, not recorded), persisted on the order line, shown in the org portal's parcel view.

Every read rebuilds the wire items array from rows through one mapper (`toWireShipmentItems`): display fields from the product join, `price` = the unit price actually paid — order history shows what was charged, and no fabricated strike-through. Org and admin views, `expireAndRestock`, and the seed all moved off the blob; org scoping still filters shipments in the query and re-asserts in `toOrgOrderView`, unchanged.

**198 tests pass** (12 new: variant pricing branches, wire mapper, migration pins), `tsc` exits 0, `next build` compiles. **Run `npx prisma migrate deploy`.** PR 2 (`CartItem`) follows; the spec closes there.

## [PR-42] 2026-08-10 — Categories nest [MIGRATION]

[category-tree](specs/multi-vendor-marketplace/category-tree/) lands. `Category` gains a self-referencing `parentId` — depth without a schema change per level, replacing the two-level subcategory idea that was product flags in disguise. Every existing category becomes a root; no data moves.

The two rules Postgres cannot express declaratively live in one pure module (`server/catalog/category.tree.ts`), so every branch is a unit test: **subtree collection** — a category page now lists its whole subtree, resolved in app code over the tens-of-rows table (D1), with an unknown slug matching nothing rather than everything — and the **cycle guard** — a category can never become its own ancestor, refused on the write path as a `DomainError` on the `parentId` field so it lands inline on the form, whose parent selector already excludes self and descendants.

**What the database now refuses on its own:** `parentId` is `RESTRICT`, and `Product.categoryId` moves **`Cascade` → `RESTRICT`** — the cascade flagged in the data-model review, where deleting a category would have deleted its products with only an application-level count in the way. The service keeps friendlier messages; the constraints are the guarantee, and tests pin both `ON DELETE RESTRICT` clauses in the migration.

Fixed on contact: **`updateCategorySchema` was `categoryFormSchema.partial()`, and `.partial()` does not strip `.default()`s (zod v4)** — every PATCH silently rewrote unmentioned fields (`description: ""`, `accent: "EMERALD"`; the full-form edit page masked it), and would now have detached `parentId: null`. Create and update now share one set of rules; only create applies defaults. The storefront list path also goes through `productService` instead of reaching the repository directly, since the service is where subtree expansion lives.

**195 tests pass** (18 new), `tsc` exits 0, `next build` compiles. **Run `npx prisma migrate deploy`** — additive column plus the two constraint swaps.

## [PR-41] 2026-08-10 — An address is a record, not a blob [CONTRACT] [MIGRATION]

[addresses-as-entities](specs/multi-vendor-marketplace/addresses-as-entities/) lands — the first data-model subfeature of the marketplace programme (org-team deferred by decision), and the table `stock-locations` will hang org pickup locations off. `Profile.addresses` — one Json column holding each user's whole address book — becomes **`Address`** (a postal fact, identity-agnostic) plus **`UserAddress`** (a person's relationship to one: their label, the recipient, the phone). The `Address` writer lives in `server/shared/` because two domains' relationships will point at it (Invariant 5 applied forward).

**The migration lifts what production actually holds, not what the type claimed.** A survey first: four blob shape variants, `label`/`isDefault` living top-level in some rows and under `metadata` in others, a `landmark` field the design drafts had missed, and two rows with no recipient or phone. The lift coalesces across all of it in SQL (`fullName|name`, `mobile|phone`, `label|metadata.label`), migrates the two incomplete rows with `''` rather than dropping a user's address (the now-required schema forces completion on next edit), and **deliberately does not migrate `isDefault`** — tests read the migration and pin every coalescing rule. The blob survives one release as `legacyAddresses` (`@map`), read by nothing.

**No default address, anywhere** — the 2026-08-08 decision, now enforced by absence: the auto-select-on-mount, make-default button, default badge, only-one-default refine, and reassign-default-on-delete all *deleted* rather than ported (~80 lines of juggling). The buyer picks an address at checkout, every time, and the Continue button waits until they do.

Wire shape: flat as ever, but `id` is now server-generated (blob-era clients minted their own), `metadata` is gone (label/notes are first-class, with real rules — the form-error guard immediately caught `notes` gaining a rule without an error output), and recipient/phone/state are required. `Order.address` stays a snapshot (D8). The repository maps `phone` (column) ↔ `mobile` (wire) so checkout is untouched.

**177 tests pass** (6 new), `tsc` exits 0, `next build` compiles, 0 lint errors in touched files. **Run `npx prisma migrate deploy`** — it creates both tables and lifts the blobs in one step; verify with `SELECT count(*) FROM "UserAddress"` matching the old blob total.

## [PR-40] 2026-08-09 — The last unit sells once

[inventory-reservation](specs/inventory-reservation/) lands, and **Phase 2 — transaction integrity — is complete**. The live checkout path had *no stock movement at all*: the client's pre-flight `check-stock` was the only guard, so any two buyers who both passed it both got the last unit. The legacy path that did move stock did it read-then-check-then-decrement — the race [ADR-0007](adr/0007-conditional-stock-decrement.md) was written against.

**The availability check is now the `where` clause of the write** (`stock: { gte: quantity }` → `decrement`), inside the order transaction: no interval exists in which two checkouts can both believe the last unit is theirs, `count === 0` rolls the whole order back, and the failure names the item and what's left ("Only 2 left of X — you asked for 3"). The reservation *plan* is pure and tested (`server/checkout/reservation.ts`): quantities merge across shipping groups (two decrements of one row would double-check a changed number) and sort by product id (unordered row-locking between concurrent orders is a deadlock). **The cart empties in the same transaction** (R6) — a closed tab can no longer leave a cart that was already bought — and the client's after-the-fact clear is gone.

**Release without breaking the guarantee** (R4): the reconciliation sweep now expires orders still unpaid 60 minutes on — but only *after* asking the gateway and hearing nothing was captured, so a confirmable order is never released first. Expiry restocks conditionally-on-still-pending, and `confirmPaid` now refuses expired orders — both writes conditional, so the expiry-vs-confirmation race has exactly one winner at the database. A capture landing after expiry is refused and refunded manually rather than confirming an order the store may not be able to fulfil. Failed payments keep their hold until expiry, so the same order is retriable — closing the question payment-confirmation carried.

**`Cart.version` is enforced or it lied** (D6): the column existed, was incremented, and was checked nowhere — worse, the one check that existed in the repository was itself read-then-compare. It is now a conditional write; a stale cart write gets a 409, and the client responds by **re-syncing and merging** — the same merge login uses — with a toast, instead of one tab silently overwriting the other (R7).

**The weaker create path is deleted, not patched** (D5): `orderService.createOrder`, `orderRepository.create`, `CreateOrderInput` and the single-shipment schema are gone — a second creation path with different stock behaviour defeats the guarantee, and a test now asserts it stays gone.

**171 tests pass** (6 new), `tsc` exits 0, `next build` compiles. The honest caveat, recorded in the TRD: the *real* concurrency test — N overlapping transactions for one unit — needs the test database this project doesn't have yet; the guard's correctness rests on its shape (pinned by test) and Postgres semantics. No migration.

## [PR-39] 2026-08-09 — An order is paid when the gateway says so [CONTRACT] [MIGRATION]

[payment-confirmation](specs/payment-confirmation/) lands. Until now the **browser** told the server an order was paid — `PATCH /api/orders/[id]` accepted `paymentStatus` from anyone — and the webhook that should have been authoritative had **silently no-op'd since it was written**: gateway-order creation stored our id under `notes.orderId` while the webhook read `notes.localOrderId`, found nothing, did nothing, and returned 200. Both Invariant 2 violations, live.

**One confirmation routine, two triggers** (trd.md D1): the browser's post-payment return and the gateway webhook both run the same three checks — signature (now `crypto.timingSafeEqual`, D8; `===` leaks match-length through timing), the persisted gateway-order linkage (`Order.gatewayOrderId`, written at payment-order creation — a signal for some other gateway order proves nothing about this one), and the captured **amount against `grandTotal`** on the webhook path, rejected in either direction. The decision is a pure function (`server/payments/confirmation.ts`), so every branch is a unit test; the transition is a **conditional write** (`updateMany where NOT paid` — ADR-0007's shape on payment state), so webhook-and-browser racing resolves at the database with exactly one winner. Idempotency keys on the payment id (D2): the same payment again is success with no side effects, a *different* payment against a paid order is an incident. The confirmation email moved from `updateOrder` onto the transition (D3), so it fires exactly once.

**The browser now reports; it does not decide.** The client's three `paymentStatus` writes are gone — success calls `/api/payments/verify` (a writer returning order state), zero-total orders call `/api/payments/confirm-free` (the server checks the total really is zero), and failure writes nothing (the failure webhook records it, and a failure signal can never overwrite a captured payment). With those gone, `PATCH /api/orders/[id]`, `orderApiClient.updateOrder`, `orderService.updateOrder`, `orderRepository.update` and `UpdateOrderInput` had **no callers left and are deleted** — the single-writer rule made structural: there is no generic order-write path for `paymentStatus` to sneak back into.

**An unmatched webhook is now loud** (D5): missing note, unknown order, amount mismatch — non-2xx, so Razorpay retries and its dashboard records the failure. Only genuinely irrelevant event types are acknowledged. The notes key is one shared constant (`RAZORPAY_NOTES_ORDER_KEY`) used by both sides and **pinned by a test** (D6), recorded in [INTEGRATIONS.md](INTEGRATIONS.md).

**The backstop for a missed webhook** (D7, R6): `/api/cron/reconcile-payments` — Vercel Cron every 15 minutes (`vercel.json`, new), guarded by `CRON_SECRET` ([OPERATIONS.md](OPERATIONS.md)) — asks the gateway about orders pending past 30 minutes and confirms captured ones through the same routine. Worst case, a missed webhook confirms in ~45 minutes.

Migration: `Order.gatewayOrderId` + two indexes, purely additive. The email template now declares the `OrderEmailView` it renders instead of importing the client-side `Order` type (a `server→src` inversion, retired). **165 tests pass** (10 new — the TRD says these are the deliverable), `tsc` exits 0, `next build` compiles, 0 lint errors in touched files.

**Deploy notes:** run `npx prisma migrate deploy`; set `CRON_SECRET` in Vercel; and the fix only takes effect for orders whose payment order is created *after* deploy (older pending orders have no `gatewayOrderId` — the sweep reports them `still-unpaid` and they resolve by re-payment).

## [PR-38] 2026-08-09 — The server decides what an order costs [CONTRACT]

[server-side-pricing-authority](specs/server-side-pricing-authority/) lands — Invariant 1 becomes true on the live checkout path. Until now `create-with-shipments` **persisted whatever totals the client sent** and the payment route **charged whatever amount the client stated**: the ₹1-for-anything hole, in production.

**Order creation reprices everything inside its own transaction.** Lines arrive as `{ productId, quantity }` and nothing more — price, sale price, name, slug and thumbnail all come from the catalogue row (`server/checkout/pricing.ts`, pure and 100%-branch tested), loaded with one `findMany` in the same transaction that writes the order, so the price used for the total is the price checked. The price fields were **removed from the schema, not accepted-and-ignored** (trd.md D2), the totals object and its consistency refine are gone (D3 — once the server computes, client numbers have nothing to check), and `discount` is a constant 0 until a coupon system computes one — any client-sent discount was an attack, not an input. A line whose product doesn't belong to the group's org fails the order: the parcel would be attributed, and its revenue owed, to the wrong org.

**The customer still confirms the number they saw**: `displayedGrandTotal` travels with the order, is compared against the server's total, and is never persisted. A mismatch — in either direction, Q2 — gets a 409 "Prices changed while you were checking out", not a silent repricing.

**The gateway amount is read back from the persisted order** (D5): `POST /api/payments/create-order` takes `{ localOrderId }`, loads the order through checkout's public surface, refuses if already paid, and charges `grandTotal`. The request type physically cannot carry an amount any more.

Also in passing, per migrate-on-contact: `order.service.ts` (the money path whose own domain rules say *no `any` in this tree*) had nine — Json-column casts now go through a typed `toJsonColumn` helper whose JSON round-trip is what Prisma does anyway; the Razorpay `window as any` pair became a declared global; `paymentStatus` is no longer accepted at order creation (Invariant 2).

**Recorded limitation:** the shipping *rate* is still the client's selection — re-deriving it means calling the courier inside the transaction. Bounds-checked; real verification belongs to [shipping-fulfilment](specs/shipping-fulfilment/). And the client's post-payment `paymentStatus: "paid"` write is untouched here — that is [payment-confirmation](specs/payment-confirmation/)'s whole subject, next in the sequence. The legacy `POST /api/orders` path (no client callers found) is left for the same PR to delete.

**155 tests pass** (12 new, every pricing branch), `tsc` exits 0, `next build` compiles, 0 lint errors in the touched files. No migration — this changes who computes, not what is stored.

## [PR-37] 2026-08-09 — Money is integer paise, end to end [CONTRACT] [MIGRATION]

[money-as-paise](specs/money-as-paise/) lands — the first of the Phase 2 transaction-integrity specs, and per its TRD D2 deliberately **one large PR**: a half-migrated state displays amounts 100× wrong, so there was no incremental path.

**Eight columns convert** (`Product.price`/`salePrice`, `Order`'s four totals, `Shipment.shippingCost`, `ShippingRateCache.rate`) via a hand-written migration that multiplies and rounds explicitly — a bare type change would have truncated ₹1,200.50 to ₹1,200. The Q1 survey found **zero rows** with sub-paisa drift, so ROUND is a guard, not a correction. The rate cache is emptied rather than converted: entries are transient, and a cache whose unit depends on write date cannot be mistrusted correctly.

**Exactly two modules know about the factor of 100.** `server/shared/money.ts` (`rupeesToPaise` guards against IEEE754 dust — `0.29 * 100` is `28.999999999999996`) and `src/lib/format.ts` (`formatCurrency` takes paise; whole rupees drop decimals). The admin form still collects rupees; conversion happens once at the catalog service (`moneyToPaise`) — **not** in a Zod transform, because the same schema validates on client and server (ADR-0013) and a transform would run twice and square the factor. TRD D4 carries that revision, dated.

**The four epsilon comparisons in `order.schemas.ts` are gone** — `Math.abs(a − b) < 0.01` was Invariant 3's named bug, and integer totals now compare with `===`. Wire money validates as `paiseAmount` (integer) and human input as `rupeeAmount` (≤2 decimals), so a field misused in the wrong unit fails validation instead of relying on a name being read (Q2, closed without renaming DTO fields). The client's `grandTotal * 100` at the Razorpay call is deleted — the total already **is** the minor unit — and Shiprocket's rupee quotes convert at the provider mapper, so a courier rate is paise from the moment it enters.

Two display notes: `formatCurrency` previously used `maximumFractionDigits: 0`, so amounts like the live `₹40,490.54` grand total were silently **rounded on screen**; paise now show when present. And five hand-rolled `₹{x.toFixed(2)}` renders in checkout moved onto the formatter.

Seeds convert (67 literals), 12 new tests pin the round-trip, the drift case, Indian-grouping formatting and the 2-decimal rule. **143 tests pass**, `tsc` exits 0, `next build` compiles.

**Run `npx prisma migrate deploy` before using the app** — the client now types these columns `Int` against a database that still holds `Float` until then. Verify after (TRD D7): `SELECT SUM("price") FROM "Product"` must read **2989900** (was 29899.00) and `SELECT SUM("grandTotal") FROM "Order"` must read **4049054** (was 40490.54). Take a backup first; the conversion is reversible only by dividing back.

## [PR-36] 2026-08-09 — Portals get their plain surfaces back, by token scope

PR-33's mapping had the admin panel and org portal inherit the storefront's warm parchment (`bg-gray-50` → `bg-background`), which read as tinted where the panels used to be plain. Rather than reverting to raw classes, a `.portal` scope in `globals.css` overrides the six surface tokens (`background`, `card`, `popover`, `muted`, `border`, `input`) to neutral values, light and dark — every component under the portals re-skins with **zero component edits**, brand and status colours stay shared with the storefront. This is the demonstration of what routing colour through tokens buys: "make this whole area look different" is six variable lines, not a sweep. A new `(org)` group layout applies the surface to `/org` and `/org/new`, which sit outside the `[orgId]` membership layout.

## [PR-35] 2026-08-09 — Category accents become semantic keys [CONTRACT] [MIGRATION]

Pulls forward the defect PR-33 could only allowlist: `Category.accentColorClass` stored raw Tailwind class strings as rows. The database check that motivated doing it now found it was worse than fragile — the column held **two incompatible shapes** (gradient triplets from seeds, flat washes from the form), and the storefront renders the value inside `bg-gradient-to-br`, so **a category created through the admin form has been shipping with no hero gradient at all**. PR-33's codemod had also left the form default as a third shape (`bg-primary/10`).

The column is now `accent`, a `CategoryAccent` enum (the `OrgRole` pattern), and `src/lib/category-accent.ts` is the one place a key becomes CSS — each key mapping to both surfaces (`swatch` for the admin table, `heroGradient` for the storefront), which fixes the two-shapes defect by construction. A palette change is an edit to that table, not a data migration. The migration is hand-written: the CASE maps every observed value shape and leaves anything unrecognised to **fail the enum cast loudly** rather than silently inventing a colour.

The design-tokens allowlist swaps from the form (data it must not break) to the mapper (the one module where classes are deliberately data-adjacent), and the scan widens from `.tsx` to all of `src`'s TypeScript. `tests/unit/category-accent.test.ts` pins completeness — every enum key renders both surfaces, since a missing entry is exactly the invisible-gradient defect again. The form-error-display exemption followed the rename after the guard caught it orphaned.

`tsc` exits 0, **131 tests pass**, `next build` compiles. **Run `npx prisma migrate deploy`** — five rows update; check first with `SELECT DISTINCT "accentColorClass" FROM "Category";`.

## [PR-34] 2026-08-09 — Fix: pre-rename sessions lost every admin affordance

"The floating admin panel is not visible anymore" — because it now checks `session.user.platformRole` (PR-25), and a JWT minted before the rename carries no such claim, so every admin affordance quietly hid for existing sessions until their next sign-in. That includes production. The `jwt` callback now stamps the claim once from the database for tokens that lack it — a migration shim, marked removable once pre-2026-08 sessions have expired. Signing out and back in also fixes any one session immediately.

## [PR-33] 2026-08-09 — UI reuse pass, and colour goes through tokens

Two directives from review of the portal work, applied repo-wide.

**Reuse.** The org orders/reviews pages had hand-rolled tables, badges and cards while `DataTable`, `StatusBadge` and `Card` existed — rebuilt on the shared components (`OrgOrdersTable` is the same `DataTable` the admin lists use, pointed at the org projection). The two sidebars became configurations of one `PortalSidebar` shell — header slot, nav, and Back to Store pinned to the bottom, which also fixes it floating mid-sidebar in the org portal. `StatusBadge` gained nothing; it was already the right component, just unused.

**Tokens.** The theme system (`globals.css`, oklch, light+dark) was real and bypassed: **759 raw palette classes across 81 files** hardcoded shades it already named. Now 8 remain, all one allowlisted file. What made the pass more than find-and-replace:

- **Three token *concepts* were missing**, which is why people hardcoded: `success`/`warning`/`info` for statuses (StatusBadge's variants are now token washes — `bg-success/15 text-success`), `scrim` for overlays that must stay dark in both themes, and `hero` for the storefront's deep-emerald brand scenes. `success` is deliberately not `primary`: "it worked" should survive a rebrand of the store's green.
- **The first mapping of overlays was wrong and got corrected mid-pass**: `bg-black/50 → bg-foreground/50` inverts in dark mode, where foreground is near-white. Overlays are `scrim`.
- **`EmailVerificationBanner`'s hand-managed `dark:` overrides were deleted, not converted** — tokens flip with the theme, which is the point of having them.
- **`Category.accentColorClass` turned out to be Tailwind classes stored as database rows.** The codemod rewrote the option list, orphaning stored values (and collapsed Orange and Yellow into one). Reverted, loudly commented, allowlisted, and the real fix (a semantic key) recorded in BACKLOG for [category-tree](specs/multi-vendor-marketplace/category-tree/).

`tests/unit/design-tokens.test.ts` enforces the rule from now on — raw palette classes fail the build outside the one data-literal allowlist — and [CLAUDE.md](../CLAUDE.md) carries it as a principle. Two codemod artifacts (`/30/60` double opacities) were caught by a sweep and fixed.

`tsc` exits 0, **122 tests pass** (3 new), `next build` compiles. Colour changes of this scale can only truly be judged by eye — worth a click around both portals and the storefront in both themes.

## [PR-32] 2026-08-09 — Correction: the org switcher renders for single-org users too

PR-31's D3 rendered a plain heading when someone had exactly one organisation — on the principle that a one-option dropdown lies about the state space. Wrong in effect: “Create another organisation” lives *inside* that dropdown, so for single-org users — most users — a second organisation was unreachable, and the switcher the feature was named for was invisible. The control now always opens; with one org it offers the org and the create action. Spec R3/A3 and TRD D3 carry the correction rather than pretending they always said this.

## [PR-31] 2026-08-09 — Portal chrome: the switcher, and one header for both panels

[org-portal-chrome](specs/multi-vendor-marketplace/org-portal-chrome/), implemented whole. The sidebar's static organisation name becomes a switcher, and both portals gain an identity header.

**Switching is navigation, nothing else.** An org in the switcher is a link to `/org/[id]` plus the section you are on — from one org's products you land on the other's products. No cookie, no session write, no context: the active org lives in the URL by programme decision, which is what makes "two tabs on two orgs" true by construction rather than by care. A deeper path (a product id) is deliberately not carried across — the record belongs to the org you are leaving. One membership renders a heading, not a dropdown with one option; the switcher also offers creating another organisation.

**One `PortalHeader` serves both panels** — signed-in name and email, sign out, back to storefront — with only the label differing (`Org Portal` / `Platform Admin`). A second header is how two panels drift. It is a server component with `"use client"` pushed down to the one interactive leaf (`SignOutButton`), and the org layout now fetches the membership list once, server-side, feeding both the authorization check and the switcher.

No new routes, no schema or contract changes, no new tests — the chrome is links and text over data already covered (memberships PR-24, boundary PR-30); its TRD records that if switching ever becomes stateful, that change must bring its own tests.

`tsc` exits 0, 119 tests pass, `next build` compiles, 0 lint errors in the touched files.

## [PR-30] 2026-08-09 — Portal separation closes: admin stops mutating products, and the boundary is a test

PR 4, the last of [portal-separation](specs/multi-vendor-marketplace/portal-separation/). The subfeature is **Implemented**.

**The platform's product surface is now read-only.** `/admin/products/new` and `[id]/edit` are deleted along with both `/api/admin/products` route files — the admin list reads server-side through the DAL, and the client only ever called those routes to mutate, which is the org portal's job now. The list and detail pages stay as the cross-vendor support view [portal-split.md](specs/multi-vendor-marketplace/portal-split.md) promised, with edit and delete affordances gated off (`readOnly` through `ProductsContainer`/`ProductsTable`, `canEdit` on `ProductsView`).

**The boundary is enforced by `tests/unit/portal-boundary.test.ts`, not by review**: every `/api/admin` handler requires a platform admin; every `/api/org` handler is defined through `withOrg`; `POST /api/orgs` is pinned as the one org write outside it (no org exists to be a member of yet) and still requires a session; no `(admin)` page imports org authority or org-scoped reads; no `(org)` page imports `requirePlatformAdmin`; and the deleted mutation surfaces stay deleted. A 37-surface property holds only if something checks it.

One first-run test failure was the test's own: it asserted the creation route doesn't contain "withOrg" — which the route's *comment* mentions by name to explain itself. The assertion now checks for a call, not the word.

Also fixed on contact: `sortBy: params.sort as any` in the admin products page became the narrowed union the org page already used.

`tsc` exits 0, **119 tests pass** (6 new), `next build` compiles, 0 lint errors in the touched files.

## [PR-29] 2026-08-09 — Org portal: orders and reviews, scoped without leaking

PR 3b of [portal-separation](specs/multi-vendor-marketplace/portal-separation/): `/org/[orgId]/orders`, `orders/[orderId]` and `reviews`. The dashboard deliberately stays a placeholder — its shape belongs to [dashboard-widgets](specs/multi-vendor-marketplace/dashboard-widgets/).

**An org's orders are the ones with a parcel from it, and it sees only its part.** The scope is by shipment origin (`shipments: { some: { orgId } }`), never "orders containing my products" — and the Prisma `include` is itself filtered to the org's shipments, so a cross-vendor basket's other parcels never leave the database. The projection (`toOrgOrderView`) enforces the same rule a second time and is a pure exported function, so programme acceptance A6 is a **unit test** (`tests/unit/org-order-view.test.ts`): a row carrying a foreign shipment loses it, and the view has no `grandTotal`/`itemsTotal` whatever the row contains — the basket's money is the buyer's business, not the vendor's. What the org does get: the delivery address (they ship the parcel), `paymentStatus` (nothing unpaid gets fulfilled), and a `parcelValue` summed over their items alone.

**Reviews are scoped through `Product.orgId` and read-only** — moderation and deletion stay platform, per [portal-split.md](specs/multi-vendor-marketplace/portal-split.md).

**No new `/api` routes and no new `"use client"`.** Everything here is a read a server component can do through the DAL, so there is nothing for a browser to call — the server-first rule ([CLAUDE.md](../CLAUDE.md)) applied rather than recited. Orders are read-only for an org: order status is the buyer's order; what an org will eventually mutate is its *shipments*, which arrives with fulfilment.

**Typing two pre-existing `any`s found a broken feature.** `updateOrderStatus` built its update as `const updateData: any` and wrote `estimatedDelivery` — which is a **Shipment** column, not an Order one. Prisma validates field names at runtime, so any admin order-update that included a date has thrown since the day it was written; the `any` kept the compiler quiet about it. The impossible write is removed along with the field's appearances in the schema, types and client. Third time this session that removing an `any` exposed a real defect rather than a style problem.

`tsc` exits 0, **113 tests pass** (6 new), `next build` compiles the three routes, 0 lint errors in the touched files.

## [PR-28] 2026-08-09 — Org onboarding complete: self-serve creation, generated codes [CONTRACT]

Completes [org-onboarding](specs/multi-vendor-marketplace/org-onboarding/) — and a process admission first: its initial pieces (`/org`, `/org/new`, `POST /api/orgs`) were built reactively when testing found the portal unreachable, before any spec existed. The spec and TRD were written afterwards to match what should exist, and the implementation corrected to them. Backwards under our own SDLC; recorded rather than hidden.

**Org codes are server-generated and frozen — nobody is asked for one, admin included.** A shop owner asked to invent `TEST-001` produces collisions and an identifier that can never change once printed, which is the slug lesson (PR-15/18) again. `ORG-` + 5 characters from an alphabet with no `0/O` or `1/I/L`, settled by the unique constraint with retry (`server/catalog/org.code.ts`). The old `findByCode`-then-insert existence check is gone — read-then-write, [ADR-0007](adr/0007-conditional-stock-decrement.md)'s reasoning applied to inserts. Existing `SEL-*` codes untouched.

**`isActive` is server-owned at creation** (Invariant 4): a new org is active by definition, deactivation is a platform act on an existing org. `createOrgSchema` loses both fields; a client that sends them is stripped, and there are tests asserting exactly that. One form still serves self-serve create, admin create, and admin edit — it renders by mode (`orgFormSchema` superset; each route parses its stricter schema), because a second form is how forms drift.

**The portal is now reachable**: an "Org Portal" entry in the storefront account menu → `/org`, which resolves state server-side — no orgs → create prompt, exactly one → straight in, several → chooser, which now also offers "create another". Creation lands you in the new portal as its OWNER, org + first membership in one transaction.

**Also in this PR, found by using the portal** (each fixed on contact, ADR-0013 decision 7):
- `getStats()` had no org scope, so a vendor's dashboard cards showed the **platform's** product count and inventory value. The scope is now a **required** argument — `getStats(orgId | null)`, the admin page passing an explicit `null` — because an optional parameter defaulting to platform-wide is exactly how this leaked.
- `defaultAddress` was registered **twice** in the org form (a textarea and an input sharing one value). Removed, and `tests/unit/form-error-display.test.ts` now fails any field bound twice in a file.
- The code/GST/PAN inputs are styled `className="uppercase"` — CSS, which changes how a value looks and never what it is — while validation ran on the raw value, so `test-001` displayed as `TEST-001` and failed. Normalisation now runs **before** the pattern. The same probe found `phone: ""` failing outright — `optionalPhoneSchema` joins `optionalPostalCodeSchema` (PR-22's defect, in a schema written before that fix existed).
- "Default Shipping Location" copy → "Pickup Location": there is no default location by decision (stock-locations trd.md D4), and the screen was contradicting it.

`tsc` exits 0, **107 tests pass** (was 96), `next build` compiles, 0 lint errors in the touched surfaces. Six `emailSchema.optional()` / `phoneSchema.optional()` declarations elsewhere have the same blank-rejection shape and are deliberately left for their own pass — two sit on live auth paths.

## [PR-27] 2026-08-08 — The org portal exists: `(org)` and products [CONTRACT]

PR 3 of [portal-separation](specs/multi-vendor-marketplace/portal-separation/), narrowed to products. `/org/[orgId]` is real: a layout that establishes membership once, a dashboard, and the four product screens with API routes behind `withOrg`.

**It runs alongside `/admin/products` rather than replacing it, which is a deliberate deviation from the TRD's "moved out of `(admin)`".** [PR-24](#pr-24-2026-08-08--orgmember-a-persons-membership-of-an-org-migration) added no backfill, so **no org in production has a member** — a hard move would have made product management unreachable for everybody the moment it deployed. Both trees work; removing the admin pages becomes its own step once memberships exist. The product containers are shared, and `useProductsBasePath` decides from the path which portal they are rendering in, so there is one set of components rather than two that drift.

**Two cross-org holes the split would otherwise have opened:**

`orgId` arrived in the **request body** — `productFormSchema` requires it and the form sent it. Under an org route that is a write hole: a member of one org could create or move a product into another by editing the payload. The scope's org is now injected *before* parsing, so whatever the client sent is overwritten rather than trusted. Server-owned, in exactly the sense [Invariant 4](../CLAUDE.md) means.

A **product id in the path is the caller's to choose**, and `getProductById` does not filter by org. Both the pages and the `[id]` handlers check ownership before reading or writing, and report a mismatch as **not-found rather than forbidden** — whether another org owns that id is not this caller's business, and 403 would confirm it exists.

Middleware now covers `/org` for signed-in only. Membership is deliberately not checked there: it runs on the edge and cannot reach Postgres, and it can be revoked mid-session ([trd.md](specs/multi-vendor-marketplace/portal-separation/trd.md) D3).

Also fixed on contact: `catch (error: any)` in `useProducts`, and eight hardcoded `/admin/products` links in components the org pages reuse — Cancel would have thrown an org member into the platform tree.

**Not done in this PR:** orders, reviews and the dashboard, which [portal-split.md](specs/multi-vendor-marketplace/portal-split.md) marks as serving both audiences and which need scoping through `Shipment.orgId` and `Product.orgId` respectively. The org dashboard shows one real number and is a placeholder until [dashboard-widgets](specs/multi-vendor-marketplace/dashboard-widgets/).

`tsc` exits 0, 96 tests pass, `next build` compiles all 7 new routes, 0 lint errors in the new surfaces.

**The portal is unreachable until someone has a membership.** Grant one:

```sql
INSERT INTO "OrgMember" ("id","userId","orgId","role","updatedAt")
SELECT gen_random_uuid()::text, u.id, o.id, 'OWNER', now()
FROM "User" u, "Org" o
WHERE u.email = '<your-email>' AND o.code = 'SEL-001';
```

## [PR-26] 2026-08-08 — The org authorization boundary

PR 2 of [portal-separation](specs/multi-vendor-marketplace/portal-separation/). No behaviour change: nothing uses it yet, which is what makes the split in PR 3 a move rather than a rewrite.

**The check returns the scope, not a boolean.** `withOrg` hands the handler `{ orgId, role, userId }`, and that `orgId` is what every subsequent query filters on. A boolean would leave the filter as a separate step someone can omit, and an omitted filter is another org's data on the page. Being authorised and being scoped are now one act.

**The handler is wrapped, not instrumented.** `withOrg(handler)` is the only thing that produces a scope, so a handler that skips it has no `orgId` to query with — as opposed to a helper each route remembers to call. The `orgId` handed over is taken from the **membership row**, not re-read from the path, so the two can never disagree.

**No platform-admin bypass**, and there is a test that a platform admin without a membership is refused. A bypass would be an exception inside a filter that must never fail.

Memoisation is split deliberately: `requireOrgMember` is wrapped in React `cache()` for server components, where several components on one page share one lookup, and `withOrg` calls the unmemoised path — a handler does one check, so there is nothing to share, and `cache()` outside a React render has no request scope to key on. Neither caches across requests, because a membership revoked by the team page has to take effect on the next request rather than at the next sign-in.

**Seven tests, all attempts to get at something**: a member of another org, a platform admin with no membership, a signed-out request, and a check that the scope's `orgId` comes from the database rather than the URL. Two defects in the tests themselves were caught and fixed before they could give false assurance — one threw a look-alike error object, so `toErrorResponse` fell through to its generic branch and the test passed on a 500 while asserting only `>= 400`; the other typed its handler double with no parameters, which `vitest` accepted and `tsc` did not.

`tsc` exits 0, **96 tests pass** (up from 89), `next build` compiles, no new lint errors.

## [PR-25] 2026-08-08 — `platformRole`, and an auth boundary that throws [CONTRACT] [MIGRATION]

PR 1 of [portal-separation](specs/multi-vendor-marketplace/portal-separation/). `User.role` becomes `User.platformRole` — a rename in place, so the column, its values and every row survive and nobody's access changes. Once `OrgMember.role` exists, an unqualified `role` means two things, which is how `ProductFlag` came to be declared three times.

It also gains a type. `PlatformRole` is a Prisma enum, so the database rejects a third value; the migration's cast **fails loudly** if any row holds something other than `USER` or `ADMIN`, which is correct — a silent default would invent a permission level. Check with `SELECT DISTINCT "role" FROM "User";` before applying.

**`(session.user as any).role` is gone from all eight sites.** The cause was a session augmentation in `src/types/next-auth.d.ts` that declared `id` and not the role, so every reader reached past the type. Declaring it once removed the need for the cast rather than the cast being deleted and re-added later. `any` at an authorization boundary is a defect ([CLAUDE.md](../CLAUDE.md)) and this was eight of them.

**`verifyAdminSession()` now throws instead of returning `Session | NextResponse`.** That union forced all 21 call sites to discriminate with `instanceof NextResponse` and shipped a hand-rolled error body. It is now `requireSession` / `requirePlatformAdmin` throwing `UnauthorizedError` (401, new) or `ForbiddenError` (403), which `toErrorResponse` renders in the standard envelope.

**That conversion could not be done alone.** 14 of the 19 handlers had no `toErrorResponse`, so a thrown `ForbiddenError` would have surfaced as an unhandled 500 rather than a 403 — turning an authorization refusal into a server error. Wiring them was a precondition, not scope creep, and is what [ADR-0013](adr/0013-one-error-envelope-and-useserverform.md) decision 7 exists to force. The four handlers under `/api/admin/orgs` that inlined their own check now use the helper too.

**Three Invariant 4 violations fixed in passing**, all in files this PR already had open: `users/[id]`, `orders/[id]` and `reviews/[id]` each cast `await request.json()` to an interface. `src/lib/validation/schemas/admin.schemas.ts` gives them real schemas that whitelist their fields — `platformRole` is writable there and nowhere else, since that is the one screen that grants it.

`tsc` exits 0, 89 tests pass, `next build` compiles, **lint errors 148 → 130**. As with [PR-24](#pr-24-2026-08-08--orgmember-a-persons-membership-of-an-org-migration), a clean build proves nothing about whether the migration was applied — the platform role is read at sign-in, not at build. Run `npx prisma migrate deploy`, then sign out and back in: an existing session's token still carries the old claim.

## [PR-24] 2026-08-08 — `OrgMember`: a person's membership of an org [MIGRATION]

Completes [organisations-and-membership](specs/multi-vendor-marketplace/organisations-and-membership/). Purely additive — one enum, one table, and nothing reads either. That is the point: the authorization change in [portal-separation](specs/multi-vendor-marketplace/portal-separation/) becomes additive rather than a schema change.

**`OrgRole` is a Prisma enum, not a TypeScript union over a `String` column.** This diverges from `ProductFlag`, which is a TS enum over `String[]` — and the reason is that a role is scalar, so it does not need the compromise Postgres arrays of enums force. Declaring it in the schema means the generated type is the *only* declaration and the database rejects anything else, which matters for a value that will gate authorization.

**Cascade on both sides of the membership**, which is the one place cascade is right in this schema: a membership is meaningless without either end, and deleting one end must remove only the link. Contrast `ORDER_ITEM.productId`, where cascade would destroy order history. `@@unique([userId, orgId])` puts "one membership per person per org" in the database rather than in a prior read.

**No backfill, deliberately.** Existing orgs have no owner to infer — `contactPerson` is a free-text name, not a user reference — so guessing one would write a fiction into an authorization table. Orgs created before this have no members and get them from [org-onboarding](specs/multi-vendor-marketplace/org-onboarding/) and [org-team](specs/multi-vendor-marketplace/org-team/).

The repository is deliberately three methods: `findMembership`, `listOrgsForUser`, `addMember`. Listing members, changing a role and removing someone wait for `org-team`, whose requirement that an org cannot be left unadministered is what decides what removal means — writing it now would either omit that rule or invent it.

Each seeded org now gets an OWNER, so `addMember` has a real caller and the org portal will be reachable locally without going through onboarding. The seed's wipe lists `orgMember` explicitly rather than relying on the cascade, matching how every other table is handled there.

**Its behaviour is not covered by a test, and cannot be.** The uniqueness constraint and the cascade are database behaviour, and there is no test database — `vitest.config.ts` runs `happy-dom` with no datasource. [TESTING.md](TESTING.md) now records that gap and what would close it, because "the database enforces it" is only an argument if something checks that it does. `tsc` exits 0, 89 tests pass, `next build` compiles with no Prisma error — though unlike [PR-23](#pr-23-2026-08-08--seller-becomes-org-contract-migration), a clean build here proves nothing about whether the migration was applied, since nothing reads the table.

## [PR-23] 2026-08-08 — `Seller` becomes `Org` [CONTRACT] [MIGRATION]

A vendor is an organisation with people in it, not a record an admin types on someone's behalf. This is the rename only — `OrgMember` and anything that reads a membership are PR 2 of [organisations-and-membership](specs/multi-vendor-marketplace/organisations-and-membership/), deliberately separate because a rename is reviewed by confirming nothing changed and new behaviour by confirming something did.

**751 substitutions across 56 files**, 19 files and directories moved with `git mv` so history follows. `Seller` → `Org`, `Product.sellerId` → `orgId`, `Shipment.sellerId` → `orgId`, `/admin/sellers` → `/admin/orgs`, `/api/admin/sellers` → `/api/admin/orgs`. Identifiers read `Org`; anything a person reads says "Organisation".

**The migration is hand-written, and that is the point.** Prisma generates a renamed model as `DROP TABLE` + `CREATE TABLE`, which would have destroyed every vendor row along with the products and shipments referencing them. Every statement in `20260808104500_rename_seller_to_org` is a rename and no data moves. Postgres does not rename a table's indexes or constraints when the table is renamed, so all eleven — the primary key, the `code` unique index, four `Seller_*` indexes, and both foreign keys with their indexes on `Product` and `Shipment` — are renamed explicitly, with the real names read out of the existing migration files rather than assumed.

**`tests/unit/vocabulary.test.ts`** fails the build if "seller" reappears in `src/`, `server/` or `prisma/` (migrations exempt — they are applied history and must never be edited). A 57-file rename stays done only if something checks; `ProductFlag` was declared three times because nothing did.

Not renamed, deliberately: the org `code` keeps its `SEL-` prefix, because regenerating vendor codes would invalidate anything already printed or exported for no gain. `Shipment.orgId` is also still the wrong question — a shipment's origin becomes `orgAddressId` — but that belongs to [stock-locations-and-allocation](specs/multi-vendor-marketplace/stock-locations-and-allocation/) and is left alone here.

**The migration is not applied.** `tsc` exits 0, 89 tests pass, `next build` compiles — and the build's static generation reports `The table public.Org does not exist in the current database`, which is the code and the schema agreeing while the database has not caught up. Run `npx prisma migrate deploy` before this is served, and take a backup first: the rename is reversible only by another rename.

## [PR-22] 2026-08-05 — Optional fields stop failing; shipping override is all-or-none; product weight persists

A product could not be created at all: the form reported "Enter a 6-digit PIN code" on a field its own section labels *Optional*. Three defects behind it, each a different way for the schema and the form to disagree.

**Optional fields that rejected their own blank value.** `shippingFromPincode` used the required `postalCodeSchema` while the UI said "Leave empty to use seller's default", so the default `""` failed the regex. Now `optionalPostalCodeSchema` — blank passes, a present value is still checked.

**Blank number inputs arriving as NaN.** `valueAsNumber` yields NaN for an untouched input, and `z.number().optional()` **rejects NaN** — verified against Zod 4 rather than assumed, because the last time an assumption about a library's output went untested it cost [PR-16](#pr-16-2026-08-05--fix-slug-retry-never-fired-under-the-pg-driver-adapter). So a blank `salePrice` blocked submission. Worse, it blocked it *silently*: `salePrice` rendered no error, so the form simply did nothing. Same for `lowStockThreshold` and the category form's `order`. A shared `optionalNumber` helper now treats every spelling of blank — `""`, `null`, `NaN` — as absent; JSON has no NaN, so the `null` case is what the server actually receives.

**Fields bound but never displayed.** `sku` had no error output — the single field the whole error-envelope effort existed to highlight ([ADR-0013](adr/0013-one-error-envelope-and-useserverform.md)), so a duplicate SKU still showed nothing on the field. Also `salePrice`, `lowStockThreshold`, `currency`, `order`. This is the third time this defect has shipped, so it is now a test rather than a review item: `tests/unit/form-error-display.test.ts` walks every `register()` in the source and fails on any field whose error is named nowhere in the file that binds it. Three fields are exempt, each with a stated reason.

**Shipping override is all-or-none.** A city without a pincode still rates from the seller's default, so a partial override is meaningless. The group refine blames *every* blank field in the group rather than just the first, so each one says why it is needed. Blank overrides now store as `NULL` via `blankToNull` instead of `''`, giving absence one spelling.

**Product weight now persists.** Both repository write sites enumerated their columns — correctly, to prevent mass assignment — and both omitted `weight`, so every product carried the schema default of 0.5 kg while `shipping.ts` rated on it. This was already recorded in [CONTRACTS.md](CONTRACTS.md) and specced as [product-weight-and-rates](specs/product-weight-and-rates/) R1; it was fixed here rather than deferred because this PR marks the field required in the UI, and demanding a value that goes nowhere is worse than not asking. **R1 and A1 only** — rate calculation, missing-weight visibility, and correcting the existing rows (R6) are still open, and every product created before this change still reads 0.5.

Two divergences closed the other way, where the form was stricter than the schema: `description` and `weight` are now required in the schema too, matching what the form has always enforced. Neither adds friction — the form's own rules already blocked both on create and on edit.

**Consequence to know about:** a product saved with a pincode override but no city (possible before this change, since only the pincode was required) will now fail the group rule when edited, and the admin must complete or clear all three.

Typecheck clean, `next build` compiles, **87 tests pass** (up from 68 — 16 new schema cases, 3 guard cases).

## [PR-21] 2026-08-05 — Error envelope adopted across routes and forms; rule recorded as ADR-0013

Extends [PR-20](#) from the product path to the rest of the application, and records the decision so it is not missed again.

**[ADR-0013](adr/0013-one-error-envelope-and-useserverform.md)** — one envelope, `toErrorResponse` on the server, `readApiError` on the client, `useServerForm` in every form, `DomainError` as the opt-in for a shown message. Recorded as an ADR because the rejected alternative — per-form `try/catch` with a toast — is the *conventional* approach and the one the codebase already used, so without a written decision it would be reintroduced by anyone acting reasonably.

Its **decision 7 is the answer to "how do we not miss this next time"**: touching a form or handler still on the old pattern means converting it in the same change. `/bb-review` now enforces that with a new section — flagging hand-rolled error bodies, `useForm(` where `useServerForm(` belongs, error handling *inside* a form, client wrappers reaching into a response body, and a modified file left on the old pattern.

**14 routes** wired to `toErrorResponse`: categories (×2), sellers (×2), addresses (×2), the four auth routes, provider connect, and the three product handlers from PR-20.

**Four new schemas**, each parsed by its route *and* used as its form's resolver: `categoryFormSchema` (with defaults, so the schema decides what "unset" means rather than the repository), and `forgotPasswordSchema` / `resetPasswordSchema` / `changePasswordSchema` — the last two attributing a mismatch to `confirmPassword`, the field a user would retype. The password rule itself is now declared once and shared by every flow that sets one.

Removing the routes' hand-rolled checks was part of this: five validation blocks in the auth routes were **unreachable** once the schema parsed first, and leaving them would have let two definitions of "valid password" drift.

**Five forms** now on `useServerForm`: product, category, seller, address, and change-password. The last was a `useState`-and-`fetch` form converted to react-hook-form, which proves the pattern covers that shape too.

**Duplicate presentation removed** from `useProducts`, `useCategoryForm`, and `useSellers` create/update — each had been toasting the same error the form hook now owns, so a single failure produced two messages. Delete and load paths keep their toasts, correctly: those are button and mount actions, not form submissions.

> **Caught during the conversion:** the change-password modal's inputs bound to `register` correctly but the file rendered `errors` **nowhere** — the hook would have set field errors that nothing displayed. Precisely the failure this work exists to remove, reintroduced by me while removing it. Per-field rendering added; worth noting that binding a field and *showing* its error are two separate steps and only the first is visible to the typechecker.

Lint errors **167 → 148**: deleting the `catch (err: any)` blocks removed 19 `no-explicit-any` violations as a side effect.

Verified: `tsc --noEmit` exit 0, 68 tests pass, `next build` compiles.

**Remaining, tracked in [BACKLOG.md](BACKLOG.md):** the signin, signup, forgot-password and reset-password pages and `ConnectProviderModal` are still `useState`-based. They already display the server's message correctly — they read `data.error`, the right key — so what they lack is field attribution. Value is genuine for signup (which of email/mobile collided) and reset-password (which rule failed), and marginal for the single-field forms. These are live, deployed auth flows with no test coverage, so converting them is deliberately left as its own change rather than folded into this one.

## [PR-20] 2026-08-05 — One error envelope, and forms that consume it without per-form code

A duplicate SKU produced `"Failed to create product"` with no field highlighted. Three separate failures caused that, and fixing only the first would have left the field unhighlighted.

**1. A key mismatch discarded the real message.** The route sent `{ error: "Unique constraint failed…" }`; `productsApiClient.createProduct` read `error.message` — undefined — and fell back to a generic string. `deleteProduct` and `updateProduct` in the same file read `error.error` correctly, so the file looked uniform. This is the third instance of a string-keyed cross-boundary contract failing silently in this codebase, after the Razorpay `notes` key and the encoded slug. None is visible to `tsc`.

**2. The product form rendered no server error at all** — only react-hook-form's client validation. The category form does this correctly, so the pattern existed and was simply not followed.

**3. Nothing mapped field errors onto fields.** `validateRequest` had emitted `details: [{ path, message }]` all along, and `sellerService` was its only consumer — which *concatenated* them into one string. No `setError` call anywhere in the codebase was react-hook-form's; every one was a `useState` setter for a general banner.

## What was built

**One envelope** (`src/lib/api-error.ts`, documented in [CONTRACTS.md](CONTRACTS.md)) carrying `error` plus optional field-attributed `details`. A Zod failure and a database constraint violation arrive identically, so a form maps details to fields without knowing which produced it.

**`toErrorResponse`** with six branches, replacing hand-rolled bodies: Zod → 400 with per-field details; `DomainError` → its own status and message; unique violation → 409 attributed to the offending column; other constraint failures (stale foreign key, value too long, missing required) → 409 attributed to the column; Prisma not-found → 404; **unknown → logged and reported generically.** Only that last branch discards its message.

**`DomainError` / `NotFoundError` / `ConflictError` / `ForbiddenError`** — how domain code opts into being shown. Anything that has not opted in is an internal fault, which is the safe default: a raw Prisma message can name columns.

**`useServerForm`** — react-hook-form with `zodResolver` and the error contract already wired. A form calls it and gets client validation from the same schema the server enforces, field-attributed server errors landing on their fields, and a general error for anything unattributable. **Forms write no error-handling code.** There is no form *renderer* in this codebase — three hand-written per-entity forms sharing field primitives — so the reusable unit is the hook, which is the better fit anyway since the layouts differ and the error semantics do not.

**`productFormSchema`** — one declaration used by the route (server authority, Invariant 4, replacing a cast) and by the form's resolver. It reuses `postalCodeSchema` for the origin pincode and the `ProductFlag` enum for flags, and adds a cross-field rule neither side could enforce alone: sale price below regular price, attributed to `salePrice`.

## The 128 throw sites

Converted **112** to typed errors by classifying their own message text — 68 `DomainError`, 34 `NotFoundError`, 9 `ConflictError`, 1 `ForbiddenError` — across 27 files, then read the diff.

**16 deliberately stayed internal**, on a principle worth stating: *if the fix is in config or code, it is internal; if the fix is in what the user did or the state they control, it is a domain error.* So `"Razorpay webhook secret not configured"` and `"Shipping module initialization failed"` stay generic, while `"Cannot delete the only address"` now reaches the user.

Seven of those internal ones were `"Failed to save cart to database"`-style wrappers sitting in catch blocks and **discarding the real cause** — the same anti-pattern that cost a session's debugging on the slug bug. They now pass `{ cause: error }`.

Also removed: the duplicate presentation in `useProducts`, which double-toasted the same error and would have competed with the hook; and its hand-written checks for images and seller, now the schema's job.

> **Self-correction:** creating `NotFoundError` in `server/shared/domain-error.ts` duplicated one I had added to `products.dal.ts` in PR-13 — precisely the [ADR-0003](adr/0003-one-repository-per-aggregate.md) violation. Consolidated to the shared one, which the DAL now re-exports.

10 tests added (68 total, 5 files), covering the key the server actually sends, detail preservation, the legacy `message` fallback, a non-JSON body, and that unplaceable details are returned rather than dropped.

Verified: `tsc --noEmit` exit 0, 68 tests pass, `next build` compiles.

**Not done:** the other ~8 casting handlers and the category/seller forms still hand-roll. The pattern is now available for them; adopting it is per-form and incremental.

## [PR-19] 2026-08-05 — Infrastructure recorded in OPERATIONS.md

The hosting and vendor split was known only in conversation. Recorded in [OPERATIONS.md](OPERATIONS.md) § Infrastructure, verified from `.vercel/project.json`, `.env`, and which variables the code actually reads rather than from what is provisioned.

Vercel hosting (project `bhendi-bazaar`, deploys from `main`), domain at GoDaddy with DNS pointed at Vercel, Upstash Redis and Vercel Blob via Vercel integrations, plus Razorpay, Resend, Shiprocket and Google OAuth.

**Two corrections to the assumed picture, both worth knowing operationally:**

- **The database is Prisma Postgres (`db.prisma.io`), not Vercel Postgres/Neon** — provisioned through the Vercel marketplace, which is why it reads as "connected via Vercel". Different dashboard, different connection limits, its own backup story.
- **Prisma Accelerate is provisioned but bypassed.** `PRISMA_DATABASE_URL` holds an Accelerate URL that **nothing reads**; the app connects directly through `DATABASE_URL`. Accelerate pools connections and caches queries — precisely the pressure a serverless deployment puts on one Postgres instance, and a better answer to it than the `max` tuning in [PR-13](#). Added to [BACKLOG.md](BACKLOG.md).

Also recorded: of the connection-string variables, only `DATABASE_URL` and `KV_REST_API_URL` are read. `POSTGRES_URL`, `DB_URL`, `REDIS_URL`, `KV_URL` and `PRISMA_DATABASE_URL` are provisioning leftovers — pruning them is now a backlog item, since multiple live connection strings in one `.env` is the hazard [Invariant 7](../CLAUDE.md) guards against.

The PR-18 follow-up "deploy PR-15 to production" is closed — the code was merged to `main` and deployed, so the live admin form now generates slugs server-side.

## [PR-18] 2026-08-05 — Production slug repair (data change, no code)

Two of the three products on production had slugs containing spaces and capitals, so their pages served an error instead of the product. Repaired directly against the production database.

| id | name | slug before | slug after |
|---|---|---|---|
| `cms8ttmrv000004lgiezties3` | Cream Embroidered Rida | `"Cream Rida"` | `cream-rida` |
| `cms8uf949000204lg9dd6t053` | BLUE RIDA | `"Blue Rida"` | `blue-rida` |

**Derived from the existing slug, not the product name** — a deliberate choice. The name would have produced `cream-embroidered-rida`; slugifying the existing slug changes only the characters that break URL encoding and leaves the intended wording alone. For a repair that is the conservative option; for *new* products the name-derived rule from [PR-15](#) applies.

**Altering the value was strongly preferable to re-uploading**, on two pieces of schema evidence: nothing references a product by slug (every relation uses `id`, slug is only `@unique` + `@@index`), and `Review.productId` carries `onDelete: Cascade` — so delete-and-recreate would have silently destroyed every review on those products.

**There was no working URL to preserve.** Verified before and after: `/product/Cream%20Rida` served a 20 KB error page containing `404` and no product content, while `/product/cream-rida` now serves 53 KB including the product name and add-to-cart. The change repaired a broken URL rather than moving a working one.

Procedure: read-only survey first, showing the proposed mapping; then single-row updates with an explicit timeout, printing before/after per row; then re-verification that all production slugs satisfy `SLUG_PATTERN`. Categories were already clean (4, all valid) and there were no empty-string SKUs.

**Follow-ups this exposed:**
- Production runs the deployed build, which predates [PR-15](#). Until it is deployed, the admin form there still accepts a typed slug and can reintroduce the problem.
- The old URL returns **HTTP 200** with an error page — a soft 404. `notFound()` on `NotFoundError` would return a real 404, which matters for how search engines treat it. Recorded in [BACKLOG.md](BACKLOG.md).
- No redirect exists from the old paths. They never worked, so nothing is lost, but a canonical-redirect fallback would rescue any link shared before today.

> Credentials were pasted into a chat transcript to perform this repair and must be rotated — the Postgres connection string and the Accelerate API key both grant full data access. Reading `.env` is sufficient for local work; production credentials should be supplied by running the script yourself rather than by sharing them.

## [PR-17] 2026-08-05 — Blank optional-unique values stored as NULL, not empty string

A second, independent constraint violation, exposed once the slug retry in [PR-16](#) started working: creating a product with a blank SKU failed with `Unique constraint failed on the fields: (sku)`.

**Cause:** `Product.sku` is `String? @unique`. Postgres permits any number of `NULL`s in a unique column but only one `''` — and `''` is a value, not an absence. One product already held `sku: ""` from a blank form field, so the *second* blank-SKU product collided. Nothing was wrong with the SKU logic; the empty string was being treated as data.

The slug retry correctly did **not** swallow this. `isUniqueViolation(error, "slug")` returns false for a `sku` collision, exactly as its test asserts, so the error surfaced instead of being retried forever against the wrong column. The narrow check earned its keep here.

**Fix:** `server/shared/blankToNull()` normalises `undefined`, `null`, `""`, and whitespace-only input to `null`, and trims otherwise. Applied to `sku` on both create and update.

**Scope checked, not assumed.** Three nullable-unique columns share this hazard — `Product.sku`, `User.email`, `User.mobile`. Only `sku` held an empty string; the user columns were already storing proper `NULL`s (1 null mobile, 0 empty strings), so the signup path is correct today. The helper documents the rule for whoever adds the next such column.

**Data repaired:** the one `sku: ""` row rewritten to `NULL`. Verified end to end afterwards — three products created with the same name *and* a blank SKU now yield `blank-sku-probe`, `-2`, `-3`, each with `sku = NULL`.

> **Operational note:** the first `updateMany` against the hosted database timed out and had to be retried as a single-row `update`. Reads succeeded throughout, so the connection was fine. Worth remembering that `db.prisma.io` can stall a write; scripts touching it should carry an explicit timeout rather than hanging.

7 tests added (58 total, 4 files).

Verified: `tsc --noEmit` exit 0, 58 tests pass, `next build` compiles.

## [PR-16] 2026-08-05 — Fix: slug retry never fired under the pg driver adapter

Creating two products with the same name failed with a raw `Unique constraint failed on the fields: (slug)` instead of appending a suffix. [PR-15](#)'s retry loop was correct; `isUniqueViolation` was not, so the loop never took its retry branch.

**Cause: the error shape differs by driver.** Without a driver adapter Prisma populates `meta.target`. With `@prisma/adapter-pg` that is **undefined**, and the offending columns appear at `meta.driverAdapterError.cause.constraint.fields`. Observed directly by provoking a collision:

```
code                                             "P2002"
meta.target                                      undefined
meta.driverAdapterError.cause.constraint.fields  ["slug"]
meta.driverAdapterError.cause.originalCode       "23505"
```

`isUniqueViolation` checked only `meta.target`, returned false for every real collision, and the loop rethrew on the first attempt. It now checks both shapes.

**Why the tests missed it — the part worth remembering.** PR-15 shipped four passing assertions for `isUniqueViolation`, built from `{ code: "P2002", meta: { target: ["slug"] } }`. That shape was **my assumption about Prisma, not Prisma's output**, so the tests confirmed the function matched the fixture and proved nothing about production. A test written from a guess validates the guess.

The test now embeds the shape captured verbatim from a real collision, and asserts `meta.target` is undefined in it — so the reason the original was wrong is itself pinned. Verified end to end as well: three products created with one name yield `duplicate-name-probe`, `-2`, `-3`.

**Also worth knowing operationally:** each retry logs a Prisma error line, because `log: ["error", "warn"]` is configured and a collision genuinely is a database error. Duplicate-named products will therefore produce `Unique constraint failed` in the logs on a successful create. Harmless, but it will look like a bug to whoever reads the logs next.

Verified: `tsc --noEmit` exit 0, 51 tests pass, `next build` compiles, duplicate-name creation suffixes correctly.

## [PR-15] 2026-08-05 — Slugs are server-generated, unique, and frozen

Fixes the cause identified in [PR-14](#). Slugs were taken verbatim from a request body, so a product named `product test 001` was stored with that exact string as its slug and became unreachable: the URL must percent-encode the spaces, and the route param arrives still encoded.

**`server/shared/slug.ts`** is now the single declaration — `SLUG_PATTERN`, `slugify()`, `slugCandidates()`, and `isUniqueViolation()`. `slugify` normalises Unicode (so `Café Crème` → `cafe-creme`), lowercases, collapses every other character run to one hyphen, and trims. A test asserts the invariant that matters: **`encodeURIComponent(slugify(x)) === slugify(x)`** for every input — a generated slug never needs encoding, so it cannot reproduce this bug.

**Slug is now a server-owned field**, added to that list in [`CLAUDE.md`](../CLAUDE.md) alongside `rating` and `paymentStatus`. It was removed from `CreateCategoryInput`, `UpdateCategoryInput`, the server and client `ProductFormInput`, both admin forms' `defaultValues`, and both slug inputs. Disabling the input would not have been enough — a disabled field still submits a value a crafted request can override, whereas a field the type does not contain cannot be supplied at all. The typechecker then found all nine remaining assumptions for free.

**Uniqueness is arbitrated by the database, not by a prior query.** `createProduct` and `createCategory` walk `slugCandidates(name)` — `black-abaya`, `black-abaya-2`, … — attempting the insert and advancing only on a `P2002` violation for `slug`, bounded at 25 attempts. Querying for availability first is the read-then-write race [ADR-0007](adr/0007-conditional-stock-decrement.md) rules out for stock, and the same mistake the data-layer audit found in `generateOrderCode`. `isUniqueViolation` checks the error code *and* the target column, so a collision on `sku` is not mistaken for one on `slug` and retried forever.

**Slugs are frozen after creation** (decided explicitly): changing one 404s every existing link. `updateProduct` and `updateCategory` no longer accept it — and while enumerating their fields to exclude it, both stopped spreading the request body, which closes the mass-assignment hole the route audit flagged. Two rules satisfied by one change.

**Data repaired:** the one invalid slug (`"product test 001"` → `"product-test-001"`) was rewritten using the same candidate walk, checked against existing slugs. All 15 products and every category now satisfy `SLUG_PATTERN`. The product renders.

Also removed: the category form's client-side slug generation with its `slugManuallyEdited` flag, and the vestigial `onSlugManualEdit` prop on the product form — redundant now the server owns the value.

31 tests added (50 total, 3 files).

> **Correcting something I said earlier in the session:** I told the user auto-slug generation "was never built", on the evidence that `generateSlug` appears only in an archived doc. That was right about *products* and wrong about *categories*, whose form did implement it. The archived doc described it as a product feature, which is where the confusion came from — and is still a fair illustration of aspirational documentation costing debugging time.

> **Not addressed:** the old URL for the renamed product 404s. Acceptable for a test product; recorded in [BACKLOG.md](BACKLOG.md) because a real slug change would need a redirect or a slug-history table.

Verified: `tsc --noEmit` exit 0, 50 tests pass, `next build` compiles, and `/product/product-test-001` renders.

## [PR-14] 2026-08-05 — Correction to PR-13: the pool was not the cause

[PR-13](#) attributed the product page's `Failed to fetch product` to connection exhaustion from leaked `pg` pools. **That was wrong.** Appending rather than editing, per the append-only rule — the original entry records what was believed at the time, and the reasoning error is more useful preserved than erased.

**The actual cause:** Next hands the dynamic route param to the page **still percent-encoded**. A product stored with `slug: "product test 001"` is requested as `/product/product%20test%20001`, and the page looks up the literal string `product%20test%20001`, which matches nothing. Slugs made only of `[a-z0-9-]` need no encoding, so every other product worked — which is exactly why the failure looked data-specific rather than systemic.

**How the wrong conclusion was reached, since the method matters more than the mistake:** the DAL call succeeded when invoked directly from a script, so the code path was proven sound and attention moved to the runtime. The script passed the *already-decoded* string — the one thing the HTTP path does differently. The tell that should have redirected it sooner: the failure was **consistent 5/5** while another product loaded fine, whereas connection exhaustion is intermittent and would have hit both.

**Both PR-13 changes are kept, on their own merits:**

- **The pool caching stands.** `new Pool()` at module scope with only the client cached on `globalThis` does leak a pool per hot reload, independently of this bug — it was already recorded in the original data-layer audit. The `max` and timeout settings also address Vercel's per-instance connection limits.
- **The error-cause changes stand, and are the reason this was solvable.** Making the message name the value it searched for (`No product with slug "product%20test%20001"`) is what exposed the encoding. The prior `catch` rethrew a fixed string and made a missing row, a mapping failure, and a connection error indistinguishable.

The real fix — server-generated slugs — follows in the next entry.

## [PR-13] 2026-08-05 — Prisma pool cached across hot reloads; DAL stops swallowing error causes

**Symptom:** the product page failed with `Error: Failed to fetch product` from `products.dal.ts`, for a product that exists.

**Not the cause:** the row is present (`slug: "product test 001"`), both its relations resolve (`category: new-category`, `seller: SEL-001`), `PRODUCT_INCLUDE` covers every field `mapProduct` reads, and the page correctly awaits `params`. Calling `productsDAL.getProductBySlug` directly from a script succeeds for that exact slug. The code path is sound.

**Cause:** `server/shared/prisma.ts` cached the `PrismaClient` on `globalThis` but constructed `new Pool(...)` at module scope, so every hot reload built a fresh pool whose connections were never released while the cached client kept using the original. Against `db.prisma.io` — hosted Postgres with a low connection cap — a long editing session exhausts the limit, and queries begin failing for reasons unrelated to the query.

The pool and adapter are now cached alongside the client, with `max` lowered to 3 in development and `connectionTimeoutMillis` set so saturation fails fast instead of hanging. **A restart is required for this to take effect**, since a running server holds the old module state.

**The reason this was hard to see is the more important fix.** Every method in `products.dal.ts` caught all errors and rethrew a fixed string, discarding the cause — and `getProductBySlug` even caught its own `"Product not found"` and relabelled it `"Failed to fetch product"`. A connection error, a mapping error, and a genuinely missing row were indistinguishable. Now:

- failures rethrow with `{ cause: error }`, so the original is preserved;
- a missing row throws `NotFoundError`, which is re-thrown unchanged rather than swallowed, so callers can render a 404 instead of a 500.

This is the "fail loudly" rule from [ADR-0005](adr/0005-payment-state-server-only.md) applied to a read path: an error that reports the wrong thing costs more than one that reports nothing.

Follow-ups not done here, recorded in [BACKLOG.md](BACKLOG.md): the same swallowing pattern exists in the other DAL modules and in `product.repository.ts` (`catch → throw new Error("Product not found")`, which also mislabels query failures as absence); the product page could call `notFound()` on `NotFoundError`; and `"product test 001"` shows the admin product form does not slugify — it stored a name with spaces as a slug.

Verified: `tsc --noEmit` exit 0, tests exit 0, `next build` compiles.

## [PR-12] 2026-08-04 — Dead route handlers and orphan API-client methods removed

Continues PR-10. A pattern audit traced every handler to its callers; this removes what nothing reaches. **52 → 46 route files, 58 surviving methods.**

**Six whole files deleted** (every method dead): `products` GET, `products/[slug]` GET, `categories/[slug]` GET, `orders/[id]/fulfill` POST, `admin/dashboard/revenue` GET, `admin/orders/bulk-update` POST.

**Seven dead methods removed from files whose siblings are live** — this distinction mattered more than anything else in the change. The audit described "12 dead handlers", but most were single methods inside files that also hold live ones. Deleting the files would have removed `PATCH /api/orders/[id]` (the payment write path) and the `addresses/[id]` handlers repaired in PR-11:

| File | Removed | Kept |
|---|---|---|
| `orders/[id]` | GET | **PATCH** |
| `orders` | POST | **GET** |
| `admin/products` | GET | **POST** |
| `admin/sellers/[id]` | GET | **PUT, DELETE** |
| `admin/reviews/[id]` | GET | **PATCH, DELETE** |
| `admin/users/[id]` | GET | **PATCH** |
| `addresses/[id]` | GET | **PATCH, DELETE** |

**Nine orphan `*ApiClient` methods removed** — `getCategoryBySlug`, `getOrderById`, `fulfillOrder`, `createOrder`, `getAddressById`, `getReviewById`, `getUserById`, `getRevenueChart`, `bulkUpdateStatus` — plus `processPayment` (108 lines), a dead checkout path exported from `useCheckoutPayment` but never destructured by the container, which is what kept `orderApiClient.createOrder` and `POST /api/orders` alive.

**Removing `POST /api/orders` also retires attack surface.** It accepted `paymentStatus` in its body and created orders with an unguarded stock decrement, reachable over HTTP with no UI caller — the same shape as `orders/[id]/shipping` in PR-10.

## Method notes

Two mistakes worth recording, both caught by `tsc`:

**Receiver identity matters more than method name.** `getCategoryBySlug` and `getOrderById` each exist on *both* a DAL and an ApiClient. An unqualified grep showed both as "used" — the DAL versions are live, the ApiClient versions were dead. Every candidate had to be checked receiver-qualified (`categoryApiClient.getCategoryBySlug`), not by bare method name. This is the duplicate-name problem from [ADR-0003](adr/0003-one-repository-per-aggregate.md) actively obstructing analysis.

**A substring path match is not a caller.** `/api/products` appeared "referenced" because `/api/products/check-stock` contains it. Extracting exact `fetch()` targets showed the only `products` fetch in the codebase is `check-stock`.

Separately, the script used to remove functions brace-matched the `{` of a destructured `{ params }` parameter instead of the function body, cutting six signatures and leaving headless bodies. `tsc` caught all six immediately; repairing in place was necessary rather than reverting, because several of these files were renamed in PR-08 and so do not exist under their current names in `HEAD`. Worth remembering that automated code removal needs the typechecker run after *every* batch, not at the end.

Verified: `tsc --noEmit` exit 0, tests exit 0, `next build` compiles, and all six deleted paths are absent from the build manifest.

## [PR-11] 2026-08-04 — `addresses/[id]` handler signatures fixed (address delete was broken)

All three handlers in `src/app/api/addresses/[id]/route.ts` were wrong, in two different ways, and `tsc` was clean throughout because the file declared its own incorrect types.

**`GET` and `DELETE` took `{ params }` as their first argument.** Next passes `(request, context)`, so the destructure was reading `params` off the `Request` object — always `undefined`, leaving `addressId` undefined and the operation targeting nothing. `DELETE` has a live caller (`profile/page.tsx` → `useAddressManager.deleteAddress` → `addressApiClient.deleteAddress`), so **deleting a saved address has been broken in production**.

**All three typed `params` as a plain object and read it without awaiting.** In Next 15+ `params` is a `Promise`, so `PATCH` — which had the argument order right — was also resolving `addressId` to `undefined` and silently updating nothing.

Fixed by matching the pattern every other dynamic handler already uses: a shared `RouteParams` type with `params: Promise<{ id: string }>`, `NextRequest` as the first argument, and `await params`. This file was the only place in the codebase that got it wrong.

Worth noting what did *not* catch this: the typechecker (the wrong types were locally declared and self-consistent), the build (route handlers are not type-checked against the framework's expected signature), and the test suite (`tests/` held only the harness and pincode specs). It surfaced from a pattern audit, not from tooling — which is an argument for the route-handler tests in [TESTING.md](TESTING.md)'s ownership-check target.

Also corrected in [ARCHITECTURE.md](ARCHITECTURE.md): "Six route handlers use Prisma directly" → **five**, verified by grep. The sixth was `orders/[id]/shipping`, deleted in PR-10.

Verified: `tsc --noEmit` exit 0, tests exit 0, `next build` compiles.

## [PR-10] 2026-08-04 — Four unreachable route handlers deleted

A sweep mapping every route handler to its callers found four with no reference anywhere in the repo. 56 → 52.

**Three were left behind by a migration that already happened.** The storefront moved to Server Component reads through the DAL, and the equivalent `/api` read routes were never removed:

| Deleted route | Superseded by |
|---|---|
| `/api/products/featured` | `productsDAL.getHeroProducts` — used at `app/(main)/page.tsx:11` |
| `/api/products/offers` | `productsDAL.getOfferProducts` — used at `app/(main)/page.tsx:12` |
| `/api/products/[slug]/similar` | `productsDAL.getSimilarProducts` — used at `app/(main)/product/[slug]/page.tsx:18` |

Same query, two entry points, one unreachable. The underlying service methods stay — the DAL calls them.

**The fourth retires a security finding at no cost.** `/api/orders/[id]/shipping` had no session check of any kind and returned tracking numbers, seller origin pincodes, and per-shipment costs for any order id. It was also unreferenced, so deleting it closes the exposure without writing a fix or preserving any behaviour.

Also confirmed by the same sweep, and worth recording because it is the expensive mistake this codebase does **not** make: **no server-side code fetches its own API routes.** Server Components read through the DAL, which calls domain services directly. There is no self-HTTP hop anywhere.

> **Method note:** the first pass reported *nine* dead routes. Five were false positives, reached via `${this.baseUrl}/segment` concatenation that a literal path grep cannot see — including `/api/payments/create-order` and `/api/payments/verify`, which checkout depends on. Each candidate was verified against its client wrapper before deletion. A path-literal grep is not sufficient evidence that a route is unused.

Verified: `tsc --noEmit` exit 0, tests exit 0, `next build` compiles, and the four paths are absent from the build manifest.

## [PR-09] 2026-08-04 — One PIN code rule, enforced server-side, surfaced inline

PR-08 found `isValidPincode` declared twice with different rules. Searching for the pattern rather than the function name found **eleven** declarations across the codebase, in three flavours:

| Where | Rule | |
|---|---|---|
| `AddressFields.tsx` — the form users actually type into | `required` only | any text passed |
| `address.schema.ts`, `common.schemas.ts`, `rates/route.ts`, `GuestAddress.tsx` | `/^\d{6}$/` | accepted `000000` |
| `shipping/utils/validators.ts`, `identity/address.service.ts`, `checkout/order.service.ts` ×2 | `/^\d{6}$/`, one on whitespace-stripped input | accepted `" 123456 "` |
| `src/utils/shipping.ts` | `/^[1-9][0-9]{5}$/` — **correct, and dead code** | no callers |

So the only correct rule was the one nothing called, and the field a customer types into validated nothing but emptiness.

**Now one declaration:** `server/shared/pincode.ts` exports `PINCODE_PATTERN`, `PINCODE_MESSAGE`, and `isValidPincode`. The rule is `/^[1-9][0-9]{5}$/` — no Indian PIN code begins with 0. All ten other sites import it; the Zod schemas go through `postalCodeSchema`, which now wraps the canonical pattern.

It lives in `server/shared/` rather than `src/lib/validation/` so that server domains can use it without importing from `src/` — `src/ → server/` is the established direction (route handlers already import server domains), whereas the reverse is the inversion being unwound.

**The server is the gate; the client shows the same message inline.** `validateRequest` already returned field-level errors (`details: [{ path, message }]`), so the server half needed no work — only a rule worth enforcing. `AddressFields` now carries the identical pattern and message as a `register()` rule, so a customer gets immediate inline feedback in the correct format and the server independently rejects anything that slips past. One rule, two enforcement points, no divergence possible.

Added `tests/unit/pincode.test.ts` — 16 cases pinning the boundaries, including the three leading-zero inputs the old server rule accepted. First real test in the suite beyond the harness smoke check; 19 tests passing.

Verified: `tsc --noEmit` exit 0, tests exit 0, `next build` compiles all 74 routes.

> **Note on existing data:** this tightens what the server accepts. `Address` rows stored under the old lax rule may hold PIN codes with a leading zero, which will now fail validation on **update**. Reads are unaffected. Worth a query before this ships widely.

## [PR-08] 2026-08-04 — Duplicate runtime symbol names resolved

Implements the naming half of [ADR-0003](adr/0003-one-repository-per-aggregate.md): a class or singleton name appears once in the repo, and where a client `fetch` wrapper mirrors a server service, the client one is named for what it is. Runtime duplicates: **14 → 2**.

**Two were dead code, deleted rather than renamed** — removing three collisions for free:
- `src/services/productService.ts` (0 importers; duplicated `productService` and `ProductService`)
- `src/lib/encryption.ts` (0 importers; duplicated `encryptionService`, a near-verbatim copy of the shipping one)

**Ten client services renamed to `*ApiClient`**, with their files renamed to match so path and export never disagree: `orderApiClient`, `cartApiClient`, `categoryApiClient`, `addressApiClient`, and the admin `cart`/`category`/`dashboard`/`order`/`review`/`user` clients. Also `ProductsService` → `ProductsApiClient` and `productsService` → `productsApiClient` in `src/admin/products/`.

**Three more collisions broken:** `productsRepository`/`ProductsRepository` in `server/catalog/` (the admin one prefixed `Admin*`; *merging* the two repositories is behaviour-affecting and stays in [BACKLOG.md](BACKLOG.md)), and `categoriesDAL`/`productsDAL` in `src/data-access-layer/` — the pair whose two declarations returned incompatible types, so correctness depended on which path a caller typed.

## ⚠️ `isValidPincode` has two different implementations

Found while resolving the names, and **not fixed** — it needs a decision, not a rename:

| | Pattern | Accepts |
|---|---|---|
| `server/shipping/utils/validators.ts` | `/^\d{6}$/` on whitespace-stripped input | `000000`, `" 123456 "` |
| `src/utils/shipping.ts` | `/^[1-9][0-9]{5}$/` | neither |

The client and server disagree on what a valid pincode is, and the **server — the authority — is the laxer of the two**, so a pincode the UI rejects can still be persisted through the API. Indian pincodes never begin with 0, which makes the client's rule the correct one.

This is the drift [ADR-0003](adr/0003-one-repository-per-aggregate.md) predicted, now demonstrated: two declarations of one rule, silently diverged. Tightening the server rule is a validation change that could reject addresses already in the database, so it needs a data check first — tracked in [BACKLOG.md](BACKLOG.md).

`formatCurrency` is also still duplicated but is behaviourally identical (the client signature carries an unused `currency` param defaulting to `"INR"`); left alone.

**26 type/interface duplicates remain untouched** — `CartItem`, `CartTotals`, `ProductFlag`, `CreateOrderInput` and friends. Those are the contract-consolidation work in [CONTRACTS.md](CONTRACTS.md), behaviour-affecting and tied to [product-weight-and-rates](specs/product-weight-and-rates/). Renaming them would hide the problem rather than fix it.

Verified: `tsc --noEmit` exit 0, tests exit 0, `next build` compiles all 74 routes.

## [PR-07] 2026-08-04 — One source of truth for the app's origin

Four things claimed to know the app's origin: `NEXT_PUBLIC_APP_URL`, a hardcoded constant in `src/lib/config.ts`, `appUrl()` on the server, and `window.location.origin`.

**`APP_URL` deleted from `src/lib/config.ts`.** It was `"https://bhendibazaar.com"`, hardcoded, with zero importers. Dead weight would have been harmless; this was a trap — the next person wanting an origin reaches for the obvious constant in the config file and silently gets **production in every environment**, so local dev would have linked to the live site.

**Two client call sites converted to relative paths**, because they never needed an origin:
- `ProductsView.tsx` — an absolute URL in a `<Link href>`. Relative works, including with `target="_blank"`.
- `services/admin/dashboardService.ts` — dropped `baseUrl` and made the three fetches relative, matching every other client service in that directory (`orderService.ts`, `addressService.ts` were already relative). Safe because its only caller is `admin/page.tsx`, which is `"use client"` and therefore always same-origin.

**`order-client.tsx` left as it was** — `window.location.origin` with an env fallback. It builds a share link, genuinely needs an absolute URL, and the runtime origin is always correct. That was already the right pattern.

Rule added to [`CLAUDE.md`](../CLAUDE.md): never hardcode our own origin. Relative in the browser; `window.location.origin` where the browser genuinely needs it absolute; `appUrl()` on the server. `src/lib/config.ts` holds static brand facts only — an origin is environment-specific or runtime-known, so it is never a constant.

Noted in passing, not fixed: `adminDashboardService` is exported from **both** `src/services/admin/dashboardService.ts` and `@server/analytics/dashboard.service`. One name, two live modules, resolved by import path — the duplicate-name problem in [ADR-0003](adr/0003-one-repository-per-aggregate.md). Renaming the client one is a follow-up.

Verified: `tsc --noEmit` exit 0, tests exit 0, `next build` compiles all 74 routes.

## [PR-06] 2026-08-04 — Comment discipline: rule added, existing comments trimmed

Added to [`CLAUDE.md`](../CLAUDE.md) Development Principles: **comments explain why, not what** — one or two lines, only where the reason is not recoverable from the code. A paragraph belongs in an ADR or a spec, linked from a short line. No file-header essays, no restating the signature, no narrating the next line. `/bb-review` now flags violations.

The rule exists because PR-03 to PR-05 introduced exactly the problem it forbids. `server/shared/app-url.ts` carried a 12-line header for a 10-line function — over half the file — restating reasoning that already lives in [OPERATIONS.md](OPERATIONS.md). Trimmed nine files:

| File | Comment lines before → after |
|---|---|
| `server/shared/app-url.ts` | 14 → 4 |
| `tests/setup.ts` | 11 → 4 |
| `tests/harness.test.ts` | 9 → 2 |
| `vitest.config.ts` | 5 → 1 |
| `.github/workflows/ci.yml` | 5 → 3 |
| `product-gallery.tsx`, `productsList/index.tsx`, `ConnectProviderModal.tsx`, `EmailVerificationBanner.tsx` | 4–5 each → 1–2 |

The two `eslint-disable` comments in `EmailVerificationBanner.tsx` keep their inline `--` reasons; a suppression without a stated cause is worse than none. Lint unchanged at 167 errors, all the one tracked rule.

Worth noting the general shape of the mistake: a documentation system with somewhere for reasoning to live makes long code comments *less* justified, not more. The comment should point at the ADR, not duplicate it.

## [PR-05] 2026-08-04 — Dev port pinned; outbound links decoupled from `NEXTAUTH_URL`

**Dev port pinned.** `npm run dev` is now `next dev -p 3000`. Unpinned, `next dev` silently falls back to 3001 when 3000 is occupied, and the app then serves from one port while both origin variables claim another — breaking Google OAuth (which matches its registered redirect URI exactly) and putting an unreachable host into every verification, reset, and order-tracking link generated in that session. Pinning makes a busy port fail at startup instead of surfacing later in customer email.

**Outbound links no longer read `NEXTAUTH_URL`.** Three call sites — the verification and password-reset links in `notifications/email.service.ts`, and the tracking link in `notifications/templates/purchaseConfirmationEmail.ts` — built URLs from `NEXTAUTH_URL`. That is NextAuth's own configuration, so two variables were authoritative for one fact: harmless on localhost where they coincide, wrong the moment they diverge, which they must on Vercel previews.

Introduced `server/shared/app-url.ts` (`appUrl()`) rather than swapping the variable inline. It resolves `NEXT_PUBLIC_APP_URL`, falls back to `NEXTAUTH_URL`, strips a trailing slash, and **throws when neither is set**. The throw is the point: `validateEnv()` is defined but never called, so nothing else catches a missing origin, and the failure mode without it is mailing `undefined/reset-password?token=…` to a real customer. A failed send is recoverable; a wrong link in an inbox is not.

`NEXT_PUBLIC_APP_URL` is consequently reclassified **required** in [OPERATIONS.md](OPERATIONS.md). `NEXTAUTH_URL` now appears only in the env required-list and as that fallback.

**Documented in [OPERATIONS.md](OPERATIONS.md):** why the two origin variables have separate jobs, why the port is a contract with Google rather than a preference, that Vercel preview deployments need `NEXTAUTH_URL` derived from `VERCEL_URL` (and that NextAuth v5 removes the variable), and a four-step local webhook tunnel procedure — including that `NEXT_PUBLIC_*` values are inlined at build time, so changing them needs a dev-server restart. Added ahead of [payment-confirmation](specs/payment-confirmation/), which needs a reachable webhook and would otherwise hit all of this mid-debug.

Verified: `tsc --noEmit` exit 0, tests exit 0, `next build` compiles all 74 routes.

## [PR-04] 2026-08-04 — Typecheck and tests become blocking CI gates; Codecov step removed

`continue-on-error: true` removed from the **typecheck** and **test** steps, which now block the pipeline. Both verified locally with the exact commands CI runs. It stays on the linter, which still reports 167 `@typescript-eslint/no-explicit-any` errors; those are cleared on their own schedule, trust-boundary code first, per [TESTING.md](TESTING.md).

**Codecov step deleted.** It uploaded `./coverage/coverage-final.json`, a file this project never produced — the configured coverage reporters are `text`, `html`, and `json-summary`, and only the unconfigured `json` reporter emits `coverage-final.json`. The step therefore uploaded nothing and reported success, hidden by its two guards (`fail_ci_if_error: false` and `continue-on-error: true`). The same shape of problem as the suppressed gates: a step that looks like it works and does nothing.

Removed rather than repaired, because coverage-trend reporting has little value while [TESTING.md](TESTING.md) deliberately rejects a global coverage percentage in favour of per-layer targets — a trend line on a number we have decided not to manage by is noise. `--coverage` also dropped from the CI test command, since nothing now consumes the report; it remains available locally via `npx vitest run --coverage`.

**The 10 non-`any` lint errors fixed.** Five were unescaped entities in JSX — pure text escaping. The other five were `react-hooks/set-state-in-effect`, the render-loop shape, and three were genuine fixes:

- `product-gallery.tsx` — zoom reset moved out of an effect on `activeIndex` and into a `goToIndex` helper called by the interactions that change the image. It takes an updater function rather than a value, because the keyboard-navigation effect has an empty dependency array and a value-based version would have captured a stale index.
- `productsList/index.tsx` and `ConnectProviderModal.tsx` — both copied incoming props into state and re-synced via an effect. Replaced with React's documented adjust-state-during-render comparison, which re-renders immediately without committing the stale value, so no cascading render occurs. The modal's reset is driven by the `open` prop rather than by `onClose`, so it still fires if the parent closes without calling the handler.

**Two were suppressed, not fixed** — both effects in `EmailVerificationBanner.tsx`. One reflects dismissal state held in `sessionStorage`; the other reacts to the URL and rewrites it with `history.replaceState`. Both synchronise with external systems, which is what effects are for; the rule cannot distinguish that from deriving state from props. Each carries an `eslint-disable-next-line` with its reason stated inline. A lazy `useState` initialiser was rejected for the first: it would read `sessionStorage` during SSR and hydrate mismatched.

Also removed two `useEffect` imports left unused by the above.

Verified: `tsc --noEmit` exit 0, `npm test -- --run` exit 0 (3 passed), `next build` compiles all 74 routes. Lint errors 177 → 167, all remaining being the one tracked rule.

## [PR-03] 2026-08-04 — Test harness repaired; placeholder moved into the shipping domain

**Test harness.** `vitest run` could not execute a single test. `vitest.config.ts` aliased only `@` → `./src`, with no `@server` — a gap that was latent before PR-02 and became a hard blocker after it, since the restructure left ~167 imports depending on that alias. Type-checking resolved them; the test runner would not have. Added the alias (with a comment stating it must mirror `tsconfig.json`), created the missing `tests/setup.ts` that `vitest.config.ts` had always referenced, and extended coverage `include` to `server/**`.

`tests/setup.ts` does three things: unmounts React trees between tests, stubs `fetch` to **throw** so an unmocked network call fails loudly rather than hanging or reaching a real service, and sets placeholder env values for config read at import time.

Added `tests/harness.test.ts` — three assertions that the runner resolves the same aliases as `tsconfig.json` and that the network guard works. It exists because an alias mismatch typechecks fine and fails only at test time; if that file fails, no other test can be trusted. `vitest run` now exits 0.

**Placeholder relocated.** `server/services/shipping/mockShippingIntegration.ts` → `server/shipping/providers/_placeholder/mock.booking.ts`, reversing the decision recorded in PR-02 to leave it outside every domain. It now sits under `providers/` because that is where an implementation of the carrier boundary belongs, prefixed `_placeholder` because it is not one. The naming is the safeguard: it cannot be mistaken for a real provider at a call site or in a directory listing.

This required **sharpening the rule it would otherwise have violated**. `server/shipping/CLAUDE.md` said "no mock or placeholder implementation in this tree", which the move contradicts. Restated to name the actual failure mode: what is forbidden is a stub that *reads as an implementation* and gets selected in production unnoticed. A stub application code can reach must live in a folder named for what it is, with a spec that deletes it — here, [shipping-fulfilment](specs/shipping-fulfilment/).

**Cleanup.** Deleted `server/admin/`, `server/repositories/`, and `server/services/`. These held no tracked files and survived locally only because Finder had left `.DS_Store` in them; git cannot track an empty directory, so a fresh clone never had them. `server/` is now exactly nine domains.

**Stale paths swept.** PR-02's doc update missed references to pre-restructure paths. Corrected across 10 files by deriving the old→new map from git's own rename detection rather than by hand. Three files were deliberately **left alone**: `CHANGELOG.md`'s PR-02 entry (append-only) and the Context sections of ADR-0005 and ADR-0012 (immutable) — each describes the state at the time of writing, and the old paths there are correct precisely because they are historical. One ADR *was* edited: ADR-0009's Decision carried an illustrative path that no longer existed, which left the rule about referencing code accurately failing its own standard. The decision is unchanged; only the example was repointed to the same symbol at its real path.

Verified: `tsc --noEmit` clean, `vitest run` passes, `next build` compiles all 74 routes.

## [PR-02] 2026-08-04 — `server/` restructured into vertical slices by domain

Implemented [ADR-0012](adr/0012-modules-are-vertical-slices-by-domain.md). `server/` had been organised along three competing axes — by layer (`services/`, `repositories/`, `domain/`), by domain (`shipping/`), and by caller (`admin/`) — and is now one directory per bounded context, each owning its own service, repository, and types.

Nine domains: `catalog` (19 files), `cart` (6), `checkout` (6), `payments` (3), `shipping` (26), `identity` (9), `notifications` (7), `analytics` (3), plus `shared` (6). The `admin/`, `repositories/`, `services/`, and `domain/` trees are gone.

Three decisions taken during the migration, recorded here because they resolve ambiguities ADR-0012 did not anticipate:
- **`analytics` is a new ninth domain.** The dashboard read-model reads `order`, `product`, `review`, and `user`, so it had no owner. It is explicitly read-only and the one documented exception to the no-cross-domain-reads rule.
- **The audit log went to `shared/audit/`**, not a domain. It is written from services across five domains, which makes it infrastructure rather than a business concern.
- **Reviews folded into `catalog`.** A review drives `Product.rating` and `reviewsCount`, so it is a property of a product in this data model.

`server/services/shipping/mockShippingIntegration.ts` is **deliberately left outside every domain**. Moving it into `shipping` would place a mock inside the tree whose own rules forbid one; deleting it is a behaviour change belonging to [shipping-fulfilment](specs/shipping-fulfilment/). Its homelessness is the marker.

Measured effects:

| | Before | After |
|---|---|---|
| `@server/*` alias imports | 11 | **167** |
| Deep relative imports into `server/` | 64 | **0** |
| `server/` → `src/` imports (inverted) | 24 | **4** |

The inversion collapsed because 22 of the 24 were `@/lib/prisma`, now `server/shared/prisma.ts`. The remaining four are type-only imports of DTOs declared on both sides — a contract change rather than a move, tracked in [CONTRACTS.md](CONTRACTS.md). `Pagination` was split out of the old `server/types.ts` into `shared/`, and the duplicate `ProductFlag` in the dashboard now points at the canonical `catalog` declaration.

Also fixed in passing, since the file moved anyway: `adress.service.ts` → `identity/address.service.ts`, retiring a misspelling that was load-bearing in two import paths.

**Pure move — no logic changed.** Verified by `tsc --noEmit` after each of the nine steps and a full `next build` at the end; all 74 routes compile. Docs updated per ADR-0012 decision 8: [ARCHITECTURE.md](ARCHITECTURE.md), the root [`CLAUDE.md`](../CLAUDE.md) domain table, and `server/services/CLAUDE.md` split into `server/checkout/CLAUDE.md` and `server/payments/CLAUDE.md`.

## [PR-01] 2026-08-03 — Documentation system: CLAUDE.md, ADRs, specs, skills
Established the project's documentation and decision-record system, ported from the `ums-soul` / `ums-sentinel` structure and adapted for a monorepo ([ADR-0001](adr/0001-monorepo-doc-structure.md)).

**Root `CLAUDE.md`** as the always-loaded rule surface — there was previously no `CLAUDE.md` anywhere, so no project rule reached an agent session. It carries seven Project Invariants, the domain map, the Lite SDLC cycle, and a canonical index of standing conventions in which each entry is a one-line pointer to its ADR, so detail cannot drift. Held under the 200-line guidance. Domain rules co-locate as `<domain>/CLAUDE.md` and load lazily — only when a file in that directory is read — so they cost no context until relevant.

**`docs/adr/`** with a README index and nine records establishing the rules the codebase is held to: docs structure, server-side pricing authority, one repository per aggregate, integer paise, server-only payment state, conditional stock reservation, docs-reference-code, spec layout, and `server/` as vertical slices by domain.

The README states a two-part test for when an ADR is warranted — genuine alternatives existed, *and* the choice constrains future work in a way someone could reasonably undo, the sharpest signal being that the rejected option is the more conventional one. Three drafted records (0006 boundary validation, 0008 seed safety, 0011 CI gates) failed it: each held one small decision wrapped in well-established practice. Their substance moved to `CLAUDE.md` Invariants 4 and 7 and to [TESTING.md](TESTING.md)'s CI-gates section; the numbers stay absent rather than being reused. The README also records that an ADR is not what makes a rule followed — ADRs are not loaded into a session, so a convention-setting ADR needs a pointer line in `CLAUDE.md`'s conventions index.

**The docs hub** — [ARCHITECTURE.md](ARCHITECTURE.md) (current state), [CONTRACTS.md](CONTRACTS.md) (client↔server DTOs), [BACKLOG.md](BACKLOG.md) (phased milestone map), [TESTING.md](TESTING.md), [DEPENDENCIES.md](DEPENDENCIES.md), [OPERATIONS.md](OPERATIONS.md), [INTEGRATIONS.md](INTEGRATIONS.md), [README.md](README.md) as a map, and [specs/](specs/).

**Six specs** covering Phase 2 and Phase 3 of [BACKLOG.md](BACKLOG.md), each `spec.md` (requirements) + `trd.md` (technical approach, no code), under the ≤100 readable-line cap ([ADR-0010](adr/0010-spec-convention.md)).

**Three skills** — `/bb-review`, `/bb-sdlc`, `/bb-brainstorm` — so the SDLC is invoked rather than recalled. `/bb-review` checks the seven Invariants against a diff, which is what makes `CLAUDE.md` enforcement rather than intention.

**Domain docs** for payments, checkout, and shipping: `CLAUDE.md`, `ARCHITECTURE.md`, and `adr/` co-located with each domain's code.

The seventeen pre-existing doc files moved to [_archive/](_archive/) with `git mv`, so `git log --follow` still reaches their history. Roughly half their content was pasted implementation code and three quarters of their internal links were dead; a single notice in the archive records what is worth mining and marks the rest untrustworthy. Nothing was deleted.

No code, schema, or dependency changes — documentation only.
