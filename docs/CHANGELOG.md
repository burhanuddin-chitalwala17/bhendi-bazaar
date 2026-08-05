# CHANGELOG

## Format
- **Append-only.** Never edit an old entry; corrections go in as new entries.
- Newest entries at the top.
- Entry header: `## [PR-NN] YYYY-MM-DD — Short title`
- Add `[CONTRACT]` when a DTO in [CONTRACTS.md](CONTRACTS.md) changed — the signal that client and server must move in lockstep.
- Add `[MIGRATION]` when the PR includes a Prisma migration, so a deploy knows to run one.
- One entry per merged PR. Cross-domain changes are recorded here; domain-internal changes go in that domain's own CHANGELOG.

## Entries

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
