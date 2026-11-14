# TRD — subscriptions/feature-access

- **Status:** Implemented — 2026-11-12, on `feat/feature-access`
- **Domain:** new `subscriptions` (owns the switches); channels, content, requests refuse; storefront, feeds and Home filter
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-12
- **References:** [spec.md](spec.md), [ux.md](ux.md) (signed off 2026-11-12), [decisions.md](decisions.md), [ADR-0003](../../../adr/0003-one-repository-per-aggregate.md), [ADR-0012](../../../adr/0012-modules-are-vertical-slices-by-domain.md), [ADR-0013](../../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0021](../../../adr/0021-audit-trail-never-fails-the-action.md), [ADR-0030](../../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md), [ADR-0033](../../../adr/0033-a-domain-is-reached-through-its-public-surface.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0046](../../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md), [ADR-0048](../../../adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0055](../../../adr/0055-an-admin-surface-reads-through-projections-and-writes-through-the-aggregates-one-repository.md), [ADR-0063](../../../adr/0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md), [ADR-0065](../../../adr/0065-storefront-reads-are-shared-across-requests-and-cleared-by-the-tables-a-write-touches.md), [ADR-0067](../../../adr/0067-words-live-in-copy-modules-and-our-own-paths-in-one-routes-table.md), [ADR-0071](../../../adr/0071-only-the-spec-is-line-capped.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
One new domain owns one fact: *may this org use this feature now?* Everything else asks it.

**Actions are refused in the domain service that does the work**, not at the screen and not only at
the route. A page, a route, a bulk action and a background job all reach the same service method, so
they all meet the same refusal; nothing can route around a lock by calling a different door. This is
the answer to the spec's first hazard, "a lock in name only", and to the owner's Q29 ("all the features
from every call site must be blocked"). Routes add the check as well, earlier, to fail fast and to keep
the registry test honest (D9), but the route check is the second line, not the first.

**Public reads are filtered where the data-access layer composes them.** The storefront, the store
directory, the sitemap, "Sold by" and the Google and Meta feeds are reads of catalog and listing. Those
domains never learn about plans: `src/data-access-layer/` already composes several domains for a page,
and that is where "only shops with Storefront" is applied. Catalog and listing gain no dependency.

**A registry makes the rule hold tomorrow.** Every org API route and every channel, content and
listing job declares the feature it needs, or `core` with a reason, in one table. A scanning test fails
an undeclared one, in the shape of ADR-0063's rate-limit registry. A module added next month cannot ship
an unlocked call site by forgetting.

**Screens never hide (Q20, Q28).** Each server page reads the shop's three booleans once and hands them
to the leaves that draw paid actions. A locked action is drawn by one shared composite, so the look,
the sheet and the contact prefill are the same in every place (ux.md "one look for every lock").

Billing (Q21) will later flip the same switches. Nothing here knows about money, payment or plans
beyond the three booleans, so billing adds a writer, not a reshaping.

## Prior art
- **Stripe Entitlements** ([docs.stripe.com/billing/entitlements](https://docs.stripe.com/billing/entitlements))
  model *feature → active entitlement per customer*. The application asks, per request, whether a
  customer holds a feature; Stripe recommends against caching the answer in a session because a lapse
  must take effect promptly. **Followed:** a declared feature set, one row per (customer, feature),
  checked server-side on each action, no session caching (D6, Q17).
- **Shopify app billing and plan gating** ([shopify.dev/docs/apps/launch/billing](https://shopify.dev/docs/apps/launch/billing))
  gates on the server and draws the upsell where the feature sits rather than removing the menu.
  **Followed:** the UX's "screens open, actions lock" (Q20) is this pattern.
- **Feature-flag services** (LaunchDarkly, Unleash) evaluate flags per request with a subject context,
  usually through an SDK, often client-side as well. **Departed:** three features, one admin, no
  percentage rollouts. A vendor and a client-side evaluation buy nothing here, and a client check is
  presentation, not enforcement.
- **Ours, checked:** `OrgChannel` (`prisma/schema.prisma`) is the same row shape, a closed-set key
  stored as a string with a boolean, keyed on (org, key). **Followed.** `CHANNELS_CONNECT` in
  `server/channels/channel-availability.ts`, one switch read in one place, is the model for D2's closed
  set. `Org.isBlocked`, checked in `resolveOrgScope` (`src/lib/org-auth.ts`) on every org request, shows
  the cost a per-request check already pays; D6 adds one read beside it, the one the spec's cost hazard
  allows. No existing pattern found wrong.

## Technical decisions

### The domain
- **D1 — A new `subscriptions` domain owns `OrgFeature`.** Files: an `org-feature.repository` (the one
  writer of the table, Invariant 5), `feature-access.service` (the public surface), `feature-access.types`
  (the closed set and DTOs), and the registry (D9). A `CLAUDE.md` for the domain states its two rules:
  it imports only `shared`, and it never decides anything about money.
  - **Why a new domain, not catalog:** entitlements change for commercial reasons, catalog changes for
    catalogue reasons; one module with two reasons to change is what ADR-0012 splits. Billing (Q21) joins
    here, and catalog should not grow a payments seam.
  - **Why it imports only `shared`:** every other domain will call it. If it imported any of them, the
    first caller from that domain would make a cycle. The home-brand id comes from `shared`
    (`server/shared/home-brand.ts`), the audit writer from `shared`, nothing else is needed.
- **D2 — `FEATURE` is a closed set** in the domain's types: `CHANNELS`, `STOREFRONT`,
  `IMAGE_ENHANCEMENT`, compared by constant everywhere (ADR-0003 D5). It lives here, not in `shared`,
  because only this domain declares it; `CHANNEL` is in `shared` because three domains each own part of
  what a channel is, which is not true of a feature.
- **D3 — A missing row reads off.** `OrgFeature` holds a row only once an admin has switched that
  feature for that shop. No row → locked. This is Q14 and Q15 at once: every shop present at release and
  every new shop start locked, with no backfill and no "set at launch" special case. The home brand is
  never read (D4).

### The question and the refusal
- **D4 — One question, one refusal.**
  - `can(orgId, feature)` → boolean. `assert(orgId, feature)` → throws on false. `forOrg(orgId)` →
    `FeatureAccessDTO` (three booleans) for a page or a scope. `allowedOrgs(feature, orgIds?)` → the set
    of orgs holding a feature, for a filter or a pass over many shops.
  - **The home brand is always allowed**, answered from `homeBrandOrgId()` before any read (Q13). It
    serves every shop's channel type data (setup-requests Q14), so locking it would break other shops.
  - The refusal is a new `FeatureLockedError` beside the others in `server/shared/domain-error.ts`: a
    `DomainError` with status 403 that carries the `feature` key. It lives in `shared` because
    `toErrorResponse` (in `src/lib/`) and every domain must recognise it, and `shared` is the one module
    all of them already import.
  - `toErrorResponse` adds `details: [{ path: "feature", message }]` for it. The envelope keeps its
    shape (ADR-0013); a client tells a lock from any other 403 by that detail, without a new field.
    `readApiError` already carries `details` through, so no client helper changes.
  - The message is the ux.md sheet title, "{feature} is part of the ₹699 plan", so even a client that
    knows nothing of locks shows something true.

### Enforcement: actions
- **D5 — Each domain refuses at its own entry points.** The check goes at the top of the service
  method, before any marketplace call, slot spend, enqueue or write. Listed per domain, against today's
  services, so the build has a checklist and review has something to diff against.
  - **channels — refused when Channels is off:**
    - `channelConnectionService`: `startConnect`, `completeConnect`, `check`.
    - `channelImportService`: `requestRead`, `runRead`, `leaveOff`, `bringBack`, `unlink`, `linkBack`,
      `dismissFamilyHint`.
    - `channelSettleService`: `settle`, `copyPhotos`, `retryPhotos`.
    - `channelFactsService`: `fillNow`, `change`, `settleFill`, `run`.
    - `channelFamilyService`: `settle`.
    - `channelLocationService`: `refresh`, `save`.
    - `channelStockService`: `turnOn`, `push`, `pushChanged`, `pushAllIn`, `dailyCheck`, `startIfReady`.
    - `channelOrdersService`: `check`, `apply`.
    - `listingPublishService`: `publish`, `publishProducts`, `bulkSend`, `send`, `check`.
    - `listingCreateService`: `findPages`, `startDraft`, `startFamily`, `send`, `linkCreated`.
    - `platformListingService`: `complaint` (raises a setup request).
  - **channels — stays free when Channels is off, and why:**
    - Reads that draw the screen: `overview`, `listingsPage`, `listing`, `detail`, `linksForProduct`,
      `readProgress`, `cards`, `card`, `page`, `review`, `screen`, `summaries`, `section`, `attention`.
      The screen opens and shows what is there (Q20, ux.md "Partial"); only actions lock.
    - `disconnect`: the shop may always leave a marketplace; a lock never traps a credential.
    - `channelStockService.pause`: stopping a sync must never be refused.
    - `platformListingService.save`: the product form's channel answers stay editable (Q5, ADR-0053).
    - `maintain` and `accessToken`: tokens keep renewing (Q11). `maintainOne` skips the health read for a
      locked shop, since "Last checked" is a channel action, but still renews and re-seals.
  - **content — refused when Image enhancement is off:** `enhancementService.request`, before
    `standing()` so no allowance slot is spent. **Free:** `run` (queued work finishes, Q12), `accept` and
    `discard` (a made proposal is the shop's, Q32), `get`, `usage`, `countAwaitingDecision`.
  - **requests — refused when Channels is off:** the marketplace plug-in (`server/requests/marketplace/`)
    filters its needs to orgs holding Channels, in `fromComplaints` and `missingCategories`, through
    `allowedOrgs`. The engine (`request.service`, `ticket.repository`) is untouched and names no feature,
    keeping setup-requests D4 ("the engine knows no module"). Issues stay free (Q19).
  - **catalog:** no action is locked. Storefront building, look, banners, handle and preview stay free
    (Q18). Sharing is a client action with no server call (D12).
- **D6 — One extra read per org request.** `resolveOrgScope` reads the membership (catalog's
  `orgMemberRepository`) and `featureAccessService.forOrg` in parallel; `OrgScope` gains `features`.
  - Not folded into catalog's membership query: that would have catalog read a table it does not own
    (ADR-0033), and catalog would learn about plans.
  - `requireOrgMember` is memoised per request, so a page and every leaf share one read. Nothing is
    cached across requests, so a switch shows on the next screen, action or job (Q17).
  - Cost: one primary-key read of at most three rows. The integration test pins it at exactly one
    statement (spec hazard "cost").
- **D7 — `withOrg` takes an optional feature.** `withOrg(handler, { feature })` refuses from the scope it
  already holds (D6), before the handler runs, through the same `FeatureLockedError`. A route that
  serves both free and paid actions declares `core` and relies on D5: `products/bulk-edit` (price and
  stock are free, marketplace send is not), `requests` (issues are free), `products/[id]/listings/[channel]`
  (PUT saves the form's answers and is free; POST starts a draft and is refused by `listingCreateService`).

### Enforcement: background jobs
- **D8 — A job checks at the step, and a lock ends it quietly.**
  - A job asks `can()` at the moment it would call a marketplace or write channel state, not when it was
    enqueued: a lock can land between the two.
  - Refused, the job **ends succeeded with a skip**, counted in the summary it already reports. Never
    thrown, so the queue neither retries it nor marks it failed. A lock is a decision, not a fault.
  - A pass over many shops (`channels.check-stock`, `channels.check-orders`, `channels.check-listings`,
    `channels.check-listing-problems`, `listing.refresh-completeness` if it touches channel state, the
    `maintain` pass) reads `allowedOrgs(CHANNELS)` **once** for the pass (channels `CLAUDE.md`: "a pass
    over every shop reads once and writes once").
  - Per-shop jobs (`channels.read-listings`, `channels.publish-listing`, `channels.push-stock`,
    `channels.stock-changed`, `channels.fill-facts`, `channels.copy-listing-photos`) check `can()` for
    their one org. Most do it for free by calling a D5 method; the registry (D9) records which.
  - **Mid-flight (spec hazard):** a publish already holding its claimed state when the lock lands is
    allowed to finish its one marketplace call and record the answer; the next step (a look, a retry)
    is refused. Half-writing a listing is worse than one more call. Stock sync stops at the next push.
  - **Exempt:** `image.enhance` (Q12). `requests.listing-complaints` is filtered by D5's plug-in rule.

### Every call site, held
- **D9 — One registry, one scanning test.**
  - `server/subscriptions/` holds a registry mapping each `src/app/api/org/**` route method, and each job
    type registered by channels, content and listing, to a `FEATURE` or to `core` with a one-sentence
    reason.
  - A test derives routes from the file tree and job types from the job registry
    (`server/shared/jobs/jobs.registry.ts`, `registeredJobTypes`) and fails on: an unclassified route or
    job; an entry naming a route or job that no longer exists; a route classified paid whose handler does
    not pass that feature to `withOrg`.
  - Mutation-tested before it is trusted (CONVENTIONS "a gate against existing debt is a ratchet"):
    remove one feature from one `withOrg` and the test must fail.
  - Starting classification, from today's 73 org routes (build confirms each):
    - **Channels:** everything under `channels/**` except `channels/route.ts` (where the shop *says* it
      sells, part of the product form, free per Q5), `channels/[channel]/connection` DELETE (disconnect),
      `channels/[channel]/stock-sync` (PUT pauses as well as starts, so `core` with D5 refusing `turnOn`),
      and the read GETs (`listings/read` GET, `settle/products` GET). Also
      `products/[id]/listings/[channel]/pages`.
    - **Image enhancement:** `enhancements` POST.
    - **core, D5 refuses inside:** `products/bulk-edit`, `requests`, `products/[id]/listings/[channel]`,
      `channels/[channel]/listings/[id]/request`.
    - **core:** every other route (products, orders, offers, bidding, locations, media, upload, shop,
      storefront editing, brands, families, listing defaults and values, shipments, setup).
  - Pages are not in the registry: they never refuse (Q20). They only read `features` to draw.

### Enforcement: public reads
- **D10 — Filtered in the data-access layer.**
  - `storefront.dal.ts`: `listShops` drops shops without Storefront (the `/store` directory, Q7).
    `getByHandle` and the brand-page read return the shop with `storefrontLocked: true` rather than null,
    so the layout can tell "locked" from "no such shop" (D11).
  - `sitemap.ts`: the shop list it already takes from `storefrontDAL.listShops` is filtered by the same
    call, so it needs no change of its own beyond using the filtered list.
  - The product page's "Sold by" link (`src/components/product/product-details.tsx`) is drawn only when
    the product page reads whether the shop's storefront is open (Q27). The product itself is untouched (Q8).
  - `shopfront-feed.dal.ts` filters the orgs listing returns (`orgChannelRepository.orgsWith`) by
    `allowedOrgs(CHANNELS)` before building the feed (A2).
  - `home.dal.ts` omits the channel attention reads when Channels is off (Q31), which also saves those
    queries for a locked shop.
  - Catalog and listing gain no import. The DAL files gain one each; file-cohesion records any file
    that passes two domains (Gates).
- **D11 — Storefront for non-members.**
  - The `/store/[handle]` layout: locked, and the viewer is neither a member of the shop nor a platform
    admin → the not-yet-available page, with `robots: noindex` in its metadata. A member or admin → the
    store as it is, under the banner (Q6, ux.md "Member or admin").
  - Membership is read with `optionalActiveSession` and `orgMemberRepository.findMembership`, only on a
    locked shop, so an open store pays nothing extra.
  - The storefront's nested routes (`/shop`, `/about`, product pages under a themed shell) inherit the
    layout's decision.
  - **Cache (spec hazard "side door"):** storefront reads are memoised per request only today, so a
    switch is seen on the next view. If they ever move onto `cachedRead`, `OrgFeature` joins
    `CACHED_TABLES` so a switch clears them (ADR-0065 decision 3). The sitemap's one-hour `revalidate`
    means a newly locked shop can stay listed for up to an hour; accepted, because a crawler following it
    meets `noindex` and the not-yet-available page.

### The admin's switch
- **D12 — A named command, audited.** `featureAccessService.set(adminId, orgId, feature, enabled)`
  writes through the repository (upsert on the key) and records an `AdminLog` entry
  (`action: FEATURE_ENABLED | FEATURE_DISABLED`, `resource: Org`). The log never fails the switch
  (ADR-0021).
  - Concurrent switches: last write wins; the reply is the stored row with who and when, so an admin
    whose screen was stale sees "{feature} was already {on/off}" (ux.md Stale).
  - The home brand: `set` refuses with a `DomainError` naming it, and the Plan tab draws the ux.md
    "Refused" line instead of switches.
  - The route is `PUT /api/admin/orgs/[orgId]/features/[feature]` with a Zod body `{ enabled }`, behind
    the existing admin guard. `feature` is parsed against `FEATURE`; anything else is 404.
  - The admin read is `featureAccessService.forAdmin(orgId)`, rows with who and when, through the same
    repository (ADR-0055: an admin surface reads through projections, writes through the one repository).
- **D13 — Release.** A schema migration creates the empty table. No data migration (D3). Turning on a
  test shop is an admin action after deploy. `HOME_BRAND_ORG_ID` must be set in every environment before
  the branch is deployed, or the home brand locks too; the deploy checklist and `docs/OPERATIONS.md` say so.

## Packages
None.

## UI approach
Screens, states and copy are [ux.md](ux.md); this says how they are built. Rules:
[src/components/CLAUDE.md](../../../../src/components/CLAUDE.md).

- **Per form factor (ADR-0050):**
  - *Phone (~360px):* the plan banner is a full-width strip directly under the page header, one line of
    text and a "Talk to us" link. A locked action keeps its place and size, with the `lock` icon (already
    in the Icon seam) before its label, so nothing reflows when a lock lifts. The locked sheet is a
    bottom sheet; its two buttons are full width and thumb-reachable.
  - *Tablet (`md:`):* the sheet becomes a centred dialog (ADR-0040's adaptive surface). The banner keeps
    full width. Admin Plan tab: switch moves to the right of each row's text.
  - *Desktop (`lg:`):* nothing new.
- **Rendering (ADR-0034):** pages stay server components. Each reads `requireOrgMember` (D6) and passes
  `FeatureAccessDTO` to the leaves it renders. No client fetch for access. The client leaves are only the
  locked action and the sheet. The admin Plan tab is a server read with one client row per feature.
- **Components:** a new `subscriptions` folder under `src/components/` (ADR-0031), holding:
  - **The locked action:** wraps one paid action. Allowed → renders its child unchanged, so the unlocked
    app is byte-for-byte what it is today. Locked → the same `Button` primitive and variant with the lock
    icon, whose tap opens the sheet. Never `disabled` (ADR-0053).
  - **The locked sheet:** feature name, value line and price from the copy deck; "Talk to us" opens the
    contact sheet with its prefill; "Not now" closes it and leaves the screen as it was.
  - **The plan banner:** server component, copy only, its link opening the same contact sheet.
- **Behaviour (ADR-0048):**
  - A paid action already on screen when a lock lands meets the server's 403. Each feature's hook already
    turns a failed call into `ApiError`; a small shared helper recognises `details[0].path === "feature"`
    and opens the locked sheet instead of the error toast (ux.md "Stale").
  - `ContactSheet` gains an optional `prefill` string, passed to `whatsappSupportUrl` (which already takes
    a message) and used as the message form's starting text (Q26). `ContactLauncher` forwards it.
  - Admin Plan tab: a `planApiClient` beside the admin org components, a `usePlanSwitch` hook on
    `useMutation`, the turn-off confirmation as a sheet (Q25), the toast on success or spring-back on
    failure (ux.md).
- **Every way in (ux.md table), with its file:**
  - Channels card actions: `marketplace-card-actions.tsx`; Listings actions: `listing-row.tsx`,
    `listing-link-action.tsx`, `read-again-button.tsx`, `stock-sync-actions.tsx`, `review-publish.tsx`,
    `listing-settle-actions.tsx`, `retry-photos-button.tsx`.
  - After saving a product: `product-marketplaces.tsx` ("Put on {marketplace}", "Edit listing").
  - Direct link to create: `put-on-marketplace.tsx` (the page opens; Create and Use this one lock).
  - Bulk: `BulkActionDialog` (marketplace action).
  - Setup requests: the marketplace plan component under `src/components/requests/marketplace/`.
  - Orders → Marketplace tab: the plan banner replaces the empty state when Channels is off.
  - Home: channel nudges absent (D10), nothing to draw.
  - Image enhancement: `gallery-rows.tsx` (the capture warning's Improve, each row's Improve, the
    "Improve…" entry), `media-library-grid.tsx` (Enhance).
  - Storefront: every `ShareShopSheet` trigger (Home, setup list, shop link card, look picker) and the
    storefront editor's View store link.
  - Admin: the automatic-enhancement policy row shows "Paused: Image enhancement is off" (Q33).
- **/business (Q30):** `ContactLauncher` added to the header beside "Open your shop" and to the pricing
  card beneath it, in `business-page.tsx`. The closing section already has one.
- **Copy (ADR-0067):** a `subscriptions-copy` module beside the components holds every string from
  ux.md's copy deck; `business-copy` gains the two "Talk to us" labels. No inline words.
- **Tokens:** none new. The banner uses an existing tinted surface token; the lock icon inherits text
  colour.

## Gates touched
- **New domain** → `PUBLIC_SURFACE` entry for `subscriptions` (module-boundaries): services and types
  only, no extra seams.
- **The new domain's `CLAUDE.md`** → `LIVING_DOCS` (docs-integrity).
- **Reach:** `src/lib/org-auth.ts`, `storefront.dal.ts`, `shopfront-feed.dal.ts`, `home.dal.ts` and the
  product DAL each gain `subscriptions`. `home.dal.ts` is already in `RECORDED`; its entry gains the
  domain and reason. Any other that passes two domains is added with its reason (file-cohesion).
- **Sheets** → the locked sheet and the Plan turn-off sheet in `MAY_USE_SHEET` (overlay-surfaces).
- **New admin route** → its caller named (route-reachability) and the admin guard (portal-guards).
  Admin routes are outside the rate-limit registry (ADR-0063 decision 1).
- **One repository:** `OrgFeature` written only by its repository (`one-repository`).
- **Copy:** `hardcoded-copy` holds the new components to the copy module.
- **New gate:** the feature registry test (D9).

## Data model
[MIGRATION] New table `OrgFeature`:
- `orgId` → `Org`, cascade on delete (a deleted shop's switches mean nothing).
- `feature` String, holding a `FEATURE` key. Not a Postgres enum, matching `OrgChannel.channel`: adding
  a feature is a code change, not a migration.
- `enabled` Boolean, default false.
- `changedById` → `User`, nullable, set null on delete (the switch outlives the admin's account).
- `changedAt` DateTime.
- Primary key `(orgId, feature)`; index on `feature` for `allowedOrgs`.

Created empty. No data migration, no column dropped (D3, D13).

## API / contract changes
[CONTRACT] `docs/CONTRACTS.md` gains:
- `FeatureAccessDTO`: `{ channels: boolean; storefront: boolean; imageEnhancement: boolean }`.
- The lock refusal: status 403, `details: [{ path: "feature", message }]`, `path` naming the feature.
- `PUT /api/admin/orgs/[orgId]/features/[feature]`: request `{ enabled: boolean }`; response the stored
  row `{ feature, enabled, changedAt, changedBy: { name, email } | null }`.
- The storefront DTO's `storefrontLocked` flag (D10).

## Test plan
Cross-referenced to [TESTING.md](../../../TESTING.md). A failing test per acceptance id first.
- **Unit:**
  - `feature-access.service`: home brand allowed with no read; missing row is off; `set` upserts,
    records audit, returns the stored row; an audit failure does not fail the switch; `set` on the home
    brand refuses.
  - `toErrorResponse` maps `FeatureLockedError` to 403 with the `feature` detail.
  - Feature registry test (D9), mutation-tested.
  - The `maintainOne` split: a locked shop is renewed and not health-checked.
- **Integration (real Postgres):**
  - **A1:** admin switches Channels off; a channel action route is 403 with `feature: channels`; a
    disconnect still succeeds.
  - **A2:** `/feeds/google.xml` and `/feeds/meta.xml` omit the locked shop; `channels.publish-listing`
    and `channels.push-stock` for it end succeeded with a skip and are not retried.
  - **A3:** with Channels off, the product saves with Amazon's fields blank and readiness reports two
    missing; switched on, publish succeeds with no edit.
  - **A4:** with Storefront off, a signed-out `/store/<handle>` renders not-yet-available with noindex;
    the owner sees the store; `/store`, the sitemap and the product page's "Sold by" omit it; the product
    page still sells.
  - **A5:** `enhancements` POST is 403 and spends no allowance; an `image.enhance` job queued before the
    switch completes and its proposal can be accepted.
  - **A6:** the home brand passes every check with no rows; an org created after release is locked.
  - **D6:** an org request adds exactly one statement for features.
  - **D5 sweep:** each refused service method in D5 throws `FeatureLockedError` for a locked org, from a
    table-driven test, so a method added to the list without its check fails.
- **Component:**
  - The locked action renders its child unchanged when allowed, and the lock and sheet when locked.
  - A 403 with the `feature` detail opens the sheet, not a toast.
  - The contact prefill reaches the WhatsApp link and the message field.
  - **A7:** `/business` header and pricing card each open the contact sheet.

## Delivery
One branch, one implementation (owner, 2026-11-12: "we don't have any PR … directly implement the whole
feature"). Built and committed on `feat/feature-access` in these units, each one commit, each passing
the gates on its own; nothing ships until the whole branch is merged, so no shop meets a bare 403
without the sheet:
1. **Domain and switch.** Migration, domain, service, error, admin route and Plan tab (A1 admin half, A6).
2. **Enforcement.** D4–D9: scope read, `withOrg` option, every D5 assert, job skips, registry test (A1, A2 jobs, A5 server).
3. **Storefront and public reads.** D10, D11 (A2 feeds, A4).
4. **Shop UI.** Banner, locked action on every way in, sheet, contact prefill, stale-403 handling, Home nudges, admin policy row (A3, A5 UI).
5. **/business.** Talk to us in header and pricing card (A7).

`HOME_BRAND_ORG_ID` must be set in every environment before the branch is deployed (D13).

## Built differently from the plan (2026-11-12)
Found while building; each is the plan's intent kept, its means changed. Recorded here so the TRD
describes what exists.
- **D5 channels:** the asserts sit behind one file, `server/channels/channel-plan.ts`, so only it reaches
  `subscriptions` and no channels service crosses the two-domain reach limit. `accessToken` also asserts,
  as a backstop for any marketplace call added later; renewal never passes through it (Q11).
- **D5 requests:** the plug-in's org list comes from `channelTypesService.connectedOrgs`, which now keeps
  holders only, rather than the plug-in asking `subscriptions` (it would have reached three domains).
- **D7 routes:** `channels/[channel]/listings/[id]/request` is `core` (refused by
  `platformListingService.complaint`): the route already reaches channels and requests. `PUT channels`
  (Google and Meta on or off) refuses turning one on from the scope inside its handler; turning one off
  stays free. The TRD had listed it as free under Q5; turning a feed on is part of Channels (Q4).
- **D8 jobs:** team bulk sends skip a locked shop's products with the new reason `channels_locked` rather
  than failing the batch. The stock push asks for the product's one shop; the daily stock check, orders
  check, listing look-ups and the problems pass read holders once per pass.
- **D10:** `getByHandle` was left unchanged; the layout asks a separate
  `storefront-access.dal.ts` (`forViewer`: open, team or closed; `openAmong` for the directory), which keeps
  `storefront.dal.ts` within its reach. Locked pages' metadata is `noindex` with no link preview.
- **D12:** the admin route is `PUT /api/admin/orgs/[id]/features/[feature]` (the folder already uses
  `[id]`); the admin read is `planFor`. Audit actions are `feature.enabled` and `feature.disabled`.
- **UI:** the shop's plan reaches leaves through `useShopPlan`, provided once by the org layout, rather
  than a prop through every screen. Both sheets use the existing `FormDialog` (bottom sheet on a phone,
  dialog from `md`), so no file was added to `MAY_USE_SHEET`. The Plan tab's Storefront line names no
  handle (the admin's org DTO carries none); ux.md moved with it.
- **Review (fresh context) changed four things.** The storefront closes in each page before its content is
  read, not in the layout, which does not stop its pages rendering into the payload (the framework's auth
  guide); `tests/unit/storefront-closed-pages.test.ts` holds it. Saving a listing's own answers stays free
  (Q34), so "Edit listing" carries no lock. A locked shop lends no themed header to a `?shop=` product page.
  Feature keys are `FEATURE.*` everywhere and one `holds()` serves server and browser. The sitemap's hourly
  lag is accepted (Q35).
- **Tests:** the shared fixture shops hold every feature (`grantAllFeatures`), standing in for a paying
  shop; two budget suites gained one statement for the holders read.

## Open questions
None. Q1–Q33 decided; Q21–Q23 parked.
