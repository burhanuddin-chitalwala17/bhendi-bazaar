# CHANGELOG

## Format
- **Append-only.** Never edit an old entry; corrections go in as new entries.
- Newest entries at the top.
- Entry header: `## [PR-NN] YYYY-MM-DD — Short title`
- Add `[CONTRACT]` when a DTO in [CONTRACTS.md](CONTRACTS.md) changed — the signal that client and server must move in lockstep.
- Add `[MIGRATION]` when the PR includes a Prisma migration, so a deploy knows to run one.
- One entry per merged PR. Cross-domain changes are recorded here; domain-internal changes go in that domain's own CHANGELOG.

- **Running month only.** When a month closes it is summarised in [CHANGELOG-HISTORY.md](CHANGELOG-HISTORY.md) and its entries are dropped (git keeps them); the session-start hook prompts it ([ADR-0072](adr/0072-the-changelog-holds-the-running-month-and-a-closed-month-becomes-a-summary.md)). Never append to the archive.

## Entries

## 2026-11-22 — Fix: an abandoned checkout showed in the admin as money a buyer spent

- The user console summed `grandTotal` over every order a buyer had, so a payment that never arrived showed as spent
  and an expired checkout as an order. `ADMIN_USER_INCLUDE` now counts `VISIBLE_ORDER_WHERE` orders and sums only
  `PAID_ORDER_WHERE` ones that are visible (checkout-abandonment R4). `tests/integration/admin-user-spend.test.ts`;
  against the old projection it reads ₹440.72 over four orders where ₹100 over three is true.

## 2026-11-22 — The dead channel banner goes; e2e signs in and walks the phone Account page

- `ChannelAttentionBanner`, its `BANNER` copy and its two tests are removed: the dashboard stopped rendering it on
  2026-11-01, when "Needs you now" took its place (seller-onboarding U3). Nothing else read them.
- e2e seeds one buyer with a password (`E2E_BUYER`) and `e2e/account.e2e.ts` signs in, reaches Your shop from the
  Account page and signs out, on phone and desktop. Against the Account page before the fix above, both fail.

## 2026-11-22 — Fix: a phone payment retried after a failed attempt was refused

- A buyer's first PhonePe attempt failed; the browser asked to release the order; the gateway reported nothing in
  flight, so the order expired and its stock went back on sale. Minutes later the buyer paid again on the same gateway
  order — which still accepts attempts — and confirmation refused it because the order had expired.
- `releaseIfUnpaid` now answers `still-payable` and keeps the hold while an order with a gateway order is younger than
  `ABANDONED_HOLD_MINUTES` (15); after that the sweep and a blocked checkout release it as before (R1, R2).
- Checkout no longer releases on `pagehide`: a phone hides the page to open the UPI or wallet app, so it fired
  mid-payment. A dismissal or a failure in the payment window still asks.

## 2026-11-22 — Fix: a phone had no way to reach Your shop or sign out

- The navbar hides its profile menu below `md`, and that menu was the only place with Your shop and Sign out; the
  phone's Account tab lands on `/profile`, which had neither. The Account page (`profile/layout.tsx`) now lists Your
  shop beside Orders, Saved and Policies, and ends with Sign out — both for a signed-in viewer only.

## 2026-11-21 — Fix: a Styled shot from a page opened before the shape choice was refused

- A page loaded before #89 deployed runs the old modal, which sends no `aspect`; the server required one and answered
  400, shown as "Please correct the highlighted fields". `requestStyledSchema` now treats a missing shape as square —
  what that modal always made — while the new modal still will not send without a choice.
- The modal shows a validation refusal's own field message (`failureMessage` in `useStyledShotRun.ts`): it has no
  fields to highlight, so the envelope's summary told the shop nothing.

## 2026-11-21 — Styled shot: the shop chooses the shape, any library picture is a reference, the result fits [CONTRACT] [MIGRATION]

- **Shape (ai-images Q42).** The modal asks Square 1:1, Portrait 4:5, Tall 9:16 or Landscape 4:3 before Generate,
  with nothing preselected. `requestStyledSchema` requires `aspect`; the quote takes `aspect` (default square); the run
  stores it (migration `20261121130000_styled_aspect`, one nullable column) and the worker asks the model for it.
  Earlier runs, with no shape stored, stay square. `EnhancementDto` gains `aspect`.
- **References (Q43, Q44).** The library picker offers every image, not only those tagged Reference; its now-unused
  `tag` prop is gone. A picture from the device is held in the page until Generate, so one removed first is never
  uploaded and never reaches the library.
- **Layout.** The result screen sized its picture as a square the full width of the panel; on a desktop that is
  taller than the panel, which never scrolls, so Regenerate and Use this were cut off. The picture now takes the
  height the controls leave, in its own shape; the form scrolls under a fixed cost line and Generate.

## 2026-11-21 — Fix: every Styled shot failed at the credit lock

- `creditRepository.lockOrg` took the shop's advisory lock with `$queryRaw`. `pg_advisory_xact_lock` returns
  `void`, which the production driver adapter cannot read, so every charge failed with "Something went wrong"
  before any model was called; nothing was charged. It now uses `$executeRaw`, as every other lock does.
- `tests/integration/credit-charge.test.ts` charges against the real database and driver (the unit suite mocks
  the client, which is how this shipped). It fails on the old code with the production error.

## 2026-11-21 — CI drops the restored data cache before the build

- The e2e job restored `.next/cache` on an exact key hit, including `fetch-cache`: the category page's product
  list from the previous run's database. A commit touching no code (docs, CI) hit it and the smoke journey could
  not find the product it had just seeded. The job now deletes `.next/cache/fetch-cache` after restoring and keeps
  the compile cache.

## 2026-11-21 — The worker is given the AI-picture variables

- The worker generates every AI picture, but neither deploy passed it the keys. `ci.yml` and `staging-worker.yml`
  now pass `WORKER_ENV_IMAGE_GEN_*` / `WORKER_STAGING_ENV_IMAGE_GEN_*` (both Cloudflare values, the Gemini key and
  the two model orders), and `.env.example` section 3 lists them, which `deploy-safety.test.ts` reads.

## 2026-11-21 — Cloudflare's image keys are named for Cloudflare

- `IMAGE_GEN_ACCOUNT_ID` / `IMAGE_GEN_API_TOKEN` are now `IMAGE_GEN_CLOUDFLARE_ACCOUNT_ID` /
  `IMAGE_GEN_CLOUDFLARE_API_TOKEN`, beside `IMAGE_GEN_GEMINI_API_KEY`: one name per provider. The old names are not
  read; rename them wherever they are set. `.env.example` now lists every AI-picture variable.

## 2026-11-21 — AI pictures: faster polling, smaller uploads, bounded downloads, a per-shop limit

- The Styled-shot dialog asks after a run every 3 s for the first 15 s, then every 6 s, and gives up at 5 min (was
  every 2 s). Most pictures land in 20–40 s; a 30 s interval would add up to 30 s of waiting after one is ready.
- References are read in parallel from the stored 1200 px copy (`mediaAssetService.readImageForModel`), not the
  original, before the generator shrinks them for the model.
- A generation's scratch output under `generations/` is deleted once its run is proposed or settled
  (`generation/outputs.ts`); OPERATIONS step 7 adds a 7-day R2 lifecycle rule for what a crash leaves.
- Adapters read a provider's picture at most 20 MB (header and stream), follow https links only, and keep 2,000
  characters of an error body. A linked picture that cannot be fetched is UNCERTAIN, so its cost is still recorded.
- A shop can start at most 10 Styled shots a minute; the eleventh is a 429. Best-effort (a count, not a lock);
  the credit hold is what bounds spend.
- A quote on the website prices at the latest stored exchange rate and fetches only when none was ever stored; the
  worker's charge still uses the day's rate.

## 2026-11-21 — The model order is read through a source, ready for an admin screen

- `server/content/generation/model-order.ts`: a purpose's model order now comes from the first `ModelOrderSource`
  that has one — today only the environment's `IMAGE_GEN_MODELS_<PURPOSE>` — else the registry's default. The
  lookup is async through the router, generator, scene painter and enhancement service, so the admin screen
  parked in ai-images Q12 is one new source reading a table, with no other change. No behaviour change.

## 2026-11-21 — Fix: an AI picture's credit always closes, and its derivatives stay AI-made

- From the improve-with-ai review: a redelivered styled run now settles (or refunds) what the last one left;
  a run that keeps erroring is given up after 20 minutes and refunded (`image.enhance` gains `retry` 5 with
  backoff); a run whose job was lost is closed when the shop next asks for a picture. No credit hold stays open.
- Catalog copies an `aiMade` mark onto every picture derived from an AI picture (crop, enlarge, backdrops), so
  none of them can become a marketplace's main image (ADR-0077).
- The dialog stops offering a paid retry once it loses track of a run, ignores a double tap on Generate,
  sends "Add credit" to the Photos page with the credit sheet open (`ROUTES.org.libraryCredits`), and gives
  the version arrows full-size targets.

## 2026-11-21 — Improve with AI: a description and reference pictures become a styled picture of the product [MIGRATION] [CONTRACT]

- [improve-with-ai](specs/ai-images/improve-with-ai/): one **Improve** split button in the library and on every photo
  in the product form. The main half opens the AI dialog (description, pictures to follow from the library or the
  device, no face / with face, the cost and credit from the server); the arrow lists the six exact tools, unchanged.
- Server: `STYLED`, a seventh enhancement tool with its own path (`server/content/styled.service.ts`): the shared
  refusals, the shop's credit held in the request's transaction, generation through the port (`listing.v1` prompt),
  every picture kept straight into the library as an AI-made derived image, then settled or refunded.
- **[MIGRATION] `20261121120000_styled_enhancement`:** the enum value and `Enhancement.brief`, `referenceRefs`, `previousId`.
- **[CONTRACT]** two routes and three `EnhancementDto` fields; CONTRACTS.md updated.
- [ADR-0077](adr/0077-the-pixel-promise-belongs-to-the-backdrop-tools-and-an-ai-picture-is-labelled-and-secondary.md):
  ADR-0059's pixel promise is the backdrop tools'; an AI picture is labelled, kept, and never a marketplace's main
  image — `listing-photos-out.ts` moves it behind a real photograph and refuses a listing with none.
- The library picker can open on one tag; reference pictures are tagged Reference when used.
- Tests: `styled-shot`, `listing-photos-main`.

## 2026-11-21 — Shops have credit for AI pictures; offline money is recorded with proof [MIGRATION] [CONTRACT]

- [shop-credits](specs/ai-images/shop-credits/): `CreditLine` (append-only, the balance is the sum), the
  platform's and each shop's margin, and the platform's payment details, all in the payouts domain
  (`server/payouts/credit.*`, ai-images Q39). Charging, settling and refunding a picture are
  `creditService.charge/settle/refund`, for improve-with-ai; a charge is refused unless the balance covers
  the most expensive model that might answer, under a per-shop advisory lock.
- **[MIGRATION] `20261121110000_shop_credits`** gives every existing shop its ₹2,500 starting credit; a shop
  made later is granted on first read. Adds `Settlement.method` and `Settlement.receiptRef`.
- **[CONTRACT]** `PATCH /api/admin/settlements/[id]` with `PAID` now needs `method` and `reference`, and takes
  `paidOn` (was `paidAt`) — the payouts sheet records them, with an optional receipt. CONTRACTS.md updated.
- Admin: a **Credits** tab in the shop console (balance, margin, record a top-up with proof, reverse a line),
  `/admin/payment-details` (UPI id, QR code, bank account, the platform margin), and the `payments` upload
  folder for receipts and the QR. Shop: a **Credits** button on the Photos page opens the credit sheet.
- Tests: `credit-ledger`, `payment-proof`.

## 2026-11-21 — Library images carry tags: Product and Reference [MIGRATION]

- [media-tags](specs/ai-images/media-tags/): `MediaAsset.tags`, a GIN-indexed array of the closed `MediaTag`
  enum, written only by `media-asset.repository.ts`. A Tag filter leads the library's filter row; the
  photo panel toggles tags; a reference picture's tile carries a badge.
- **[MIGRATION] `20261121100000_media_tags`** tags every shop image a product's gallery uses as Product;
  images no product uses, and platform images, stay untagged (ai-images Q22, as revised by the owner).
- Product is added wherever a gallery links an image (`withAssetIds`, and bulk import); Reference arrives
  with improve-with-ai. `PUT /api/org/[orgId]/media/[assetId]/tags` (free, `core`).
- `MediaAssetDto` gains `tags` (catalog-internal; no `[CONTRACT]`).

## 2026-11-21 — Image generation goes through one provider-agnostic module; scenes are painted on Cloudflare [MIGRATION]

- **New module `server/content/generation/`** ([generation-foundation](specs/ai-images/generation-foundation/),
  [ADR-0076](adr/0076-image-generation-goes-through-one-port-and-models-are-data.md)): one port, adapters for
  Cloudflare's AI gateway (hosted and third-party models), Gemini directly and fal, a model registry as
  data with dated prices, a router (ordered list per purpose from `IMAGE_GEN_MODELS_<PURPOSE>`, capability
  filter, fallback only when a model is unavailable), versioned prompts, and a cost in integer paise at
  the day's ECB rate.
- **[MIGRATION] `20261121090000_generation_ledger`:** `Generation` (one row per model call, written before
  the call so a retry replays rather than pays twice) and `ExchangeRate` (one row per day). Additive only.
- **Behaviour change — "In a scene"** is painted by Cloudflare's klein-4b first (≈₹0.13), Bria on fal as the
  fallback. The paste-back and the pixel check are unchanged. The scene's cost is now its generation
  row's, not the typed `SCENE_PAINT_PAISE` (removed); `Enhancement.provider` reads `generation`.
- `/admin/enhancements` shows the free-tool cut-outs the platform absorbs past the host's 5,000 a month.
- `npm run generate:bakeoff` compares models on a shop's photographs, side by side with cost and time,
  writing no rows. Shared bake-off helpers moved to `scripts/bakeoff-shared.ts`.
- **Deploy:** set `IMAGE_GEN_ACCOUNT_ID` and `IMAGE_GEN_API_TOKEN` (and optionally `IMAGE_GEN_GEMINI_API_KEY`).
  Without them scenes keep working on fal. The worker must reach `api.frankfurter.app` for the rate.
  The hosted model's multipart field names are not documented; verify one live call before relying on it.
- Tests: `generation-router`, `generation-adapter-contract`, `generation-cost`, `generation-idempotency`,
  `generation-vendor-boundary` (mutation-tested), the scene painter rewritten; no contract change.
## 2026-11-20 — Listing drafts say where a create stands; a field map can be removed; size from length x width [CONTRACT]

- **Wording** (`platform-listing-copy.ts`): a listing not yet on Amazon reads "Not on Amazon yet · ready to create"
  in its save bar instead of "6 changes waiting" (every field differs from a page that does not exist), and its draft
  panel says "Sending to Amazon…" or "Accepted by Amazon · waiting for it to go on sale." instead of "Nothing was
  created on Amazon" while the create is out (`CREATE.draftNoteFor`, `saveBarStatus`).
- **"Amazon is showing other content"** no longer fires when Amazon only recased the title (its style rules rewrite an
  all-capital one): titles are compared ignoring case and spacing (`lookAt`, `listing-publish.service.ts`).
- **Remove a field map** (field-maps Q24): `DELETE /api/admin/field-maps` (`fieldMapRemoveSchema`: channel,
  channelType, fieldPath, bbType; audited `channel.field-map.remove`; 404 when already gone), `fieldMapService.remove`,
  a Remove button beside each map. No confirm step, as a change has none (Q4).
- **Size from the measurements:** the rule `size_display_from_measures` sends "60 x 40 cm" for a product with length
  and width, no height and no size label (a rug, a prayer mat); it fell back to "Free Size" before. A product with all
  three measures, or with a size label ("M"), is unchanged. Only Amazon `size_info.display_name` maps it by default.
- A draft Amazon refused or has not answered shows its own status in the save bar, not "ready to create"; an
  unanswered create reads "Amazon hasn't answered yet; the page may still appear there."
- Tests: `tests/unit/listing-draft-wording.test.ts`, `listing-builder.test.ts` (the rule), `field-map-parts.test.tsx`
  (Remove), `tests/integration/listing-build.test.ts` (remove), `marketplace-publish.test.ts` (a recased title).

## 2026-11-20 — A field made of parts is mapped part by part on the admin's field maps [CONTRACT]

- **Why:** the field-map screen mapped a whole channel field to one answer only, so Amazon RUG's Item Dimensions
  L x W (length and width) was mapped to a size word and needed a migration (field-maps Q23, ux signed off).
- **Screen** (`field-map-list.tsx`): a field in parts says "In parts: length, width" and lists each part,
  "{Field} · {part}", with its own map or "Not mapped" and "Map {part}". It offers no whole-field Map; a whole-field
  map made before is marked "Can't fill a field in parts. Map each part instead."
- **Server:** parts are read off the type's stored schema (`server/listing/schema-parts.ts`, now also what the Amazon
  provider uses). `fieldMapService.save` refuses a whole-field map on a field in parts and a part the type does not
  declare; a part's map removes every whole-field map on that field, for any type of ours
  (`fieldMapRepository.removeWhole`). A field the create fills itself (Amazon's offer, stock, parentage) stays
  "Filled by the system" and is never listed in parts.
- **Requests:** a field in parts in an Amazon fields plan is `map_parts` ("In parts: map each part on its field
  maps", with a link to the type's maps) instead of "Needs a developer"; Apply skips it.
- `schema-parts` joins listing's public surface (`tests/unit/module-boundaries.test.ts`).
- Tests: `tests/unit/field-map-parts.test.tsx` (the screen), `tests/integration/listing-build.test.ts` (view and
  save rules), `tests/unit/setup-requests.test.ts` (`map_parts`).

## 2026-11-20 — [MIGRATION] Amazon RUG's Item Dimensions L x W mapped to length and width

- `20261120090000_amazon_rug_length_width`: RUG's `item_length_width` is one attribute of two measures, and the admin
  screen can map a whole field to one answer only, so it had been mapped to a size word. The migration removes that
  whole-field map and maps `item_length_width.length` / `.width` to the product's length and width in centimetres,
  as the default maps do `item_dimensions`. Reference data only.

## 2026-11-20 — Fix: an Amazon create leaves out attributes its type does not have

- **Incident:** the masalla bag's first create under RUG stopped at our own schema check with "Amazon won't take This
  listing as it is (must NOT have additional properties)". Amazon's type schemas are closed at the top
  (`additionalProperties: false`), and the create body always adds our compliance and plumbing attributes (HSN line,
  contact information, dangerous-goods declaration…) plus whatever the field maps build, whether or not that type
  declares them. One undeclared attribute fails the whole listing, and the message named none.
- **Fix:** `conformToSchema` (`amazon.shape.ts`) drops a top-level attribute a closed schema does not declare, as it
  already trimmed undeclared keys inside an item; an open schema keeps it. A mapped answer dropped this way is a
  warning on the listing (`leftOutWarnings`, `amazon.publish.ts`: "Amazon's RUG has no "x" field, so it was left
  out"), so nothing is left out unseen (field-maps Q6). `checkAgainstSchema` names an undeclared attribute instead of
  "This listing", should one still reach it. Which attribute RUG refused is not known: the check's message named none.
- Tests: `tests/unit/listing-builder.test.ts` — an undeclared attribute is left out of a closed type and kept by an
  open one, a mapped one is warned of, and one reaching the check is named.

## 2026-11-20 — Fix: a new Amazon page follows its type's category; the admin channel page loads again

- **Incident 1:** a draft started before its product type had an Amazon category kept "no category" for ever, and
  was sent as Amazon's placeholder `PRODUCT`, which Amazon refuses for a new page. The ticket raised from it was
  filed under the type's later category (RUG), pointing the admin at a mapping with nothing wrong in it.
- **Fix:** a new page's category is the type's mapping as it is now, read when the draft is started, shown and
  sent (`categoryOf` in `listing-create.service.ts`, through `channelSetupService.publishing`, whether or not the
  shop has the channel switched on) and recorded on the draft (`platformListingRepository.setMarketplaceType`).
  An offer keeps the page's own type. A new page with no category is refused locally as `no_category`, with no
  call to Amazon and no ticket: the admin's Channels worklist already lists a type with nowhere to go.
- `publishingFor` now returns a kind's not-sold row, and `publishingOf` stops there, as readiness's `categoryFor`
  does: a kind marked not sold is no longer read as its type's catch-all category (this also corrects the category
  a marketplace ticket is filed under).
- **Incident 2:** `/admin/channels/[channel]` failed to load: `ChannelTypeList` handed `ResourceList` its
  `cell`/`rowKey`/`rowHref` functions from a server component. It is now a client component, and
  `tests/unit/rendering-strategy.test.ts` fails any table reached from server code without `"use client"`.
- Tests: `tests/integration/marketplace-publish.test.ts`, on a test-owned type and mapping — a draft made before its
  type was mapped is sent under the mapping as it is now; one with no category, or a kind marked not sold, is
  refused without asking Amazon.

## 2026-11-20 — Publishing says why a listing was not sent, and does not offer one still being sent [CONTRACT]

- **Symptom:** every refusal read "This listing changed while you were reviewing", including a listing whose
  last send was still waiting on Amazon, which the review kept offering because its fields stay waiting until confirmed.
- **Review:** a listing in `sent` or `checking` is left off the review and counted in `ReviewDTO.sending`, which
  the page says in words; the Listings bar no longer counts it. The listing editor shows its Pending status
  (Q25's one word for sent and checking) in place of Review and publish.
- **Publish:** `PublishResultDTO.refused` is now `{ id, reason }[]` (`PUBLISH_REFUSAL`: changed, sending, nothing),
  and the page shows one message per reason. The claim's version guard is unchanged.
- Tests: `tests/integration/marketplace-publish.test.ts` — a listing still out is off the review and refused as sending;
  one with nothing kept to send is refused as nothing and stays unclaimed.

## 2026-11-20 — Fix: the worker skipped every publish for the home-brand shop

- **Incident:** Niqab Boutique's Amazon publishes sat at "Pending" and never reached Amazon; publishing again
  read "This listing changed while you were reviewing". Each `channels.publish-listing` job completed in ~140 ms
  having called nothing, leaving the listing `sent`.
- **Cause:** the home brand holds every paid feature through `HOME_BRAND_ORG_ID` (`server/shared/home-brand.ts`),
  not an `OrgFeature` row. Vercel has the variable; the worker's deploy never passed it, so `lockedSkip` read
  Channels as off on the worker while the site let the publish through.
- **Fix:** `HOME_BRAND_ORG_ID` joins the worker's env list in `ci.yml` and `staging-worker.yml`
  (`WORKER_ENV_HOME_BRAND_ORG_ID`, `WORKER_STAGING_ENV_HOME_BRAND_ORG_ID`). Needs the secret set and a worker redeploy.

## 2026-11-20 — Fix: CI's production audit blocked on a new advisory in Prisma's `effect`

- `scripts/audit-prod.mjs` failed on GHSA-7589-6fvf-x4pw (high, ReDoS in `Schema.TemplateLiteral`) in `effect@3.20.0`,
  which `@prisma/config@7.10.1` pins exactly. Prisma 7.10.1 is the newest 7.x, so no upgrade carries the fix.
- `package.json` `overrides` lifts `effect` to `3.22.5`, the patched release in the same major. `prisma validate`
  and the unit suite pass on it. Row in [DEPENDENCIES.md](DEPENDENCIES.md); drop the override once Prisma ships it.

## 2026-11-20 — Images no longer go through Vercel's optimizer: each photograph is stored at its delivery widths

- **Incident:** every product image answered `402 Payment Required` from `/_next/image`. The Vercel Hobby
  image-optimization quota (5,000 transformations a month) was spent, and on the free tier it switches images off.
- **Fix ([ADR-0075](adr/0075-photographs-are-stored-at-each-delivery-width-and-served-without-an-optimizer.md)):**
  every raster photograph is also stored as `.w320`, `.w800` and `.w1200` WebP copies beside its original
  (`server/catalog/image-widths.ts`). A custom `next/image` loader (`src/lib/image/loader.ts`) points the
  browser at the nearest copy in R2. `sizes` still decides which one; nothing is transformed on request.
- The store writes the copies, so no caller can forget them: `putObject` for server writes, `confirmUpload`
  for the library and wizards, and review submit/edit for review photos (`ensureWidthCopies`). `deleteObject`
  removes them with the original.
- **Deploy order:** run `npm run images:backfill-widths -- --write` against production **before** this
  deploys, and **again right after**, to catch anything the old code stored in between. A photograph
  without copies renders broken under the new loader.
- R2's CORS rules must allow GET from our origin: the fit-it-in edge sampler reads a copy into a canvas.
- No TRD: an incident fix for a production outage, done at the owner's direction (2026-11-20). ADR-0075 records the design.
- CSP `img-src` gains `lh3.googleusercontent.com`: Google avatars are now fetched by the browser, not the optimizer.
- No migration, no contract change. Tests: `tests/unit/image-widths.test.ts`, plus confirm and review cases;
  each new hook mutation-checked (removing it fails its test).

## 2026-11-14 — /business partner side: packages from ₹899

- "Packages from ₹899" beside the partner side's first ask and in its close; the cost question answers
  with it. No period on purpose: campaigns are charged on top (owner, 2026-11-14).
  `PARTNER_PACKAGES_FROM_PAISE` in `business-copy.ts`, display only.

## 2026-11-14 — /business: one page, two sides — Sell with us and Partner with us

- The owner's direction, from the brand films (`business-page-video-frames` branch, `docs/video-frames/scenes.md`):
  one page with a switch between **Sell with us** and **Partner with us**, plain words, one ask per side.
  `/business` opens on the shop side; `/business?for=partner` (`ROUTES.businessPartner`) on the partner side.
  The switch is links, so each side has its own URL and renders on the server.
- Shop side: hero, the problem, "List once. Sell everywhere." (live places, and Flipkart, Meesho, WhatsApp
  and Instagram posts marked **Coming soon**, owner 2026-11-14), four things it does, a coming-soon section,
  the ₹699 plan, three steps, questions, close. One button, "Open your shop".
- Partner side (new): who it's for, where buyers arrive, three placements (home page banner, category pages,
  every campaign) drawn over photographs of the live site, what it says about the brand, three steps,
  questions, close. One button, "Become a partner", opens Contact us in its partner version — a
  partner title, a WhatsApp message and the subject "Partnership" filled in. No new form, no price
  (quote on request).
- No people on the page (owner): drawn product screens, and two captures of bhendi-bazaar.com in
  `public/business/`.
- Shared pieces, each one entry: `Button` variant `spotlight` (the gold ask), `PageTabs` variant
  `segmented`, `ContactLauncher`/`ContactSheet` `intent="partner"` (title, no policies row) beside main's `prefill` for the words.
- The shop side keeps "Talk to us" in the top bar and under the plan (feature-access Q30).
- Display only: no data, route handler or contract change.

## 2026-11-12 — /business: a design pass on the page a shop decides on

- Desktop hero no longer leaves the right half empty: the phone sits on a tinted stage with a "New order"
  card and the "Live on every channel" card tucked to its edges, so neither covers the phone's button.
- A "works with" strip under the hero names Amazon, Flipkart, Google Shopping, Facebook & Instagram.
- "How it works" is one framed diagram (product → one stock count → channels) instead of three loose
  columns with dead space; feature, closing and product tiles get tinted stages instead of flat grey.
- "Why shops choose us" items are cards; "Questions? Talk to us" is an outline button, not bare text —
  `ContactLauncher` passes `variant` and `size` through to its `Button` (ghost stays the default).
- Display only: no route, data or contract change. Copy added to `business-copy.ts`.

## 2026-11-13 — Fix: a variant opened from a shop's product page left the shop

- **Bug:** on a themed shop's product page (`/product/{slug}?shop={handle}`), tapping another variant under "Also
  available" opened `/product/{variant}` without `?shop=`, so the page fell back to the marketplace chrome and the
  buyer was out of the shop (storefront-themes Q33 broken). "Similar products" below did the same, and listed other
  shops' goods.
- **Fix:** the shop a product page keeps is now one per-request answer, `productChromeShop()` in
  `storefront.dal.ts`, read by both the `(main)` layout (for the chrome) and the product page (for its links), so
  the two cannot disagree. Variant links, the similar-products grid and the themed cards (which drop `storefrontProductHref`) share one `productHref`
  (`src/components/shared/product-href.ts`) that adds `?shop=` inside a shop and stays canonical elsewhere. Inside
  a shop, similar products are that shop's own (`getSimilarProductsForOrg`). The marketplace product page is unchanged.
- Tests: new `storefront-variant-links`: a variant and a similar-product card keep `?shop=` inside a shop and are
  canonical outside one; `read-cache-tables` (integration) exercises the new `similar-products-org` read. **Mutation:** putting back `ROUTES.product(sibling.slug)` failed it; restored. Checked in the
  running app: from a shop's product, tapping the variant kept the shop's look, and no product link on the page left
  the shop. Ran: `tsc --noEmit`, `vitest run tests/unit`, `read-cache-tables` against `bhendi_bazaar_dev`, `lint:boundary`.

## 2026-11-13 — Storefront font, unit 3: a shop picks its heading face, and its store draws it

- **own-store/storefront-font** unit 3 (Q2, Q9; R1–R7; D6, D7; A1–A4). Each card in Storefront → Look gains a
  "Font for headings" row. It opens the eight faces as samples of the shop's own name, cut at 24 characters,
  suggested for the template first, then more fonts, with "Use template default". It is a bottom sheet on a phone
  and a popover from `md:` (`ResponsivePicker`, ADR-0040 decision 1); each face is a pressed/unpressed button. A face
  picked carries across templates, even a template's own; only "Use template default" clears it (R6). A "Previewing
  · not live yet" banner shows while the face differs from the live one. The cards and the full preview pass it as `?font=`, the preview page draws
  it, Publish sends it, the confirm reads "Publish {Template} with {Face}?" and the toast "Published. Your store now
  uses {Face}."; the old "Your new look is live." and "Publish {Template}?" strings are gone.
- The themed shell sets `data-font` and the face's loader class when a face is chosen, so the shop name, section
  titles, product names and the product page title take it. Prices, body, buttons and chips keep the theme's faces.
- Tests: new `storefront-font-picker` covers the row's default, the samples, long names, a chosen face redrawing
  the card, the face carrying to another template and being published, Use template default sending none, and
  the shell's `data-font`, and a template's own face kept across templates. **Mutations:** publishing the live face instead of the chosen one failed 2 tests;
  dropping `data-font` from the shell failed 1; both restored. Checked in the running app as the local seed's shop
  owner: the phone sheet, the desktop popover, and the store at 360px with Marcellus (Darbar) and Poppins (Bloom).
  Headings measured 22px phone and 18px section titles in the chosen face, prices in the theme's face, and only
  the chosen face downloaded. Ran: `tsc --noEmit`, `vitest run tests/unit`, `lint:boundary`.

## 2026-11-13 — Storefront font, unit 2: the heading face is published with the look [MIGRATION] [CONTRACT]

- **own-store/storefront-font** unit 2 (Q6, Q7; D3, D4; A1, A3). The face rides the look: the look schema requires
  `font` (a listed key or null), so a tab opened before this deploy is refused rather than clearing a chosen face; `publish` writes it under the same `lookVersion` compare-and-set;
  a change of font alone is a change of look, so the face it replaces is kept for Switch back, which restores it.
  `Storefront` and `StorefrontPageDto` carry `fontKey`, parsed on read (a retired key reads as the theme's own). The
  picker sends the live face unchanged until unit 3 gives it a control.
- Migration `20261113090000_org_profile_font_key`: adds nullable `OrgProfile.fontKey` and `previousFontKey`. Additive;
  no backfill; nothing dropped. Applied to the local dev database only.
- `[CONTRACT]` `StorefrontLookInput`, `LookKeys` (`StorefrontLookState.live`, `.previous`), `Storefront.fontKey`,
  `StorefrontPageDto.fontKey` (CONTRACTS.md).
- Tests: `storefront-look-publish` (integration, local Postgres) gains a font-only publish, Switch back restoring
  the default face, and a retired key reading as null; `storefront-look-picker` checks the schema accepts listed
  keys and null and refuses a family name or a CSS value. **Mutation:** dropping `font` from the same-look check
  failed 2 integration tests; restored. Ran: `tsc --noEmit`, `vitest run tests/unit`, the look and editor integration
  suites against `bhendi_bazaar_dev`.

## 2026-11-13 — Storefront font, unit 1: the heading-font list, its faces and ADR-0074

- **own-store/storefront-font** unit 1 (Q1, Q7, Q8, Q10; D1, D2, D5, D8). No behaviour change: nothing sets
  `data-font` yet. `FONT` in `server/catalog/storefront-themes.ts` lists the eight faces the owner chose, each with its
  own CSS variable, a one-line kind, and per-theme suggestions led by the theme's own face; `readFontKey` reads an
  unknown key as the template's default. `theme-fonts.ts` loads Marcellus, Poppins and a standalone DM Sans
  (`preload: false`), and `globals.css` gains a `[data-font]` scope per key that repoints the display face only.
- A chosen DM Sans reads its own variable, not `--font-body-face`, which Darbar repoints to Jost. Marcellus ships one
  weight, so its scope refuses a faked bold (`font-synthesis-weight: none`) where a theme asks for 600 or 800.
- **ADR-0074**: a theme never sets proportion, and a shop picks its heading face from a closed list. It amends
  ADR-0064 D1, D6 (a chosen face is a third family on a page) and its last consequence. CONVENTIONS.md gains the line.
- Tests: `storefront-themes-registry` checks the list, one scope per key pointing at that key's own variable, no
  size, weight or case in a font scope, suggestions, key parsing, and that every face is loaded. **Mutation:**
  pointing DM Sans at `--font-body-face` failed 2 tests; restored. Ran: `tsc --noEmit`, `vitest run tests/unit`.

## 2026-11-13 — Storefront look, units 2–4: heroes never bare, no shade on photos, compact Darbar categories [CONTRACT]

- **own-store/storefront-look** units 2, 3 and 4 in one change (the hero rebuild is what removes its scrim, so the
  two could not land apart). Q3, Q4, Q5, Q8, Q11, Q12; R4–R7, R9; A2–A5.
- **Heroes** (`themed/hero.tsx`), each variant kept and reshaped to the signed-off prototype: text never sits on a
  photo. One identity block (logo, name, line, chips: rating above its floor · since · products, Shop all) sits
  below the photo on a phone and beside it from `md:`. Edge and Bloom fill the desktop side with featured goods
  (best selling in stock, then new in; Q11, no new query); Darbar's solid name card overlaps the photo's foot;
  Daily shows a rail of the shop's banners (title on a solid label, tap follows its link) then hero photos, and a
  strip of derived facts; Edge labels its photo with the first titled banner; Darbar's desktop adds four featured
  goods. Photos and banners keep their slot's shape (4:5; 16:9 or 5:2 from `md:`, Q12); with no photo the pattern
  is a short band. Hero "Shop all" shows on a phone in Edge only (Q13). `StorefrontPage` gains `banners`, read
  with the landing page (one more cached query); `[CONTRACT]` CONTRACTS.md moves with it.
- **No shade** (Q3): the photo scrim leaves the hero and the themed card; the offer badge sits on the deal ground
  (Bloom, Daily) or as deal ink on the card ground (Edge, Darbar), and "Sold out" on the card ground. The
  marketplace card keeps its scrim (Q9, parked).
- **Darbar categories** (Q5): `editorial` is a rail of arched tiles (112px phone, 176px desktop) with the same
  heading as the other themes, in place of three full-screen tiles.
- Product page in a store: Darbar's title is in capitals and "Product details" takes the theme's face.
- Tests: new `storefront-look-hero` (each theme's hero holds identity and chips outside the photo, R9 with no
  photo and one product, featured order, Darbar's six-tile rail); `storefront-palettes` gains a scan that no
  themed component uses a scrim and a deal-on-card contrast check for Edge and Darbar's palettes.
  **Mutations:** a `bg-photo-scrim` put back on the Edge identity block failed the scan; slicing Darbar's rail to
  three tiles failed the rail test; letting Daily's first slide span two rows with two slides failed the no-blank
  test; all restored. Checked in the running app at 360×740 and 1280×800 for all four
  themes; the product title measured 22px / 32px and the price 18px / 22px. Ran: `tsc --noEmit`,
  `vitest run tests/unit`, `lint:boundary`.

## 2026-11-13 — Storefront look, unit 1: every template on the platform type scale

- **own-store/storefront-look** unit 1 (Q1, Q2, Q6, Q7; R1–R3; A1, A6). The four `[data-theme]` scopes in
  `globals.css` no longer set any `--text-*`, `--spacing-*` or `--container-*`: shop names, titles, prices and
  section spacing are the platform's in every template (Bloom's headline was up to 72px, Edge's 96px). A theme
  keeps face, tracking, shape, motion and pattern, and gains `--font-display-weight` and `--display-case`
  (Darbar's caps, Daily's heavy weight) read by the new `font-display-weight` and `display-case` utilities at every `font-display` site.
- Product page inside a store: the title is the theme's display face at headline size (was the platform's
  Playfair, bold, at the theme's size); `PriceDisplay size="lg"` is title size under a themed shell through the
  built-in `in-data-theme:` variant, unchanged on the marketplace. Daily keeps three phone columns (Q6, owner).
- Tests: `storefront-themes-registry` now fails if a theme scope sets a size, spacing or width (storefront-look
  A6) and requires each theme's weight and case; the pairwise difference check reads weight and case in place of
  size. New `storefront-look-scale` pins the product title and price (A1). **Mutation:** adding
  `--text-headline: clamp(2.5rem, 1.9rem + 3vw, 4.5rem)` back to the themes failed 3 tests; restored, all pass.
  Ran: `tsc --noEmit`, `vitest run tests/unit`.

## 2026-11-12 — Test: feature-public-reads cleans up its shop's pickup address

- CI failed in `feature-public-reads` cleanup: deleting the shop hit `OrgAddress_orgId_fkey` (an org's addresses are
  `Restrict`). The cleanup now deletes the shop's address links and addresses first, as `pickup-address` does, and
  skips when setup failed, since an undefined id is no filter to Prisma.
- Tests: full integration suite passes (96 files, 727 tests).

## 2026-11-12 — Paid-feature locks: Channels, Storefront and Image enhancement per shop [MIGRATION] [CONTRACT]

- **subscriptions/feature-access**, built in one pass (owner: no separate PRs). A new `subscriptions` domain
  owns `OrgFeature` (one row per shop and feature; an absent row is locked) and the one check every domain
  asks. The home brand (`HOME_BRAND_ORG_ID`) holds everything with no row. **Every shop but the home brand
  starts locked**; the admin switches each feature on the shop's new **Plan** tab, audited.
- **Locks hold at every way in** (Q29): channel actions refuse in their services and at `accessToken`;
  enhancement requests refuse before a slot is spent; channel jobs for a locked shop end with a skip, and
  passes over many shops leave them out; Google and Meta feeds, the `/store` directory, the sitemap and
  "Sold by" leave a locked shop out; its storefront is "not yet available" to all but its team. Every org
  route and job is classified in `feature-registry.ts`.
- **Screens never hide** (Q20): paid actions keep their place with a lock and open one plan sheet whose
  Talk to us fills the contact sheet with the feature and the shop. `/business` gains Talk to us in its
  header and on the pricing card.
- Migration `20261112090000_org_feature`: creates `OrgFeature`, empty; nothing dropped. **Set
  `HOME_BRAND_ORG_ID` in every environment before deploying**, or the home brand locks too.
- `[CONTRACT]` `FeatureAccessDTO`, `OrgPlanDTO`, `FeatureSwitchDTO`, the lock's `feature` detail on a 403,
  and the admin switch route (CONTRACTS.md). `BULK_SKIP_REASON` gains `channels_locked`.
- Tests: `feature-access`, `feature-enforcement`, `feature-public-reads` (integration, real Postgres);
  `feature-registry`, `feature-locked-envelope`, `feature-locks-ui`, `org-auth` (unit). Mutations, each
  turning its test red before restoring: removed `{ feature }` from the publish route's `withOrg`; renamed
  the read-listings job type; removed `bringBack`'s Channels assert; removed the publish job's skip;
  dropped the feed's holders filter; let a guest through a locked storefront; made `LockedAction` always
  render its child; dropped the fill-facts and photos skips; locked disconnect; health-checked a locked
  shop; removed the shop page's storefront gate.
- Reviewed in a fresh context: the storefront gate moved from the layout into each page (a layout does not
  stop its pages rendering into the payload); listing saves stay free (Q34); the `?shop=` product header,
  touch target, unknown-shop 404 and raw feature strings fixed; free paths and token renewal now tested.

## 2026-11-12 — Only the spec is line-capped; TRD and UX are not

- [ADR-0071](adr/0071-only-the-spec-is-line-capped.md): `trd.md` is as long as its decisions need. The owner
  reads the spec, decisions and the UX prototype, not the TRD; the 100-line cap was trimming rationale a builder and
  reviewer need. `ux.md` uncapped too (owner). `spec.md` keeps the cap. ADR-0010 D4 and ADR-0061 D3 amended (Status lines only).
- Moved with it: root `CLAUDE.md` cycle table, `docs/CONVENTIONS.md`, `docs/README.md`, `docs/specs/README.md`,
  the ADR index, `/bb-sdlc` (no TRD count) and `/bb-review` (no TRD length finding).

## 2026-11-12 — docs: two changelog files; shipped features drop ux and TRD; dead docs removed

- Two changelog files: `docs/CHANGELOG.md` holds only the running month (506 KB → 240 KB), and
  `docs/CHANGELOG-HISTORY.md` holds a short summary per closed month plus the last PR number used. August to
  October are summarised there; their full entries, and the `docs/changelog/` monthly files, are dropped (git
  keeps them). Six November entries that sat above the Format section now sit under Entries.
- `scripts/hooks/session-start.sh` (SessionStart in `.claude/settings.json`) tells Claude when a closed month is
  still here; Claude writes its summary, then `scripts/changelog-rollover.mjs` drops it, refusing a month with no
  summary (ADR-0072).
- Removed: `.claude/artifacts/platform-audit.html` (superseded by GTM-READINESS.md), the listing-model
  `plan.html` and setup-requests `prototype.html` (both features shipped; links point at commit 431ed6e7),
  `docs/_archive/` (labelled do-not-trust since 2026-08-03), and 41 finished or parked items from TRACKER.md.
- Shipped features keep `spec.md` + `decisions.md` only (ADR-0073): 78 `ux.md`/`trd.md` files (688 KB) of
  Implemented features deleted; 131 links into them rewritten as pinned `431ed6e7:<path>` refs; the channel copy
  modules are now the source of their screens' words. bb-build deletes them when it flips Status.
- Also removed: `multi-vendor-marketplace/consumer-inventory.md` and `portal-split.md` (used only by shipped
  subfeatures). `data-model.md` stays: the unbuilt org-team spec still cites it.
- Tests: `tests/unit/changelog-rollover.test.ts` (an unsummarised month is refused and nothing changes; the PR
  high-water mark is kept); docs-integrity numbering now checks the running month against that mark.

## 2026-11-12 — Listings: Fix → Edit product → Save or Back comes back one step at a time

- From a filtered Listings page, Fix opened the listing screen, whose Back went to the product page; from
  there Edit product's Back and Save went to the Products list. Two steps skipped, filters lost.
- Each screen now carries the one that opened it as `from`: the listing screen's Back returns to Listings as it
  was left, and Edit product's Back, Cancel and Save return to the listing screen (Save after the toast). Opened
  any other way, both behave as before. `from` is followed only if it is our own path (`safeReturnPath`, the
  sign-in rule), else the screen's natural parent.
- Tests: listing-fix-return (new; mutation-checked).

## 2026-11-12 — Addresses: an edit changes the address; a failed add says so; sign-in at checkout keeps the typed one [CONTRACT]

- Profile: editing a saved address posted it as a new one, so the book grew a duplicate and the old one stayed.
  An address with an id is now updated in place.
- Checkout: adding an address closed the dialog and selected it whether or not the save worked, with an id the
  browser made up. The dialog now waits for the server, shows its error and stays open on failure, and selects
  the address as saved. `POST /api/addresses` returns the saved address (CONTRACTS.md, Addresses); its
  validation failures now carry their field details, so the dialog shows them on the fields.
- Checkout: signing in threw away the address a guest had typed. It now stays selected; an order carries its
  address inline, so it needs no account id (seamless-sign-in D13, superseding D10's clearing).
- Tests: address-saves (new; both cases mutation-checked), checkout-sign-in updated.

## 2026-11-10 — Amazon: a created page is looked at until it is buyable; its ASIN kept; handbag silhouette sent [MIGRATION]

- The first Generic HANDBAG listing was created at 20:57 UTC and Amazon made it buyable later; our follow-up
  looked twice (about two and ten minutes after the send), found it not yet buyable, and called it done
  (`live: false` for good). A page we created and found but not yet buyable is now looked at on the existing
  schedule (up to two hours) and only then settles; a complaint still ends the wait at once.
- The look reads the page's own id (Amazon's ASIN, `StatusAnswer.externalId`, optional) and keeps it on the
  mirror row (never overwriting one held); a create's link carries it.
- Data migration `20261110090000_amazon_handbag_silhouette`: Amazon's quality warning named
  `handbag_silhouette`; it now follows the bag's kind, each paired to Amazon's nearest word (handbag → satchel,
  tote → bucket, sling, messenger). Reference data only.
- Verified first, read-only (one GET with the shop's connection, token kept in memory): Amazon holds SKU
  NBHBT0906 as DISCOVERABLE and BUYABLE, ASIN B0HR3B6NSZ, ₹220 (MRP ₹290), FBM quantity 1. Seller Central's
  "Missing Offer" and 0 were its inventory page lagging, not a dropped offer.
- Tests: marketplace-publish (looks on until buyable, then settles with the ASIN); both changes mutation-checked.

## 2026-11-09 — Amazon: a missing barcode is the shop's to give, never a request [CONTRACT]

- Amazon's next check of the HANDBAG listing (06:17) had one error: no barcode ("Externally assigned product
  identifier"). The listing card said "Amazon also needs 1 detail we don't ask for yet" and the requests
  daily pass **reopened** the closed HANDBAG ticket for it, though only the shop can add a barcode or get the
  brand's exemption, as the barcode card on the same page says.
- The Amazon provider now marks those complaints `ISSUE_NEED.BARCODE` (the identifier, the exemption flag,
  a suggested ASIN); the listing plan leaves them to the barcode card; requests never raise one, even from
  an issue stored before the mark, and a ticket that named one still closes on the daily check.
- `ISSUE_NEED` gains `barcode` (CONTRACTS.md, ListingIssue); `TypeAttribute` gains optional `parts` (internal to
  channels and requests, no wire change).
- Tests: listing-plan, listing-publish-providers, setup-requests; each mutation-checked.

## 2026-11-09 — Amazon: the first HANDBAG send's refusals fixed at their cause [MIGRATION]

- Amazon checked the first live HANDBAG listing (2026-11-09) and refused it: Item Weight invalid with no
  unit, Water Resistance Level not an approved value; and inner, item_dimensions and size_info ignored as
  "not applicable". Not missing questions: wrong maps. A setup request applied on 2026-11-06/08 had mapped
  whole groups to one text answer (inner and size_info → "What is in the set", item_dimensions and
  **item_weight** → "Form"), the last overwriting the weight-in-grams map; and water resistance sent
  Amazon's display words where its schema takes codes (`not_water_resistant`).
- Data migration `20261109090000_amazon_handbag_map_fixes` (reference data only): the four wrong maps
  removed (their part maps already send inner.material, length/width/height and the size display name),
  item_weight restored to the product's weight in grams, water resistance paired to Amazon's codes.
- Guard: Amazon's definition now names a group's parts (`TypeAttribute.parts`), and a request never
  proposes one answer for a group, even a fact named after it. Tests: setup-requests, a new
  amazon-grouped-attributes test against the stored HANDBAG schema; both mutation-checked.
- The listing card's Ready line no longer says "Fill these on the product: …" with every field Amazon
  named (14, most filled automatically): it sends the shop to the product, where only real gaps show.
- Verified read-only on production: the live product builds with weight 250 g, `not_water_resistant`,
  inner and outer material, L×W×H in cm, department Girls, age range Kid, capacity 500 ml, no gaps.
  The HANDBAG request was already closed by the daily check (2026-11-08); nothing for the admin to do.

## 2026-11-08 — requests: a field a field map fills is answered; no more Inner → "What is in the set"

- The Amazon fields request for HANDBAG asked a developer for department, capacity, age range, number of items
  and outer material, and proposed mapping Inner → "What is in the set" and Item dimensions → "Form". All were
  already filled by field maps (department and age range from the audience, dimensions from length × width ×
  height, inner and outer material from their attributes): `channelSetupService.answered` read only the old
  register. It now also counts a field map, by its path's first part (`inner.material` answers `inner`).
- The matcher paired words by any prefix, so `in` (from "What **in** the set") matched `inner`, and `item`
  paired `item_dimensions` with `itemForm`. It now drops joining words and Amazon's `item_` prefix, splits our
  camelCase keys, and counts a prefix only between words of four letters or more.
- Read-only audit on production (owner's request): with the fix, the open HANDBAG ticket has **no** field left
  unanswered. Tests: setup-answered (integration), the matcher's two pairings (unit). Mutations: dropping the
  map read and reverting the matcher each failed a test.

## 2026-11-08 — CI: the e2e build cache is reused only for the exact same code and schema

- The e2e job failed twice on "browse a category" (the product it had seeded never appeared) and passed
  each time only after the `nextjs-…` cache was deleted. Its key hashed `src/**` and `server/**` only and
  fell back to any older cache, and `.next/cache` also holds Next's stored page data: after a schema
  change, data built for the old code could be served. The key now also hashes `prisma/**` and
  `next.config.*`, and the fallback `restore-keys` is gone. A miss costs a full build, a few minutes.
- Not reproducible locally (fresh database, clean build, CI's env only: 12/12 pass), so the cause is
  inferred from the fix, not observed. Ran: `deploy-safety` test.

## 2026-11-08 — docs: test-file count after merging listing-model into main

- `docs/ARCHITECTURE.md` said 375 Vitest files; the merge of `feat/listing-model` with main's newer work gives
  376 (284 unit). CI's docs-integrity test failed on it. Ran: that test.

## 2026-11-08 — listing-model / retire-old-paths: the product's old answer columns go [MIGRATION]

- Migration `20261108190000_retire_frozen_answers` copies `Product.facts` and `measurements` whole into
  `ProductAnswersArchive` (read by no code; a record so nothing is lost), then checks that every answer is in a
  value row and the archive is complete, and fails changing nothing if not, then drops the two columns. The
  compare script is retired: its check now runs inside the migration, on every database it reaches.
- ADR-0051 superseded and ADR-0070 accepted; CONVENTIONS describes the new model. The programme's HANDOFF.md
  is removed (the specs, decisions and this log carry its state).
- **Not removed, logged as decisions Q4:** the old channel map tables, `ListingValue`, the code fact list and
  `Product.weight` are still read by publish, feeds, readiness, the form or checkout, so dropping them would
  break those. Each moves to the new tables in its own unit after the owner's publish test.
- Guard: `answers-live-in-values` fails on any code naming the dropped columns or reading the archive. Ran:
  `tsc`, unit, docs check, the migration on local dev and ci.

## 2026-11-08 — listing-model / dynamic-form A4: a product sets its own country, maker, packer or importer

- The product form's Details step shows "Who makes it and where it's from": each of country of origin, maker,
  packer and importer reads "From your brand Noor: …" (or the shop's country when the brand names none);
  Change makes it the product's own ("Set on this product"), "Use brand's" goes back (ux journey 3, R3, A4).
  The add form now gets the shop's brands too.
- The save keeps those four as the product's own answers (`ownOverrides` in listing-fill); the value functions
  already never put the brand's value over one. A create sends the product's own first, then the brand's, then
  the shop's country (`complianceFor`). The closed set is `INHERITED_ANSWER` in `server/shared/brand-party.ts`.
- Tests: `tests/unit/product-inherited-fields.test.tsx` (the form, the publish order), listing-fill (the save).
  Mutations: dropping the save's overrides, the publish's own-first, and the revert each failed a test.
- **Fresh-context review, and its fixes:**
  - **Blocker:** the form's save dropped every fact its type does not ask, and no type asks these four, so an
    override on a new product (or after a category change) never reached the server. `keepAsked` keeps them.
    Found with it: the edit form read stored facts through a parser that read a product with any unknown key
    as having **no facts at all**; it now skips only that entry. Tests: `keepAsked` unit, and the real edit
    form saving a maker, keeping it through a brand edit, and "Use brand's" bringing the brand's back
    (`product-edit-keeps-facts`). Mutations: both fixes reverted each failed a test.
  - A brandless product's create sent no maker or packer though its form showed the default brand's; the create
    now uses the shop's default brand (`defaultBrandOf`; brand-parties test, mutation failed it).
  - Copy: "Use shop defaults's", a stray space and an empty brand name fixed with whole sentences per case.
- Ran: `tsc`, unit, the touched integration files one at a time.

## 2026-11-08 — listing-model / dynamic-form unit 3b: a product's answers live in the value rows (full switch) [MIGRATION]

- **Owner decision Q16:** one full switch, no product or database information lost. Migration
  `20261108180000_answers_live_in_values` gives `ProductValue` the answer exactly as the product holds it
  (`answer`, with origin, unlisted flag and marketplace source, so nothing is dropped) and a `measured` flag;
  drops every value-sync trigger; adds `bb_write_answers` and `bb_write_inherited`; moves every product; and
  refuses to finish, changing nothing, if any answer would be lost. `Product.facts` and `measurements` are
  **not dropped**: renamed `factsFrozen`/`measurementsFrozen` in the schema, a frozen pre-switch copy read only
  by the compare gate until retire-old-paths drops them behind the backup.
- **One writer:** `product-value.repository` writes in each write's own transaction: product create, update,
  bulk import, marketplace fill, answer set and undo, the fact correction, the seed; brand, party, default-brand
  and shop-default writes refresh the products they fill. **Every reader** reads the value rows: catalog's
  product reads attach them, the storefront joins them into its one query (query budgets unchanged), readiness,
  channels' family read and the register's values-in-use read them.
- **Found on the way:** two JSON-path filters on the old column (the fact correction, values in use) the type
  checker could not see, moved to the value rows; the storefront cache declares `ProductValue`, and (review B3
  below) a call to the value functions now counts as a write of it, so an edited answer clears cached pages.
- **Fresh-context review, and its fixes** (all logged with the mutation that proves each test):
  - **B1** a product inheriting its brand's country could not save its own: both rows took one id, so the save
    failed on the primary key. Ids are now per kind (`:f:`, `:m:`, `:w`, `:i:`), `bb_write_answers` clears all
    the product's rows before writing, and an inherited row never goes over the product's own (A4). Test: own
    country saved, then kept through a brand edit (mutation: the old partial delete failed it).
  - **B2** the decimal check was double-escaped, so `2.5` stayed text and `40.5 in` lost its canonical number.
    Tests: decimal fact and measure (mutation: the double escape failed both).
  - **B3** the cache saw only `INSERT`/`UPDATE`/`DELETE` naming a table, never `SELECT bb_write_answers(…)`, so
    an answer-only edit did not clear cached pages. `table-writes` now maps the value functions to
    `ProductValue` (unit test; mutation: dropping the map failed it).
  - **S1** a re-type (marketplace category, a category's type or place, a type's measure units) left typed rows
    in the old unit. New `bb_rederive_answers` rebuilds them from the verbatim answers, called in each of those
    writes' transactions (tests; mutation of each of the three call sites and of the function failed them).
  - **S2** a brand edited from default to not left its brandless products filled; update passes what it was.
    **S3** the fact correction locks its products before reading them. **S4** decisions Q16 and HANDOFF
    corrected (the old columns are frozen, not written). **Low:** hero products read their answers;
    `fillEmpty` is one transaction; `forListing` typed without a cast; the guard regexes widened (mutation: a
    planted `p."facts" ->>` failed it); `setAnswers` keeps the product's weight when none is given.
  - The migration was regenerated; local ci and dev had its function section and backfill re-run (idempotent,
    no-loss check passed) and its checksum updated.
- Guards: `tests/unit/answers-live-in-values.test.ts` fails on any code touching the frozen columns, any raw
  query or JSON-path filter on them, or any writer of ProductValue but the repository (mutation: re-adding the
  old values-in-use query failed it). `scripts/attributes-compare.ts` now checks the frozen copy against the
  value rows: local dev PASS. Tests moved to `setAnswers`/`answersOf` helpers. Ran: unit, integration (local ci,
  one file at a time), `tsc`, the stop hook.

## 2026-11-08 — listing-model / dynamic-form unit 3a: completeness on the product page

- The channel strip ("Amazon 17 of 19", "Ready for …", what is still needed) now shows on the product view
  page as well as the edit page (R4). The products list's channel pills already count, per channel, the
  products it would refuse, which since unit 1 includes every field the channel's own catalogue requires:
  one count per pill, not a second (Q2 resolved).
- No new tests: the strip and its read are covered by unit 2's; the page only places it. Ran: `tsc`, unit.

## 2026-11-08 — listing-model / dynamic-form unit 4: the brand page holds its parties and its Amazon choice [CONTRACT] [MIGRATION]

- **Brand form** (R7, A5, Q13): "Who makes, packs and imports it (marketplaces ask)" with three optional
  parties (name, address, pincode) and "List as Generic"; only the name is required. Saved with the brand in
  one transaction through catalog's brand repository; a blank party is removed; the brand's maker and packer
  lines follow so every reader agrees until retire-old-paths. The card shows maker, packer, importer and
  "Not registered on Amazon: lists as Generic". Party roles are one closed set in `server/shared/brand-party.ts`.
- **Shop-wide Generic switch retired** (Q14, superseding attributes Q16; migration
  `20261108170000_brand_owns_amazon_choice` drops its trigger): its section, route, schema, client method and
  repository command removed. Each brand keeps its choice; the listing screen and a create read the brand's;
  a product with no brand takes the shop's default brand's, and only with none the shop's old column
  (`server/channels/generic-brand.ts`). No listing changes on deploy.
- **Fresh-context review fixes:** an Amazon create now sends maker, packer and importer each from its own
  party with address and pincode, importer only from the importer party, so a domestic brand's packer is
  never declared as its importer (`complianceParties`); a party with an address but no name is kept; the
  Amazon choice is the two-way "Registered on Amazon / List as Generic"; "Couldn't save. Your changes are
  kept."; the brand form's Partial state is shown through completeness (Q15); TRD D7 updated.
- [CONTRACT] `brandSchema`/`updateBrandSchema` take `parties` and `amazonRegistered` instead of the two lines;
  `BrandDto` gains both; the amazon-generic route is gone (CONTRACTS.md).
- Tests: brand schema (parties blank to null, six-digit pincode), the brand page saving parties and the Amazon
  choice with products following, a PATCH without parties keeping them and a blanked party removed, a
  brandless product following the default brand, compliance lines per party (`compliance-parties.test.ts`),
  service and integration fixtures moved to the new input.
  Ran: unit, integration (local ci), `tsc`, `lint:boundary`, `docs:check`.

## 2026-11-08 — listing-model / dynamic-form unit 2: completeness per channel, stored [CONTRACT] [MIGRATION]

- **`ProductChannelState`** (migration `20261108160000_product_channel_state`; one new table): per product,
  per channel the shop sells on, how many required fields it answers and what is missing (D3, R4). One
  writer, `product-channel-state.repository.ts`; computed by `completeness.service.ts` with the same build a
  send makes (Q9), in batches of 500, by the new `listing.refresh-completeness` job (`listing.jobs.ts`,
  registered in the worker).
- **Recomputed** after a product save, archive or restore, a bulk sheet, the fix page's answer or undo, a
  channel turned on or off, a field map saved and a channel newly asking more; a daily sweep re-asks for
  every shop selling anywhere (Q11). A failed ask is logged, never fails the save.
- **Shown:** the product edit page's strip ("Amazon 17 of 19", "Ready for …", what is still needed) and a Home
  line per channel, "38 products need up to 4 details for Flipkart", opening the products list filtered by
  the channel (R5, Q10). [CONTRACT] `HomeAttentionDto.channelNeeds` (server read; CONTRACTS.md).
- Tests: `tests/integration/completeness.test.ts` (stored, adapter fields not counted, moves when
  answered — A2; archived and unread types hold no row; a channel no longer sold on loses its row); the Home line in `home-attention.test.ts`.
- **Fresh-context review fixes:** completeness takes the shop's HSN and honours "not sold here" as a send
  does; a channel type never read, and an archived product, hold no row (never a "Ready" not earned); the
  row carries its shop, so listing never filters on catalog's table; one refresh per shop at a time (an
  advisory lock). Still to build: counts on the products list's channel filter and the strip on the
  product page (Q2 back to decided).
- `module-boundaries`: listing's public surface gains `completeness.queue`, because a product save (catalog)
  and a channel's new rules (channels) ask completeness to be recomputed.
  Ran: unit, integration (local ci), `tsc`, `lint:boundary`, `docs:check`.

## 2026-11-08 — listing-model / dynamic-form unit 1: the form asks every question, grouped by what channels need [MIGRATION]

- **New questions answerable** (Q5, migration `20261108150000_dynamic_form_questions`): style, lining
  material, pockets, strap type, fabric type, size system and type, form, units, stone clarity and cut,
  metal weight, generic name and model name declared as facts with their attribute keys; their lists
  (style and strap type from Amazon's own, sizes); each type's questions extended, capacity on bags and
  pouches, pack quantity and care where parent Q26 asks; metal weight asked in grams; the list-sync trigger
  knows the new facts. **Behaviour change:** every product form asks these.
- **Grouped by channel** (R2, A1, Q6–Q8): "Required now" holds the store's required measurements and what
  a channel the shop sells on requires, badged with it, measurements included (capacity on a bag); the rest
  sits under "Also helps on {channels}", collapsed, opened when it holds an error; badges follow the kind
  shown (a tote's channel types, not a backpack's). Computed on the server for every
  type (`server/listing/form-channels.ts`, pure; `form-channels.service.ts`), handed to the form through
  the types DAL; nothing blocks a save.
- Not a contract change: `PLANNED_ATTRIBUTES` (`field-map.types.ts`) is emptied because its keys are now
  facts; the admin field-map route accepts the same keys as before (CONTRACTS.md notes it).
- **Fresh-context review fixes:** measures grouped and badged; the no-channel state as signed off; the new
  questions' type rows follow each type's own order; badges per kind; channel use loaded in parallel with
  the page; rule keys typed; the collapsed group's tap target 40px.
- Tests: `tests/unit/form-channels.test.ts` (A1 required and badged, not-sold-on and optional fields help,
  connecting makes them required, the two groups with and without channels, another type's map ignored);
  type counts updated in `product-type-table`. Ran: unit, integration
  (local ci), `tsc`, `lint:boundary`, `docs:check`.

## 2026-11-08 — listing-model: the proof run on a production copy, and its fixes [MIGRATION]

- **Run once, with the owner's permission** (2026-11-08): production copied into a local database,
  the branch's migrations applied to the copy, both gates run, the copy dropped. Production was only read.
- **Migrations:** all seven new migrations applied cleanly to real data.
- **attributes compare (A3, parent Q33): PASS** — 113 products, 413 answers, 0 mismatches.
- **field-maps proof (R7, A5):**
  - *Amazon* (one product per mapped type with a connected shop: HANDBAG). The first run found three map
    faults, all fixed: production had no Amazon types read yet, so the listing went out unshaped (now
    read on demand before the first create, Q21); "false" for water resistance (yes/no now paired, and
    Amazon receives its code for a display name, Q22, migration `20261108140000_amazon_yes_no_pairs`); the
    local schema check refused fields Amazon itself did not ask for (now it blocks only values Amazon's
    schema refuses, Q20). Second run: Amazon's own check-only answer asks only for answers the product
    has not given — style, lining, pockets, strap type, capacity (the questions dynamic-form will ask) and
    key features. No map is wrong.
  - *Meta:* 86 items, 0 problems (items with no category left out). *Google:* 111 items; 70 apparel and
    bag items lack gender and age group because only 17 of 87 such products answer Audience. Product
    data, not a map: dynamic-form's "Required now" asks it; nothing is guessed.
- Tests: Amazon code for a display name, a measure part shaped without a schema, yes/no words; the
  whole-body schema test now checks only value problems. Ran: unit, integration (local ci), `tsc`.

## 2026-11-08 — listing-model / attributes unit 3: the move's compare gate

- `scripts/attributes-compare.ts` (D9, A3, parent Q33): every product's answers before the move against its
  value rows after it, by count and value, per type, in batches of 1,000; read-only; exits non-zero on any
  mismatch, which stops the release. The comparison is `server/listing/attribute-compare.ts` (pure).
- First run, local dev: 44 products, 84 answers, 0 mismatches. **Production run:** the owner runs
  `npx tsx --env-file=.env.prod scripts/attributes-compare.ts` after deploying to a copy, before release.
- Tests: `tests/unit/attribute-compare.test.ts` (a clean move passes; a missing, changed or wrongly
  converted answer is named; an answer kept as text passes).

## 2026-11-08 — listing-model / attributes unit 2: brand parties, type follows category, new questions [MIGRATION]

- **Brand parties** (migration `20261108130000_attributes_brand_parties`): `BrandParty` (maker, packer,
  importer: name, address, pincode, D6); the value sync writes manufacturer, packer and importer from the
  parties as one line each, else the brand's two lines (Q11), and a party edit re-derives the brand's
  products. Parties are not copied from those lines, so today's brand page keeps reaching products. `Brand.amazonRegistered` set from the shop's Generic switch; a new
  brand takes the shop's setting, the switch still sets every brand, and a create lists as Generic by the
  brand (parent Q10, Q16).
- **Type follows category** (D7, parent Q9, Q14): every save takes the category's type (its own or its
  nearest ancestor's), a category's type or place moving re-types the products beneath it, answers kept.
  **Behaviour change:** products whose type differed from their category's take the category's; this
  supersedes categories' "never retype a typed product" (updated `category-type-adoption` and
  `family-merge` tests accordingly).
- **New questions** (parent Q26, D8, Q15): style, lining material, pockets, strap type, fabric type, size
  system and type, form, units, stone clarity and cut, metal weight, generic name and model name, with
  options from Amazon's own lists where they are closed; duplicates of today's facts not added, and those
  facts attached where Q26 asks them (capacity on bags, pack quantity on every type, care on clothing).
  `BbTypeAttribute.fromType` keeps migration-added questions when a type's facts change.
- **Fresh-context review fixes:** brand edits reach products again (parties not copied); Q26's capacity,
  pack quantity and care attached; a kind the new type lacks is cleared on a re-type; a family whose
  members now share one type takes it (Q17); the admin's category audit counts the products moved before
  the move (the old untyped-only adoption is removed); categories R7/D1b marked superseded.
- Tests: `tests/integration/brand-parties.test.ts` (parties fill as one line, importer only from its party,
  an edit on today's brand page still reaches products, a new brand and the shop switch for Generic, A4
  new and reused questions with the old strap answer kept, A5 a category moving type with its family and
  kind, a subcategory and a moved category reading their parent's type). Mutations: dropping the category
  trigger failed A5; dropping the kind rule failed its test. Ran: unit,
  integration (local ci), `tsc`, `lint:boundary`, `docs:check`.

## 2026-11-08 — listing-model / attributes unit 1: the attribute dictionary and typed product values [MIGRATION]

- **New tables** (migration `20261108120000_attributes`, nothing existing changed or dropped): `Attribute`
  (the 28 facts and 10 measurements with their keys, weight, brand, country of origin, manufacturer,
  packer, importer; Q3, Q5, Q6), `AttributeOption` (every list value per fact, shops' own included, Q10),
  `BbTypeAttribute` (each type's questions, order, labels and required measurements, D2), `ProductValue`
  (one typed answer per product per attribute with its source, a CHECK that one value column is set, D3)
  and `ProductValueSet` (the read copy, its own table so Product keeps one writer, Q8).
- **Kept in step by the database** until dynamic-form switches the writes (Q7): a trigger re-derives a
  product's rows on any change to its facts, measurements, weight, brand, type or org; brand and shop
  default edits re-derive the products they fill (Q9). Measures stored canonical with the shop's unit
  kept (D4); an answer that does not fit its kind is kept as text (R7). The migration moves every product.
- `product-value.repository.ts` reads (the read copy parsed, never thrown on). Not a contract change: the
  new types are server-only (CONTRACTS.md). Generated by `scripts/attributes-migration.ts`.
- Tests: `tests/integration/product-values.test.ts` (answers typed and present, R8 canonical measures in
  cm and inches, A1 brand fills and follows a brand edit, A2 a default brand made later and the shop's
  country, rows and read copy follow a change, list and type sync, D1 every stored kind handled); A3's
  count-and-value comparison is unit 3. Mutations: dropping the brand trigger failed A1; dropping the
  default-brand insert trigger failed A2. Ran: unit, integration
  (local ci), `tsc`, `lint:boundary`, `docs:check`.

## 2026-11-08 — listing-model / field-maps unit 3: the proof run's tooling

- `scripts/field-maps-proof.ts` (R7, A5, Q5): one real product of every Amazon type a BB type publishes to,
  through Amazon's check-only mode via the new `listingCreateService.checkOnly` (creates and stores nothing),
  and every Google and Meta feed item against those channels' published rules
  (`server/listing/shopfront-feed-check.ts`, the stand-in for validators neither offers outside a merchant
  account). The owner runs it with production access; its result is recorded here when run.
- **Found by its first local run:** Meta requires a category where Google infers one, and items with none
  went out. The feed now leaves them out of Meta's file (shopfront-feeds D8: what a channel would reject is
  left out). Tests: `tests/unit/shopfront-feed-check.test.ts`, a Meta case in `shopfront-feed.test.ts`.
- **Proof result:** not yet run against production (needs the owner's `.env.prod`).

## 2026-11-08 — listing-model / field-maps unit 2: default maps for all five channels, and the admin's screen [CONTRACT] [MIGRATION]

- **Default maps** (migration `20261108110000_default_field_maps`, reference data, inserts and updates of its
  own rows only), generated by `scripts/field-maps-migration.ts`: today's register carried over (each
  mapped fact with its answers' words, each setup-request fill), then 700 maps researched from each
  channel's own documentation, each with its source, date and reason (R2, Q3): Amazon department, gender
  and age range from audience, model name and part number from the SKU, item type and item count as
  defaults the product overrides, weight in grams, dimensions in centimetres, size in words, `outer` and
  `material` both from Material, `inner`, style, pockets and strap type to the attributes subfeature's new
  questions (strap type was mapped to Strap, the wrong question); Flipkart Type from the kind, sizes, bag
  measures; Meesho from its templates, with its first category maps (combos stay this store only);
  Google and Meta age group, size and weight. Fields nothing answers are marked for a developer (R1).
- **Fresh-context review fixes** (decisions Q12–Q19 logged): a blank pair box no longer blocks a save;
  the nearest size applies only to a measurement, inside the list and within half a step, never to a
  count (Q15); a pair to a word the channel's list lacks is a gap, and the generator refuses to write one
  (Q18); Meesho generic names match their category exactly; Meesho closest fits are marked nearest with a
  note (Q19); carried answer words go only onto maps still reading their fact; a map to a question not yet
  built fills nothing, counts as unmapped and shows as waiting (Q17); readable rule and field names; pairs
  chosen from the channel's list. Mutations: removing the skip rule and the half-step bound each failed
  their test.
- **Builder:** the kind as a source; a number onto a list of numbers takes the nearest (Meesho sizes); a
  measure onto a closed list is paired without a unit; a map for a field the type lacks is skipped once
  the type was read; a label holding a dot ("No. of Compartments") is a field of its own.
- **Admin screen** `/admin/channels/{channel}/{type}` (R6, ux.md): every field, required first, with its
  source, reason, where it was checked, "Not mapped", "Needs a developer · requested", "New · added", and
  answers with no match; search; a row opens its edit in place. The channel page lists its types with what
  is not mapped. [CONTRACT] `PUT /api/admin/field-maps` with `fieldMapSaveSchema` (CONTRACTS.md).
- Tests: `tests/integration/default-field-maps.test.ts` (A1 on Amazon's real HANDBAG schema; every map
  names a rule, column, unit and question that exist, D2; no required Flipkart, Meesho, Google or Meta
  field without a map), `listing-build.test.ts` (A4: an admin change is the next build), builder unit tests
  for dots, nearest numbers and kinds. Ran: unit, integration (local ci), `tsc`, `lint:boundary`,
  `docs:check`, `next build`.

## 2026-11-08 — listing-model / field-maps unit 1: listings built from field maps [MIGRATION]

- **New tables** `FieldMap` and `FieldValueMap` (migration `20261108100000_field_maps`; two new tables,
  nothing dropped). One writer, `server/listing/field-map.repository.ts`. A map is keyed by the
  channel's own names and a field path, with our type's own row over the one for every type (Q7, Q8).
- **Builder** (`server/listing/listing-builder.ts`, pure): sources attribute, rule, core, shop, constant
  (a default the product's answer overrides, R4) and developer; units converted (`units.ts`); answers
  paired by the map's pair, then the channel's word of the same letters, else a `noMatch` gap (Q6, Q10);
  required fields with no map, no answer or waiting on a developer are named. Rules in `field-rules.ts`
  (department, age range, gender, age group from audience; size label; size display from measures).
  `listing-build.service.ts` reads every input once per batch.
- **Amazon create** now builds from the maps and shapes each leaf from the type's stored JSON Schema
  (`amazon.shape.ts`, Q9); a new listing is checked against that schema with `ajv` first and refused with
  the attribute's name, no call made (D6). `forwardAttributes`/`fillAttributes`/`mapped()` removed.
- **Google and Meta feed** writes the built attributes as `g:` tags (channel-catalogue Q8).
- **Setup requests:** Apply writes field maps beside the old register, so what it sets up still reaches a
  create. **Readiness:** a field a map fills is no longer "missing" (one more statement, budget 7→8).
- **Behaviour note:** until unit 2's default maps land, a create sends only Amazon's own core fields;
  the branch ships as one release (parent Q31).
- **Fresh-context review fixes:** the create body's own attributes are trimmed to the keys each item's
  schema declares (Amazon's manufacturer contact takes `value` alone; without this every create with a
  manufacturer was refused locally); a measure with no unit named goes in the first unit the channel lists
  that ours converts to, else a gap; an uncompilable schema skips the local check; pairs are read only
  as own keys; a setup request's Apply merges pairs instead of replacing them; what the maps could not fill
  is kept on the listing as warnings (Q6); the rules' header says whose words they return. Mutations:
  sending the body untrimmed failed the whole-body schema test; reading pairs as plain properties failed
  the `constructor` test.
- Not a contract change: the new `field-map.types.ts` shapes never cross the browser boundary (noted in CONTRACTS.md); the admin route comes in unit 2.
- New package `ajv` 8.17.1 (DEPENDENCIES.md). `Product.measurements` added to catalog's listing read.
- Tests: `tests/unit/listing-builder.test.ts` (A2, A3, pairing, gaps, overrides, Amazon shape checked
  against the real HANDBAG schema, feed tags), `tests/integration/listing-build.test.ts` (Q7, A3, forty
  products cost one), `setup-requests` now proves Apply through the builder. Mutations: returning the
  answer unpaired made the no-match test fail; converting across unit families made the unit test fail.
  Ran: unit, integration (local ci), `tsc`, `lint:boundary`, `docs:check`.

## 2026-11-08 — listing-model: channel-catalogue A1 proven on Amazon's real HANDBAG schema

- The owner ran `scripts/amazon-type-probe.ts HANDBAG --save` through the home brand; the schema is
  `tests/fixtures/amazon/HANDBAG.schema.json` (157 attributes, 75 `allOf` rules).
- **The schema's own `required` lists six attributes, all filled by the create.** Every field the shop
  must answer sits in a rule whose `if` is "not a variation parent" (e.g. `allOf[7]`: department, item
  weight, size info, part number, item type name, target gender). The reader before c11ad764 would have
  named none of them; the evaluator names 19.
- Against the 2026-11-06 refusal: every field it named is required of the shop. Readiness, with today's
  maps, names all but `strap_type`, which is mapped, to the wrong question (detachable or not); a wrong
  map is invisible to readiness and is field-maps' to fix. It also names `model_name`, `part_number` and
  `item_type_name`, required by the schema for a standalone listing and sent by nothing today.
- Tests: three cases in `tests/unit/channel-catalogue.test.ts` on the fixture. Mutation: treating rule
  fields as conditional again (the old reader) turned five red.

## 2026-11-08 — listing-model: channel-catalogue, fresh-context review of the fix unit

`/bb-review` of `c11ad764` found no invariant breach and three ways "required" could still be decided wrong:
- `properties: { x: false }` (x must be absent) was read as always true; it now holds only if x is absent.
- An `if` nested inside a `then`/`else`, and `required` beside an `if`, were dropped; one `apply` now walks
  every keyword of every rule.
- Attributes a create sends only when answered (brand, bullets, description, main image, country of
  origin) were counted as always present; `PRESENT` is now only what `amazonCreateBody` always sends.
- `amazonTypeDefinition`'s filter is now the pure `amazonRequiredAttributes`, tested, since setup-request
  tickets read it. The TRD's status says A1 waits for the probe; the generator's README says never to
  overwrite an applied migration with its output.
- Tests: three new unit cases; mutation: undoing each fix turned the suite red (1, 7 and 2 failures).

## 2026-11-08 — listing-model: channel-catalogue review fixes, and Google and Meta sent for visibility [CONTRACT] [MIGRATION]

Fixes from `/bb-review` of channel-catalogue units 1–2 (`a3f17ee`), which corrects that entry's claims:
its integration test proved A1 on five stub fields, not HANDBAG's 13, and its suite was not green when run whole.
- **Amazon's rules are judged, not lumped (Q3).** The reader stored every `allOf[].then.required` as
  conditional, so a rule that applies to every new page (Amazon's "no `merchant_suggested_asin`") never
  reached readiness. New `server/channels/providers/amazon/amazon.requirements.ts` evaluates each rule's
  `if` in three values for one standalone, shop-shipped new listing on amazon.in: holds → required;
  applies only to another listing (a parent, a theme), an either/or, or anything it cannot judge →
  conditional. `amazonTypeDefinition` (requests) uses the same rule, so the file has one meaning of required.
- **Writes fit the transaction:** a type's fields are written in one `INSERT … ON CONFLICT` statement
  instead of one upsert each; ids follow the template migration's (`chf_` + md5), so a field keeps one id.
- **A4:** each `missingField` carries `asOf`, the date its type was read; the panel says "(their list of
  {date})". The unused `channelCatalogueRepository.readAt` and the duplicate `CatalogueChange` are gone.
- **Daily read logged:** `maintain` logs each marketplace's catalogue read (read, failed, changed) or why
  it read nothing (home brand unset or not connected).
- **Test isolation:** the catalogue suite enabled Amazon on the shared test shop and never restored it,
  failing seven readiness tests whenever it ran first; it now restores what it found.
- **Google and Meta (Q8, owner):** gender, age group and size are sent for visibility though India does
  not enforce them, and asked only through answers the shop already gives. Migration
  `20261108090000_channel_visibility_attributes`: audience → `gender` maps and value pairs on both
  channels' six apparel nodes; age group and clothing size marked adapter-derived; Meta colour required
  on apparel. The generator now emits the same state (88 rows compared). Before this, the 2026-11-07
  catalogue asked gender and age group as new questions on every apparel product (18 false gaps measured).
- **`scripts/amazon-type-probe.ts`:** prints what an Amazon type requires of the Q3 listing, through the
  home brand; `--save` keeps the schema as a test fixture. To be run where the production connection is.
- [CONTRACT] `ListingProblem` `missingField` gains `asOf`.
- Tests: `tests/unit/channel-catalogue.test.ts` (rule evaluation: new page, parent, else branch,
  either/or, value test, unknown keyword); `tests/integration/channel-catalogue.test.ts` (A3 lists per
  channel, A4 date, isolation). Mutation: inverting `not`, and treating "cannot tell" as required, each
  turned the unit suite red. Ran: `tsc`, unit, both integration suites in sequence (17 passed).
- Still open: A1 against Amazon's real HANDBAG schema needs the probe run once with production access.

## 2026-11-07 — listing-model: each channel's own catalogue, and readiness reads it [CONTRACT] [MIGRATION]

- **channel-catalogue (units 1, 2; listing-model Q22, channel-catalogue Q1–Q7).** New `ChannelType`,
  `ChannelField` and `ChannelTypeChange` (migration `20261107120000_channel_catalogue`; three new tables,
  nothing dropped). One writer, `server/listing/channel-catalogue.repository.ts`; listing owns the
  catalogue so readiness can read it without importing channels.
- **Amazon is read daily:** channels' `channelCatalogueReader.refresh` runs from `maintain` for every
  marketplace, through the home brand, one definitions call per type a BB type publishes to. Required
  comes from the schema's `required` and its `allOf[].then.required` rules; plumbing a create already
  sends is marked adapter-filled. A re-read that adds a required field records it.
- **Flipkart, Meesho, Google and Meta** load by data migration `20261107130000_channel_catalogue_templates`
  (inserts only), generated by `scripts/channel-catalogue-migration.mjs` from the extracted templates and
  Google's and Meta's product specs read 2026-11-07: 53 types, 1,961 fields.
- **Readiness** gains `missingField`: a required, non-adapter field of the product's channel type that no
  attribute map or fill covers reads Incomplete with the field's name (two more statements per batch,
  budget raised 5→7). **Home** says "{channel} now asks {n} more details for {type}" for 14 days.
- [CONTRACT] `NotReadyReason` gains `missingField`; `HomeAttentionDto` gains `channelAsks`.
- Tests: `tests/unit/channel-catalogue.test.ts`, `tests/integration/channel-catalogue.test.ts` (A1 HANDBAG's
  13 fields, A2 adapter fields absent, a vanished field gone, a re-read records a change), Home line.
  Mutation: dropping the "filled" check in readiness made the unit test fail. Ran: unit, integration
  (local ci), `tsc`, `lint:boundary`, `docs:check`.

## 2026-11-07 — Fix: a picker inside a dialog took no clicks (brand country of origin)

- **Reported by the owner:** country of origin could not be chosen on a brand. The brand form is a
  dialog and the country list a popover inside it. Radix's dismissable layer was installed twice
  (`@radix-ui/react-dialog` and `react-popover` each bundled 1.2.1, the rest of the tree had 1.1.20), so
  the popover registered in a different layer stack, the modal dialog kept `pointer-events: none` on
  it, and every click fell through. Any popover, menu or select inside a dialog was exposed.
- `package.json` `overrides` pin `@radix-ui/react-dismissable-layer` 1.2.1 and `react-focus-scope`
  1.3.1 (both over three weeks old): one copy each. Lockfile changed; no code change.
- New `tests/unit/overlay-in-dialog.test.tsx`: one installed copy of each, and a click on a popover
  option inside a dialog lands. Mutation: the previous lockfile made both fail (the click test
  reproduces the bug). Ran: unit, `tsc`, `next build`.

## 2026-11-06 — A shop raises a request in one tap; "With us" says what it covers

- **Asked by the owner:** "With us" was a status the shop could not act on, and where no ticket existed
  yet the only way out was a WhatsApp message (setup-requests Q36). The listing's How to fix it now
  shows **Raise a request** in place of "Ask the admin": `POST /api/org/{org}/channels/{channel}/listings/{product}/request`
  reads the listing's current errors on the server (`platformListingService.complaint`) and raises them
  through `requestService.raiseFromEvents`: a requirement where a kind applies, an issue with the error
  attached otherwise. No body is read; one ticket per fix still (D3). It never reopens a done ticket
  (Q12): a shop with a Ready fields ticket keeps its Fill on product step.
- A raised ticket shows its chip with when it was raised, what it covers, and **See your requests**.
  One Raise button per screen; after a tap it says the request is with us and links there. "Report
  this" stays for the shop's words.
- "Ask the admin" remains only on the parked kinds (Q17, the no-category filter on the products list).
- New `tests/unit/raise-request.test.tsx`. Mutations, each seen to fail it: the route raising from the
  request body; the route reopening; the banner showing a second button. Reviewed by /bb-review in a
  fresh context; its findings fixed. Ran: unit (the only failure is the shallow-clone check of this sandbox), `tsc`, eslint on the
  changed files.

## 2026-11-06 — The ticket engine knows no module; marketplace tickets are a plug-in [CONTRACT]

- **Asked by the owner:** requests must not be coupled to channels (setup-requests D4, Q33). The engine
  (`request.service`, `request.types`, `ticket.repository`, the jobs, `kinds/kind.ts`) no longer imports
  channel or listing code or names a marketplace or kind. A module plugs in with `TicketKindPlugin`s and
  a `NeedSource` (needs from its events, needs from a daily check) in `kinds/index.ts`, and a preview
  component in `requirement-plans.tsx`.
- Everything about marketplaces moved into `server/requests/marketplace/`: the two kinds, their types
  and choice schemas, complaint sorting, field matching, the home brand, the daily category check.
  The engine's `raiseFromComplaints`/`raiseMissingCategories` are `raiseFromEvents` and the sources'
  `daily`; an issue's subject and detail are neutral (`source`, `context`, `subject`, `code`,
  `message`); the admin inbox reads a kind's `mode` (one tap, decision) instead of its name.
- No behaviour change: the same tickets, keys (an issue's now keyed by its source's label) and screens.
- New guard `tests/unit/requests-decoupled.test.ts`. Mutation: a listing import and the word "amazon"
  added to `request.service.ts`; both checks failed. Ran: unit, integration, `tsc`, `docs:check`,
  `next build`.

## 2026-11-06 — Requests in the shop sidebar; list as Generic on Amazon; stock shown on a product's view [CONTRACT] [MIGRATION]

- **Requests is a shop sidebar item** (setup-requests Q33, superseding Q25): `/org/{org}/requests` lists
  the shop's requests with Report a problem, under Settings; it is off the Channels page, because a
  request can be for any part of the shop. Report categories widened to the shop's areas (Q34).
- **List as Generic on Amazon** (Q35). Brands and defaults gains "My brand isn't registered on Amazon:
  list as Generic" (`OrgListingDefaults.amazonGeneric`, its own PUT so the defaults form never resets
  it). On, a create sends Amazon's "Generic" and no barcode; the listing's Brand reads Generic with a
  note and a link to change it, and Amazon's brand-name complaint is no longer a fix to make.
  `ListingRules.genericBrand` says which marketplaces have it (Amazon); the brand-name complaint is
  tagged `brand_name` by the provider.
- **Brand on the product form.** A Brand picker in Details (the product already stored one; the form
  never showed it). "Choose a brand" on a listing opens the edit page at Details, on that field.
- **Fix: a product's view page showed "Where is this kept? Add your shop address once." and Total 0**
  on every product with stock: the read-only form was given no locations. It now lists the locations
  holding the product's stock, with city and pincode.
- Ran: unit, integration, `tsc`, `lint:boundary`, `docs:check`, `next build`.

## 2026-11-06 — CI green: five docs re-verified against setup-requests

- `docs-integrity` failed: setup-requests added files under five docs' Covers. Re-read each against them.
  Drift fixed: CONTRACTS' `ShopTicketDTO` gains `category`, and the two request bodies are named;
  channels lists `channel-types.service` and `listing-complaints.ts`, and the complaints hand-over as a
  boundary; the route doc names `requirePlatformAdminId` and `schema.parse` beside `validateRequest`.
  `server/requests/` and `src/components/` matched as written. Ran: docs-integrity (84).

## 2026-11-05 — Four env files: local, dev, prod, example

- **Asked by the owner.** `.env.example` now holds every variable in sections — Vercel, local only,
  worker, ops — replacing `.env.production.example` and `.env.worker.example`. The worker list is
  commented (a copy into `.env` must not blank the app's values); `deploy-safety.test.ts` reads it there.
- `npm run dev:dev` / `dev:prod` run the local app against the live dev or production database, from
  the gitignored `.env.dev` / `.env.prod` (`node --env-file`, so they win over `.env`). Both pin
  `APP_ENV=local`, localhost auth URLs, and the seed gates off. Ran: deploy-safety, docs-integrity.

## 2026-11-05 — Setup requests: what a shop can't fix becomes a ticket we fix once [CONTRACT] [MIGRATION]

- **setup-requests, units 1–5** (spec, decisions Q1–Q32, ux, TRD in `docs/specs/setup-requests/`).
  A new `requests` domain: a **requirement** is raised by itself from a marketplace's refusal or from
  readiness and the admin enables it in one tap (Amazon fields for a type) or one pick (an Amazon
  category for our type); an **issue** is a shop's report under a category, for a developer. One
  ticket per fix, keyed by what fixes it (`Ticket`), each shop's need beside it (`TicketNeed`).
- Apply reads Amazon's type definition through the home brand (`HOME_BRAND_ORG_ID`), proposes per field
  reuse, add a declared fact, fill from the product (`ChannelAttributeFill`) or a fixed value, and
  writes it in one transaction with the ticket, only while open; a create then sends fills beside
  facts. Done is checked daily (enqueued by `channels.maintain`, no new schedule).
- Shop: How to fix it shows the ticket's state (With us · Ready · Not supported yet) in place of "Ask
  the admin"; an unrecognised complaint offers Report this; Channels lists "Your requests". Admin:
  `/admin/requests` with Requirements and Issues.
- Cost: raising is two statements however many shops; the daily problems look grows from 2 to 3
  statements (one job hands every shop's complaints over).
- Review in a fresh context, every finding fixed: needs deduplicated per (ticket, shop, product) so two
  same-code errors cannot fail a batch; the daily look's standing complaints never reopen a resolved
  ticket (only a fresh send or report does); `notifiedAt` cleared only when the ticket is open again;
  tickets locked in key order; a type's facts appended atomically; a report's product checked against
  the shop; a from-product field with no source refused as a field error; the daily pass drops needs
  whose product left sale and closes tickets nobody needs (Q13); constants and copy out of the server.
- Mutations, each failed `setup-requests` integration: resolving without the open guard (double Apply
  wrote twice); never reopening a done ticket; skipping the stale-plan hash; raising needs without
  de-duplication. Ran: unit (3080), integration (655), `tsc`, `lint:boundary`, `docs:check`, `next build`.

## 2026-11-05 — A listing waiting on its marketplace reads "Pending"

- **Asked by the owner** (marketplace-publish Q25, superseding Q4). "Sent {ago} · Amazon usually
  answers within an hour" and "Checking with Amazon · next look in {n} min" become one state:
  "Pending · waiting for Amazon's answer". The send toast says it is pending. Copy only
  (`statusText`); the stored states and the polling schedule are unchanged.
- Docs: setup-requests spec drafted (spec, decisions Q1–Q31, ux, local prototype); not built.

## 2026-11-05 — A refused listing says how to fix each problem [CONTRACT]

- **Asked by the owner** (marketplace-publish Q24). Amazon's "'Strap Type' is required but missing" ×20
  had nothing to tap. The listing banner now has **How to fix it**: the brand's details go to Brands and
  defaults (or Choose a brand when the product has none); the offer, when the product has no MRP, to
  Add the MRP; an attribute the mapping fills from a blank fact to Fill on product; anything else to Ask
  the admin. Only what none of these place keeps Amazon's sentence.
- `amazonIssues` keeps the attribute Amazon names and says which are the brand's or the MRP
  (`NEED_OF`); `fixesOf` (`listing-plan.ts`, pure) groups them; the screen reads the attribute mapping
  only when a complaint needs it.
- Mutations: treating an answered fact as fillable, and asking for an MRP the product has; each failed
  `listing-plan`. Ran: unit (3065), `tsc`.

## 2026-11-05 — Channel register: adding a marketplace type no longer fails

- **Fix.** Adding an Amazon type on `/admin/channels/{marketplace}` answered 500 every time: the route
  spread the parsed body, its `action: "add"` included, into `channelCategoryMap.create`, which Prisma
  refused as an unknown argument. The route now passes the four fields, and `addReadType` names every
  column it writes, so an extra key can never reach the insert (Invariant 4). A new test in
  `channel-register` sends the screen's own request through the route. Mutation: restoring the spread
  made it fail. Ran: `channel-register` integration, `tsc`.

## 2026-11-05 — Store: six products to a desktop row

- **Asked by the owner.** `PRODUCT_GRID_CLASSES` goes `lg:grid-cols-4` → `lg:grid-cols-6` (phone 2,
  tablet 3 unchanged), so every product grid — Home, category, shop all, offers, search, saved — shows
  six across from 1024px. A tile's image slot follows (360px → 240px, a sixth of the 1440px page), so a
  tile downloads no more than it shows. Home's "New this week" is one full row (4 → 6) and the hero
  grid's first page two (8 → 12); listing pages stay at 12, already a multiple of 2, 3 and 6.
  `storefront-journey` holds the columns and the slot. A theme's own shelf keeps its density.

## 2026-11-05 — Store Home: the category row has no scrollbar; arrows from tablet

- **Asked by the owner:** the scrollbar under the arches looked ugly (and crowded their names). It is
  gone at every size. `ScrollRail` (new, `shared/scroll-rail.tsx`, a small client leaf) holds the
  line: a phone swipes; from a tablet a back and a forward arrow step about a screenful, each shown
  only while there is more that way, so a mouse without a trackpad still reaches the end (hover is
  never the only way). Smooth unless the visitor prefers reduced motion. The arches themselves stay
  server-rendered.

## 2026-11-05 — Store Home: category arches a size smaller

- **Asked by the owner.** Each arch is about a fifth narrower: 64–72px on a phone (was 72–80),
  112px on a tablet (was 128) and 128px on a desktop (was 160); image `sizes` follow.

## 2026-11-05 — Channels: WhatsApp and Instagram shown as coming soon

- **Asked by the owner.** The Channels page's Coming soon section gains WhatsApp ("Share your
  catalogue and take orders in chats") and Instagram ("Tag your products in posts, reels and
  stories"), beside Flipkart and Meesho: muted cards, a Coming soon chip, nothing to press.
- They are `PLANNED_CHANNELS` in `channel-card-list.tsx`, **not** in the server's `CHANNEL` set: a
  channel there gets feeds, readiness checks and image rules it cannot use yet. Their marks are
  Simple Icons' (CC0) in each brand's own colour, in `ui/icons/platform-marks.tsx`; their words in
  `channel-copy.ts` (`PLANNED_CHANNEL_COPY`).
- `channel-cards.test.tsx` asserts both appear under Coming soon with no link or button.

## 2026-11-05 — CI green again: three docs re-verified against ADR-0067, "seller" out of the business page

- `main`'s `unit` job failed four tests after the /business commit, so nothing deployed.
- **Docs gate:** ADR-0067 postdated `CLAUDE.md`, `docs/CONVENTIONS.md` and `docs/README.md`. Read
  against it: `CONVENTIONS.md` still called the copy scan "a ratchet"; it has no baseline and fails
  on any inline copy, so the line says that. `CLAUDE.md` adds ADR-0067 to the conventions that touch
  almost every change. `README.md` maps directories and had nothing to correct. All three re-dated.
- **Vocabulary gate:** `business-copy.ts` said "seller account(s)" in two places. Now "Amazon and
  Flipkart accounts" and "marketplace account"; the exemption list is unchanged.

## 2026-11-05 — CI: the gates run side by side, and the worker image no longer builds under emulation

A push to `main` took 30–38 minutes (run 363: 37m50s). Measured from the job timings:

- **The jobs ran as one chain**: test (11m36s) → e2e (3m12s) → deploy (4m) → deploy-worker
  (18m45s). Now `test`, `unit`, `integration`, `e2e` and `worker-image` start together; `deploy`
  needs the four gates, and `deploy-worker` needs `deploy` and the image. Still nothing ships before
  every gate passes, and the worker still starts only after the web deploy migrated.
- **Tests ran one file at a time**: 497s, of which 31% was tests and the rest per-file setup. Only
  `tests/integration/` shares a database. `npm run test:unit` (270 files) runs in parallel, 97s on
  4 cores locally; `npm run test:integration` (84 files) stays serial, 116s locally.
- **The arm64 worker image ran `npm ci` under QEMU**: 505s. The deps stage now runs on the build
  platform with `npm ci --os=linux --cpu=<target>` (23s); nothing in it runs an install script and
  the Prisma client is WebAssembly. Checked by running the cross-installed tree in an arm64
  container: sharp encodes, and the worker boots, connects and works jobs.
- **The layer cache exported to the Actions cache for 6 minutes a run**, and missed on the next run
  anyway (run 350, unchanged lockfile, still 12 minutes). That cache is capped at 10 GB a
  repository and the dependency layer is ~1 GB per architecture. It now lives in the registry at
  `:buildcache`.
- **The restart pulled ~1 GB onto the machine** after the deploy (87s). On `main` the image is
  pre-pulled while the gates run; the pull alone, never a restart.
- `e2e` caches `.next/cache`.
- **Yours:** `test (22.x)` keeps its name but no longer runs the suite. Add `unit` and `integration`
  to `main`'s required checks, or a PR can merge with them red (`deploy` still refuses).
- `test-integrity` also runs in the `integration` job, so the guard that the integration layer is not
  skipping checks that job's own `DATABASE_URL`.

Expected critical path: about 4 minutes of gates, then the Vercel build (2–4 minutes), then the
worker restart. `tests/unit/deploy-safety.test.ts` passes against the new workflow; actionlint is clean.

## 2026-11-05 — Tests: marketplace-facts no longer leaves categories on the dev Home

- **Found by the owner:** the local Home's category row showed twelve "Mats Q35 …" arches. Each was
  a top-level category `marketplace-facts.test.ts` creates; its `finally` deleted the category last,
  after steps that can throw (a listing lookup, a job delete), so twelve runs on 2026-11-04 left one
  each. The category deletes are now `deleteMany` (no throw on a row already gone) and `afterAll`
  sweeps the suite's own empty `mf-q35-*` / `mf-mats-*` categories. The suite (19/19) removed all
  twelve from the local dev database. No production impact.
- **Not a change:** the local banner is shorter than live only because the seeded banners carry no
  picture (a picture-less banner sizes to its words); with a picture it takes live's 5:2.

## 2026-11-05 — /sell becomes /business, a landing page for what Bhendi Bazaar is

- **A landing page, not a flyer.** `/business` explains the platform in the order a shop decides:
  the problem today against what changes, the one idea (one product in, your store, Amazon,
  Flipkart, Google and Meta out, one stock count), four features each beside a drawn screen, six
  strengths, then the price, three steps and six questions. Inventory sync and marketplace publish
  are now listed as live; sales by channel and Instagram posts stay "arriving".
- **Honest terms.** ₹699 a month GST included, plus the owner's stated 2% on orders paid through the
  shop's store and nothing on marketplace sales; cancel any month; "Questions? Talk to us" opens the
  existing contact sheet. The 2% is a display constant in `business-copy.ts`; `Org.commissionBps`
  still defaults to 1500 in `prisma/schema.prisma`, so the two must be reconciled before launch.
- **Screens are drawn, not captured** (`business-mockups.tsx`): the seed catalogue is placeholder
  data. Built from the revamp's grammar: type roles, `Icon`, `BrandLogo`, `PlatformMark`,
  `StatusBadge`; one new role, `text-landing`, for the hero headline only (registered in `cn`).
- `ROUTES.sell` is now `ROUTES.business`; `/sell` redirects permanently (`next.config.ts`), the
  footer and sitemap follow. `src/components/org/sell/` is replaced by `src/components/org/business/`.

## 2026-11-05 — Every word on screen and every link to our pages is a constant (ADR-0067)

- **Asked by the owner:** "no strings hard coded … driven via constants". A scan found 1,837
  hard-coded items in 412 front-end files — JSX text, copy props, toasts, our own paths — and a
  second pass found 333 more the first rule could not see (sentences in ternaries, objects,
  metadata, helper `.ts` files).
- **Words** now live in each area's `*-copy.ts` beside its components (about 70 modules, one
  `as const` object per surface; label maps keyed by a closed set are records there). Every word is
  byte-identical, apart from "Pieces you add…/save…" → "Things you add…/save…" (the store sells more
  than clothing). Existing exported names stay, re-exported from their copy module.
- **Paths** to our own pages come from `ROUTES` (`server/shared/routes.ts`), one builder per page of
  the app; it sits in `server/shared/` because emails and revalidation need it too.
- **Enforced:** `tests/unit/hardcoded-copy.test.ts` fails on any hard-coded copy or route outside a
  copy module or `ROUTES` (JSX text after a tag or an expression, copy props, toasts, route literals,
  quoted sentences). Mutation-checked both ways: plain text, `&apos;` text, a ternary sentence and
  text after an expression are caught; arrows, comparisons, generics, class names and identifiers
  are not. It started as a ratchet and reached zero, so its baseline is gone. Seven files are
  exempt by name, each with its reason (brand facts in `config.ts`, font names, a thrown error,
  log text, a Zod schema's messages).
- **Out of scope by decision (ADR-0067 D3):** schema messages in `src/lib/validation/` and route
  handlers' fallback error text in `src/app/api/` stay beside their rule; `DomainError` text too.
- ADR-0067 (Proposed), a line in `docs/CONVENTIONS.md`, a rule in `src/components/CLAUDE.md`.
- **Build fix found on the way:** `security-headers.ts` had taken `ROUTES` through the `@server/`
  alias, which `next.config.ts` loads before aliases exist — tsc and every unit test passed and only
  `next build` failed. It imports relatively now, and `tests/unit/next-config-imports.test.ts`
  walks everything `next.config.ts` loads and fails on any alias (mutation-checked).
- Suites: tsc; unit; integration 648/648; `next build`; e2e 12/12 against `bhendi_bazaar_ci`.

## 2026-11-05 — Local env: only what the app reads; ops secrets apart

- **Asked by the owner.** The local `.env` had 55 variables; each was checked by name against
  every reader in `src/`, `server/`, `prisma/`, `worker/`, `scripts/`, the workflows and the configs
  (no value was read or printed).
  - **Kept, 31,** grouped by purpose with one line each: app, database, seeding, sign-in, secrets
    at rest, payments, shipping webhook, email, images, photo enhancement, marketplaces. Values
    byte-identical to before; `missingEnv` reports nothing missing.
  - **Moved to `.env.ops`, 11** (ignored by git, loaded by nothing): `WORKER_*`, `GHCR_*`,
    `BACKUP_R2_*` (GitHub secrets for the workflows), `PROD_ADMIN_*` (an inline input to the one-off
    production seed) and `GOOGLE_VERIFICATION_TOKEN` (production's meta tag).
  - **Dropped, 13, read by nothing:** `KV_REST_API_*`, `KV_URL`, `REDIS_URL` (Vercel KV
    leftovers; the `KV_REST_API_*` pair is a rate-limit fallback, so locally it pointed the limiter
    at a remote store), `EMAIL`, `PASSWORD`, `TOKEN_VALUE`, `FIRE_CRAWL_API`, `AMAZON_REDIRECT_URL`,
    `FLIPKART_REDIRECT_URL`, `SHIPROCKET_EMAIL`/`SHIPROCKET_PASSWORD` (the env fallback is gone,
    shipping ADR-0002).
  - A full copy is in `.env.backup-2026-11-05` (git-ignored); delete it once the app runs.
- `.env.example` gains `APP_ENV` and the `.env.ops` note and loses the Shiprocket login pair;
  `docs/OPERATIONS.md` loses its row and gains the `.env.ops` sentence.

## 2026-11-05 — Tests: a refused banner can no longer be left live on the dev Home

- **Found by the owner:** the local Home crashed (`next/image` unconfigured host
  `cdn.bhendi-bazaar.com`). An active home banner "Home probe 2", pointing at a test picture, was in
  `bhendi_bazaar_dev`: during a mutation run on 2026-11-04 the "only your own library" guard was off,
  so a save the test expects refused went through, and `afterAll` deleted only the ids it had
  pushed. A "Not mine" shop banner had leaked the same way.
- `tests/integration/image-slots.test.ts` now also deletes every banner and shop banner carrying
  this run's pictures. Mutation-checked: with the guard disabled the suite fails and leaves no row.
- The two leaked rows and five unused test pictures were removed from the local dev database only.
- No production impact: production banners come from uploads to the configured image host.

## 2026-11-05 — Store copy: one vocabulary for every kind of product

- **Asked by the owner** after "The cloth": a scan for prototype leftovers. The prototype's sample
  data (shops, products, dates, a buyer's address) appears nowhere outside comments. Its clothing
  vocabulary did, on surfaces every product uses — the bazaar sells attar, bukhoor, kitchenware
  and bags as well:
  - **"piece" → "item"/"product"** on the listing count ("248 items"), bag summary, saved list,
    sold-out toast, empty bag, empty and offer-free category, shop-all, not-found, unavailable at
    checkout, the bidding note and the review photos hint. Seller-side "Auctions for one-off
    pieces" stays: an auction is for a one-off.
  - **Reviews** no longer ask about fit and fabric ("Is it as described? How is the quality?…";
    "What buyers say once it has arrived").
  - **Search** suggests "a product, a colour, a shop", not "a fabric".
- Suites: tsc; unit.

## 2026-11-05 — Product page: no more clothing-only words on every product

- **Asked by the owner:** every product page said "The cloth" above its description — the
  prototype's heading for a rida, copied in as fixed text, so a tote bag and bukhoor said it too.
  It is now "Product details". The same assumption is gone from "Questions about this product?",
  the no-reviews line (was "how it fits and how the fabric feels"), the delete-review dialog, and
  the shop's description placeholder ("how it is used", was "how it fits").
- Suites: tsc; unit.

## 2026-11-05 — Store Home: categories are one scrolling line, smaller

- **Asked by the owner:** the category arches wrapped to a second row and were too large. They are
  now one line at every size, never wrapping: 72–80px on a phone (swiped, no scrollbar), 128px on a
  tablet and 160px on a desktop (9:10), with a thin scrollbar kept from tablet so a mouse can reach
  the rest. Image `sizes` follow the fixed widths. The row runs to the gutter's edge at each size.
- Suites: tsc; unit 3059/3059.

## 2026-11-05 — E2E: the checkout check reads the line a buyer can see

- CI's smoke journey failed on both projects at `/checkout`: since the summary folds its lines on a
  phone (StoreCheckout), the product's name is in the page twice — inside the phone's closed fold
  and in the tablet-up column, one of them always `display: none` — and `.first()` found the hidden
  one. The test now opens the fold where it shows, as a buyer would, and asserts the name that is on
  screen (`filter({ visible: true })`). It still fails if checkout snapshots an empty bag: there is
  then no fold and no name.
- E2E 12/12 locally against `bhendi_bazaar_ci` from a clean build.

## 2026-11-05 — Docs: five living docs re-verified against yesterday's code

- CI's docs gate: `CONTRACTS.md`, `server/checkout/CLAUDE.md`, `server/channels/CLAUDE.md`,
  `src/components/CLAUDE.md` and `src/app/api/CLAUDE.md` covered code that changed on 2026-11-05.
  Each was read against the named paths; `Verified:` moves to 2026-11-05.
  - **checkout:** a rule for the one export path (`order-export.ts`: list filter and
    `VISIBLE_ORDER_WHERE`, the cap, audit before the file, `csvCell`, `rupeesText`).
  - **route handlers:** a file download linked from a server page counts as the route's caller.
  - **front end:** another platform's mark is `PlatformMark`, reached through `channel-mark.tsx`.
  - **CONTRACTS:** the orders side panel's `?order=` is named as a page parameter, not a wire shape.
  - **channels:** read against `listing-problems.*`; nothing had drifted.

## 2026-11-05 — Store: the page column widens to 1440px

- **Asked by the owner:** on a laptop the store showed ~200px of empty margin each side; the
  prototype keeps the gutter small. `--container-page` (marketplace header, pages, footer, tab
  bar) and the default `--container-store` go 72rem → 90rem; the gutter is unchanged (12–32px), so
  below 1440px the margin is just the gutter. Themes that set their own store width keep it.
- Image slots follow the width (ADR-0026): a grid tile asks 360px from `lg` (was 288), the product
  gallery 42rem, a card banner 90rem. `storefront-journey` holds the tile to a quarter of 1440.
- **For the owner:** the Home banner is now full-bleed, up to the screen's width; the 1600×640
  minimum upload still passes, but 2400×960 or larger stays sharp on a 2× laptop screen.
- Suites: tsc; unit.

## 2026-11-05 — [CONTRACT] Admin orders: the order beside the list, and Export CSV

- **Asked by the owner** (AdminOrders prototype; design-system Q36, Q37).
- **Side panel (Q36):** from desktop a row opens the order beside the list instead of leaving it,
  held in the URL (`?order=<id>`, parsed by `orderPeekSchema`), so it can be shared and is rendered
  on the server; the open row is marked. It shows code, placed time and payment method, status and
  payment, each parcel's items (thumbnail, quantity) and status, deliver-to, the total, and Open full
  order; × closes it, keeping the filters. Below desktop a row opens the full page, as before (the
  list shows rows below `lg`). `ResourceList` gains `tableRowHref` and `activeKey`; `parcelTone`
  moves to `order-status.ts` so the panel and the parcels panel share one tone rule.
- **Export CSV (Q37):** `GET /api/admin/orders/export`, behind `requirePlatformAdmin`, writes the
  list's current view: one schema (`adminOrderViewSchema`) now parses the page's filters and the
  export's, and one `viewWhere` builds both queries. Columns: order, placed (India time), status,
  payment, buyer, email, phone, city, pincode, items, total (₹, from integer paise by integer
  division), shops. At most 10,000 rows; a larger view is refused with 422 and asked to narrow. The
  `ORDERS_EXPORTED` audit entry (view, count) is written first and must land. Cells starting `= + -
  @` tab or return are prefixed with `'`; `Cache-Control: no-store`. The button is a plain link.
- Tests: `orders-export` (integration): non-admin refused with nothing written; exactly the filtered
  view, abandoned checkouts left out; formula defused; ₹1234.56 from 123,456 paise; audit row;
  over-cap refusal. Mutation-tested: skipping the guard, removing the formula prefix and dropping
  the status filter each fail it.
- Suites: tsc; unit; integration `orders-export` 3/3.

## 2026-11-05 — [CONTRACT] Seller products: channel pills replace the readiness card; "Select all" across pages

- **Asked by the owner:** the "Ready to list elsewhere" card was useful but heavy. It is now one
  pill per channel the shop sells on, beside the filters (design-system Q35): the platform's mark,
  its name, and "All ready" or "3 to fix". A pill with products to fix filters the list to exactly
  those (`?channel=google`, parsed against `CHANNELS`, resolved on the server like "Wishlisted
  only"); tapping it again clears it. Filtered, a note above the list says what keeps them off
  ("3 have no Google Shopping category · Ask the admin", "2 need a fabric · Fix them") with
  "Where you sell", and each row carries its own reason as a warning badge. Pills scroll on a phone,
  wrap from tablet. `channel-readiness-summary.tsx` is gone.
- **Listing:** `channelReadinessService.notReadyOn(orgId, channel)` — the shop's on-sale products
  that channel would refuse, each with its reasons, from the same verdicts as the pill's count.
  `keepsItOff(problem)` is read from the readiness bands, so the refusing problems are not listed a
  second time.
- **Select all:** once every visible row is ticked the selection bar offers "Select all 105";
  then "Clear selection". Price, archive and send then send the list's filters (`matching`,
  `ProductListScope`) instead of ids; the route finds the products itself in the path's org and
  refuses with a clear message over 200 rather than acting on part of the list. Stock stays
  per page. The team's route is unchanged. `SelectionBar` gains an optional `selectAll` link.
- Tests: `channel-readiness-service` gains the not-ready read (this shop only, on sale only, with its
  reason; a channel not sold on refuses nothing); new `product-select-all` (another shop's matching
  product never found; over the cap refused); `product-bulk-schema` gains five cases. Mutations
  (any verdict counted, wrong reason, org scope dropped, cap loosened, exactly-one dropped, strict
  scope loosened) each caught.

## 2026-11-05 — Store Home: the banner runs edge to edge under the header, categories under it

- **Asked by the owner:** keep the full banner with words over it (not the prototype's arch), make
  it majestic, and start Home with header → banner → categories.
  - `HeroBanner` / `HeroSlider` gain an `edge` axis: `card` (a shop's storefront, unchanged) and
    `bleed` (Home): no rounded corners, flush under the header (lifts past the page's top padding),
    out to the viewport's edges via a new `bleed` utility, and from tablet at the desktop
    picture's own 5:2, so an uploaded banner is shown whole (≈576px tall at 1440px), capped at
    the screen height. Phone keeps its 4:5 version.
  - `MarketplaceChrome` clips sideways overflow, so `bleed`'s scrollbar-width overshoot never
    scrolls the page.
  - `CategoryArches` on a phone: 72–80px 4:5 arches with the name centred under them, about five
    in view, as StoreHome draws them; tablet and desktop keep the tall 9:10 grid.
- Suites: tsc; unit.

## 2026-11-04 — Store home and category: checked against the review prototype

- **Asked by the owner:** walk StoreHome, StoreHomeDesktop, StoreCategory, StoreCategoryTablet and
  ProductTile against the code.
  - **Product tile:** already matched (4:5 photo, heart in a round chip top right, "N% off" top
    left, shop line, two-line name, price and strike).
  - **Category page:** the piece count moves beside the title (`PageHeader` actions);
    `ListingToolbar` becomes the prototype's ruled band, edge to edge of the gutter, on every
    listing (its `count` is now optional). Under the grid, "24 of 248 · more load as you scroll"
    (`PaginatedProductGrid` takes `total`) and a row of skeleton tiles while the next page loads;
    "Show more" stays as the fallback for an observer that never fires.
  - **Home:** "See all" under New this week names the count ("See all 86", the cached listing
    count). The trust row is ruled above and below instead of boxed, icons and words in the text
    colour. The offer strip sits on the gold tint (`bg-accent`) instead of a white card.
- **Not built, and why:** the hero stays the admin's uploaded banner (photo with words over it),
  not the prototype's words-beside-an-arch split: banners became uploaded desktop and phone
  graphics (image-slots), and the banner drawer previews that shape. "From 12 shops in the bazaar"
  needs a distinct-shop count the catalogue does not read. The offer strip lists reduced pieces
  rather than one campaign line ("20% off georgette ridas · until Sunday"): there is no current
  campaign to read. The phone footer stays a two-column list rather than accordion rows.
- Suites: tsc; unit 3054/3054.

## 2026-11-04 — Bag, checkout and order pages: checked against the review prototype

- **Asked by the owner:** each page compared with StoreCart, StoreCheckout and StoreOrder.
  Most already matched: lines by shop ("From … · one parcel"), the stepper, Move to saved and
  Remove, the summary (Items, offers as −₹ in the success colour, "Worked out at checkout", Total
  so far), the docked total and Checkout; checkout's three numbered steps, "Pay ₹…" docked; the
  order headline, a card per parcel with its four-step bar, Track and Cancel per parcel. Fixed:
  - **Bag:** the price sits at the end of the stepper's row, actions under it; the dashed coupon
    row is back ("Apply a coupon at checkout", a link, because a code is priced against the order).
  - **Checkout:** the bar is "Your bag ← · Checkout · Secure" on every size (it was hidden on a
    phone); the order summary's lines fold on a phone and stay open from tablet; the trust row is
    three marks across.
  - **Order:** each parcel card leads with its first piece's photo (the stored `thumbnail`).
  - Presentation only: no total, price or payment logic changed.
- Suites: tsc; unit 3054/3054.

## 2026-11-04 — Seller and admin screens checked against the review prototype

- **Asked by the owner:** compare each designed screen with what was built.
- **Fixed:** the shop's Orders rows now carry the product photo and when the buyer paid (both
  in the prototype; the data was already on the parcel). `shop-order-rows.tsx`.
- **Matched, no change:** shop Products (tabs with counts, rows on a phone and a table from
  tablet, selection bar with Edit price / Edit stock / Archive / Send), shop Orders (Store /
  marketplace switch, To pack · For pickup · On the way · Done with counts, the packing hint,
  Mark packed on the row), admin Dashboard (period links, sales card and chart, Needs action,
  Latest orders), admin Orders (status tabs with counts, search and filters, table), the
  picture field (crop or fit, focus point, Recommended / Optional) and the eight grammar parts.
- **Not built, by design or for lack of data:** a "Drafts" products tab (no draft state
  exists), a Channels column and "Select all 48" on Products, a products count line in the
  header, admin Orders' side panel and Export CSV, and a tablet frame in the banner preview.
- Suites: tsc (bar another change in progress in `paginated-product-grid.tsx`); unit.

## 2026-11-04 — Product page: brought back to the review prototype

- **Asked by the owner** (live screenshot against StorePDPDesktop): the words followed the
  prototype, the photographs did not; the gallery had not been rebuilt.
  - **Width:** photo and words now share the page half and half from tablet up; the 3:2 split
    drew a 4:5 photo taller than the screen.
  - **Thumbnails:** a rail beside the photo from desktop, a line under it below that; the active
    one is outlined, no longer scaled (it clipped inside the scroller).
  - **Price badge** says how much is off ("20% off", whole percent rounded down so it never
    promises more than the price gives); "Offer" only when the cut is under 1%. `OfferBadge`
    takes `percentOff`; every `PriceDisplay` gets it.
  - **Delivery, payment and returns** are one ruled card, a row each, icons in the text colour.
  - Gallery classes moved to tokens (`rounded-field`, `text-caption`, `duration-*`,
    `ease-standard`); it leaves the shape backlog.
- **Not in the prototype and kept:** Buy now beside Add to bag (tablet up). **Not built:** the
  "Ridas · Georgette · shop" line above the gallery (the product carries no category name yet)
  and "Arrives by … to 400003" for a remembered PIN code (the check asks each visit).
- Suites: tsc; unit 3054/3054.

## 2026-11-04 — A listing Amazon suppresses later shows why, and is fixed and sent again from its listing [CONTRACT] [MIGRATION]

- **Owner's ask (marketplace-publish Q23):** a listing Amazon suppressed or rejected after it went
  live showed only as Inactive, with no reason and no way to fix and push again.
- **A daily look, for every shop in one run** (`channels.check-listing-problems`, from the daily
  maintain pass): one statement reads every connected account with its token; each account is asked
  once (`searchListingsItems` filtered to `withIssueSeverity=ERROR`, so a clean account is one call);
  one statement writes every answer. Two statements a day, whatever the number of shops. An account
  that could not be read keeps what it had; a listing not named again is clean.
- **The fix:** the Listings row reads "Suppressed" or "Needs a fix" with Amazon's sentence and **Fix**,
  which opens the listing with the reason on its field. The field it names waits for a send, edited or
  not, so **Review and publish** pushes it again; the look after the send clears it at once. A reason
  on nothing we edit points to Seller Central. "Needs fixing n" filters the page; Home names the count.
- Migration `20261104130000_listing_problems`: `ChannelListing.problems`, `problemsSince`,
  `suppressed`. Adds columns; drops nothing. Flipkart answers none (it reports no reason).
- `channelConnectionService.tokenSource` replaces three copies of the batch token closure.
- Tests: `marketplace-publish.test.ts` (one read and one write for every account, counted: 2
  statements; a clean listing clears and an unread account keeps its own; the reason on the field, a
  resend of the unchanged field, cleared after a clean look), `listing-publish-providers.test.ts`
  (the error filter, paging, suppression from enforcement), `home-attention.test.ts`. Mutations:
  not clearing listings no longer named, clearing every account instead of those read, and dropping
  the resend each failed a test. Suites: unit, integration, tsc, lint:boundary, build.

## 2026-11-04 — Store: categories leave the desktop header; Home's category row becomes arches

- **Asked by the owner:** the header named the same categories as Home's picture row just below
  it. The bar now holds Shops and Offers only; categories are browsed from the picture row (every
  size) and the footer.
- **Home's category row follows the review prototype:** `CategoryArches` (new, `category/`) draws
  the top-level categories, in the admin's order, as arch-topped pictures (9:10) with the name and
  an arrow beneath, below the hero rather than above it: a swipeable line on a phone, four across
  from tablet, five from desktop. `CategoryLanes` (the small circles) stays for a shop's filter
  rail and a category page's children. Whether the uploaded category pictures suit the tall frame
  is checked after deploy (owner).
- Suites: tsc; unit.

## 2026-11-04 — Offers: a table with status tabs, search and pages, for shops and the admin

- **Asked by the owner:** a shop can have many offers, and a grid of big cards made one hard to
  find. Both Offers pages (seller and admin share it) are now one `ResourceList`: compact rows on a
  phone, a table from a tablet with Offer (and its code), Discount, Covers, Runs, Used, Status and
  Stop. The whole row opens the offer; "Edit" is also spelled out from a tablet.
- **Filters, all in the URL and applied on the server:** status tabs (All · Live · Scheduled ·
  Ended · Stopped) with counts; a search over the offer's name, its code, and a covered product's
  name or SKU; the kind (automatic or code); sort by name or end date from the column headers;
  25 a page with Previous / Next. The form is a plain GET, so it works before any script loads.
  An empty list says whether nothing exists yet ("New offer") or nothing matches ("Clear filters").
- **Fix:** the list showed only the first 24 offers and had no way to the rest.
- One status per row: Stopped, then Ended or Scheduled by date, then Budget used up or Fully
  claimed, else Live. Stop is offered only on a running or scheduled offer.
- `adminPromotionService.listOffers` (`OfferListQuery` → `OfferListResult`, closed sets
  `OFFER_STATUS`, `OFFER_KIND`, `OFFER_SORTS` in `promotion.types.ts`) maps rows to an explicit
  `OfferListRow`, replacing the page's `as unknown as` cast. `promotionRepository.listScoped` takes
  a `filter` that is ANDed with the scope, never replacing it, and an id tie-break so pages never
  repeat or skip; `countScoped` counts the tabs. The URL is parsed by `offerListQuerySchema`: an
  unknown value falls back to the default, and the sort column is resolved against `OFFER_SORTS`
  before it reaches `orderBy`. The `/api/*/promotions` list routes are unchanged.
- Tests: `tests/integration/offers-list.test.ts` (another shop's matching offer never shows; each
  tab holds what its badge says, a stopped offer past its end is Stopped not Ended; search finds a
  covered SKU; counts stay within the shop) and two URL cases in `promotion-schema.test.ts`.
  Mutation-tested: the filter replacing the scope, Ended taking stopped offers, the SKU branch and an
  unchecked sort column each fail a test. `offer-form-loss-panel` reads both the phone rows and the table.
- Suites: tsc (clean outside the channels files being edited in parallel); unit 3052/3052;
  integration offers-list, offer-budget, offer-ceiling, offers-preview-charge,
  bulk-sale-price-and-sibling-offers 43/43.

## 2026-11-04 — Seller portal: Channels shows the platforms' real marks, and what is coming soon apart

- **Asked by the owner:** the page was a grid of letter tiles. Each card now carries the platform's
  own mark in its own colours (`ui/icons/platform-marks.tsx`, `PlatformMark` with a `size` axis:
  Amazon, Flipkart, Meta from Simple Icons, CC0; Google's four-colour G), our logo for the store, a
  one-line purpose, a state chip (feeds get On / Off), the detail, and its actions right-aligned
  under a rule. Cards in a row share a height; padding `p-4 md:p-5`.
- **Two sections:** "Where you sell" (store, Google, Meta, any marketplace open to connect) and
  "Coming soon" (dashed, quiet, nothing to press): every marketplace the server reports unavailable,
  plus Meesho (`UNBUILT_CHANNELS`; no connector exists). Meesho has no free-to-use mark, so its
  wordmark is set in its purple until the official SVG drops into `platform-marks.tsx`.
- **Flipkart moves to Coming soon by the existing switch, not by the UI:** remove `flipkart` from
  `CHANNELS_CONNECT` (TRD D10, `server/channels/channel-availability.ts`) in the deployment's
  environment. Until then the server still offers and accepts a Flipkart connect.
- Tests: `channel-cards` gains the section split (an unavailable marketplace never sits beside a
  Connect button); mutation-tested and caught. Suites: tsc; unit 3052/3052.

## 2026-11-04 — Seller portal: two dead nav items gone, dropdown arrows inset, figure tiles aligned

- **Asked by the owner:** "Setup list" in the sidebar only jumped to Home, where the list already
  lives (and keeps a one-line Show row when hidden); "Switch shop" repeated the shop switcher at the
  top left. Both removed from `PORTAL_NAV` and its key type; the "hidden" toast copy no longer
  points at More.
- **`Select`:** the browser's own arrow sat flush against the border in some engines (Photos
  filters). The native arrow is hidden (`appearance-none`) and an `expand` icon drawn 12px in, with
  room kept for it (`pr-10`); still a native select, so a phone opens its own picker.
- **`DashboardWidgets` tiles** (the admin's view of a shop) follow `StatsCard`: figure, then label,
  then caption on its own line, icon top right, equal heights in a row (the link wrapper is
  `h-full`), one padding.
- Suites: tsc; unit 3049/3049.

## 2026-11-04 — [CONTRACT] Seller portal: Home looks like the admin dashboard, in the shop's colour

- **Asked by the owner:** both are control panels, so they share one look (design-system Q34). The
  shop's Home now has the admin's layout: period links (Today / 7 days / 30 days, in the URL) in the
  header; a sales card with the total, its change and the day chart; four figures under it (Paid
  orders, Average order, You'll receive, To pack now); "Needs you now" beside it from desktop, above
  it on a phone. Before the first paid order the setup list takes the sales card's place.
- **One component, two tones:** `SalesSummary` (`dashboard/sales-summary.tsx`) is what both the
  admin's `SalesOverviewBlock` and the new `ShopSalesBlock` render. `SalesChart` gains a `tone` axis
  (`platform` = brand green, `shop` = new semantic `--shop-accent`, blue); `PeriodControl` takes a
  `basePath`.
- **The figures:** `shopSalesOverview` reads the shop's payouts ledger in one statement
  (`salesRepository.shopByDay`): goods less both funded discounts over live SALE and REVERSAL entries,
  so a cancelled parcel nets out; SALE count as paid orders; payable (fees included) as You'll receive.
  Read live, never cached (ADR-0065). The "Your numbers" widget grid and its parcels read are gone
  from Home; the widgets stay on the admin's org view.
- **Fix:** the floating "Admin" button no longer shows in the seller portal, where it covered the
  page's action bar ("Add a product") and drawer footers.
- Tests: `admin-dashboard-metrics` gains the shop read (org scoping, deleted entries, reversals,
  India-day buckets, paise exact); each of those four guards mutation-tested and caught.
- Suites: tsc; unit 3049/3049; integration `admin-dashboard-metrics` 8/8.

## 2026-11-04 — Seller portal: a banner is added in a full drawer, with a preview of how it will look

- **Asked by the owner:** the "Add a banner" dialog was a cramped centred box. It is now a drawer:
  the whole screen on a phone, a wide right-hand panel from tablet (`SheetContent` gains a
  `size="full"` axis). The header and the Cancel / Add banner footer stay put while the body scrolls.
  `add-promotion-dialog.tsx` → `add-promotion-sheet.tsx`, which leaves the raw-dialog ratchet and is
  listed as ADR-0040 case 3 (fields beside the preview they change).
- **Preview at the top of the drawer:** desktop (5:2) and phone (4:5) frames with the picture framed
  as it will be saved (crop or fit-in, phone focus point) and the title, line and "Shop now" over it,
  updating as you type. The words come from the live banner's own `HeroBannerWords` (split out of
  `HeroBanner`, with a `frame` axis), so the preview can't drift from the shop page. With no picture
  it shows the plain shop colour, as the shop page does. `ImageSlotField` gets `showPreview` so the
  drawer doesn't show its bare preview as well.
- Suites: tsc; unit 3049/3049.

## 2026-11-04 — Seller portal: the top bar's search icon is gone

- **Found by the owner:** the magnifier in the portal's top bar only linked to the Products page. There
  is no portal-wide search for it to open, and Products has its own search box, so a search icon that
  navigated elsewhere was a surprise. Removed with `PortalHeader`'s `search` prop and its copy.
- Suites: tsc; unit portal-copy, portal-sidebar-sticky, portal-nav, icons.

## 2026-11-04 — E2E smoke green again: seed before the server answers; tests speak "bag"

- **Category page read "0 pieces" in CI.** Playwright starts the server, whose readiness probe loads
  home; since the revamp home and the footer read the category list, which the read cache keeps for
  an hour (ADR-0065). The seed then made the "test-fixtures" category outside any request, which
  clears nothing, so the category page found the category (read live) but walked a stale tree and
  listed nothing. Production is not affected: categories are made through admin requests, which clear
  the cache. The webServer command now seeds before `next start`; globalSetup still seeds for a
  reused local server (the seed is idempotent).
- The smoke test now asks for the store's words since Q21: "Add to bag", "Added to your bag", "Your bag
  is empty" (was "Add to cart", "Added to cart", "Your cart is quiet", "No items to checkout").
- Reproduced exactly as CI runs it (fresh `bhendi_bazaar_ci`, no `.next`, CI's missing secrets): 4
  failed before, 12/12 passed after, phone and desktop.

## 2026-11-04 — Review fixes for the design-system programme (/bb-review, fresh context)

- **A phone-only storefront photo drew cover-cropped on tablet and desktop** while the editor's preview
  showed it fitted: the buyer's page built its row without the phone-only rule the editor used. One
  row-builder now serves both (`slotImageRow` in `storefront.service.ts`). Integration test: a phone-only
  "fit it in" set draws fitted with its fill on desktop; reverting the fix failed 2 tests.
- **Bulk stock went around `stockService`** (Invariant 6 names it as the way stock moves). It now has
  `setCountedMany`, `lockAllOf`, `changedMany` and `markSoldOut`, and the bulk service calls only those.
- **Stock has a ceiling:** `STOCK_MAX` (1,000,000 per location) in the product form and the bulk edit,
  so a typo is a message rather than an int overflow and a 500.
- **A min-and-max price filter kept only the max** (pre-existing in the listing; the new count inherited
  it): one `price` key now carries both bounds.
- `claimPublish`'s doc comment is back on `claimPublish`. Inventory-sync's renumbered decision (Q28,
  sync starts on connecting) is now cited as Q28 in code comments too (channels, Home's DAL, the
  stock-sync route and schema, three channel components).
- Follow-ups the review raised, not done here: a team bulk send that fails at the third shop loses the
  first two shops' audit entries; bulk stock may write to an inactive location; a lost insert race
  reports `currentQuantity: 0`; the listing count can be cached under an unbounded category slug (as the
  product rows already can); the pincode check calls the rates route on every product view and shares
  checkout's rate bucket; the bulk audit is written after commit; rupee parsing in `bulk-input.ts`
  belongs beside `src/lib/format.ts`; the bulk integration test clears the shared test shop's Amazon
  connections, which a concurrent run can trip over.

## 2026-11-04 — Synced with origin: bulk stock edits ride the one "stock changed" job

- `origin/main` brought inventory-sync's one-read-one-job stock change (`channels.stock-changed`).
  The bulk actions' `stockChangedMany` now calls the same `stockChanged` (one read, one job for the
  whole selection) and `enqueueSoldOut` writes one job marking every archived product sold out,
  instead of a push job per product. `enqueueMany` gives a spec's retries as `enqueue` does.
- **Build fix found by `next build`:** the admin's pickup list (a client component) imported
  `PICKUP_QUEUE_TAB` from `pickup-queue.ts`, which reaches the database client, so the browser
  bundle pulled in `pg`. The tabs and row shape now live in `server/checkout/pickup-queue.types.ts`,
  re-exported from `pickup-queue.ts`. Typecheck and tests cannot see this; only the build can.
- Verified on the synced tree: tsc; unit 3,049/3,049; integration 635/635 (local database); `next build`.
- **Correction to an earlier entry:** both branches numbered an inventory-sync decision Q27. Origin's
  (one job per stock change) keeps Q27, being cited in code; "sync starts on connecting", cited as
  inventory-sync Q27 in the 2026-11-04 stock-sync entry below, is now **Q28** in the spec, TRD and UX.

## 2026-11-04 — Lucide removed; every icon through one seam; role names compared by constant (design-system foundations, last unit)

- The last 16 files moved to `Icon` / `Spinner`; `lucide-react` is uninstalled. `icons.test.ts` loses its
  ratchet and now refuses any icon-library import outside `ui/icons/` outright.
- The remaining `"ADMIN"` / `"USER"` literals (middleware, admin guard, auth config, users table and filter)
  compare against `PLATFORM_ROLE`; the analytics repository uses Prisma's own enum, keeping it to two domains.
- `ARCHITECTURE.md` counts moved: 166 handlers, 14 storefront pages, 351 test files.
- Not done in this programme: the React Compiler (TRD D7) — it changes how ~400 client components render
  and needs its own before/after measurement (foundations A9), so it waits for the owner's visual review.

## 2026-11-04 — Admin rebuilt: grouped navigation, a dashboard led by sales and its trend, dense lists (design-system/admin-console)

- **Navigation:** five groups (Overview, Orders, Catalogue, Shops, Platform), one icon each, the real logo
  inverted on the dark rail; Refunds carries its count.
- **Dashboard** renders on the server: sales for today / 7 / 30 days with the change on the period before,
  a hand-drawn SVG chart (current solid, previous dashed, a spoken summary; no chart package — Q13), paid
  orders, average order, platform kept, shops selling, "Needs action" (Q31) with an all-clear, and the
  latest orders. Each block streams and fails on its own. `dashboard-live.tsx`, its client and the two
  orphaned `/api/admin/dashboard*` routes are deleted (route-reachability).
- **Lists:** orders (tabs with counts from one `groupBy`), pickups, refunds, product types, payouts and
  auctions are `ResourceList`s with URL sort and row links; chips are `StatusBadge`; every page has one
  `PageHeader` h1; the admin group gains `error.tsx` and `loading.tsx`. The products page's meaningless
  `revalidate` is gone (it renders per request behind the session). `FloatingAdminButton` sits above
  the tab bar and compares by constant. Auth pages and `/sell`: icons and type only (Q14 parks the rest).
- Tests: `admin-dashboard-view.test.tsx` (chart points per day, a zero period draws flat without NaN,
  spoken summary, attention copy and paise, period parsing). Mutations: removing the zero-peak guard and
  the period check each failed a test. Integration: `admin-dashboard-metrics`, `db-ops-budget`.
- Not done: an order detail panel (rows open the order page), the shops list is still read in the browser.

## 2026-11-04 — Seller portal rebuilt: products with bulk edits, orders with tab counts, Home that calls for action [CONTRACT] (design-system/seller-workspace)

- **Chrome:** phone top bar is the shop switcher and search; the tab bar is Home · Products · Orders ·
  Earnings · More (own-store Q13 replaced: Shop moves into More); Orders carries the to-pack count.
- **Products:** tabs with counts (All, Low stock, Sold out, Archived), search, one `ResourceList`
  (phone rows, dense table from `md:`), and selection → Price, Stock, Archive, Send to marketplace
  (Q29), each a dialog that sends integer paise or per-location stock with what it saw, then reports
  what changed, what was skipped and why, and what someone else changed meanwhile. The stat-card row is
  gone; "All (archived too)" is replaced by the tabs. `ProductForTable.stockByLocation` is new.
- **Orders:** Store / Marketplace as a segmented control; tabs with counts (To pack, For pickup — was
  "Ready" — On the way, Done, Cancelled); "Mark packed" on the row.
- **Home:** "Needs you now" per Q31, an all-clear, the shop link, "Add a product" docked.
- **Everywhere:** hand-rolled save bars → `ActionBar`; the five `(org)` error boundaries → `ErrorState`
  with retry; ten new `loading.tsx`; storefront hero and collection photos take a phone and a desktop
  version (image-slots D10, editor side; `StorefrontSettingsInput.heroImages`, `collections[].image`).
- Tests: `bulk-product-dialog.test.tsx` (rupees to paise, stock sends only changed cells with
  `seenQuantity`, selection clears, an empty form warns and sends nothing); a storefront-editor
  integration case (desktop+phone and phone-only sets; a foreign picture refused). Mutations: sending
  `quantity` as `seenQuantity` failed 2; not clearing the selection failed 1.
- Not done: a shop-scoped "this week" figure (needs a new read), the Q15 move of `shared/forms/*`.

## 2026-11-04 — Store rebuilt, phone first: one tab bar, docked buy bar, delivery by pincode, a focused checkout [CONTRACT] (design-system/storefront-journey)

- **Chrome:** tab bar Home · Shop · Saved · Bag · Account (Q21), hidden in checkout, where the header
  becomes a back arrow to the bag (Q20); the real logo; the footer, with grievance and returns links,
  now shows on phones too. A new `/shop` page lists every category and the catalogue.
- **Grid:** 2 / 3 / 4 across on phone / tablet / desktop (Q19) with `sizes` to match; long grids use
  `content-visibility` (Q23). Category, search and offers share a toolbar with a count, sort in the URL
  and an "On offer" chip; a search with no query no longer says "undefined".
- **Product page:** delivery by pincode from the existing rates lookup (Q25; refuses anything but six
  digits, remembers the pincode in this browser only), price and Add to bag docked above the tab bar;
  the bag icon drops on add and the heart pops on save; no size guide (Q28), no "ask the shop" (Q26).
- **Bag** groups lines by shop, one parcel each; **checkout** is three steps with one "Pay ₹X" button
  that opens Razorpay (Q27; no method picker, no cash on delivery), errors shown only after Pay; the
  **order page** shows each parcel's progress, keeping track and cancel rules as they were.
- **Server:** `listingWhere` is shared by the listing and a new `countProducts` (read through the cache
  except searches and offer filters, ADR-0065); `StorefrontPageDto` gains `heroImages` and
  `collections[].image`, and the themed hero and collections draw both versions. `PriceDisplay` uses
  the type roles and the foreground colour.
- Tests: `storefront-journey.test.tsx` (grid columns match `sizes`; exactly five tabs, absent in
  checkout; pincode refused before any request; no checkout error before Pay). Mutations: removing the
  after-Pay gate failed 1; loosening the pincode check failed 2. `org-scoping` now requires both product
  reads to build their filter from `listingWhere`; `read-cache-tables` walks the new count.
- Not done: the themed shop's own header and tab bar were only re-iconed; `/shop` is not yet in the
  sitemap; the docked bar does not yet repeat "arrives by".

## 2026-11-04 — Banners get a phone picture and a desktop picture, cropped exact or fitted [CONTRACT] [MIGRATION] (design-system/image-slots)

- **Owner's request (Q24):** the admin's home banners and a shop's banners take a phone and a desktop
  version. A picture a little off the slot's shape is either kept exact (cropped, choosing what stays)
  or fitted in (edges filled with a colour sampled from it). With no phone version, a phone shows the
  desktop picture around a focus point the uploader picks. One field (`shared/image-slot/`) and one
  renderer (`shared/responsive-image.tsx`, `<picture>` art direction through `getImageProps`; the phone
  file below `md:`, the desktop file from it) serve every surface. Spec and TRD:
  `docs/specs/design-system/image-slots/`.
- **Stored, not baked:** the crop rectangle, fit, fill and focus are kept per side and drawn with
  `object-fit` and `object-position`, so re-cropping never re-encodes a file. The server checks
  everything again: the picture is a ready image in the owner's own library, the crop is inside it and
  on the slot's shape within 2%, the fill is a colour.
- **[MIGRATION] `20261104120000_image_slots`, additive:** `Banner` and `OrgBanner` gain `phoneImageUrl`,
  `phoneImageAssetId` (FK to `MediaAsset`, restrict) and `imageFraming`; `OrgStorefrontSlot` gains
  `phoneAssetId` and `imageFraming`. Existing banners are backfilled to centred cover and render as
  before. The phone URL is a column, so the cached home-banner read gains no table (ADR-0065).
- **[CONTRACT]** banner forms send `image` instead of `imageUrl`; the hero reads `ResponsiveImageDto`
  (CONTRACTS.md, Banners). The media library counts phone pictures as uses, so one in use cannot be
  retired. On a phone, a banner with a picture now takes the 4:5 phone shape.
- Removed: `BannerImageField.tsx`, `banner-image-check.ts`.
- Tests: `image-slots`, `image-framing`, `responsive-image`, `image-slot-write` (unit),
  `tests/integration/image-slots.test.ts` (save and read back with a crop and a phone picture; a phone
  picture in use cannot be retired; another shop's picture refused; an old banner still renders; a
  home banner from the platform library). Mutations: dropping the crop-bounds check failed 2 tests;
  dropping the org scope on the library lookup failed 2.
- Not yet: storefront photo slots use the new columns only in the database (their look sheet and
  themed sections still take one picture); the category hero; an edit dialog for a shop's banner.
  Not checked in a browser.

## 2026-11-04 — Admin sales trend, and "Needs attention" that only calls for what can be done [CONTRACT] (design-system Q30, Q31, data side)

- **Admin dashboard reads** (`server/analytics/sales.*`, read-only, live — never the read cache): per
  India day, paid order value in paise for today / 7 / 30 days and the same span before it, cut at the
  same time of day; paid orders, average order, platform kept (from the payouts ledger) and shops
  selling, each with its change. Paid means `paymentStatus = paid` and not cancelled, summed from the
  stored `grandTotal`; unpaid, failed and expired orders never count. 3 statements per load.
- **Admin queue (Q31):** at most five, money and buyers first, nothing at zero, each linking where it is
  resolved: refunds not yet started; parcels ready for 24 h or more and not booked; shops owed money
  for 7 days or more; courier conflicts not dismissed. One statement. "Shops not verified" was built and
  dropped (Q32): nothing sets the flag and no buyer sees it. Every item is a query; no column or label was added.
- **Seller Home (Q31):** "orders to pack" counts only paid parcels still packing and says how long the
  oldest has waited; a new low-stock line counts only products that sold in the last 30 days and says
  when the first runs out. "New reviews" and "auction ends soon" are dropped — nothing the shop does
  clears either. `HomeAttentionDto` changed (CONTRACTS.md); the screens come with the seller and admin
  units.
- Tests: `tests/integration/admin-dashboard-metrics.test.ts` (7: unpaid/expired/failed/cancelled
  excluded, month boundary, India-midnight buckets, exact paise, platform kept nets fees, low stock
  ignores unsold products, each queue threshold on both sides), `tests/unit/admin-attention.test.ts`,
  `home-attention.test.ts` rewritten. Mutation: dropping the paid filter from the day series failed the
  sums test.
- Dropping the reviews and auction lines reverses own-store Q13 and Q22 (owner agreed, Q33).

## 2026-11-04 — Bulk product actions: price, stock, archive, send, one statement each [CONTRACT] (design-system Q29, server side)

- **Owner's call (Q29):** a shop, or the Bhendi Bazaar team, selects products and edits price, edits
  stock, archives, or sends them to a connected marketplace. Routes `POST /api/org/[orgId]/products/bulk-edit`
  and `POST /api/admin/products/bulk-edit`; shapes in CONTRACTS.md (Products). The screens come with
  the seller-workspace unit; `useBulkProductActions` is ready for them.
- **Optimised as asked:** no action loops over rows. Price is 3 statements and stock and archive 6,
  whether 2 or 12 products (asserted); per-row guards (stock compare-and-set, a listing's version) sit
  inside the one statement. New seams: `enqueueMany` (one batched job insert) and a batched audit insert.
- **Invariants:** every statement is scoped by org (another shop's id is skipped, never touched); money
  is paise, percent rounds half away from zero; stock is compare-and-set (Invariant 6); archive keeps
  the single-archive rules (stock locked, live bidding refused, idempotent); the team path requires a
  reason and writes the shop-visible history; a bulk price edit bumps `version`, so an open form is
  refused rather than silently undoing it. Writes go through the Prisma client, so the read cache
  clears by table (ADR-0065).
- **Rate limits:** the two routes are portal routes behind `withOrg` / `requirePlatformAdminId`, which
  the registry (ADR-0063) does not list by design.
- Tests: `tests/integration/product-bulk-actions.test.ts` (9: org scoping, paise and rounding, version
  bump, stock conflict, archive idempotence, team skips archived, foreign location, send claims and
  in-flight, statement count flat in N), `tests/unit/product-bulk-schema.test.ts`. Mutations: dropping
  the org scope failed the scoping test; dropping the compare-and-set failed the conflict test.
  Not yet tested: the `bidding_live` skip on its own, the send statement count, a team send across shops.

## 2026-11-04 — Page grammar: one page header, action bar, states, tabs, list, selection bar (design-system/page-grammar)

- **One page title:** `PageHeader` is the only h1 (`text-headline`), with a visible back link whose
  `label` names the parent ("Products", never "Back"). `SectionHeader` no longer renders an h1; its 19
  h1 uses moved to `PageHeader` (a test refuses `SectionHeader as="h1"`).
- **New shared parts:** `ActionBar` (docked above the tab bar on a phone, inline from `md:`),
  `PageTabs` (route tabs with counts, zero hidden), `SelectionBar` (count, three actions and "More",
  hidden at zero), `ResourceList` (one column definition: rows on a phone, a dense table from
  `md:`/`lg:`, selection, sort in the URL with `aria-sort`); `DataTable` is now a thin wrapper over it.
- **States:** `EmptyState` draws the arch and takes one action that may be a link; `ErrorState` has one
  retry; skeleton blocks (`SkeletonRows`, `SkeletonTiles`, `SkeletonHeader`) replace `LoadingSpinner`,
  which is deleted. `StatusBadge` takes `tone` (one `cva` map); `StatsCard` drops the icon-in-a-circle.
- **Tokens:** a base `--deal` / `--deal-foreground` outside storefront themes (rose 450 on white; themes
  still repoint it); `Button variant="inverse"` for dark surfaces, used by the selection bar;
  `Checkbox hideLabel` for row selection with a spoken name.
- Call sites moved mechanically (EmptyState `icon`, StatusBadge `status` → `tone`, DataTable `onSort`
  removed — sorting is the URL's). Hand-rolled save bars, chips and raw tables are left for the
  screen units. 14 files left the icon ratchet.
- Tests: `page-grammar.test.tsx` (empty-state link, no h1 SectionHeader, URL sort and `aria-sort`,
  selection bar at zero and overflow, tabs `aria-current` and zero count). Mutations: `count <= 0` →
  `count < 0` failed the selection test; dropping the page reset failed the sort test.

## 2026-11-04 — Design-system foundations: one icon seam, type roles, Button axes (design-system/foundations unit 1–2)

- **Icons:** `@phosphor-icons/react` 2.1.10 added (MIT; `optimizePackageImports` in `next.config.ts`).
  `ui/icon.tsx` draws every icon by meaning (`ui/icons/registry.ts`, 124 lucide glyphs mapped);
  weight follows size (regular under 20px, light above). The owner-approved brand drawings
  (`ui/icons/brand.tsx`, v2: two-tone, one motion each, off under reduced motion) override bag,
  saved, home, shop, account, search, menu and parcel, and add rida and arch. `ui/spinner.tsx` for
  inline progress; `Button pending` uses it.
- **Gate:** `tests/unit/icons.test.ts` — only `ui/icons/` imports an icon library; the 208 files
  still on lucide are a ratchet that only shrinks (ADR-0056); an unlabelled icon is `aria-hidden`.
  Mutation: a lucide import added to `ui/spinner.tsx` failed it.
- **Type:** seven roles (`text-display` … `text-label`), phone and desktop sizes per Q10; body text is
  `text-body`. `text-3xs`/`text-4xs` retired (42 uses → `text-2xs`, 11px floor) and refused by
  `design-tokens.test.ts` (mutation: a `text-3xs` in `product-card.tsx` failed it). Motion roles
  (`duration-fast|base|slow`, `ease-standard|emphasised`, zeroed under reduced motion); shadows drawn
  from the palette ink instead of `rgb(0 0 0)`; `--icon-accent`. All registered in `cn`.
- **Button:** `size` and `shape` are separate axes (`size="icon-lg"` → `shape="icon" size="lg"`, 61
  uses); `ShareButton` exposes the same axes. `layout/brand-logo.tsx` renders the platform logo,
  inverted on dark surfaces.
- **Rules:** ADR-0066 (Proposed; renumbered from 0065, which the read cache took) gains D8 variants
  per axis and D9 the logo; `src/components/CLAUDE.md` states the icon, variant, type and logo rules.
- Suites: tsc; unit gates icons, design-tokens, cn-tokens, ui-primitives, button-rows, double-submit, share-button, docs-integrity. Full suite runs after the parallel units land.

## 2026-11-04 — Stock change, review: survives the deploy that introduces it

- **Found in review** of the entry below, fixed before merge: a deploy ships the site before the
  worker, so the running worker could meet `channels.stock-changed` before it knows the type, fail it
  through its five default retries (~15 minutes) and park it, losing that change's marketplace push.
  One shop has stock sync on. A job spec may now carry its own `retry` (`jobs.types.ts`), stored on the
  job when sent; `channels.stock-changed` retries ten times backing off from a minute (about six hours
  to the queue's one-hour cap), so it waits for the new worker instead. No deploy order to remember.
- Also: TRD D2 describes the new flow; two doc comments moved back to their functions; the batch
  job's sold-out priority is tested.
- **Tests:** the retry window exceeds three hours (mutation: no `retry` went red); the priority
  (mutation: none went red).

## 2026-11-04 — A stock change is one read and one job, and only listed products are pushed

- **Why:** every stock change (an order, an edit, a bulk import) read each touched product's total and
  queued a marketplace push per product, whether or not any marketplace listed it; each push job then
  cost the worker a fetch and a read to find nothing to send. A 30-product change was 63 statements in
  its transaction; a 500-product import about 3,000 in all.
- **Now (inventory-sync Q27):** catalog reads every total in one statement and enqueues one
  `channels.stock-changed` job naming the products, each with whether it sold out. Channels keeps the
  products a live listing on a marketplace with sync on would send, in one read, and queues the
  unchanged `channels.push-stock` for each. Measured: 63 → 5 statements for 30 products.
- **Unchanged:** the push (lock per product, counts already sent skipped, busy marketplace retried), a
  sold-out product going first (Q19), catalog never importing channels, and `channels.push-stock`'s
  payload, so jobs already queued at deploy still run.
- **Tests:** `tests/integration/stock-sync.test.ts`: one job per change naming each product and which
  sold out (mutations: a job per product, the flag lost, each went red); only listed products pushed,
  none with sync off (mutation: no filter went red).

## 2026-11-04 — Answer check and worker wake, review: a first look is never merged into a later run

- **Found in review** of the entry below, fixed before merge:
  - pg-boss merges delayed jobs by when they are *sent*, so a send's two-minute first look could be
    swallowed by a run already queued an hour ahead. `enqueueListingCheck` now keys each run by the
    two-minute slot it will *run* in (`enqueueLater`'s new `slot`): different moments never merge,
    the same moment still collapses to one run.
  - A connection the shop must reconnect is no longer asked; its look counts as missed, as before
    the reads were batched.
  - `mirrorsFor` reads in a fixed order, so a product with two live mirrors names the same SKU to
    every caller.
- **Tests:** a far-off run does not swallow a near one (mutation: no run slot went red); no call
  through a connection needing reconnect (mutation went red); one shop's unreadable token fails only
  its looks (mutation: reading it outside the guard went red); the wake rule prefers an idle loop,
  still wakes one when all are busy, and frees a loop whose job threw (mutations went red).

## 2026-11-04 — The listing answer check runs when a look is due; one new job wakes one worker loop

- **Why (the ops review):** after a publish the worker looks for the marketplace's answer at 2, 10, 30
  and 120 minutes, but the check ran every two minutes while anything waited (about sixty runs for four
  looks) and read each listing piece by piece: up to ~4,300 statements a day. Separately, pg-boss woke
  all four worker loops for every new job, three of them to fetch nothing.
- **Answer check (marketplace-publish Q22):** the next run is enqueued for when the next look falls
  due, never sooner than two minutes apart, and none once nothing waits. A run claims what is due and
  reads those listings, their connections with sealed tokens, and missing SKUs in one statement each;
  a look then costs only its own write. The looks and the chain (inventory-sync Q23) are unchanged.
- **Worker wake (worker-foundation trd.md D3):** a new job wakes one idle loop; a loop that takes a job
  wakes one idle sibling, so a burst still spreads. Measured on the real worker: 8 statements per job
  before, 4 after; 40 jobs in one transaction drained in 1.5 s at about 2 each.
- **Tests:** `tests/integration/marketplace-publish.test.ts` gains the schedule (mutation: a fixed two
  minutes went red) and the cost, one write per extra listing (mutation: a per-listing SKU read went
  red); `tests/unit/jobs-wake.test.ts` holds the wake rule (mutations: no override, no sibling wake
  each went red) and fails if a pg-boss upgrade moves the internals it relies on.

## 2026-11-04 — Storefront cache, review: bounded age, a clear after commit, only cached tables, input cannot fill it

- **Found in review** of the entry below, fixed before merge:
  - Next serves an expired entry and refreshes it behind the response, so its `revalidate` bounded
    nothing: each entry now carries when it was read and is read live past its limit.
  - A write's statement runs before its transaction commits, so a page rendered in between could
    re-cache the old row: the clear is now repeated after the response (`after()`).
  - A write to any table queued a clear: now only tables some cached read declares (`CACHED_TABLES`).
  - Searches, later pages, arbitrary review ids and over-long slugs no longer add cache entries.
  - The auction lock goes through `suspendsPurchase`; the bidding CLAUDE.md and CONTRACTS.md are updated.
  - The listings page's progress line moves every 4 seconds again (it showed only on refresh); the
    15-minute "still reading" state is recorded (channel-import Q21, ux.md, trd.md D10).
- **Tests:** `tests/unit/read-cache-money.test.ts` fails if checkout, cart, payments, payouts, the
  promotion engine or their routes touch the cache (mutation: cart on the display context went red);
  the age limit (mutation: serving the old entry went red); the write wiring through the real client,
  raw SQL and a transaction included.

## 2026-11-04 — Storefront page views stop re-reading the database; the listings page stops re-rendering itself

- **Why:** the database meters every statement, and the store was spending about 15,000 a day. Each
  query was already lean, but nothing was kept between requests: every page view cost 5–9 statements,
  a missing product 5, so crawlers cost as much as shoppers.
- **Storefront reads are shared across requests ([ADR-0065](adr/0065-storefront-reads-are-shared-across-requests-and-cleared-by-the-tables-a-write-touches.md)):**
  offers, auction locks, categories, ratings, banners, review lists and product rows come from Next's
  data cache. Each cached read declares the tables it reads; any write to one of them through the site
  clears it at once (checked: an admin banner switch shows on the very next view). The worker's writes
  fall back to an expiry: 5 minutes for product rows (stock), an hour for the rest.
- **Prices stay exact:** offers that have not ended are cached, and which have started is decided per
  request, so a sale starts and ends to the second (ADR-0018's boundary). Lists chosen *by* being on
  offer are read live. Checkout, cart and payment still read live (Invariants 1, 2, 6).
- **Measured on a production build** (statements per repeat view): home 8 → 1, category 7 → 0,
  product 9 → 0, search 6 → 0, offers 5 → 1, missing product 5 → 0.
- **Listings page:** while a marketplace read runs, the page used to re-render all its reads every
  4 seconds. It now asks only for the read's progress (new `GET …/listings/read`), refreshes when the
  read ends or every 30 seconds of progress, and stops on its own after 15 minutes.
- **Tests:** `tests/integration/read-cache-tables.test.ts` fails if a cached read touches a table it
  did not declare (mutation: dropping `ProductStock` and `PromotionTarget` went red);
  `tests/unit/display-price-context.test.ts` holds the offer boundary (mutation: dropping the start
  check went red); `tests/unit/read-cache.test.ts` (write detection, Date/Map round trip);
  `tests/unit/read-progress.test.ts` (mutation: dropping the time limit went red).

## 2026-11-04 — Seven UI defects from the platform audit

- **Checkout:** the phone's Place Order bar was `sticky bottom-0` under the fixed tab bar (z-40), so it
  was hidden; it now sits at `bottom-tabbar`, with a bleed matching the page gutter (`px-3`, `sm:px-6`).
- **Order page:** said "Thank you… placed successfully" for every order, unpaid, failed, expired and
  cancelled included. The headline now follows the status (`order/order-headline.ts`) and is the
  page's `h1`. The Suspense around already-awaited data, which could never show, is gone.
- **Admin payout detail:** the header printed the literal text `{org.name}`; the values are code again.
- **Portal sidebar:** `/admin/orders/pickups` lit Orders and Pickups both, and `/admin/ordersx` lit
  Orders. One item lights: the deepest whole-segment match.
- **Error screens:** five boundaries called `reset`, which in Next 16 re-renders without refetching,
  so "Try again" showed the same error. They call `retry`.
- **Product tiles:** `sizes` said 33vw on phones while the grid has been 2-up since b2c4ce46, so phone
  tiles fetched images too small and looked soft. Now 50vw.
- **Home hero:** on desktop the headline and buttons were hidden until hover; they always show.
- **Header cart:** was disabled and swallowed the click when empty; it always opens the cart.
- Tests: `ui-fixes-2026-11.test.ts` (headline per status, one lit item and whole-segment matching,
  every boundary uses `retry`). Mutation: putting `reset()` back in the pickups boundary failed it.
  Suites: unit, tsc.

## 2026-11-04 — Stock sync starts on connecting; Pause moves to the Channels card [CONTRACT]

- **Owner's call (inventory-sync Q27, superseding Q4):** Bhendi Bazaar is the source of truth for every
  platform, so connecting a marketplace means keeping it synced. No "Turn on stock sync" switch and
  no turn-on preview: once every marketplace location is matched, sync starts by itself and sends
  every linked listing (unlinked ones are never touched). A paused connection is never restarted
  by itself.
- **Listings page:** the Stock sync card shows only when it needs the shop (match locations, paused,
  a refusal, Amazon unreachable, reconnect). "Read again" is the page's one button.
- **Channels card:** "Stock sync on" / "Stock sync paused", with Pause / Turn back on beside Disconnect.
- **Home:** "Match your Amazon locations so stock can be sent", and "n listings now out of stock on
  Amazon: we have 0" for linked listings sent 0 since Amazon last showed them in stock, until the
  next read. The preview's gate becomes this warning (ADR-0053).
- Removed: the `/channels/[channel]/stock-sync` page, `StockPreview`, `StockPreviewDTO`, the "off"
  action. Added: `StockAttentionDTO`, `ChannelCardDTO.stockSync`; CONTRACTS.md updated.
- Tests: `stock-sync.test.ts` (starts on the match and on a read of matched locations; never undoes a
  pause; waits for a match and Home asks for it; Home flags a listing put to 0 until the next read),
  `home-attention.test.ts`. Mutations: letting a paused sync restart failed the pause test; dropping
  the "since the last read" filter failed the out-of-stock test. Suites: unit, integration (stock-sync,
  order-check-budget, channel-import), tsc.

## 2026-11-03 — Amazon gets JPEGs of our WebP photos; listing photos survive a product save

- **Found by the owner:** a published "Photos" change stayed on Review and publish with nothing under
  it. Two causes. Our photos are stored as WebP and Amazon refuses WebP, so the publish dropped every
  photo, sent Amazon nothing for them and recorded nothing as sent; and listings kept photos by
  media id, which a product save renews, so any save made photos read as changed.
- **Fixed:** a photo Amazon would refuse goes as a JPEG rendition on white (`marketplaceJpeg`, made
  once and kept, `server/channels/listing-photos-out.ts`); listings keep photos by address, and ids
  stored before this are read as addresses (one no longer held reads as the product's photos, as a new
  listing starts); a photo set with none left to send is refused on Photos instead of read as sent;
  the review shows the shop's own pictures. Unknown formats go as they are, for Amazon to judge.
- Tests: `marketplace-publish.test.ts` (a save leaves nothing waiting; a reorder goes as JPEG
  addresses), `listing-plan.test.ts` (old ids read as addresses), `listing-publish-providers.test.ts`
  (no photos left is a refusal). Mutations: keeping photos by id again failed two tests; skipping the
  JPEG sent WebP addresses (red).

## 2026-11-03 — Family page: a member's button says Exclude once it is in

- On the family page each member's button read "Include" whether or not it was in the family. It now
  names what a tap does: "Exclude" (outlined) while the member is in, "Include" once it is left out.
  Test: `family-form.test.tsx` (out, count drops, back in, count returns).

## 2026-11-03 — CI: two living docs re-verified

- `src/components/CLAUDE.md` and `src/app/api/CLAUDE.md` re-read against the fix page's components and
  `PUT /api/org/[orgId]/products/facts`; both follow the rules as written, so only `Verified:` moved.

## 2026-11-03 — Fix what keeps products off a channel, many at once [CONTRACT] [MIGRATION]

- **The card names each gap** (readiness-fix [spec](specs/channel-registry/readiness-fix/)): under each
  channel, "79 need a colour · Fix them" for each missing compulsory fact, and "3 have no Google
  category · Ask the admin" for types with no category there.
- **One page per gap** (`/org/[orgId]/products/fix`): only the products missing it, each with its
  photo, a picker that saves as it is used, and the marketplace's own word as evidence. Tick several
  and set one answer; only empty answers are written and the rest are named. Done below, with Undo
  while the answer is still the one given.
- **[CONTRACT]** CONTRACTS.md "Readiness gaps and fixing them"; `file-cohesion` records the fix page's DAL.
- Tests: `readiness-fix.test.ts`. Mutations: writing without `onlyIfEmpty` replaced a typed answer
  (red); dropping the offered-answer check stored a value no list has (red).
- **Fresh-context review, fixed before handing over:** a listing whose read kept failing was queued
  again every day, and "Read again" plus the daily pass queued it twice; now a fill is marked when
  queued (`ChannelListing.attributesTriedAt`, [MIGRATION] `20261103000100_listing_fill_tried`, adds a
  column) and queued again only a week later (mutation: dropping the mark queued it twice, red). "All
  done" no longer claims how many a channel takes; the bulk button reads "Set" and says "Pick an answer
  first"; a refused undo says why; the card's "and N more" opens the rest; the fix page has its loading
  state and computes readiness once; a category's type change records how many products it typed.

## 2026-11-03 — Listings linked by SKU fill their products; a category's new type reaches its untyped products

- **Facts fill for SKU links** (marketplace-facts [Q36](specs/marketplace-integration/marketplace-facts/decisions.md),
  superseding Q5). A production check on 2026-11-03 found 40 of the shop's 43 Amazon links made by SKU
  and never read, so 79 products had no colour and Google would take 1 of 83. Every linked listing
  never read now gets the same one fill a settle gives: after each listing read, and in the daily
  pass. A fill still writes only what is empty, and unclear answers still wait for the owner (parent Q42).
  Test: `marketplace-facts.test.ts` "fills once every listing linked by its SKU…"; mutation: dropping
  the never-read filter queued a listing already read (red).
- **A category's type reaches its products with none** (categories D1b, R7, the safe case). Pointing
  an untyped category at a type now gives that type to its products with no type, in its subtree
  wherever it is what they resolve to; a product with a type, or under a child with its own, is left
  alone. Test: `category-type-adoption.test.ts`; mutation: dropping `productType: null` retyped a
  typed product (red). For the shop: Admin → Categories → "LADIES MASALLA BAG" → type Bag brings 18
  products into readiness.

## 2026-11-02 — "Where you sell" on the products page goes to Channels

- The readiness panel's link still pointed at the retired "Where you sell" page, which now opens
  Brands and defaults; it goes to the Channels page that replaced it (parent Q6). Link only; no test,
  nothing else changed.

## 2026-11-02 — Dependency updates: Dependabot #74–#78, CI on Node 22

- **Taken as raised:** `tailwind-merge` 3.7, `@radix-ui/react-switch` 1.4, `@radix-ui/react-popover` 1.3,
  ESLint 10 (same 60 errors as ESLint 9, rule for rule; Next's bundled plugins still declare ESLint 9
  as their peer, and run).
- **#76 fixed:** Vitest 5 needs Node 22 or later, so CI moves from Node 20 to 22 (the worker image was
  already on 22), with `@types/node` 22 and `@vitest/ui` / `@vitest/coverage-v8` moved in step.
- **Checked:** tsc, the full suite, the production build and the Playwright journeys, all green.

## 2026-11-02 — Channel listings and publishing: each marketplace's listing edited here, sent from here [CONTRACT] [MIGRATION]

- **channel-listings.** A product's page shows each connected marketplace's listing status and "Edit
  Amazon listing". The listing screen holds six fields (title, price, photos, key features,
  description, on sale), each "Same as product" or "Changed for Amazon" with the product's value and
  "Use product's", "On Amazon now" with "Use Amazon's", and a locked "Same everywhere" group. Flipkart's
  screen edits price and on sale; its catalogue's content says to change it in Seller Hub, with
  "Copy ours". A listing starts with what is live, so nothing waits on first look (Q2). The product
  form gains MRP, barcode and up to five key features.
- **marketplace-publish.** "Review and publish" shows every change old above new, each undoable, a
  price more than 30% away marked; Publish sends only the kept fields at the reviewed version, one job
  per listing under its lock, and a self-renewing check reads Amazon's answer at about 2 and 10 minutes
  (then 30, 120, daily while unanswered). Complaints land on their field as "Amazon says: …". "Put on
  Amazon" looks for the product's page by barcode then name: sell on it, or a new page checked by
  Amazon's check-only mode first; a family goes up as its page then each member. Pause ends the
  Amazon offer, never deletes. The Listings page shows "N listings have changes".
- **[MIGRATION] `20261102000100_platform_listings`:** `PlatformListing`, `Product.keyFeatures` and
  `Product.barcode`. Adds only; drops nothing.
- **[CONTRACT]** CONTRACTS.md "Platform listings and publishing".
- **Mutations recorded:** removing `.strict()` from the save body let `mrp` through (unit red);
  dropping the version from the save's `where` let a stale save win (integration red); the same in the
  publish claim let a moved listing publish (red); sending every writable field instead of the kept
  ones sent the undone price (red); skipping the check-only answer created a page Amazon had refused (red).
- **Fresh-context review, fixed before handing over:** a send that was skipped, dead-lettered or whose
  family page was never sent could read "Sent" for ever (now every outcome is recorded, a member without
  its page is refused, and the daily pass ends a send the queue gave up on); a look that threw never
  counted, so the check could run for ever (now it counts, refused access asks to reconnect); marketplace
  calls held a transaction (now outside it, answers guarded on the state read); Flipkart's rounding
  was not what was recorded; Amazon's fields were recorded as sent before a look confirmed them; MRP
  could not be cleared. Mutations: removing the missed-look record left a listing checking (red);
  removing the whole-rupee rounding at the claim sent ₹429.50 (red).
- **Gates:** `tsc --noEmit`; unit suite; integration `channel-listings`, `marketplace-publish` and the
  channels suites on `bhendi_bazaar_ci` (en_US, UTC); `lint:boundary`; `docs:check`; `next build`.

## 2026-11-02 — Sell page: one plan, the whole suite, ₹699 a month

- **`/sell`, a pamphlet for sellers.** Hero, the four pillars (own store, photos made ready, sell
  everywhere, run the business), what is still arriving tagged as such, one pricing card, three
  steps and three questions. Every word is in `src/components/org/sell/sell-copy.ts`; the price is
  one paise constant there, display only (subscriptions is still planned in BACKLOG.md, nothing is
  charged). GST included, no trial, and no commission claim, because own-store orders still carry
  `Org.commissionBps`. Every action leads to `/org/new`. Its own `(marketing)` route group, so it
  runs full-bleed without the store's navbar and tab bar; server-rendered; added to the sitemap.

## 2026-11-02 — Shop details has one Save

- **One save bar instead of a Save on every card** (org-profile [Q30](specs/own-store/org-profile/decisions.md),
  superseding Q17 and R9's per-section save). It shows only while something is unsaved, "Unsaved
  changes · Discard · Save", on the phone's tab bar and at the foot of the column from md. Save
  sends each changed section through the same per-section PATCH, one after another with the newest
  version, so the column whitelist and the conflict check are unchanged; a failed section keeps its
  banner and its typing. The rename still confirms in its sheet, opened last. No server change.
- **Partly saved is said, never silent.** The rest save, the toast reads "Not everything saved. The
  section that didn't says why.", and a collapsed failed row opens and scrolls into view. Typing
  done during a slow save stays unsaved, and a name that only gains a space clears the bar.
- Tests: `tests/unit/shop-details.test.tsx` (only changed sections are sent, in turn with the
  newer version, one toast; Discard restores; mutation-checked) and `shop-contact.test.tsx`.

## 2026-11-01 — Dependency updates: Dependabot #68–#73, two of them fixed

- **Taken as raised:** GitHub Actions (8, still pinned to commit SHAs), `pg` + `@types/pg` 8.23,
  `cn` 0.5, `@radix-ui/react-dialog` 1.3.
- **#72 fixed:** it moved `react` to 19.3.1 and left `react-dom` at 19.2.1; React refuses mismatched
  versions, so both are now pinned exactly at 19.3.1.
- **#71 fixed:** `@vitejs/plugin-react` 6 needs Vite 8 (the suite would not start on Vite 7); Vite moves
  to 8, which Vitest 4 supports.
- **Checked:** tsc, the full suite, the production build and the Playwright journeys, all green.

## 2026-11-01 — inventory-sync Q26, review: one shop's token or a moved cursor cannot spoil the run

- **Found in review** of the batched order check, fixed before merge:
  - a shop whose stored token cannot be read is now that shop's failure, logged, not the whole run's;
    the token is read when the marketplace asks for it, and renewed once at most per shop per run;
  - an access refusal is logged as one, not swallowed;
  - the batched cursor write is a compare-and-set against the cursor the run claimed, so a cursor
    reset while the run was reading (sync turned off and on) is never overwritten, and a quiet run
    writes nothing;
  - unused single-shop reads and writes removed.
- **Tests:** `tests/integration/order-check-budget.test.ts` now measures more shops than are read at
  once, drives the token path on every shop, and proves an unreadable token and a moved cursor.
  Mutations recorded: reading the token before the guarded read (2 red), dropping the cursor
  compare-and-set (1 red).

## 2026-11-01 — inventory-sync Q26: the marketplace order check costs the same for one shop or thousands

- **Why:** each syncing shop cost about six database statements every five minutes (read its
  connection, a locking transaction for its token, a read of its recorded lines): about 1,700 a day per
  shop, so 20–30 shops would have outgrown Prisma's operations allowance on their own.
- **Now (owner decision Q26, superseding Q23 and, for the interval, parent Q30):** the check is a
  safety net every **ten** minutes, since a change made on Bhendi Bazaar already pushes at once (Q19).
  One statement claims every due connection and returns what each check needs, sealed token included;
  each shop's marketplace is read (at most four at a time); one statement reads the recorded lines of
  all of them; a transaction is spent only on a line that is new or moved; one statement writes every
  moved cursor. **A quiet run is two statements for one shop or six** (measured). Only an expiring
  token goes through the locked renewal, about hourly per shop on Amazon.
- **One shop's failure is that shop's:** the others are still checked and recorded, and its own cursor
  stays, so its next run reads the same span.
- **Unchanged:** per-line handling (stock taken once, oversold, cancellations put back once), and the
  immediate push after any change on Bhendi Bazaar.
- **Docs:** inventory-sync decisions (Q26; Q23 superseded), parent Q30 superseded, spec R2/A1 and TRD
  D4 now say ten minutes, `server/channels/CLAUDE.md`.
- **Mutation-tested:** the recorded-lines read put back per shop (one shop 2 statements, six 7) and a
  per-shop connection re-read (3 vs 4): each red, each restored.
- **Tests:** `order-check-budget.test.ts` (3, against the database): one shop and six cost the same, at
  most three statements; one shop failing leaves the others recorded and its cursor unmoved.
  `stock-sync.test.ts` (21) unchanged apart from watching the batched cursor write.

## 2026-11-01 — Worker drains a burst at once; stock sync writes only what differs

- **The worker drains a burst.** Production showed stock sync's 43 sends running four every five
  minutes: pg-boss waits out its poll after each fetch unless woken, and jobs enqueued in one
  transaction send one wake. The worker now runs one fetch loop per slot (`startWorkLoops`,
  `server/shared/jobs/jobs.work.ts`), each fetching again at once after it ran a job; an empty fetch
  waits as before, so an idle worker costs one extra fetch per slot at most.
- **Turning stock sync on writes only where the marketplace differs.** A listing's first send reads
  its count there (it already did, for FBA); when it already matches ours it is recorded as sent with
  no write. The section's line reads "Checking your Amazon counts… n of 43 done; only the ones that
  differ are sent."
- **Mutation-tested:** the self-wake removed → `jobs-drain.test.ts` red (2 of 12 ran, as production);
  the matching skip removed → the turn-on test red. Each restored.
- **Tests:** `jobs-drain.test.ts` (new, a real queue), `stock-sync.test.ts` (21).
- **Deploy:** the worker must be redeployed for the drain to take effect.

## 2026-11-01 — themed shop pages show the platform's category photos

- "Shop by category" on a themed shop drew a letter on every tile: a shop that picked no collections fell back to its
  categories with no photo at all, and a picked collection without its own photo had none either. Both now show the
  category's platform image (`Category.heroImage`) before the letter pattern; the shop's own photo still wins. The
  editor still shows only the shop's own pick (`server/catalog/storefront.service.ts`, `landing-data.ts`, and the
  slot repository's select). `tests/unit/storefront-editor.test.tsx` fails on the old fallback.

## 2026-11-01 — the sort control shows the pick at once

- On a shop page, "Price: low to high" looked ignored: the control read its value from the URL, which changes only when
  the sorted page arrives, so it snapped back to the old sort meanwhile. `src/components/shared/product-sort-select.tsx`
  now holds the pick (dimmed, `aria-busy`) until the URL catches up, and drops it if the URL moves another way (Back).
  `tests/unit/product-sort-select.test.tsx` fails on the old control.

## 2026-11-01 — the shop portal's sidebar sticks again

- From `md:` the shop sidebar scrolled away with the page. Its bottom anchor reset all four edges with `md:inset-auto`,
  and `cn` (tailwind-merge) treats that as overriding `md:top-0`, so it dropped it: `sticky` with no `top` does nothing.
  `src/components/layout/PortalSidebar.tsx` now resets only the edges the phone sheet set (`md:inset-x-auto
  md:bottom-auto`). `tests/unit/portal-sidebar-sticky.test.tsx` fails on the old classes.
- The list scrolls inside the sidebar at every width (the md icon rail no longer overflows the screen on a short
  window), and `overscroll-contain` keeps the page still when the list reaches its end. The rail's drawn hover label
  would be clipped by that scroll, so the rail shows the browser's own tooltip (`title`); the label stays the link's
  accessible name.

## 2026-11-01 — storefront fonts: the build refuses a named fallback list

- `next build` failed on `src/components/storefront/theme-fonts.ts`: the font loader reads its options at build time and
  refuses a constant ("Font loader values must be explicitly written literals"). Each call now writes its fallback list
  out. Tests and `tsc` never run the loader, so only a build shows this; `npm run build` passes locally.

## 2026-11-01 — inventory-sync: the preview refuses to show counts before locations are matched [CONTRACT]

- On production the Amazon preview showed all 43 listings "1 → 0": the shop's stock (Bangalore
  Home) was there, but Amazon's pickup address, read on reconnecting, was never matched, so there
  was no count of ours and the preview printed 0. Sending was already refused; the page said
  nothing useful and invited the tap.
- The preview now reads no counts while a location is unmatched and offers only Match locations;
  a connection whose locations are not read yet counts as unmatched (it was counted as matched),
  in the section, the preview and turn-on alike, and says "Reading your Amazon locations…".
- A listing in stock on the marketplace that would be sent 0 is listed first, marked "goes out of
  stock", under a line naming how many.
- **Mutation-tested:** the no-locations rule removed → the new test red; the preview reading counts
  while unmatched → red. Each restored.
- **Tests:** `stock-sync.test.ts` (20).

## 2026-11-01 — Merge main into org-portal: one courier webhook, timeouts beside rate limits

- **Courier webhook:** main moved the old handler to `POST /api/webhooks/shipping/courier` with `SHIPROCKET_WEBHOOK_TOKEN`;
  order-fulfilment unit 4 had replaced it at `/api/webhooks/shipping/tracking` with `SHIPPING_WEBHOOK_TOKEN`. One route
  stays: unit 4's handler at main's path, reading main's variable. `/tracking`, `server/shipping/webhook-auth.ts`,
  `tests/unit/shiprocket-webhook-auth.test.ts` and `SHIPPING_WEBHOOK_TOKEN` are gone; the URL-words check moved into
  `tests/unit/courier-token.test.ts`.
- **Routes:** main's `optionalActiveSession` (suspended accounts refused) now feeds the rate limiter's user id in
  addresses, bids, payment abandon, the promotions quote, reviews and order creation; main's old order limiter is dropped
  for the registry's.
- **Startup:** `src/lib/env.ts` keeps main's longer required list and `missingEnv` (read by `/api/health?deep=1`) and the
  boot refusal of an unlimited deployed environment; the missing list is logged as main's `[startup]` error.
- **Timeouts:** the bulk sheet's create and marker calls, and `apiDownload`, carry deadlines like main's other calls;
  email keeps both main's deadline and the idempotency key.
- **Gates main added, met:** seven routes this branch had given a session read for the rate limiter now read it through
  `optionalActiveSession` (`tests/unit/blocked-session.test.ts`): six with `onBlocked: "allow"`, since the read only names
  the caller, and the buyer's parcel cancel refusing a suspended account. Main's `GET /api/health` is exempt in the
  registry as the uptime probe. zod 4.6 needed the storefront schema's two `distinct` keys typed.

## 2026-11-01 — storefront-themes unit 6: point-of-need editor and theme suggestion [CONTRACT] [MIGRATION]

- **Migration `20261101171600_storefront_content` (additive):** `OrgProfile` gains `heroLine`, `claims`, `openingHours`,
  `storefrontHiddenSections` (Json, parsed on read) and `contentEditedByUserId` (Restrict, ADR-0020). New
  `OrgStorefrontSlot` (org, kind HERO/COLLECTION, position; category and asset both Restrict) with its own repository
  `server/catalog/org-storefront-slot.repository.ts`, so a hero or collection photo is a use the media library reads
  (`storefrontSlots` joins its use relations; `storefront-collection` its use kinds; ADR-0058).
- **Editor (D13; R9, R10; Q9, Q10):** in the full-screen preview a tapped section opens its sheet
  (`src/components/org/look/section-sheet.tsx`: bottom sheet on a phone, side panel from `md:`), asking only the fields
  the registry's new `SECTION_FIELDS` names: hero photos (≤3) and one line, collections (≤6 of the shop's categories,
  a photo each, search past 8), claims, opening hours, and "Hide this section" on collections, story and visit. Story and
  visit link to Shop details for the facts. Saves are live at once and redraw the preview; only the look waits for
  Publish. ux.md states: "Saved", "Saving…" after 3 s and never disabled, "Couldn't save. Your words are kept here.",
  "Changed by {Name} just now. Load theirs?" with Load / Keep mine, "Up to three. Remove one to add this.", "112 / 120"
  from 80%, "Uploading…", "{n} photo didn't upload." with Try again, "Use a photo, not a PDF.".
- **Save (D13):** `PATCH /api/org/[orgId]/storefront` is now a compare-and-set on the `updatedAt` the editor read, in
  one transaction with the slots; only fields sent change. A claim must be on the shop's list, a collection a category
  it sells, a photo one of its own ready pictures. The accent is no longer offered (still stored and read by unthemed
  pages); the Shop page's editor sends its version too.
- **Claims and suggestion (Q19, Q21, Q44, new):** `server/catalog/storefront-claims.ts` declares the claim keys, labels and
  per-product-type lists; the shop's kind is its main product type. Each theme declares the product types it is
  suggested for; the picker marks that card "Suggested for {kind}".
- **Buyer page:** hero photos, line, picked collections (else the categories it sells in), claims, today's hours in
  India (Q45, new) and hidden sections reach the themed page; a hidden section's words leave the payload. A cover from
  before the editor still fills the hero (Q11). A themed shop's link preview is its first hero photo's preview rendition
  (D14). The preview alone draws "Add a photo" on an empty hero and a hidden section as a line to tap (Q43, new);
  "Tap any part to change it." shows once.
- **Contract:** `StorefrontSettingsInput`, new `StorefrontSettingsDto`, `StorefrontPageDto`, `StorefrontLookState`,
  `MediaUseDto`; `docs/CONTRACTS.md` moves with them. No new public route, so the rate-limit registry is unchanged.
- **Tests:** integration `storefront-editor.test.ts` (stale save names the member; claims off the list refused and
  labels shown; suggestion; unsold collection and foreign photo refused; slots are library uses and block retiring;
  hidden content left out; a section's save leaves the rest); unit `storefront-editor.test.tsx` (no proof key, fourth
  claim, line length, limits, claims read, suggestion, hours in India, preview-only chip and hidden line, sheet's
  Stale / Refused / Retryable / counter states). Mutation-tested, each caught: the version in the save's `where`; the
  claim-list and sold-category checks; `storefrontSlots` as a use; `readClaims`' list filter; the strict schema; the
  preview-only chip; story subtraction when hidden.
- **Review fixes:** the Shop page's editor resets its form to the version each save returns, so a second save without a
  reload is not refused as stale (unit test saves twice). Migration `20261101171700_storefront_content_edited_at` adds
  `OrgProfile.contentEditedAt`, written as one instant with `updatedAt`, so "Changed by {Name}" names the editor only
  when theirs was the last save, else "another member" (integration: Shop details then sheet). Deleting a category a
  shop shows as a collection is refused with a named reason instead of the foreign-key error. Each mutation-tested.

## 2026-11-01 — storefront-themes unit 5: picker, preview, publish, switch back [CONTRACT]

- **Publish (D11; R4, A2, A9; Q4, Q31):** new `server/catalog/storefront-look.service.ts` publishes a theme and palette at
  the look version the picker read: a compare-and-set in `orgProfileRepository.publishLookIfVersion` that bumps the
  version, so of two members publishing at once one wins and the other gets 409 "{Name} published {theme} {n} min ago."
  (with "See it" / "Publish mine anyway", which resends at the new version). Owner only ("Only the shop's owner can change
  its look.", 403); audited after the write (`ORG_LOOK_PUBLISHED`, `ORG_LOOK_REVERTED`, ADR-0021). The look replaced is
  kept 30 days; **switch back** restores it at the same compare-and-set and refuses after the 30 days. A shop's first
  publish keeps its page from before any theme, which switch back restores as "your old page" (Q42, new).
- **Routes:** `PUT /api/org/[orgId]/storefront/look`, `POST …/storefront/look/revert`, both `withOrg`, strict Zod schemas;
  caller `orgStorefrontApiClient.ts`. No public route, so the rate-limit registry is unchanged.
- **Preview (D12; Q32):** a new route group `src/app/(preview)` holds `/org/{orgId}/storefront/preview`, portal-guarded
  (`requireOrgMember`), `noindex`, no portal chrome: the themed shell and sections for the requested keys, landing or shop
  view, read by `storefrontDAL.getStorefrontPreview` (the service's `storefrontPage` takes the look to draw). An empty shop
  previews labelled sample goods declared in `src/components/storefront/preview/sample-goods.ts`. Inside the frame a link
  goes nowhere and a tapped section is posted to the parent, our origin only (the unit 6 editor listens). Framing: on
  that path alone `frame-ancestors 'self'` (middleware) and `X-Frame-Options: SAMEORIGIN` (a second `next.config.ts` entry
  after `DENY`); everywhere else unchanged.
- **Picker (ux.md picker, preview & publish):** `/org/{orgId}/storefront/look`, reached from the portal's Shop page: four
  cards, each a live scaled iframe of the shop's own page with the theme's pattern until it arrives ("Preview unavailable"
  / "Try again" when it does not), palette dots, "Live now", "Switch back to {previous}". The full-screen preview is a
  `TaskDialog` (ADR-0040 case 2) with palettes, Landing / Shop and "Publish this look"; from `lg:` a desktop frame sits
  beside the phone. Publish and switch back confirm in a `FormDialog`, show "Publishing…" with a spinner after a second
  and never disable; failure reads "Not published. Your shop still shows {current}." Success toasts "Your new look is
  live." and offers "Share your shop". A member who is not the owner sees the refusal and "Back"; a failed read is the
  page's error ("Couldn't load your themes. Check your internet.").
- **Left to unit 6 (its Delivery line):** "Suggested for {category}", "Tap any part to change it." and the "Add a photo"
  chip, which belong with the section editor and the theme suggestion.
- **Contract:** new `StorefrontLookInput`, `StorefrontRevertInput`, `StorefrontLookState`; `docs/CONTRACTS.md` moves with it.
- **Tests:** integration `storefront-look-publish.test.ts` (version 0 start; STAFF 403; publish live, version, 30 days,
  audit; stale 409 with name and theme; resend wins; switch back and its audit; refused after 30 days); unit
  `storefront-look-picker.test.tsx` (schemas, copy, cards, palettes, publish, conflict, failure, never disabled, switch
  back, sample goods), `storefront-look-frame.test.tsx` (pattern, unavailable and retry, link stopped, origin-only post),
  `security-headers.test.ts` (preview path only, config order, middleware asks the path).
- **Mutations recorded:** repository CAS without `lookVersion` → 3 integration red; owner check dropped → 2 red; 30-day
  expiry dropped → red; palette-of-theme refine → `true` → red; `frame-ancestors` always `'self'` → 2 red; framed path
  widened to `/storefront` → 2 red; link `preventDefault` dropped → red; `postMessage` to `"*"` → red. All restored.
- **Review fixes:** the error page's "Try again" calls Next 16.3's `retry` (re-fetches; `reset` only re-renders); the frame
  guard also stops form submits (the themed header's search); an empty shop gets "Add a product" above the cards; a switch
  back after the 30 days is **410** (not 409), shown with no resend and no "See it"; at `md:` the preview's controls sit
  in a column beside the phone frame. Tests: submit stopped, resend carries the refreshed version, 410 offers no resend.

## 2026-11-01 — order-fulfilment Q38 re-signed: admin refund copy

- The owner re-signed the refund copy changed at build (unit 6): the confirm sheet's "to the way the buyer paid" with
  "Not now", "Try again" on the gateway-refused row, and the 409 refusal in our own words. Q38 in
  `docs/specs/own-store/order-fulfilment/decisions.md` records it. No behaviour change.

## 2026-11-01 — storefront-themes unit 4: deals and badges [MIGRATION] [CONTRACT]

- **Deals section (D10; R7, A6; Q12, Q13, Q20, Q36, Q41):** new `server/promotions/storefront-offers.ts` decides which of a
  shop's offers show and words them from the offer ("20% off · All Sarees", "₹100 off orders over ₹999", "Ends Tue 3 Nov" /
  "Ends today", by India's clock); running automatic offers and only the codes the shop ticked, soonest ending first, six at
  most, "Few left" at ten or fewer uses with no count, a percentage no deeper than the shop's ceiling (as the engine clamps
  it), and no card for a sale price (Q41, new). Read through `promotionService.storefrontOffers` over a new
  `promotionRepository.listRunningForOrg`; `storefront.dal.ts` asks it, never `storefrontService`, and adds up to eight
  priced goods on offer. New `ThemedDeals` (`src/components/storefront/themed/deals.tsx`) in its three variants — campaign,
  banners, strip — with "Shop the deal" to `/shop?deals=1` and a client `CopyCode` leaf ("Code {CODE} · tap to copy" →
  "Copied"); a shop with no offer and nothing reduced shows no section.
- **Badges (A3):** every themed card shows "{n}% off" read off the resolved price and list price (new `percentOff` in
  `src/domain/product.ts`, which the marketplace card now shares); none on a sold-out card.
- **Show on my shop (Q20) [MIGRATION]:** `20261101170200_promotion_show_on_storefront` adds `Promotion.showOnStorefront`
  (default false). The shop's offer form shows the tick for a coupon; the service stores it only for a shop's code.
- **Contract:** `PromotionFormInput` gains `showOnStorefront`; `StorefrontPage` gains `offers` and `dealProducts`; new
  `StorefrontOfferDto`. `docs/CONTRACTS.md` moves with it.
- **Tests:** new `storefront-offers.test.ts` (what shows, the words, India day, ceiling), deals and badge cases in
  `storefront-themed-sections.test.tsx` (every theme), `promotion-schema.test.ts` (default off, platform strips it),
  integration `storefront-deals.test.ts` (another shop's and unticked offers absent; tick stored only on a code; badge equals
  `promotionService.quote`; a stopped offer leaves card and badge).
- **Review fixes:** the strip's goods count only the shop's own offers (new `ownOffersOnly` on `ProductFilter`, passed to
  `offerCoverage` as `ownedBy`), so a platform offer gives no shop a deals section (R7, Q12; integration case added); the
  badge's percent is floored, never rounded, so 12.5% reads "12% off" (A3; unit case added).
- **Mutations recorded:** tick check dropped → red; exhausted filter dropped → red; few-left `<=` → `<` → red; ceiling clamp
  dropped → red; sale-price filter dropped → red; midnight end not moved back → red; sort removed → red; deals slice always
  shown → red; badge on sold-out → 4 red; schema default true → red; service ignoring trigger → integration red; repository
  without the org filter → 2 integration red; `ownedBy` filter dropped → integration red; floor → round → unit red. All restored.

## 2026-11-01 — seller-onboarding unit 6: share the shop's link

- **Share sheet (R10, A2; D13):** `src/components/org/share/share-shop-sheet.tsx`, on the hand-off sheet (bottom
  sheet; popover from `lg:`), titled "Share your shop": the link (truncated mid), the card a chat will show, and
  "Share on WhatsApp" (a `wa.me` link with "Visit {Shop name} online: {link}"), "Copy link", "See as a buyer". Copy
  says "Link copied" and "Copied. Paste it in any chat."; a failed copy says "Long-press the link to copy it."
- **First share recorded (Q3, Q32):** `useShareShop` calls `POST …/setup/shared` on the first WhatsApp tap or the first
  copy that reached the clipboard; a failed record is silent and the next tap retries; a shop that has shared asks
  nothing. On Home the toast says "Shared · {n} of 5 done" and the list refreshes; elsewhere it says "Shared".
- **Openers:** Home's setup step 5 opens the sheet in place with its hint on top (it no longer leaves for the Shop
  tab), Home's link gains "Share", "All caught up" opens it, and the toast after the first product carries "Share".
  The Shop tab's link card opens the same sheet instead of the generic share dialog, and its copy counts too.
- **One preview (Q33):** `src/lib/store-preview.ts` builds the store page's Open Graph title, description and image;
  the store page's metadata and the sheet both read it (no change to the metadata). `share-shop.dal.ts` reads it for
  Home and the Shop tab, falling back to the shop's own details when the public read fails.
- **Status:** seller-onboarding spec and TRD → Implemented (units 1–6).
- **Docs:** ARCHITECTURE.md test-file count.
- **Tests:** `tests/unit/share-shop-sheet.test.tsx`, `tests/unit/shop-hub.test.ts`, `tests/unit/hint-sheet.test.tsx`.
  Mutation-tested: dropping the already-shared guard, marking the share recorded before the server answers, sending
  the message unencoded, recording a failed copy, sending step 5 back to the Shop tab, and letting a failed public
  read cost the link each fail a test; so do trusting only the mount-time "shared" (a sheet kept mounted across the
  refresh said "6 of 5 done") and dropping the product toast's "Share".
- **Cost:** the preview's hero image is one request-cached public-profile read per Home and Shop-tab render (TRD D13).

## 2026-11-01 — storefront-themes unit 3: themed chrome, the landing/shop split, redirects [CONTRACT]

- **Routes (D6; Q3, Q19, Q35; R13):** `src/app/(store)/store/layout.tsx` keeps only the wishlist; a new
  `[handle]/layout.tsx` draws a themed shop's chrome or the marketplace's (`src/components/layout/marketplace-chrome.tsx`,
  which the directory now wraps itself in). Themed: `/store/{handle}` is the landing page (`ThemedSections` over the
  page DTO), new `/store/{handle}/shop` lists the goods in the theme's card and density (category chips, Deals as
  `?deals=1` on `offerOnly`, search within the shop, sort, "Visit {Shop name}"), `/about` 308s to the landing page, and
  a link into today's filtered grid 307s to `/shop`. Unthemed: today's pages unchanged, `/shop` 307s home; a retired
  handle on `/shop` follows to the moved shop page. `src/app/sitemap.ts` lists a themed shop's `/shop` instead of `/about`.
- **Chrome (D7; R5, A5, Q6, own-store Q22, Q23):** new `src/components/storefront/themed/chrome/` — `ThemedShell` (theme
  and palette scopes plus the theme's faces over header, page, footer and tab bar), a header (mark and name to the
  landing page, logo alone past 24 characters, search within the shop, the shared cart count), a phone tab bar (Home ·
  Shop · Deals · Cart · More; More holds the account, orders and "Shop all of Bhendi Bazaar"), and a footer with the
  shop's links and the platform band ("Sold on Bhendi Bazaar", Contact us, policies). Every themed product link adds
  `?shop={handle}` (`storefrontProductHref`); `src/middleware.ts` forwards it with the slug as request headers
  (`src/lib/storefront-chrome.ts`, always cleared first) and the `(main)` layout draws that shop's chrome only when the
  product is the shop's (`productsRepository.orgIdForSlug`). Leaving that product refetches the tree, since a layout is
  not re-rendered on a client navigation (Q40). `PaginatedProductGrid` takes an optional themed card style.
- **Page DTO (D9; Q34, Q38, Q39):** `StorefrontPageDto` from `storefrontService.storefrontPage`, null until a look is
  published; best selling by units in paid orders over 90 days (`orderService.bestSellingProductIdsForOrg`, a grouped
  count in `order.repository.ts`), dispatch time as the median from paid to ready over recent parcels
  (`server/checkout/dispatch-time.ts`, through shipping's `readyTimesForOrg`), left out under three parcels. The DAL
  prices the goods (`getStorefrontPage`) and adds new in, categories and `productCountFor`. Hero line, claims, hours,
  chosen collections and hidden themed sections stay empty until unit 6; the deals section until unit 4.
- **Contract:** `Storefront` gains `themeKey`, `paletteKey`; `ShopListing` gains `themed`; `ProductFilter` gains
  server-resolved `ids`; `PUBLIC_PROFILE_SELECT` reads the look columns. `docs/CONTRACTS.md` moves with it.
- **Tests:** new `storefront-themed-routes.test.ts` (308/307 redirects, filtered-link forward, Deals as `offerOnly`,
  sitemap), `storefront-chrome.test.ts` (forwarded header cleared and validated; a foreign product draws the marketplace's
  chrome), `storefront-themed-chrome.test.tsx` (A5 tab bar and More, header, footer band, `?shop=` on cards, "Visit
  shop"), integration `storefront-landing.test.ts` (unpaid, refunded, cancelled, stale and other shops' sales do not rank;
  dispatch floor and median; no DTO before publish or for a retired key). Censuses moved: `org-scoping` (orgIdForSlug
  public), `product-visibility` (25 → 27 reads, both spread `AVAILABLE` and `FROM_ACTIVE_ORG`), `storefront-public-dto`.
- **Mutations recorded:** paid filter dropped from best selling → 2 red; order-status filter dropped → 2 red; dispatch
  floor 3 → 1 → 2 red; forwarded headers not cleared → spoof test red; chrome shop without the org check → red; `/about`
  as 307 → red; unthemed `/shop` redirect removed → red; sitemap `themed` ignored → red; `offers` not mapped to `deals` →
  red; "Shop all of" removed from More → red; card without `?shop=` → red; platform band copy changed → red. All restored.
- **Review fixes:** a malformed or non-ASCII product slug forwards no chrome headers instead of a middleware 500; best
  selling counts only goods still on sale (an archived one no longer crowds the shelf); dispatch time skips parcels of
  cancelled or expired orders (the order statuses passed in by checkout). New `[handle]/error.tsx` ("Something went wrong.
  Try again.", `retry`) inside the shop's chrome, and `/shop` streams its goods under a `ThemedGridSkeleton` in the
  theme's card shape, shown after 300 ms. Mutations: archived filter dropped → red; cancelled-order filter dropped → red.
- `docs/ARCHITECTURE.md`: 295 → 299 test files. Decisions Q3, Q6, Q33, Q34, Q35 → implemented (unit 3); Q39, Q40 logged
  and implemented. Suites: `tsc`, `vitest tests/unit`, the storefront and parcel integration files, `lint:boundary`,
  `docs:check`.

## 2026-11-01 — order-fulfilment Q37 accepted: the cancel give-back seam

- The owner accepted the `server/checkout/cancel-give-back.ts` entry in `tests/unit/file-cohesion.test.ts` (ADR-0056):
  one seam reaching payments, payouts and promotions, so a cancel gives back all three or none. Q37 in
  `docs/specs/own-store/order-fulfilment/decisions.md` records the acceptance. No behaviour change.

## 2026-11-01 — seller-onboarding unit 5: pickup address over the form, reviews on the product

- **Pickup address sheet (R8, A4; D11; Q12, Q26):** `src/components/org/pickup-address-sheet.tsx` wraps the existing
  `LocationForm` in the hand-off sheet (bottom sheet; 28rem side sheet from `lg:`) titled "Add pickup address". The
  product form's "Add location" / "Add another location" now open it instead of a dialog (its prompt copy stays);
  the saved address comes back as a stock row and the product form underneath keeps what was typed. The Shop hub's
  "Pickup addresses · none yet" row opens it in place and refreshes. ux.md copy: "Save address", "Saving…",
  "Still saving…" after 3 s, toast "Pickup address added", and "Couldn't save. Your form is safe." with "Try again"
  for a network drop or server fault; field errors stay on their fields. The button is never disabled — a press
  while saving sends nothing. `LocationForm` gains optional `messages` and `actions`; the locations page is unchanged.
- **Duplicate name (Q29):** `orgAddressService` refuses an add, or a rename, onto a name the shop already has, any
  case, as a `ConflictError` on `name`: "You already have '{name}'. Use another name." No index (Q29).
- **Reviews in context (R9; D12; Q13):** the portal product page gains a read-only Reviews section from
  `reviewsDAL.firstPage` (summary, newest first, "See all reviews" when there are more), with ux's empty line and its
  own "Try again" on a failed read. Home's "new reviews" line links to it through the shared `PRODUCT_REVIEWS_ANCHOR`.
- **No parcel opener (Q31):** D11's opener list drops the parcel: a parcel ships from the address that held its
  stock, so it never lacks one. The Shop hub opens the sheet only for a shop with no address at all; a shop whose
  addresses are all paused keeps the link to Pickup addresses, to switch one back on.
- **Streaming:** the product page's Reviews section has its own `Suspense` and skeleton, so it never holds the page.
- **Gates:** `overlay-surfaces` drops `ProductOrgShippingFields.tsx` from the dialog ratchet (it no longer uses one).
- **Status:** spec and TRD stay Accepted; unit 6 remains.
- **Tests:** `tests/unit/pickup-address-sheet.test.tsx`, `tests/unit/product-reviews-section.test.tsx`,
  `tests/integration/pickup-address.test.ts`. Mutation-tested: dropping the duplicate-name check, its case-insensitive
  match, or its own-row exclusion; letting a second press re-send; passing a server fault's message through; never
  switching to "Still saving…"; and a section id that is not Home's anchor each fail a test.

## 2026-11-01 — seller-onboarding unit 4: hints the seller opens, and "?" on every portal page

- **Hints (R4, A5; D9):** each setup step on Home is now a button that opens its hint — 1–3 cards, one at a time with
  dots and "{i} of {n}", "Next", and a last card whose button starts the task ("Add product", "Add pickup address",
  "Add logo and line", "Share your shop"), still carrying `from=home`. Nothing opens by itself; a hint closed mid-way
  reopens at card 1. Copy is ux.md's deck, in `src/components/layout/portal-hints.ts` beside `PORTAL_NAV`.
- **"?" (R5; Q11):** `PageHeader` takes an optional `help` key (a `PORTAL_NAV` key) and renders "?", which opens the
  page's name, its purpose line from the navigation and, for Products, Pickup addresses, Shop details and Shop, the
  matching step's cards, ending "Got it". `help` is typed `PortalNavKey`, so an unknown key does not compile.
  Every portal page carries it — sub-pages take their section's key (a product form or bulk sheet "products", an order
  "orders", a channel's listings, stock, family and settle pages "channels"); `SectionHeader` and the shared product
  containers pass `help` through, and the admin console passes none.
- **Hand-off close:** the sheet's close control is the shadcn `Button` inside `SheetClose asChild`, labelled from
  `HINT_COPY.close`.
- **Hand-off surface (D10; ADR-0040 case 4):** `src/components/shared/overlays/handoff-sheet.tsx` — a bottom sheet
  below `lg:`, from `lg:` a popover beside its control (hint, share) or a 28rem side sheet (address, for unit 5). One
  `MAY_USE_SHEET` entry.
- **Status:** spec and TRD stay Accepted; units 5–6 remain.
- **Tests:** `tests/unit/portal-hints.test.ts`, `tests/unit/hint-sheet.test.tsx`. Mutation-tested: a fourth card, a
  three-sentence card, a navigation page without `help`, a sub-page without `help`, the next step's hint opening on render, "?" opening on render,
  and a card index kept across reopening each fail a test.

## 2026-11-01 — storefront-themes unit 2: sections and compositions [MIGRATION]

- **Registry (D1, D8; Q8, Q9):** `server/catalog/storefront-themes.ts` gains the one section library (`SECTION`,
  `SECTION_VARIANTS`: hero 4, collections 3, deals 3, best selling 3, new in 2, why buy 3, story 3, reviews 2,
  visit 2), `HIDEABLE_SECTIONS` (collections, story, visit — the shop's own words and picks), `CARD_STYLE` and each
  theme's `COMPOSITIONS` in the spec's section order. The footer is chrome (D7, unit 3), not a composed section.
- **Sections (D8; R2, R10, R11, Q17, Q23, Q34):** new `src/components/storefront/themed/` — server components for
  hero, collections, a shared product shelf (grid, rail, rails by category), why buy, story, reviews, visit, one
  product card in four styles, and `ThemedSections`, which renders a theme's composition and closes up empty
  sections. `page-data.ts` holds the slice functions (best selling needs 4, shelves cap at 8, collections at 6;
  since-when and the returns preset never open "Why buy from us" alone; claims drawn apart from facts). A missing
  photo draws the theme's pattern: new `--pattern-image`/`--pattern-size` per `[data-theme]` and
  `bg-theme-pattern` (registered in `cn`). Empty shop: "{Shop name} is setting up. Check back soon." The deals
  section renders nothing until unit 4 (D10). Nothing mounts any of it yet (unit 3).
- **Schema (D11; Q4, Q19, Q31):** migration `20261101170100_storefront_look` adds `OrgProfile.themeKey`,
  `paletteKey`, `lookVersion` (default 0), `lookPublishedAt`, `lookPublishedByUserId` (Restrict, ADR-0020),
  `previousThemeKey`, `previousPaletteKey`, `previousLookUntil`. Additive, no backfill; nothing writes them yet. The
  publisher FK is indexed (`OrgProfile_lookPublishedByUserId_idx`) so Restrict does not scan `OrgProfile`.
- **Review fixes:** hero text over a photo uses `bg-photo-scrim` at the strength the D4 contrast gate tests (no
  `/60` modifier); the rating count is grouped ("1,212 reviews"); the Edge card's spec line shows the category's
  name or nothing, never a slug. Q37 rewords signed-off copy and is flagged for the owner to confirm.
- **Naming:** the section is keyed `bestSelling` and titled "Best selling": "bestsellers" trips the retired-word
  gate (`tests/unit/vocabulary.test.ts`), and a word inside a compound is not worth an allowlist edit.
- **Tests:** `storefront-themes-registry.test.ts` (compositions name only declared sections and variants, each once,
  hero first; every theme carries goods, deals, proof and visit; no undrawn variant; four card styles; themes
  differ pairwise in ≥3 section variants — A1; hideable set pinned). New `storefront-themed-sections.test.tsx`
  (A4 per theme: name, logo, one product → pattern in the hero, no blank section, no "undefined"; product without a
  photo → pattern; empty shop copy; hidden sections; Q34 floor; why-buy wording and claims apart). New integration
  `storefront-look-columns.test.ts` (unthemed at version 0; publisher cannot be deleted).
- **Mutations recorded:** a composition variant cast to `"carousel"` → two registry tests red; pattern test id
  removed → 8 render tests red; `MIN_BEST_SELLING` 3 → red; empty sections kept as wrappers → 4 red; hero count
  always "products" → the singular test red. All restored.
- `docs/ARCHITECTURE.md` counts: 113 → 114 migrations, 293 → 295 test files. Decisions Q8, Q17 → implemented
  (unit 2); Q37 (returns read as the preset label) and Q38 ("1 day", "today") logged and implemented. Suites: `tsc`, `vitest tests/unit`, the new integration file, `lint:boundary`, `docs:check`.

## 2026-11-01 — own-store/bulk-sheet unit 5: the team uploads a shop's sheet, recorded once [CONTRACT]

- **Admin twins (D11; R9; Q17, Q18):** `GET /api/admin/orgs/:id/products/bulk/sample`, `POST …/validate`, `POST
  …/marker` and `POST …/products/bulk` behind `requirePlatformAdmin`, scoped to the path's shop (404 otherwise); the
  same build, check and marker as the shop's. Create needs `reason` (`teamReasonField`, "Say why — the shop will read
  it.") and takes `fileName`; a deactivated or blocked shop is refused ("{Shop} is deactivated. Reactivate it to add
  products."). After commit one `PRODUCT_TEAM_BULK_UPLOADED` entry on the shop (`resource: "Org"`) holds reason, file
  name, counts and product ids; it is written through `createProducts`' `onImported`, before the sale prices, so a failed
  markdown write still leaves it; a failed audit write never fails the import (ADR-0021). `server/catalog/bulk/bulk-team.service.ts`.
- **Edits through the version (D10):** `importBulk` names the uploader as editor on every row, sets or clears
  `teamEditedAt`, and moves an updated product's `version`, so an open form rebases. The shop's own create passes its
  member; create's checks are one `validateCreateRows` both routes call.
- **Status:** spec and TRD stay Accepted until A7 is timed with the owner's father.
- **Screen:** `/admin/orgs/[orgId]/products/bulk`, reached by "Add many for this shop", is the shop's wizard with the
  banner and reason above every step; the reason is checked before any photo goes up; done reads "Created {a} and
  updated {b} for {Shop}. Recorded in the activity log." No location or a deactivated shop shows ux.md's line instead.
- **Fix:** bulk photos are filed under `org/<code>/bulk/` (`bulkPhotoPath`); `products/<code>/bulk/` was refused by
  both token routes since stored files moved under their owner.
- **Tests:** `tests/unit/bulk-sheet-team.test.ts`, `tests/integration/bulk-sheet-team.test.ts`, `bulk-files.test.ts`.
  Mutation-tested: dropping either half of the deactivated-or-blocked refusal, moving the audit after the sale prices, the team mark, the version move, the all-or-nothing return, the
  required reason, and the old photo prefix each fail a test.

## 2026-11-01 — order-fulfilment unit 6: refund owed for lost, damaged and returned parcels; the refund button [CONTRACT]

- **Refund owed for every cause** (R13, Q25; D16): a parcel moving into `lost`, `damaged` or `rto_delivered` now
  writes its one `Refund` row by the cancel's rule and cap — `oweRefund` in `server/checkout/cancel-give-back.ts`,
  called from `parcel-moved.ts`. A repeated courier update writes nothing (unique `shipmentId`).
- **The refund button** (R14, A9; D17; Q12): `server/checkout/refund-start.ts` `startRefund` behind
  `POST /api/admin/refunds/[id]/start`. Payments claims the row conditionally (OWED, UNCONFIRMED, FAILED, or
  REQUESTED older than 2 min → REQUESTED), then asks Razorpay once with `receipt` = the row id and a 10 s timeout
  (`createRefund`, `findRefundByReceipt` in the Razorpay adapter). A row ever sent before is first looked up by its
  receipt and the found refund adopted; a failed lookup stays UNCONFIRMED rather than asking blind. Success →
  STARTED with the gateway id and the buyer's "Refund of ₹{x} started" notice on the same transaction; a 4xx →
  FAILED with Razorpay's reason; a timeout or 5xx → UNCONFIRMED. The answer is recorded only against the claim that
  asked, so a late answer cannot overwrite a retry. Who pressed is audited (`REFUND_START`), and names the refusal.
- **Screens** (ux.md "admin refunds"): `/admin/orders/refunds` (admin nav "Refunds"): not started first, oldest
  first, then started; "₹1,240 owed · {parcel} · cancelled by shop / lost / damaged / returned"; "Owed for {n} days"
  amber past 2; "Started 3 Nov · rfnd_…"; the confirm sheet; Unconfirmed and Failed rows with Open in Razorpay and
  Try again; 50 a page; cards, a table at `lg:`. The buyer's order shows "Refund of ₹{x} started …" on a lost,
  damaged or returned parcel once started. No button is disabled.
- **Review fixes:** a 200 carrying a refund Razorpay already marked failed is refused, not started; an order with
  no captured payment, or a server without Razorpay keys, is a `409` in our words before the row is claimed (Q38);
  the admin nav "Refunds" shows the not-started count (`PortalNavItem.count`); the build-time copy changes are Q38,
  pending the owner's re-sign.
- **[CONTRACT]** `RefundStartOutcome`, the start route, `RefundRow`. `CONTRACTS.md` updated. No migration: unit 5's
  `Refund` table holds every column.
- **Tests:** `tests/integration/refund-start.test.ts` (Q25 lost, damaged, returned; R14 list and start with one
  email and the buyer's line; A9 timeout then adopt; failed lookup; two presses at once; refusal then retry; stale
  request; a late answer after a retry; 404); `tests/unit/refund-gateway.test.ts` (receipt and amount; timeout and
  dropped connection unknown; 5xx unknown; 4xx reason; receipt lookup skips failed refunds; failed lookup throws).
  Mutations, each restored: claim accepting STARTED (1 failed); receipt lookup skipped (3 failed); Q25 causes not
  owed (1 failed); 5xx read as a refusal (1 failed); stale window ignored (2 failed); settle not tied to its claim
  (1 failed).

## 2026-11-01 — own-store/bulk-sheet unit 4: problems marked in the shop's own file [CONTRACT]

- **Marker (D7; R6, A4; Q11, Q12, Q30):** `POST /api/org/:orgId/products/bulk/marker` takes the same file again,
  re-runs the whole check and answers the shop's own workbook (`server/catalog/bulk/sheet-marker.ts`): each problem
  cell filled red with a note, the row's Problems cell holding its lines joined by " · ", nothing else written; a
  file marked before has only our own red and note lines cleared — a red cell is ours only if its note holds a line
  its row's Problems listed, since our red is also Excel's "Bad" style. A .csv comes back as an .xlsx with Problems first.
  Re-uploading the marked file reads the same rows and stamp.
- **One check (D8, D9):** `checkProductSheet` (`bulk-check.service.ts`) is what validate and the marker both run;
  all-or-nothing is unchanged (Q19). A row the shape refuses is still checked against the catalogue, so "Price
  missing · Colour 'Emrald' isn't in the list…" arrive together; a cell already refused is not named twice.
- **Screen:** "Download your sheet with problems marked" is the docked action when rows have problems, with "Fix
  the red cells and upload the same file again." above the list; never disabled — the tap shows "Marking your
  sheet…" at once, a second tap says so again, and a refusal about the file shows its own words (retry copy only for
  a network or server fault).
- **Tests:** `tests/unit/bulk-sheet-marker.test.ts`, `tests/integration/bulk-sheet-marker.test.ts`. Mutation-tested:
  clearing any fill, not clearing last round, not writing Problems, not shifting a .csv, not checking drafts, and
  naming a refused cell twice, and clearing a red cell whose note is not ours each fail a test.

## 2026-11-01 — order-fulfilment unit 5: cancel, fee and its setting, cancellation count, refund owed on cancel [CONTRACT] [MIGRATION]

- **One cancel, three doors** (R10, R11, R15, A7, A8; D12; Q9, Q13, Q28, Q31): `server/checkout/fulfilment-cancel.ts`
  `cancelParcel` behind `POST /api/org/[orgId]/shipments/[id]/cancel` (shop, from `packing`, reason required),
  `POST /api/admin/shipments/[id]/cancel` (admin, until `picked_up`) and `POST /api/orders/[orderId]/shipments/[id]/cancel`
  (signed-in owner, from `packing`, reason optional, `ORDER` rate limit). Where each may cancel from is
  `CANCELLABLE_FROM`, checked inside the locked move (`applyStatus` gains `onlyFrom`), so a cancel racing "ready"
  or a pickup loses with ux.md's words. Unpaid orders stay refused; another shop's parcel, another buyer's or a
  guest's order is 404.
- **Every give-back once** (R12, R12a, A6; D13, D14, D16; Q10, Q11, Q20, Q33): restock and reversal stay in the move;
  `parcel-moved.ts` calls one seam, `cancel-give-back.ts` (Q37), which releases the parcel's share of each offer's budget (`PromotionBudgetRelease`, cumulative floors
  over the shop's parcels, `server/checkout/parcel-shares.ts`), gives the coupon back only when the summary has just
  made the order cancelled, records the refund owed (lines less discount share plus shipping, capped at what was
  captured; `server/payments/refund.*`), and on the shop's own cancel a `CANCELLATION_FEE` entry of −fee, copied. The
  buyer and the shop are emailed ("Order BB-… cancelled", "Parcel BB-…-SH1 cancelled", the fee line only on the
  shop's own). A cancel now locks the order's offers before its restock (D2); expiry writes an order-level release row.
- **Carry-forward** (R12b; D15; Q27, Q34): `createSettlement` refuses a selection that leaves the shop's unsettled
  negative entries behind, or totals ₹0 or less.
- **Fee setting and count** (R12a, A12; D14; Q29): `/admin/settings/fulfilment` (admin nav "Settings") — "Shop
  cancellation fee (₹)", compare-and-set on a version, audited (`CANCELLATION_FEE_CHANGED`); the count table lists
  each shop's own cancellations in 30 days with its fees, 50 a page. `PUT /api/admin/settings/fulfilment`.
- **Screens** (ux.md shop cancel sheet, admin cancel sheet, buyer cancel sheet, buyer order): one reason list
  (`components/order/cancel/`); the shop's "Cancel parcel" on its card (a ready one explains, with Contact us), the
  cancelled card's fee line; "Cancel parcel" on the pickups queue, the not-packed list and the order console (a
  booked one's row keeps the amber "Cancelled. Now cancel AWB {awb} on Shiprocket." with Open Shiprocket); the
  buyer's "Cancel order" / "Cancel these items" with the amount, the refund line, "Your {code} coupon can be used
  again.", and the timeline's "Cancelled · refund on its way", plain "Cancelled" when nothing was owed. A ₹0 fee
  drops the fee clause from the shop's sheet. No button is disabled.
- **[MIGRATION]** `20261101163500_cancellation_fee_kind` (enum value alone, so the next can index it) and
  `20261101163600_order_fulfilment_cancel`: `PromotionBudgetRelease`, `Refund` (+ `RefundState`), `FulfilmentSettings`
  seeded at ₹50, the one-fee-per-parcel partial index. Additive.
- **[CONTRACT]** `shopCancelSchema`, `buyerCancelSchema`, `fulfilmentFeeSchema`, the three cancel answers,
  `FulfilmentSettingsView`, `ParcelTimelineDto.refundStarted`, the buyer `Shipment.org.name`, the settlement refusals.
  `CONTRACTS.md` updated.
- **Tests:** `tests/integration/parcel-cancel.test.ts` (A6 shop cancel and twice; buyer no fee; two-parcel coupon;
  concurrent double cancel; the cancel/pickup race; R10 refusals; A8; scope; A12 with a stale save; D15);
  `tests/unit/parcel-shares.test.ts` (shares, budget split and refund cap over 300 random splits each);
  `tests/unit/parcel-cancel.test.tsx` (A7, the sheets' states, reason and fee inputs, cancel emails, buyer timeline).
  `offer-budget.test.ts` asserts the expiry's release row and cleans it. Mutations, each restored: `onlyFrom` guard
  removed (1 failed); fee on any actor's cancel (2 failed); coupon back on every cancel (1 failed); refund cap removed
  (2 failed); settlement debt check removed (1 failed); settlement floor removed (1 failed); fee save without the
  version (1 failed); buyer ownership check removed (1 failed); budget split across shops (1 failed).
- **Gate edits:** `file-cohesion` `RECORDED` gains `server/checkout/cancel-give-back.ts` (payments, payouts,
  promotions), narrowed at review from a five-domain `parcel-moved.ts`; it awaits the owner's acceptance (Q37); `rate-limit/registry.ts` gains the buyer's cancel.

## 2026-11-01 — own-store/bulk-sheet unit 3: the stamp, the old-sheet warning and refusal, problems by row, counts [CONTRACT]

- **Stamp (D4; R4, A3; Q10, Q27):** the hidden `Lists` tab ends with a `__stamp` column — made-on date, a SHA-256
  fingerprint of every tab's column keys and every list's words, the ticks — and Instructions reads "Made {date}
  · version {first six}". `server/catalog/bulk/sheet-stamp.ts` judges an upload against the sheet the same ticks
  make today: same fingerprint silent; different but every key known and every required column present, stale;
  otherwise refused naming the column as the file heads it. An unstamped .xlsx is warned with its own creation
  date (Q28); a .csv is read as before. `bulkSheetService.judgeUpload` is the one judge (Q18 for U5).
- **Screen (D8; R7, R8):** the validate answer gains `plan` (creates, updates) and `sheet`; a refused sheet is not
  read further. `CheckReport.tsx` shows "This sheet is from {date}…" with "Continue with this sheet" / "Download a
  fresh sheet", "This sheet is too old to read: the '{column}' column has changed.", "{n} problems in {r} rows ·
  nothing created yet" grouped by row and tab, 20 then "Show all", filterable by column, and "All {n} rows look
  good · {a} new, {b} updates" with "Create {a} · update {b}"; done reads "{n} products on sale · {a} new, {b}
  updated". "Check the sheet" is no longer disabled while busy; a tap says what is happening.
- **Problems (U1's handoff):** every `RowError` carries `tab` and, on validate, `column` (`row-errors.ts`); a SKU
  repeated reads "SKU {code} is used twice — rows {a} and {b}", naming tabs when they differ; an archived SKU reads
  "SKU {code} belongs to an archived product. Restore it, or use another code."; over 300 rows reads "Your sheet
  has {n} rows. Upload 300 or fewer at a time — split it into two sheets."
- **Tests:** `tests/unit/bulk-sheet-stamp.test.ts`; `bulk-upload`, `bulk-sheet-download` integration extended.
  Mutation-tested: fingerprint compare always equal (4 fail), unknown key not refused (1), missing required not
  refused (1), optional column treated as required (1), unstamped .xlsx not warned (1), cross-tab rows unnamed (1),
  row errors without their tab (1), the route's refusal branch dropped (1).
- **Review fixes:** a new file or "Download a fresh sheet" clears the old report, so a refused sheet is no dead
  end; the file's own problems count no row and offer "Pick another file"; a product-type problem is named by the
  Category column; the check's loading line stays "Reading your sheet…" (ux.md updated: the count is not known
  until the one round trip ends); the validate route's refusal is tested end to end.

## 2026-11-01 — product-form unit 6: the shop sees what the team changed [CONTRACT]

- **Badge** (R12, A7; D13; Q14): "Edited by Bhendi Bazaar team · {date}" on the shop's product page
  (with "See what changed") and its list row while `teamEditedAt` is set; the shop's next save clears
  it (U4's column), the history stays.
- **History** (D13): a server read on `/org/[orgId]/products/[id]` of the product's
  `PRODUCT_TEAM_*` audit entries, newest first, one line each — "Bhendi Bazaar team · 30 Oct, 4:12 pm
  · Price ₹2,499 → ₹2,299 · 'reason'"; a team create reads "Added this product". Empty renders nothing;
  loading shimmers; a failed read says "Couldn't load the history." with "Try again"; newest five, then
  "Show all changes"; a long line clamps behind "More". Copy in
  `src/components/product/team/team-edit-copy.ts`.
- **Home line** (Q23): "Our team changed {n} product(s)" in Needs you now, opening the one product's
  history or the products list; counts available products only (an archived one the shop has acted on).
- **[CONTRACT]** `ProductTeamEditDto` (no admin identity); `ProductForTable.teamEditedAt`;
  `HomeAttentionDto.teamEdits`. The audit read `listResourceActions` selects no admin columns.
- **Tests:** `tests/unit/product-form-team-history.test.tsx` (line, badge, stock/opaque wording, create,
  no identity, malformed and other-org entries left out, Empty, Show all, More, retry, Home line);
  `tests/integration/product-team-history.test.ts` (A7 history money first without the admin; another
  shop reads nothing; archive entries are not history; Home count, clear on shop save, archived not
  counted). Mutations, each restored: DTO spreading the stored entry (2 failed); org check dropped
  (2 failed); `safeParse` turned into `parse` (1 failed); count without `teamEditedAt` (1 failed);
  count without `AVAILABLE` (1 failed); history without the five-line cut (1 failed). The action filter
  in `listActionsForResource` survives its mutation: the metadata parse also leaves archive entries out,
  so it is held twice. `product-visibility` census for `product.repository.ts` 25 → 27 (the summary's
  count and first, both filtered).
- Q14, Q23 → implemented (unit 6). Spec and TRD → Implemented.

## 2026-11-01 — own-store/bulk-sheet unit 2: dropdowns of words on a Lists tab, word matching [CONTRACT]

- **Dropdowns (D3; R2, A2; Q6, Q7):** every list column — category as a path ("Women › Abayas"), kind, family,
  brand, each answer, yes/no — reads its words from a `veryHidden` `Lists` tab by range (was: an `Answers` tab
  for facts only, categories as slugs inline). Category and kind lists are per tab. Family warns on a new name;
  every other list stops with "Pick from the list in this column." List help lines and an Instructions "Lists
  guide" serve phone apps that ignore dropdowns. A Brand column appears when the shop has brands.
- **Matching (D6; R5; Q8):** `server/catalog/bulk/word-match.ts` matches a typed word to a label or key ignoring
  case, spaces and punctuation (a word two values share matches neither) and names the closest by edit distance.
  A category matches a full path or a slug, never a bare name (`categoryMatcher` in `sheet-tabs.ts`). The dry
  run now checks category, kind, brand, every answer and yes/no — a miss reads "{Column} '{value}' isn't in the
  list — pick from the dropdown. Did you mean '{closest}'?" and creates nothing. An answer outside its list is a
  problem, no longer kept as `unlisted` (was categories D8's keep-and-flag); a yes/no that is neither is no
  longer read as no. Families match by the same rule. A bare name two categories share matches neither, even
  where it is one's slug. A row's brand is written as `brandId` only when the sheet has a Brand column — a blank
  cell clears it, no column (an old sheet, a CSV) leaves an updated product's brand as it was.
- **Reading (D5):** each row keeps its cells' addresses; `RawSheet.createdOn` holds an .xlsx's creation date for
  U3's unstamped warning (Q28). Create payload: `categorySlug` is the cell as typed; optional `brandName`.
- **Tests:** `tests/unit/bulk-sheet-lists.test.ts`; `bulk-vocabulary`, `bulk-upload`, `bulk-sheet-download`
  integration extended. Mutation-tested: unlisted answer kept (4 fail), yes/no defaulted to no (1), category by
  slug only (1), ambiguous word last-wins (1), closest without a threshold (1), family stops (1), brand miss
  silent (2), kind by key only (1), punctuation kept (3), dry run skips the vocabulary (1), addresses dropped (1), brand
  written without a Brand column (1).

## 2026-11-01 — product-form unit 5: the team adds and fixes a shop's product, with a reason, on record [CONTRACT] [MIGRATION]

- **Admin edit and add for a shop** (R10; D12; Q12): `/admin/products/[id]` gains "Edit for shop" and
  the shop's admin page "Add product for this shop"; both open the shop's own form
  (`/admin/products/[id]/edit`, `/admin/orgs/[orgId]/products/new`) with the banner "Editing for {Shop}.
  The shop will see 'Edited by Bhendi Bazaar team'." and "Why are you changing this?". The save reads
  "Save for shop" / "Put on sale for shop"; success toasts "Saved. {Shop} will see what changed." (a
  create goes to the product). An archived product shows "This product is archived. Restore it to
  edit." with "Restore"; a shop with no pickup address shows "{Shop} has no pickup address yet. Add one
  for them first." The team keeps no device draft (one device serves many shops) and adds no location.
- **Team saves** (R11, A7; D11; Q13, Q21, Q22): `server/catalog/product-team.service.ts` calls the same
  `productsService` create and edit with the admin as editor (`teamEditedAt` set, the version bumped,
  the conflict rebase unchanged), the org always the product's or the path's. Then one
  `recordAdminAction` entry — `PRODUCT_TEAM_CREATED` / `PRODUCT_TEAM_UPDATED`, metadata `{ orgId,
  reason, changes }`, each change `{ field, at?, before, after }` with money first, then stock, then the
  rest (`server/catalog/product-team.ts`, paise). A failed record never fails the save (ADR-0021).
- **Routes** (D12), all `requirePlatformAdmin`: `POST /api/admin/orgs/[id]/products`,
  `PATCH /api/admin/products/[id]`, `POST /api/admin/products/[id]/restore`, and the shop-scoped
  twins the form calls — `products/readiness`, `listing-values`, `families`, `upload/token`,
  `upload/confirm` under `/api/admin/orgs/[id]/`. The listing client takes a prefix
  (`listingApiPrefix`), so the form's reads follow its portal.
- **[MIGRATION]** `20261101152500_admin_log_resource_index`: `AdminLog` index on (resource,
  resourceId) for U6's history read. Additive.
- **[CONTRACT]** `teamProductFormSchema` / `teamProductEditSchema` = the shop's schemas + required
  `reason` (3–200, trimmed; "Say why — the shop will read it."); `ProductDetails` gains read-only
  `archivedAt`. `CONTRACTS.md` Products section updated.
- **Tests:** `tests/unit/product-team.test.ts` (money-first diff, keyed facts, create against nothing,
  reason required); `tests/unit/product-form-team.test.tsx` (banner, "Save for shop", no `disabled`,
  empty reason sends nothing, reason and `seenVersion` sent, no draft);
  `tests/integration/product-team-edit.test.ts` (A7 one entry with reason and price first, the mark;
  body org ignored; saves when the audit fails; archived refused then restored; team create).
  Mutations, each restored: archived check removed (1 failed); body org allowed over the product's
  (1 failed); audit written without the never-throw wrapper (1 failed); create without the team editor
  (1 failed); money moved after the rest (2 failed); reason min 0 (3 failed); schema without the reason
  on the client (2 failed); team draft kept (1 failed); an admin product route writing through
  `admin.product.service` directly (portal-boundary, 1 failed).
- **Gate edits:** `portal-boundary` "the admin tree no longer mutates products" becomes "every admin
  product write is a team save" (the TRD's D12 supersedes it; `(admin)/admin/products/new` still must
  not exist). `product-form-readiness` and `product-form-category-change` mocks keep the real
  `listingApiPrefix` and assert the `/api/org/org-1` prefix.
- Q12, Q13, Q21, Q22 → implemented (unit 5).
- **Review fixes:** the after-snapshot and diff run inside the audit's never-throw guard, so a read
  failing after the commit cannot 500 a saved product (ADR-0021); stored facts and measurements are
  read through `parseStoredFacts`/`parseStoredMeasurements` (ADR-0051); stock changes are keyed
  `name (orgAddressId)` so two same-named locations stay apart; `teamProductEditSchema` drops `orgId`
  instead of the route faking one (the sale-price rule shared via one tuple); the team badge's ux.md
  line now reads `· {date}`, as built; a stepped team create without a reason is tested.
- **Parked Q37:** the ux "Empty" row's "Add location" needs an admin address write path the TRD's D12
  does not list; the empty state links back to the shop meanwhile.

## 2026-11-01 — order-fulfilment unit 4: signed courier updates, conflicts, delivery emails [CONTRACT] [MIGRATION]

- **Signed webhook** (R8, A4; D9, Q7): the courier webhook moved to `POST /api/webhooks/shipping/tracking` (the old
  `/shiprocket` path is deleted; community reports say Shiprocket refuses a URL naming it). It requires `x-api-key`
  equal to the new `SHIPPING_WEBHOOK_TOKEN`, compared over SHA-256 digests with `timingSafeEqual`
  (`server/shipping/courier-token.ts`) before the body is read; missing, wrong or unset is 401. A failure applying an
  update is now 500 so Shiprocket retries (Q32), not 200. Same-origin exemption, rate-limit registry and
  route-reachability follow the new path. **Ops:** set the token in every deployment and register the new URL with it.
- **Courier updates** (R9, A5; D10): `server/checkout/courier-update.ts` moves the parcel through `moveParcel` (a
  repeated "Delivered" moves once, under the order lock). Shiprocket's "PICKED UP" was unmapped and now maps to
  `picked_up`. The buyer is emailed "Delivered: order {code}" once per parcel (`NOTICE_KIND.DELIVERED`). A differing
  `etd` (Shiprocket's sample field, its India day) replaces the ETA by compare-and-set while the parcel travels, writes
  an `eta_changed` timeline row ("New delivery date: {eta}" for the buyer, "ETA {old} → {eta}" for the admin, no shop
  line, as ux.md has it) and emails the buyer "New delivery date: {eta}" once per change.
- **Conflicts** (R8, A13; D10, Q32): an AWB no parcel carries, or a courier move on a cancelled parcel (decided from
  the locked move's outcome; the courier echoing our cancel is not one), is a `CourierConflict` row, answered 200.
  Admin pickups gains a "Conflicts" tab with the open count: open first, a cancelled parcel's row in red, one row per
  AWB with "{n} updates", "Show details" for the raw body, "Find parcel" / "Open Shiprocket", "Dismiss" (dismisses
  the AWB's open rows; "Dismissed." toast; resolved rows greyed "Dismissed by {name}"), 50 more per "Load more",
  "Couldn't load conflicts." on error. `POST /api/admin/courier-conflicts/[id]/dismiss`. "Hide details" added to ux.md.
- **[MIGRATION] `20261101150100_courier_conflicts`**: the `CourierConflict` table and two indexes. Additive.
- **[CONTRACT]** CONTRACTS.md: the webhook's path, token and answers; the dismiss route.
- **Mutations** (each made a test fail, then restored): M1 the unset-secret check dropped; M2 any token accepted; M3
  the route's token check removed; M4 the failure answer made 200; M5 the cancelled-parcel conflict removed; M6 the
  courier's cancel echo made a conflict; M7 an unknown AWB dropped unrecorded; M8 the same-day ETA skip removed; M9
  the delivered email removed.
- **Review fixes:** the Conflicts tab counts distinct open AWBs, as the list folds them; "Find parcel" opens Ready (an
  unknown AWB is most often a parcel booked on Shiprocket but never here); a numeric AWB must be a safe integer, so a
  rounded one is refused with 400 rather than filed as a false conflict. M10: the count reverted to raw rows fails A13.
  Tests: `tests/integration/courier-updates.test.ts`, `tests/unit/courier-token.test.ts`.

## 2026-11-01 — own-store/bulk-sheet unit 1: the download page, Instructions, a tab per type, the example row, Video help [CONTRACT]

- **Get the sheet (D1, D12; R1; Q2, Q16, Q29):** `/org/[orgId]/products/bulk` is now four steps (Get the sheet ·
  Fill it · Upload · Check and create). Step 1 ticks categories by path, grouped by the tab each makes
  (`groupForTicking`), prefilled from the categories the shop sells in, searchable and collapsed past 60; read
  through `src/data-access-layer/org/bulk-sheet.dal.ts` → `bulkSheetService.choices`. "Last downloaded" is kept
  per shop in the device's storage, read safely. Nothing ticked is refused on tap, never disabled; no pickup
  address shows "Add location". Entry renamed "Add many at once".
- **The workbook (D1, D2; R3, R11, A1; Q3, Q5, Q9, Q25):** `GET …/products/bulk/sample` takes `?categories=`
  (was `?types=`). `planSheetTabs` makes one tab per type the ticks resolve to, Other last; each tab's category
  dropdown offers only its own. Instructions first (five steps, colour key, photo and video lines, made-on date).
  Each tab: column A Problems, orange required headings, a hidden key row, a help line, one greyed example whose
  name reads "EXAMPLE — this row is skipped"; headings and Problems frozen. The Types and How to fill tabs are gone.
- **Reading it back (A5):** `parseSheet` reads every visible tab with the key row by key, past the help line,
  skipping the example while its marker stays and never reading Problems; a sheet with only the example answers
  "Your sheet has no products yet — the example row is skipped." A .csv or older .xlsx reads by heading, as before,
  and never from Instructions. A tab is known by `name` and `price` on its key row, so deleting Problems breaks
  nothing. Each row carries its `tab`; create and SKU plans key rows by index (tabs share row numbers), and the
  create payload carries each row's sheet `rowNumber`/`tab` for messages. Problems do not yet name the tab (U3:
  `RowError.tab`) and dropdowns still offer slugs (U2).
- **A8:** a non-link Video cell reads "Not a YouTube link: "{value}" — add a video file from the product form after upload".
- **Tests:** `tests/unit/bulk-sheet-tabs.test.ts`, `bulk-sheet-columns`/`bulk-sheet-build` rewritten for the tab
  shape, `tests/integration/bulk-sheet-download.test.ts`. Mutation-tested: example skip removed (2 fail), Problems
  read as data (2), help row read (3), empty refusal removed (1), type grouping removed (15), A8 suffix dropped (1),
  keyed-tab check back to cell A2 (1).

## 2026-11-01 — order-fulfilment unit 3: booking, label, date change, India-time timeline [CONTRACT] [MIGRATION]

- **Booking** (R5, R6, A3; D11; Q4, Q23): `POST /api/admin/shipments/[id]/booking` → `bookPickup`
  (`server/checkout/fulfilment-booking.ts`), one `moveParcel` into `pickup_booked` that carries pickup date, ETA,
  courier, AWB, tracking and label links (`applyStatus` writes them with the status). The partial unique index on the
  AWB decides a clash, even two admins at once; the holder is then named ("This AWB is already on {code}." on the AWB
  field). Refusals: not ready, "The buyer cancelled this parcel. Cancel it on Shiprocket too.", "Already booked by
  {name} at {time}." (the admin's name is kept on the timeline row). `parcel-moved.ts` writes the buyer's "Your order
  ships {day}" (dates, tracking link; buyer email from `buyer-contact.ts`) and the shop's "Pickup booked for {day}"
  (links to the parcel page, never the label, Q26). The order confirmation's "Estimated Delivery: N/A" now reads
  "We'll email the delivery date once your parcel is booked."
- **Date change and picked up** (R5): `PATCH` on the same path → `changePickupDates`, compare-and-set on the date the
  panel opened with (and the ETA as read); one `pickup_moved` timeline row and a shop email per change, the buyer's
  only when the delivery day moved (`Notice.ref` = the row, so a second change emails again). Saving the dates as
  booked writes and sends nothing. The form is keyed by the booked dates, so a second change from the same row
  sends the new date as seen. Days are real calendar days ("2026-02-30" is a field error). "Changed to {day} by {name} at {time}." when someone moved it first. `POST
  …/picked-up` → `markPickedUp` (Q4), emailing the shop "{code} picked up".
- **Label** (R6; D7, Q26): `GET /api/org/[orgId]/shipments/[id]/label` streams the stored link for the parcel's own
  shop only while booked; https, a Shiprocket host allowlist checked at booking too (`server/shipping/label.ts`,
  INTEGRATIONS.md, unverified), no redirects, 10 s. The shop card shows "Pickup booked for {day} · {courier} · AWB
  {awb}" and "Download label".
- **Timeline** (R7, A14; D5): `ParcelTimelineDto` from `parcelTimelines` (`server/checkout/parcel-timeline.ts`), dates
  in India time (`indiaTime`, `calendarDay` in `server/shared/india-time.ts`; `@db.Date` days read as themselves).
  One `ParcelTimeline` component (`src/components/order/timeline/`) words it per reader from ux.md's table, on the
  shop parcel page, the buyer's order page ("Arrives by {day}", "Track parcel", "Arriving in {n} parcels") and the
  admin order console. The buyer's cancelled line gains its refund state with unit 5.
- **Admin pickups** (ux.md "admin pickups"): tabs Ready (default) · Booked · Not packed, with counts; Ready oldest
  first, amber "Waiting {n} h · Ready for {n} h — book today" past 24 h; Booked by pickup day, red "Pickup was due
  yesterday · No courier update since booking."; 50 per page ("Showing 51–100 of 120", Previous / Next), filtered
  by shop or city from the row; "Book pickup", "Change pickup date", "Mark picked up" there and on
  the order console. Book and re-date use `FormDialog` (bottom sheet on phone, dialog from `md:`) with
  `useServerForm` and native date inputs, rather than the TRD's side sheet and `ResponsivePicker` — no new
  `MAY_USE_SHEET` entry. Copy added to ux.md where it had none: "Enter the delivery date.", "Enter the courier.",
  "Label link must be the link Shiprocket gives you.", "Pickup was due {n} days ago", the picked-up toast.
- **Deleted** (Q30, Q36): the tracking route, `ShipmentTrackingForm` and its client and schema;
  `PATCH /api/admin/orders/[id]`, `adminOrderApiClient`, `updateOrderStatus`, `updateOrderStatusSchema`,
  `orderRepository.transition`/`setNotes`, `ORDER_TRANSITIONS`, `OPERATOR_SETTABLE_STATUSES`. The orders table shows
  the status read-only.
- **[MIGRATION] `20261101100200_parcel_booking`** drops one index (`Notice_shipmentId_kind_audience_key`, replaced by
  one that adds `ref`; no data goes): adds `Shipment.pickupDate`, `labelUrl`; `estimatedDelivery` becomes `DATE`
  (nothing wrote it before); blank AWBs become null, a duplicate AWB stops the deploy, then a partial unique index;
  `ParcelEvent.pickupDate`, `estimatedDelivery`, `actorName`; `Notice.ref`.
- **Mutations** (each made a test fail, then restored): M1 the AWB-clash catch removed (two cases fail); M2 the
  seen-date condition dropped from `movePickupDates`; M3 the org check dropped from `labelLinkFor`; M4 the label host
  check made always-true; M5 "delivery after pickup" made `>=`; M6 the booked-only check dropped from `labelLinkFor`;
  M7 the form's key removed (second change sends the first date); M8 the no-op skip removed (server and client); M9
  the buyer notice sent on a pickup-only move.
  Tests: `tests/integration/parcel-booking.test.ts`, `tests/unit/parcel-booking.test.tsx`.

## 2026-11-01 — product-form unit 4: edit overview, drafts, leave sheet, version and conflict rebase [CONTRACT] [MIGRATION]

- **Edit overview** (R7; D1): editing opens at five section cards (Photos and video, What it is,
  Price & stock, Details, Review), each a one-line summary, its error count and, on Details, "{Channel} will
  ask: {fact}". A card opens that section alone (full screen on a phone, beside the cards from `md:`,
  buyer preview at `lg:`); one "Save changes" saves the product, "Saving…" while it does, never
  disabled, a second tap ignored. Toast "Saved. Live on your store now." and back at the overview. The
  sections are U1's `ProductSections`, so create and edit cannot drift. The editable long form is gone;
  the read-only view stays.
- **Version compare-and-set** (R9, A6; D6, D7; Q11, Q35) **[MIGRATION]**
  `20261101140400_product_edit_version`: `Product.version` (default 0), `lastEditedById` (Restrict),
  `lastEditedAt`, `teamEditedAt`; additive, no backfill. `updateProduct` opens its transaction with a
  guarded `updateMany` on (id, org, version) that bumps it and names the editor; count 0 is a
  `ConflictError` on path `seenVersion` before stock, media or fields move. The wording
  (`server/catalog/product-edit.ts`): "Bhendi Bazaar team changed this product 2 min ago. We loaded the
  latest and kept your changes — check and save." — the team, never an admin's name.
- **Rebase** (D8): on that 409, or the stock 409, `useEditRebase` refreshes the page's props, resets to
  the latest product and lays the seller's changed fields back over it, marked "Your change kept:
  Price". After a sale the stored stock wins: "2 sold while you were editing. Stock is now 8."
- **Drafts and the leave sheet** (R8, A5; D9, D10; Q10): `useFormPersist` stores a saved-at time and a
  `seenVersion`, writes only once something changed, and offers a draft older than 7 days ("We kept what
  you typed on 22 Oct. Use it?" · "Use it" / "Start fresh") instead of restoring it; a recent one comes
  back with "We kept what you typed at 4:12 pm." · "Discard". Edit drafts are per product and keep
  their version, so a stale one is refused and rebased; stock is never drafted. A copy-from start is
  never restored. `useLeaveGuard` opens "Leave without saving?" · "Your changes to {sections} will be
  lost." · "Keep editing" / "Leave" on close, same-origin links and the back gesture, create and edit.
- **[CONTRACT]** `productEditSchema` (`productFormSchema` + required `seenVersion`) on
  `PATCH /api/org/[orgId]/products/[id]`; the org `ProductDetails` gains `version`, `lastEditedAt`,
  `lastEditedBy` (name) and `teamEditedAt`. `CONTRACTS.md` Products section updated.
- **Tests:** `tests/unit/product-form-edit.test.tsx` (R7 cards and one open section; A8 no `disabled`
  over every section; A5 leave sheet on back and none when clean; draft restore with its own
  `seenVersion`, stale "Use it?"; A6 refusal reopens the latest with the price re-applied and marked
  and saves at the new version; stale stock; conflict wording). `tests/integration/product-edit-version.test.ts`
  (A6 on a real schema: a second save from version 0 writes no field and no stock, names the member;
  a team save marks and the shop's next clears). `offer-ceiling` and `product-edit-keeps-facts` follow
  the new signature and the overview. Mutations, each restored: the `version` clause dropped from the
  guarded update (2 failed); the count-0 check never firing (2 failed).
- **Gate edits:** `product-visibility` CENSUS for `product.repository.ts` 24 → 25 reads: `versionConflict`
  sees archived products on purpose (it only words a refused save of the product being edited).
  `src/lib/format.ts` gains `formatTime` ("4:12 pm") for the draft line, so the locale gate holds.
- Q10, Q11 → implemented (unit 4); Q35 → decided (form save implemented in unit 4; team and sheet saves bump version later).

## 2026-11-01 — seller-onboarding unit 3: Home, the five-step setup list, return to Home [CONTRACT] [MIGRATION]

- **Setup list (D5; R3, A1, A6; Q2, Q3, Q19):** `deriveOnboarding` takes products on sale, a pickup-ready
  location (active, street, contact), logo and tagline, the first share and the hide mark; it returns five
  steps in Q19's order, `doneCount`, `next`, `complete`, `hidden`. Channel readiness left the list (Q4).
- **Two marks (D6; Q6, Q23):** `Org.setupHiddenAt`, `Org.firstSharedAt`, written by `orgRepository` with
  conditional raw updates (a repeat writes nothing; `updatedAt`, the contact version, is untouched). Routes
  `POST`/`DELETE /api/org/[orgId]/setup/hidden`, `POST …/setup/shared` (`withOrg`), called by `setupApiClient`.
- **Home (D7; R2; Q5, Q14, Q22, Q24, Q25):** `/org/[orgId]` reads through `src/data-access-layer/org/home.dal.ts`,
  one try/catch per line: shop name and link, "Needs you now" (orders to pack, new reviews in 7 days — the product
  when all on one —, the first channel needing attention, photo proposals awaiting a decision, a live auction
  ending within 24 h; zero hides, a failure keeps its own retry, three shown then "See all {n}"), the setup list
  (hide with Undo toast, a hidden list keeps its "Show" row where More → Setup list lands, done collapses to
  "Your shop is set up."), then the numbers (Q14's line before the first paid order, 4-up from `lg:`, "Updated
  {n} min ago" + Refresh past 15 min). Skeleton while reading. `onboarding-card.tsx` deleted; the channel banner
  moved to a Home line. New counts: `reviewService.newForOrg`, `enhancementService.countAwaitingDecision`.
- **Return to Home (D8; R7):** `RETURN_TO` (`src/components/org/home/return-to.ts`) parses `from` against a closed
  set; product create, a new pickup address and Shop details (once logo and line are both in) go to
  `/org/[orgId]?done=<step>`, and Home toasts "Product added · {n} of 5 done" etc. Product form wired here (Q
  "whichever lands second").
- **[MIGRATION] `20261101130300_org_setup_marks`**: two nullable columns, no backfill; drops nothing.
- **Review fixes:** Home passes the parcels and paid-orders figures it read to `DashboardWidgets` (`prefetched`),
  so the grid does not query them twice; "See all {n}" counts lines (Q30), ux.md's example corrected.
- **Gates:** `file-cohesion` RECORDED gains `home.dal.ts` (analytics, bidding, catalog, channels, content).
  Tests: `tests/unit/org-onboarding.test.ts`, `tests/unit/return-to.test.ts`, `tests/unit/home-attention.test.ts`,
  `tests/integration/seller-onboarding-home.test.ts`.
- **Mutations** (each made a test fail, then restored): M1 hide's `IS NULL` condition removed; M2 first-share's
  `IS NULL` removed; M3 unhide's `IS NOT NULL` removed; M4 the contact-name check dropped from pickup-ready;
  M5 the visible-review filter dropped from the new-review count; M6 `parseReturnTo` accepting any string.
- Decisions Q2, Q3, Q4, Q5, Q6, Q14, Q19, Q23, Q24, Q25 → implemented (unit 3).

## 2026-11-01 — storefront-themes unit 1: theme tokens, twelve palettes, fonts, the contrast gate

- **Registry (D1; R1–R3, Q18):** new `server/catalog/storefront-themes.ts` declares the closed theme set (Edge, Darbar,
  Bloom, Daily), three palettes each with a fixed tone, faces per role, phone columns, and `readStorefrontLook`, which
  parses stored keys (unknown theme → unthemed; a palette from another theme → the theme's first). Nothing calls it yet.
- **Tokens (D2):** `src/app/globals.css` gains storefront roles — `text-headline/-title/-body/-tag/-price` (each
  size a `clamp()` with a rem floor), `tracking-headline/-tag`, `py-section`, `px-gutter`, `gap-grid`, `max-w-store`,
  `shadow-tile`, `font-display`, `font-label`, `duration-theme`, `ease-theme` — and four `[data-theme]` scopes from
  the spec's theme cards. `--radius-card`/`--radius-field` move out of `@theme inline` so a scope can repoint them
  (values unchanged outside a theme). Reduced motion zeroes `--motion-duration`. All registered in `cn`.
- **Palettes (D3; Q5):** twelve `[data-palette]` scopes over 60 new primitives (13 new families in `FAMILY`), each
  repointing every colour role, status colours included, plus new `deal` and `feature` roles and `color-scheme`.
  The `dark` variant now skips `[data-palette]` subtrees. `--color-photo-scrim` / `--color-on-photo` for hero text.
- **Fonts (D5; Q7, Q30):** new `src/components/storefront/theme-fonts.ts` loads Space Grotesk, Geist Mono, Jost,
  Cormorant Garamond, DM Mono and Mulish through `next/font/google`, `preload: false`, `display: swap`; Bloom reuses
  the root's DM Sans. Not yet mounted (U3), so no page changes and CSP is untouched.
- **Gates:** new `storefront-palettes.test.ts` (D4: every text role 4.5:1 and control edge 3:1 per palette, tone
  agrees with ground, `dark:` inert, scrim text over white and black photos) and `storefront-themes-registry.test.ts`
  (A1: themes differ pairwise in ≥3 non-colour roles; scope per key and key per scope; ≤2 families; fonts not
  preloaded; key parsing). `cn-tokens` and `design-tokens` extended. The scrim test failed first at 70% (2.99:1 on
  white); raised to 85%.
- **Mutations recorded:** `--umber-450` lightened to L 0.6 → three Darbar palettes red; `dark` variant unguarded →
  red; scrim back to 70% → red; lilac scope renamed → red; Mulish `preload: true` → red; Daily given Edge's values
  for all but two roles → A1 red; Edge headline `6vw` → red; `cn` without `tile` → red; reduced-motion 1ms → red.
  All restored.
- **Review fixes:** the `dark` guard sits inside `:where()` so `dark:` utilities keep their old specificity; status
  roles and `primary` on the page ground joined the gate, and the primitives that failed were darkened; `text-deal`
  and `text-feature` are not registered — those roles are fills only.
- `docs/ARCHITECTURE.md` test-file count 264 → 266. Decisions Q5, Q16, Q30 → implemented (unit 1); Q7 stays decided until U3 mounts the faces on storefront routes only. Suites:
  `tsc`, `vitest tests/unit`, `lint:boundary`, `docs:check`.

## 2026-11-01 — order-fulfilment unit 2: ready, trimmed buyer details, nudges, 36 h flag [CONTRACT] [MIGRATION]

- **Ready** (R3, A1; D6): `POST /api/org/[orgId]/shipments/[id]/ready` → `markParcelReady`
  (`server/checkout/fulfilment.service.ts`), through `moveParcel` with `paidOnly`. Another shop's parcel or an
  unpaid one is 404; a cancelled one is ux.md's "This parcel was cancelled by {who} on {date}. Don't send it."
  (India day, `server/shared/india-time.ts`); one already moved is "This parcel is already …". The shop parcel
  page shows only the shop's parcels, "Ready for pickup" docked above the tab bar (in the card header at `lg:`),
  the confirm sheet ("Is everything packed and sealed?" / "Yes, it's ready"), the toast, the retry toast,
  the first-order hint and "Show all {n} items" past 30 lines (`src/components/org/parcels/`). Never disabled.
- **Trimmed buyer** (R3, A10; D7; Q22): org reads are `ShopOrderView`/`ShopParcelView`
  (`server/checkout/shop-parcel.types.ts`) through `adminOrderRepository.listShopOrders`/`getShopOrder`; the
  address is trimmed to name, city, pincode by `toShopBuyer`. The shop list has tabs To pack · Ready · On the
  way · Done · Cancelled (one row per parcel, "Parcel 1 of 2 · Ready"), "Search order number", Load more by
  20, "Updated {n} min ago" with Refresh past five minutes, and ux.md's empty, first-use and error lines. The
  admin org console's Orders tab uses the same list. Deleted (Q36): the org transition route, its button and
  client, `transitionForOrg`, `OrgOrderView`, `org-orders-table`/`-filters`. The admin tracking form now needs
  the shop's "ready" (409 otherwise) instead of the order-wide "packed".
- **Notices** (R4, A2; D8; Q8): `Notice` (notifications), unique on (parcel, kind, audience), written on the
  move's transaction by `noticeService.write`; only a new row enqueues `notify.send`. The handler
  (`notifications.jobs.ts`) skips a sent row and keys Resend on the notice id. `parcel-moved.ts` writes the
  admin's "Parcel ready to book — {shop}, {city}" when the shop (not an admin) marks ready.
- **Nudges and the 36 h flag** (R3a, A11; D18; Q24): `fulfilment.sweep` (`server/checkout/fulfilment.jobs.ts`,
  hourly, the 4th of 4 schedules) writes "1 parcel waiting to be packed" at 12 h and 24 h after `paidAt` (a parcel
  already past 24 h gets only the 24 h one) and "Waiting 24 h: parcel {code}" for a parcel ready 24 h. New
  `/admin/orders/pickups` (admin nav "Pickups") holds the "Not packed" tab: paid parcels unready 36 h on, oldest
  first, filter by shop, the shop's city and phone, "Shop emailed at 12 h and 24 h" / "+ you emailed {n} h ago",
  "Paid 3 days ago, not ready." red past 72 h, and "Email shop" (`POST /api/admin/shipments/[id]/email-shop`,
  once per parcel, toast "Email sent to {shop}.").
- **[MIGRATION] `20261101100100_fulfilment_notices`** drops nothing: adds `Order.paidAt` (stamped by
  `confirmPaid`; backfilled from `createdAt` for paid orders) and `Notice`, and pre-fills sent notices for parcels
  already waiting so the first sweep emails no one. A `packing` parcel of a paid order the shop had already
  marked `packed` moves to `ready_for_pickup` (seeded `system` ParcelEvent, `ready`/`ready_24h` pre-filled), so
  the stricter tracking form does not send it back to the shop.
- **Review fixes**: both shop order pages run their own `requireOrgMember` and render ux.md's Refused ("You
  don't have access to this shop's orders." · "Go to my shops") on 403; "Email shop" finds its one parcel by id
  and the "Not packed · N" count is uncapped (`countNotPacked`); the not-packed list is a table at `lg:`
  (`not-packed-list.tsx`); the second-press refusal is added to ux.md's matrix.
- **Mutations** (each made a test fail, then restored): M1 shop scope dropped from `markParcelReady`; M2 `paidOnly`
  check removed; M3 `insertOnce` answers a row on a duplicate; M4 the shop-only condition on the ready notice
  removed; M5 the buyer trim bypassed; M6 the sent-row skip removed; M7 the 12 h window's lower bound removed;
  M8 the 36 h threshold set to zero; M9 `paidAt` not stamped; M10 the tracking route's `packing` refusal
  disabled (the D6 tracking-form case fails). Tests: `tests/integration/parcel-ready.test.ts`,
  `tests/unit/parcel-ready.test.tsx`.

## 2026-11-01 — seller-onboarding unit 2: the create screen shows the link it makes

- **Create screen (D4; R1, A1; Q21, Q27):** `/org/new` previews "Your link: {host}/store/{handle}" as the name is typed,
  using the server's own `handleCandidates` in the browser (so a reserved word skips to `-2` exactly as the insert does);
  a long handle is cut in the middle. The host comes from `appUrl()`, never a constant. Words live in
  `src/components/org/open-shop-copy.ts`. Body and route unchanged (`POST /api/orgs`, `ACCOUNT`, org-profile U1's schema).
- **States (ux Create your shop):** a spinner on "Opening your shop…" (still tappable, still one shop); "Still opening…
  don't close this page." after 3 s; a dropped connection or a 5xx shows "Couldn't open your shop. Check your internet and try again." with "Try again"
  (never the server's generic message), a refusal shows its
  message without one; field messages unchanged. From `md:` the form sits in a centred 28rem card (ux Phone / tablet / desktop).
- **Signed out (ux Refused):** the page says "Sign in to open your shop." and opens the sign-in sheet, which refreshes the
  page in place. `src/middleware.ts` gains `signInAtEdge`, which lets exactly `/org/new` past the sign-in redirect; the
  page still calls `requireSession`, and a blocked account is still refused.
- **Gates:** `open-shop.test.tsx` (preview, reserved word, long link, slow, retry, 5xx copy, terminal error), new
  `open-shop-page.test.tsx` (signed-out prompt, signed-in form on the app's origin, blocked refused, edge exemption).
- **Mutations recorded:** every failure made retryable → terminal-error test red; preview built by a local slugify instead
  of `handleCandidates` → reserved-word test red; edge exemption widened to a `/org/new` prefix → edge test red; the page
  swallowing every session error → blocked-account test red; slow timer at 30 s → slow test red. All restored.
- Decisions Q21, Q27 → implemented (unit 2). Suites: `tsc`, `vitest tests/unit`, `lint:boundary`, `docs:check`.

## 2026-11-01 — org-profile unit 5: copy sweep, the org code hidden from the shop

- **Code hidden** (R8; D9): the shop switcher and the `/org` "Choose a shop" list show the shop's name and the
  person's role, no longer `Org.code`. `orgMemberRepository.listOrgsForUser` stops selecting `code`, so it no
  longer reaches the switcher's client props. The coupon prefix on the offer form still names the code
  (promotions D13); kept by Q28, a ratchet entry pointing at it. The product form is still sent the code as its
  photo upload folder, never rendered for one shop (Q29).
- **Copy sweep** (A4; D9; Q12): the portal copy scan (seller-onboarding D14) now refuses "Description",
  "Introduction", "Business Name", "Accent", "Contact Person", "Block 1 heading" and the old placeholders
  ("John Doe", "org@example.com", "ABC Traders") anywhere in the seller portal, and any rendered org code. No
  portal file needed a copy change; units 1–4 had already moved them. Admin forms are out of scope (Q22). The
  code scan matches any `*.code`/`orgCode` in a JSX text child or a `${...}` interpolation, not only `{org.code}`;
  a prop such as `orgCode={org.code}` (a storage path) is not shown.
- **ux states:** no new screen; the switcher and chooser keep their states with one line less.
- Decisions Q1, Q12 implemented; Q28, Q29 logged from review; spec and TRD Implemented.
- **Mutations** (each made a test fail, then restored): M1 `{org.code}` back in the switcher → two tests failed.
  M2 `{org?.code}` in the chooser → the code test failed. M3 "John Doe" in a portal form → the retired-words
  test failed. M4 the swatch label back to "Accent" → the retired-words test failed. M5 the coupon prefix removed
  from an allowlisted page → the stale-allowlist check failed. M6 `` {`${org.name} · ${org.code}`} `` in the
  chooser → the code test failed. M7 `{currentOrg.code}` in the switcher → both code tests failed.
- **Tests:** `tests/unit/portal-copy.test.ts` (three new cases). Ran `tsc`, `vitest run tests/unit`,
  `vitest run tests/integration/shop-details.test.ts tests/integration/shop-contact.test.ts` (local disposable DB),
  `lint:boundary`, `docs:check`.

## 2026-11-01 — org-profile unit 4: Looks — "How you work" retired, accent as swatches [CONTRACT]

- **"How you work" retired, text kept** (R7; D5; Q6): the three Block heading/line pairs leave the storefront
  editor, `storefrontSettingsSchema` (strict, so a `pillars` key is refused), `storefrontService.saveSettings`,
  `PUBLIC_PROFILE_SELECT`, `BrandPageDto`, the section order, the hideable set and the "What your page shows"
  panel. `brand-pillars.tsx` and `pillarsFrom` are gone. `OrgProfile.pillars` and its data are untouched; no
  migration. "Why buy from us" is storefront-themes' (its R8, Q21).
- **Accent as swatches** (A4; D8; Q20): the Shop page's "Accent" select of token names becomes four unnamed
  colour swatches labelled "Colour" (a radio group of `Button`s, "Colour 1"–"Colour 4", each a semantic token
  class; none disabled). No stored accent shows the first swatch as chosen, which is what buyers see then.
- **ux states:** no new screen; the looks card keeps the editor's existing save, refresh and error states.
- **[CONTRACT]** `BrandPageDto.pillars` removed; `storefrontSettingsSchema` narrowed to `heroUrl`, `accent`,
  `hiddenSections`; `"pillars"` leaves `BRAND_PAGE_SECTION_ORDER`/`HIDEABLE_BRAND_PAGE_SECTIONS`. CONTRACTS.md
  updated. Decisions Q6, Q20 implemented.
- **Mutations** (each made a test fail, then restored): M1 `pillars` back in the looks schema → the schema
  refusal test failed. M2 `pillars` back in `PUBLIC_PROFILE_SELECT` → the buyer-payload and select-allowlist
  tests failed. M3 swatch labelled with its token name → the unnamed-swatch test failed. M4 `aria-checked` never
  true → two swatch tests failed. M5 swatch click not setting the value → the save test failed.
- **Tests:** `tests/unit/storefront-looks.test.tsx` (new); `storefront-public-dto`, `brand-page-sections`,
  `brand-page-standing`, `brand-page-render` (pillars removed); `tests/integration/shop-details.test.ts` (column
  kept, buyer page without it). Ran `tsc`, `vitest run tests/unit`, `vitest run tests/integration/shop-details.test.ts
  tests/integration/seller-profile.test.ts tests/integration/brand-page-proof.test.ts` (local disposable DB),
  `lint:boundary`, `docs:check`.

## 2026-11-01 — seller-onboarding unit 1: a phone tab bar, one grouped navigation, a Shop tab, plain names

- **Navigation (D1, D2; Q9, Q10, Q28):** `src/components/layout/portal-nav.ts` declares the shop portal's list once — five
  groups (Sell, Your shop, Grow, Money, Settings), a purpose line per item, four tabs. A phone gets a bottom bar (Home ·
  Orders · Products · Shop · More); More opens the existing `PortalSidebar` drawer, now bottom-anchored and grouped; the
  hamburger goes. `md:` shows an icon rail (label on hover and focus, and always the link's name), `lg:` the full grouped
  sidebar. Help opens the Contact sheet; Setup list points at Home's list (unit 3 builds it). The admin's flat list is
  unchanged. The portal's `<main>` clears the tab bar on a phone.
- **Shop tab (D3; Q8):** new `/org/[orgId]/shop` — link card (Share, Copy link, See as a buyer) and four rows (Shop
  details, Shop page, Pickup addresses, Reviews), each with a one-line status, read by `shop-hub.dal.ts`; a row whose read
  fails shows "Couldn't load. Try again." and the others still render. Row skeletons while it loads.
- **Renames (D14; Q7):** Dashboard→Home, Storefront→Shop page, Locations→Pickup addresses, Earnings→Money you'll receive,
  Library→Photos, What you sell→Brands and defaults; the banner card "Promotions"→"Banners" (its dialog and toasts too);
  the suspended page→"Your shop is paused" with Contact us; seller copy says "shop", never "organisation"; the header's
  "Storefront" link→"See as a buyer". No URL changed. The banner card's arrows, delete and its add dialog are no longer
  disabled: a tap while a change is saving toasts "Saving the last change…", and an arrow with nowhere to go is not drawn.
- **Gates:** new `portal-nav.test.ts` (every `(org)` page belongs to exactly one item, four tabs plus More, a purpose per
  item, Q22 placement; spec A3, R5, R6), `portal-copy.test.ts` (no "organisation" in seller copy, "Banners", nothing
  disabled on these screens; spec A7), `shop-hub.test.ts` (rows fail alone). `PortalSidebar.tsx` leaves `SHAPE_LEGACY`.
- **Review fixes:** the rail's hover label is no longer clipped (the nav scrolls only at `lg:`); the Shop page row reads
  only the section facts (`storefrontService.brandPageSectionFacts`, `storefrontDAL.brandPageForStanding`) — no proof,
  no goods — sharing one rating read with the Reviews row, and a shop with no public page says "not open to buyers yet".
- **Mutations recorded:** banner title back to "Promotions" → copy test red; "organisation" restored on `/org` → red;
  `disabled={busy}` on a banner arrow → red; Bidding removed from `PORTAL_NAV` → nav test red (2); active entry taken as
  the first match instead of the longest → red (Shop hub lit on Shop details); hub reviews read unguarded → shop-hub red;
  inactive addresses counted → red (2). All restored.
- Decisions Q7–Q10, Q28 → implemented (unit 1). Suites: `tsc`, `vitest tests/unit`, `lint:boundary`, `docs:check`. Integration:
  `org-banner-roundtrip`, `shop-details`, `seller-profile`.

## 2026-11-01 — org-profile unit 3: Shop details, the private part [CONTRACT]

- **Name, mobile, email, link** (R5; A3; D7; Q15, Q16, Q23, Q25): the shop name becomes editable on Shop details,
  confirmed in a `FormDialog` sheet ("Buyers will see {new} on your shop and every product. Your link stays
  {link}.", "Change name" / "Keep old name"). "Only Bhendi Bazaar sees this — to reach you about orders and
  payouts" holds the mobile (shared phone field, any country) and the email for order updates, each saving alone.
  The link row reuses `HandleChangeDialog`. `PATCH /api/org/[orgId]/shop/contact` (`withOrg`) parses
  `shopContactSchema`; `shopDetailsService.saveContact` refuses staff with "Only the shop owner can change this."
  (the handle route now says the same), writes only the fields sent, and is a compare-and-set on `Org.updatedAt`
  (`orgRepository.updateContactIfUnchanged`). Order and payout emails and the brand page read `Org` directly,
  so the new name and email apply at once (A3).
- **Old address told** (Q16, Q25): an email change enqueues `org.email-changed` in the same transaction (spec in
  `server/shared/jobs/`, so catalog never imports notifications) and is audited `ORG_EMAIL_CHANGED` after commit
  (ADR-0021); a mobile change is audited `ORG_PHONE_CHANGED` (from/to) the same way. The handler (`server/notifications/notifications.jobs.ts`, registered in `worker/main.ts`) sends
  "Your shop's email was changed" with a Resend idempotency key derived from the job id, so a redelivered job is
  one email, with `SUPPORT_INBOX` as Reply-To since the notice invites a reply. `SendEmailOptions` gains
  `idempotencyKey`. INTEGRATIONS.md records Resend's key window. The worker now sends email: `.env.worker.example`
  and OPERATIONS.md gain `RESEND_API_KEY`, `EMAIL_FROM` and `NEXT_PUBLIC_APP_URL` — **set their
  `WORKER_ENV_<NAME>` secrets before deploying**, or every notice job fails and parks.
- **Tax card** (R6): "Tax and bank details · We'll ask before your first payout. Nothing to do now."
- **ux states built:** Shop details private part — Success toasts ("Saved. We'll call this number about orders.",
  and "Saved. New orders will come to this email.", added to ux.md), Retryable, Terminal (field messages: "Use at
  least 3 letters.", the shared phone message), Refused (owner-only; "That link is taken. Try {suggestion}." —
  the handle change now suggests the first free numbered variant), Stale, Slow. Name sheet — First use, Loading
  ("Changing…"), Success ("Name changed."), Retryable ("Couldn't change it. Try again." with "Try again"),
  Terminal (stays on the field; the sheet opens only for a valid, different name), Refused (with "Close"), Stale
  (a 409 shows the server's copy with "Load latest", which reloads the page as the section banners do), Slow
  ("Still changing…"); bottom sheet below `md:`, dialog from `md:` (the primitive's switch, as the TRD says).
- **Never disabled:** the handle dialog's two buttons lost `disabled` (ADR-0053); a second tap while saving
  sends nothing, as on every Shop details save.
- **[CONTRACT]** `shopContactSchema`; `ShopDetailsDto` gains `phone`, `email`, `contactUpdatedAt`; job
  `org.email-changed`; handle refusal copy. CONTRACTS.md updated. Decisions Q5, Q15, Q16, Q23, Q25 implemented.
- **Mutations** (each made a test fail, then restored): M1 owner check made never-true → the staff-refusal unit
  and integration tests failed. M2 `shopContactSchema` non-strict → the forbidden-field test failed. M3
  `updatedAt` removed from the contact compare-and-set → two integration tests (stale, stale email) failed. M4
  enqueue skipped → the one-job integration test failed. M5 idempotency key dropped → the once-per-job test
  failed. M6 `contactColumns` spreading the whole input → the only-fields-sent test failed (first version used
  `toHaveBeenCalledWith`, which ignores an undefined key; tightened to `toStrictEqual`). M7 the name form
  writing straight away instead of opening the sheet → four sheet tests failed. M8 handle refusal back to the
  old copy → three storefront-service tests failed.
- **Tests:** `tests/unit/shop-contact.test.tsx` (schema, service, private part, name sheet, job),
  `tests/integration/shop-contact.test.ts` (A3, Q21, Q23, Q25), `storefront-service` (suggestion),
  `email-templates` (new template), `shop-details` (fixtures). Ran `tsc`, `vitest run tests/unit`,
  `vitest run tests/integration/shop-contact.test.ts tests/integration/shop-details.test.ts` (local disposable
  DB), `lint:boundary`, `docs:check`.

## 2026-11-01 — Docs cost less to load: the changelog splits by month, the conventions index leaves CLAUDE.md

- **Changelog:** entries before this month move to `docs/changelog/2026-08.md` and `2026-09.md`, unchanged and still
  append-only; `docs/CHANGELOG.md` keeps the current month (727 KB → 238 KB). The numbering check reads every month in
  order; the archive is exempt from the living-doc gates, as the old single file was.
- **CLAUDE.md:** the 61-line conventions index moves to `docs/CONVENTIONS.md` (a living doc in the gate); CLAUDE.md keeps
  the invariants, the SDLC and the seven conventions nearly every change meets, and says when to read the index
  (26 KB → 15 KB on every session). bb-sdlc, `docs/adr/README.md` and `docs/README.md` point at the new home.
- **Why:** both files were paid for on every agent turn of the org-portal build.
- Suites: `docs:check`.

## 2026-11-01 — Shiprocket webhook moved to `/api/webhooks/shipping/courier`

- **Shiprocket refuses a webhook URL containing "shiprocket", "kartrocket", "sr" or "kr"** (its webhook
  settings page, checked 2026-11-01), so `/api/webhooks/shipping/shiprocket` could never be registered.
  The route is now `/api/webhooks/shipping/courier`; the same-origin exemption, reachability entry, docs
  and tests follow it, and a test holds the path free of the refused words.
- **Confirmed in the dashboard:** the token is sent as `x-api-key`, as the B5 code expects.
- **Owner note:** Shiprocket has one webhook URL per account; at the time of checking it pointed at another
  integration. Replacing it with ours stops that integration's tracking updates.
