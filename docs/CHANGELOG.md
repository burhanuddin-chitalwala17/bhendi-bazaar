# CHANGELOG

## Format
- **Append-only.** Never edit an old entry; corrections go in as new entries.
- Newest entries at the top.
- Entry header: `## [PR-NN] YYYY-MM-DD — Short title`
- Add `[CONTRACT]` when a DTO in [CONTRACTS.md](CONTRACTS.md) changed — the signal that client and server must move in lockstep.
- Add `[MIGRATION]` when the PR includes a Prisma migration, so a deploy knows to run one.
- One entry per merged PR. Cross-domain changes are recorded here; domain-internal changes go in that domain's own CHANGELOG.

## Entries

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
