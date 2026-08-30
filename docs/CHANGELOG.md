# CHANGELOG

## Format
- **Append-only.** Never edit an old entry; corrections go in as new entries.
- Newest entries at the top.
- Entry header: `## [PR-NN] YYYY-MM-DD — Short title`
- Add `[CONTRACT]` when a DTO in [CONTRACTS.md](CONTRACTS.md) changed — the signal that client and server must move in lockstep.
- Add `[MIGRATION]` when the PR includes a Prisma migration, so a deploy knows to run one.
- One entry per merged PR. Cross-domain changes are recorded here; domain-internal changes go in that domain's own CHANGELOG.

## Entries

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
