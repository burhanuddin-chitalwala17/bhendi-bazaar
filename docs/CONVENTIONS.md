# Conventions index

- **Verified:** 2026-11-12
- **Covers:** `docs/adr/*.md`, `docs/specs/*/`

The canonical index of *how we work*, moved out of the root `CLAUDE.md` on 2026-11-01 so it is read when
a task touches it rather than loaded into every session. **Each line is a pointer**: the rule and its ADR,
nothing more; detail lives in the ADR so it has one wording ([ADR-0009](adr/0009-docs-reference-code-never-copy-it.md) D6).
**A new convention adds a line here and an ADR to point at.**

- **Docs split by volatility** — rules / current state / decisions / plans / history each have one home. [ADR-0001](adr/0001-monorepo-doc-structure.md)
- **Domain docs co-locate with code** — `<domain>/CLAUDE.md`, lazy-loaded. [ADR-0001](adr/0001-monorepo-doc-structure.md)
- **ADRs are append-only** — supersede, never edit. [ADR-0001](adr/0001-monorepo-doc-structure.md), [index](adr/README.md)
- **ADRs are for genuine decisions** — real alternatives, the rejected one often conventional. [docs/adr/README.md](adr/README.md)
- **Specs are `spec.md` + `trd.md`, no code; only `spec.md` is capped (≤100 readable lines); `trd.md` and `ux.md` are uncapped.** [ADR-0010](adr/0010-spec-convention.md), [ADR-0071](adr/0071-only-the-spec-is-line-capped.md)
- **A shipped feature keeps `spec.md` + `decisions.md` only** — `ux.md` and `trd.md` go in the commit that flips Status to Implemented; links become `<sha>:path` refs. [ADR-0073](adr/0073-a-shipped-feature-keeps-its-spec-and-decisions-and-drops-its-ux-and-trd.md)
- **A feature is one outcome, its decisions are logged, its UX is signed off before the TRD** — Claude cuts scope into In/Later and defaults reversible decisions; `decisions.md` holds every Q, and its **State** is read before any Q is relied on: `decided`/`implemented` bind, `superseded by Qn` defers to Qn, `open` blocks, `parked` is out of scope. A Q not yet implemented is replaced in place; only an implemented one is superseded ([ADR-0062](adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)); `ux.md` holds every state. [ADR-0061](adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md)
- **CHANGELOG is append-only, newest first, one entry per unit, unique numbers** — `[CONTRACT]` when a DTO or schema changes and `CONTRACTS.md` moves with it; `[MIGRATION]` when `prisma/migrations/` gains a folder. `docs:check` holds the numbering. It holds the running month; a closed month is summarised in `CHANGELOG-HISTORY.md` and dropped, prompted at session start. [ADR-0072](adr/0072-the-changelog-holds-the-running-month-and-a-closed-month-becomes-a-summary.md)
- **Docs reference code by path, never copy it.** [ADR-0009](adr/0009-docs-reference-code-never-copy-it.md)
- **A doc's `Verified:` date is a gate** — declare `Covers:`; `npm run docs:check` fails on drift. [ADR-0009](adr/0009-docs-reference-code-never-copy-it.md)
- **One error envelope, consumed by `useServerForm`** — `toErrorResponse` out, `readApiError` in, `DomainError` to opt into a shown message. [ADR-0013](adr/0013-one-error-envelope-and-useserverform.md)
- **`server/` is organised by domain, not by layer or caller** — no `admin/` tree. [ADR-0012](adr/0012-modules-are-vertical-slices-by-domain.md)
- **A domain is reached through its public surface** — `*.service`, `*.types` and the seams it declares. Never another domain's repository. [ADR-0033](adr/0033-a-domain-is-reached-through-its-public-surface.md)
- **One components home, by domain; every control through its primitive.** [ADR-0031](adr/0031-one-components-home-organised-by-domain.md)
- **The UI is built in tiers, and every icon goes through one seam** *(Proposed)* — palette → tokens → bridge → `ui/` primitives → `shared/` composites → domain composites → `layout/` → pages, each with a placement test; icons by meaning through `ui/icon.tsx`; type, motion and depth are role tokens. [ADR-0066](adr/0066-the-ui-is-built-in-tiers-and-every-icon-goes-through-one-seam.md)
- **Words live in copy modules, and our own paths in one routes table** *(Proposed)* — what a person reads is in the area's `*-copy.ts`; a link to one of our pages is built by `ROUTES` (`server/shared/routes.ts`); `tests/unit/hardcoded-copy.test.ts` fails on any left inline. [ADR-0067](adr/0067-words-live-in-copy-modules-and-our-own-paths-in-one-routes-table.md)
- **A component renders, a hook holds state, an API client makes the call** — `fetch` only in a `*ApiClient.ts` beside its domain; props are DTOs, never `@prisma/client`. [ADR-0048](adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md)
- **An overlay's surface follows its content** — picker, canvas task, detail panel, handed-off flow; each carries its own phone form. [ADR-0040](adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md)
- **The UI is mobile-first** — base = phone, breakpoints add. [ADR-0015](adr/0015-mobile-first-design.md)
- **Three form factors on Tailwind's own breakpoints** — phone at base (`sm:` only refines it), tablet `md:`, desktop `lg:`; scripts read `FORM_FACTOR_QUERY`. [ADR-0050](adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md)
- **The phone storefront is an app shell** — bottom tab bar, 3-up grids, docked actions. [ADR-0016](adr/0016-mobile-app-shell.md)
- **Every design axis goes through tokens** — colour, type, tracking, elevation, shape, width; colour values live only in the primitive palette, which semantic tokens point at. [ADR-0022](adr/0022-design-decisions-go-through-tokens.md), [ADR-0049](adr/0049-colour-is-a-primitive-palette-read-through-semantic-tokens.md)
- **A file's reasons to change are a decision** — a file reaches at most two other domains; beyond that the set and the reason are recorded. It is the *import* that adds a reason, so that is where the gate fires, at any size. [ADR-0036](adr/0036-a-files-reasons-to-change-are-a-decision.md)
- **Closed sets are declared once and compared by constant** — `ORDER_STATUS.PAID`, never `"paid"`. [ADR-0003](adr/0003-one-repository-per-aggregate.md) D5
- **Render on the server by default** — a `page.tsx` is never `"use client"`; push it to the smallest leaf. [ADR-0034](adr/0034-render-on-the-server-by-default.md)
- **One effective-price function serves display and charge.** [ADR-0018](adr/0018-one-effective-price-function.md)
- **A discount is one winning offer, allocated to lines, with its funding recorded.** [ADR-0019](adr/0019-discount-is-one-winning-offer.md)
- **An order code is random, a reference rather than a credential.** [ADR-0025](adr/0025-order-codes-are-random-not-sequential.md)
- **An unpaid checkout releases its goods and is shown to nobody.** [checkout-abandonment](specs/checkout-abandonment/)
- **Records that carry money or attribution never cascade** — deletion is refused; the real operation is cancellation. [ADR-0020](adr/0020-money-bearing-records-never-cascade.md)
- **A product leaves sale by archiving, never by deletion.** [ADR-0029](adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md)
- **A record a person authored is retired, never deleted** — one column per way of retiring it. [ADR-0032](adr/0032-records-people-authored-are-retired-not-deleted.md)
- **A user is deactivated, never deleted** — and that is not `isBlocked`. [ADR-0032](adr/0032-records-people-authored-are-retired-not-deleted.md)
- **An item up for bidding cannot be bought, and the product never knows it.** [ADR-0023](adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md)
- **A phone number is contact data, not an identity key.** [ADR-0024](adr/0024-phone-is-contact-data-not-an-identity-key.md)
- **The audit trail records an action; it never decides whether it happened.** [ADR-0021](adr/0021-audit-trail-never-fails-the-action.md)
- **An org storefront is a scoped projection of the marketplace, on one domain.** [ADR-0030](adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md)
- **A storefront theme is a token set and a section composition declared in code** — one section library, three palettes each, the shop stores keys only, every palette contrast-tested. [ADR-0064](adr/0064-a-storefront-theme-is-a-token-set-and-a-section-composition-declared-in-code.md)
- **Images live in Cloudflare R2, behind one seam.** [ADR-0028](adr/0028-images-live-in-cloudflare-r2.md)
- **Images are stored small and delivered through the optimizer.** [ADR-0026](adr/0026-images-are-delivered-through-the-optimizer.md)
- **A zoomable surface declares the size it zooms to; the stored ceiling clears it.** [ADR-0027](adr/0027-zoomable-surfaces-declare-the-size-they-zoom-to.md)
- **Video is stored in our own object store and transcoded by the worker; a YouTube link stays an embed.** [ADR-0039](adr/0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md)
- **Every response carries a nonce-based CSP** — `script-src` never gains `'unsafe-inline'`. [ADR-0035](adr/0035-every-response-carries-a-nonce-based-csp.md)
- **The host is a deployment fact, not an architectural input** — seams, app-named environment, no vendor names in config; a free tier is used, never depended on. [ADR-0037](adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)
- **A channel is classed by where the sale completes** — storefront, shopfront, marketplace; the kind decides the machinery. [ADR-0041](adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)
- **A canonical fact is admitted by answerability, not by agreement** — one platform asking is enough, none is enough; a fact the shop cannot answer from the product is a channel extra declared as a schema, never a bag, never the union. Store the fact that derives the other. [ADR-0047](adr/0047-a-canonical-fact-is-admitted-by-answerability-not-by-agreement.md), [ADR-0042](adr/0042-the-shared-vocabulary-is-the-intersection-and-a-channel-declares-its-own-extras.md)
- **A variant is a product in a family** — its own SKU, price and stock; the family carries facts, measurements and type. [ADR-0043](adr/0043-a-variant-is-a-product-in-a-family.md), [ADR-0051](adr/0051-a-products-facts-are-one-json-column-each-entry-carrying-its-origin.md)
- **A product type is a row selecting from facts declared in code** — answers are data, keys stored and labels shown, types belong to the platform, derivations are never stored. [ADR-0052](adr/0052-a-product-type-is-a-row-that-selects-from-facts-declared-in-code.md)
- **A product's attributes are rows, mapped at runtime to each channel's own catalogue** — attributes added only by migration, typed value rows with a projection, a stored catalogue per channel, one field map per channel field, listings built not stored. [ADR-0070](adr/0070-a-products-attributes-are-rows-mapped-to-each-channels-own-catalogue.md)
- **A marketplace order's money is reported, not computed** — Invariant 2's shape, not Invariant 1's exception; it never enters the payouts ledger. [ADR-0044](adr/0044-a-marketplace-orders-money-is-reported-not-computed.md)
- **Channel mappings are dated data** — category, attribute and value rows carrying a checked date and source; required-ness is a column, never adapter code. [ADR-0045](adr/0045-channel-mappings-are-versioned-data.md), [ADR-0054](adr/0054-a-channel-mapping-carries-a-checked-date-and-source-and-required-ness-is-data.md)
- **Readiness advises and never gates** — states are named for what the other side will think, nothing is disabled, the reason is one tap away; a gate needs a watched rejection as evidence. [ADR-0053](adr/0053-readiness-advises-and-never-gates.md)
- **Background work runs on an owned worker against a Postgres job queue** — enqueued in the business transaction, handlers idempotent on job id, no HTTP between queue and code. [ADR-0038](adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)
- **A new model is checked against the field before the codebase** — a TRD introducing a new persistence shape, data model or integration pattern states the established approach and whether it follows it; our own prevailing pattern is evidence, never authority. [ADR-0046](adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md)
- **A gate against existing debt is a ratchet** — an allowlist with a reason per entry that only shrinks, over a scan that proves it scanned; a guard is mutation-tested before it is trusted and the mutation is recorded; an allowlist edit is a review finding. [ADR-0056](adr/0056-a-gate-against-existing-debt-is-a-ratchet.md)
- **Shared hooks live in `src/hooks/core`; every other hook travels with its component.** [ADR-0057](adr/0057-shared-hooks-live-in-one-core-folder-and-every-other-hook-travels-with-its-component.md)
- **Media is one aggregate; a derivative is lineage, not a use; usage is a query, never a counter.** [ADR-0058](adr/0058-media-is-one-aggregate-a-derivative-is-lineage-not-a-use-and-usage-is-derived.md)
- **An enhancement never changes the product's pixels, proven before encoding.** [ADR-0059](adr/0059-an-enhancement-never-changes-the-products-pixels-proven-before-encoding.md)
- **Mutations stay on route handlers, and a mutating request must come from our origin** — `src/middleware.ts` refuses cross-site `POST`/`PUT`/`PATCH`/`DELETE` to `/api/**`; signed webhooks and `/api/auth` are the named exemptions. [ADR-0060](adr/0060-mutations-stay-on-route-handlers-and-a-mutating-request-must-come-from-our-origin.md)
- **Every public route is classified for rate limiting** — one registry: a named policy or an exemption with its reason; an unclassified route fails the suite. [ADR-0063](adr/0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md)
- **A storefront read shared across requests goes through `cachedRead` and declares every table it reads** — a write clears by table, the clock stays per request, and money is never read from it. `tests/integration/read-cache-tables.test.ts` [ADR-0065](adr/0065-storefront-reads-are-shared-across-requests-and-cleared-by-the-tables-a-write-touches.md)
- **A dropped column names whose data goes** — a `DROP COLUMN`/`DROP TABLE` migration states who confirmed the data disposable, and when. `tests/unit/migration-drops.test.ts`
- **The tests are audited like the code** — a suite that cannot run, or passes over an empty scan, is not a passing suite. `tests/unit/test-integrity.test.ts`
- **Every route handler has a caller, named in the repository or declared as external** — no compiler follows a string. `tests/unit/route-reachability.test.ts`
- **Index tables are generated from the files they index, never typed** — `npm run docs:index`; a stale table fails `docs:check`. `tests/unit/docs-integrity.test.ts`
