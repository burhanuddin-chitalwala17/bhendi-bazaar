# GTM readiness review and roadmap

- **Reviewed:** 2026-10-31 (baseline audit 2026-10-29)
- **Scope:** the whole codebase (`src/`, `server/`, `worker/`, CI, infra) and the live site
- **Status:** a record of a moment, not a living doc. Re-measure against section 9 instead of editing the findings
- **Not legal advice.** Items marked *(verify)* need a lawyer or CA to check against the official text

## How to use this document (for a new session)

This is a self-contained handover. A fresh Claude session can pick up from here without the conversation that produced it.

1. Read [../CLAUDE.md](../CLAUDE.md) first. The project's invariants and conventions override anything here.
2. Work the blockers in **section 6** in order. Each has the files to touch.
3. **Working rules the owner set:**
   - Fixes go straight to code + tests + a CHANGELOG line. A spec or TRD is needed only for money, payment state, schema/migration or `CONTRACTS.md` changes.
   - The owner commits and pushes. Never commit, push or stage.
   - Work stays on the `main` branch.
   - Buttons are never disabled. Double-submit protection is an in-flight guard, not `disabled`.
   - Each unit gets a fresh-context review (`/bb-review`), and any new guard test is mutation-tested before it is trusted.
4. Re-run the checks in **section 9** to report progress against the scores in **section 1**.

---

## 1. Where we stand

| Area | 29 Oct | 31 Oct | Verdict |
|---|---|---|---|
| Latency & scale | 5.5 | **5.5** | Each request is disciplined, but the servers run in the US, nothing is cached and there is no connection pooler |
| SEO & discovery | 4 | **4 live, about 5 once deployed** | The 29 Oct fixes are not deployed; no structured data; AI crawlers are now unblocked |
| Security | 7 | **5.5** | All 11 earlier findings are still open, plus a **critical Next.js RCE** and CI secret exposure |
| Infra & reliability | 4 | **4** | **No database backup at all**; failures alert nobody; the Hobby plan forbids commercial use |
| Compliance (new) | — | **4** | Policies exist; the marketplace duties (seller and GST details, product declarations, a grievance record) are missing |
| Frontend architecture | 7 | **7.5** | Strong gates; the number of client components has no ceiling |
| State / UX resilience | 4 | **4** | No double-submit lock, no idempotency, loading screens on only 5 of 79 pages |
| Engineering practice (new) | — | **7** | Guardrails above the norm; no e2e tests, integration tests skip in CI, push-to-main deploys |
| **Overall** | ≈5.3 | **≈5.2** | **Not production-ready. About 3 weeks of focused work closes the GTM blockers.** |

The score dipped because this review went deeper, not because the code got worse.

### Verified by hand on 2026-10-31
- **`next@16.3.5` is affected by GHSA-2464-fhr4-w9xw**: critical (9.5), unauthenticated remote code execution through Image Optimization. GHSA-673q-mjm6-r5xr (critical) and GHSA-p3m5-59mp-jv5r (high) also need **16.4.1**. — https://github.com/advisories/GHSA-2464-fhr4-w9xw
- **The live header `x-vercel-id: bom1::iad1`** means requests enter in Mumbai but the code runs in Washington DC, while the database is in Mumbai. `vercel.json` has no `regions`.
- **AI crawlers** (GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot, meta-externalagent) were getting 403 from the Vercel Firewall. The owner fixed this, and all of them got 200 on 2026-10-31.
- **The 29 Oct SEO fixes are committed but not live.** `/category/zz-not-real` still returns 200 and `/s` is still in the sitemap. `vercel.json` sets `git.deploymentEnabled: false`, so deploys are manual.
- **`create-order` overwrites `gatewayOrderId`** (`server/checkout/order.repository.ts`, `attachGatewayOrder`), so a real payment can be rejected.
- **No database backup exists in the repo.** There is no `pg_dump`, backup job or backup bucket. The only R2 buckets in the docs hold images. The Prisma Free plan has no backups.

---

## 2. Clarifications from the owner

### Backups: "we have Cloudflare buckets where we store backups, maybe deferred due to an ops issue"
- Nothing in the repo or docs shows a database backup. The R2 buckets referenced are the image buckets (`R2_BUCKET`, see [OPERATIONS.md](OPERATIONS.md)).
- **Owner check:**
  - R2 dashboard: is there any bucket besides the image ones, and how old is its newest file?
  - Prisma console: Database, then Backups (empty or locked on Free).
- The "ops issue" was very likely the Free plan's query quota, which blocked production on 2026-08-21. A full `pg_dump` reads every table and uses a lot of that quota. **Upgrade to Prisma Starter before nightly dumps.**
- **Target:**
  - Prisma Starter snapshots (fast restore).
  - Plus a nightly encrypted `pg_dump` into an R2 bucket we control (independent of Prisma). If a backup bucket already exists, reuse it.
  - Plus a restore drill.
  - See B3.

### Caching, query optimisation, load testing, e2e and scalable testing
All are in the roadmap. Where each sits, and why:

| Topic | Work | When | Why then |
|---|---|---|---|
| **Query optimisation** | Connection pooler; `pg_trgm` search index; channel matching moved into SQL; keyset pagination; missing indexes | Pooler **before GTM**; the rest in the first 90 days | The pooler stops connection exhaustion on launch day. The channel and listing fixes matter once sellers hold thousands of SKUs |
| **Caching** | Next 16 Cache Components on catalogue reads; prices always computed per request (ADR-0018) | **Quick wins before GTM** (stream similar products, trigram index); full caching in the first 90 days | The project's DB plan puts caching last, because it hides slow queries rather than fixing them. Full caching also needs an ADR: the nonce CSP (ADR-0035) forces dynamic rendering |
| **Load testing** | k6: home → category → product → cart → checkout at 3× expected peak | **A smoke run before GTM**, then before every sale | Proves the database and pool survive a spike before customers find out. Shopify load-tests before BFCM — https://shopify.engineering/scale-performance-testing |
| **E2E testing** | Playwright: browse → cart → checkout (stop at the gateway stub), sign-in, seller list-product, plus axe accessibility checks | **Before GTM**, required to pass before a production deploy | Today a push to `main` ships straight to customers with no journey test — https://playwright.dev/docs/ci |
| **Scalable testing** | Integration tests run in CI (39 of 40 skip today); Lighthouse CI and bundle budgets; query budgets on channel pages; coverage floor on money paths only; Playwright sharding as the suite grows | First 90 days | Proves the DB-enforced invariants on every change, not only on a laptop |

**Tools, all free:**
- **k6** (open source; scripts in JS; runs in GitHub Actions).
- **Playwright** (the de facto standard for Next.js; parallel and sharded; built-in accessibility hooks via `@axe-core/playwright`).
- **Lighthouse CI** (scores every preview against budgets).

---

## 3. Scores per area: what changed and why

### Latency & scale (5.5)
- **Open:**
  - No cross-request caching (no `"use cache"`/`cacheTag`/`revalidateTag`, `cacheComponents` off).
  - The root layout calls `getServerSession` and the main layout reads the wishlist, so every page is dynamic.
  - About 111 of 163 `findMany` calls have no `take`; 10 offset paginations; no cursor pagination.
  - Channel paths load the whole org catalogue (`server/catalog/product.repository.ts`, `listForMatching`, 5 callers) and rank names in JS.
  - "Show more" on listings re-reads every earlier page (`server/channels/channel-listing.repository.ts`).
  - The readiness summary re-scores every product per view (`server/listing/channel-readiness.service.ts`).
  - Pool `max: 10` per instance with no pooler (`server/shared/prisma.ts`).
  - Token renewal holds a row lock during external HTTP (`server/channels/channel-connection.service.ts`).
  - The product page awaits similar products before rendering (`src/app/(main)/product/[slug]/page.tsx`).
- **Partly fixed:** Product indexes on `categoryId`, `createdAt`, `orgId`, `[orgId, archivedAt]`. Still missing: trigram index, and ChannelListing `connectionId`/`goneAt` indexes.
- **Strength:** `tests/integration/db-ops-budget.test.ts` caps query counts in CI.

### SEO & discovery (4)
- **Open:**
  - No JSON-LD anywhere.
  - No `title.template`.
  - The product page has a soft 404: its `generateMetadata` swallows not-found.
  - Googlebot gets the canonical in `<body>`, because Next 16 streams metadata and Googlebot is not in `htmlLimitedBots`.
  - The sitemap has no `lastmod`.
  - The feed lacks `item_group_id`, colour, size, gender, age_group and sale dates; 25 of 105 items lack a `google_product_category`.
  - No Meta Pixel, Conversions API or Meta domain verification.
  - `priority` is deprecated on the hero images.
- **Fixed in code, not live:** category metadata, canonical and 404; `/s` noindex and out of the sitemap; WordPress-era URLs return 410.
- **Fixed live:** AI crawlers unblocked.

### Security (5.5)
All 11 earlier findings are open. New this review: the critical Next.js advisories, `toJSON(secrets)` in CI, and no owner check on payment routes. See B1, B5, B6 and B8.

### Infra & reliability (4)
- **Open:**
  - No backup or restore drill.
  - No R2 protection.
  - No error tracking, health endpoint or alerting.
  - 8 outbound calls without a timeout.
  - The worker deploy is not gated on the web deploy and migration.
  - `CREDENTIAL_KEYS` has no escrow copy.
  - Free/Hobby plans.
  - `validateEnv()` is never called.
- **Better than credited:** Shiprocket and marketplace calls already have timeouts; a rehearsed failed-migration recovery is documented; the staging worker refuses the production DB.

### Compliance (4)
- **Met:**
  - A policies page with a named grievance officer.
  - The total is shown before payment.
  - No card data touched (Razorpay hosted checkout).
  - "Only N left" is real stock, not false urgency.
  - Strong security headers.
- **Missing:** see B11.

### Frontend (7.5) / State & UX (4) / Engineering practice (7)
- **Open:**
  - No in-flight lock in `src/hooks/core/useMutation.ts` or `src/hooks/core/useServerForm.ts`.
  - No `pending` prop on `src/components/ui/button.tsx`.
  - 49 `disabled={…pending}` gates.
  - Only 5 of 79 pages have a `loading.tsx`; no `global-error.tsx`.
  - No timeout or offline mapping in `src/lib/api-client.ts`.
  - Cart store hydration mismatch (`src/store/cartStore.ts`).
  - 186 of 287 components are client components with no ceiling.
  - 10 DAL files import repositories and none import `server-only`.
  - 14 components exceed 300 lines.
  - 35 lint errors, and lint does not block CI.
  - 6 server files import `@/lib/validation/schemas/*` (server → src direction break).
  - 218 `console.*` calls and no structured logger.
  - No e2e tests; 39 of 40 integration files skip in CI.

---

## 4. Owner actions (no code)

| When | Action | Cost |
|---|---|---|
| Now | Deploy `main` (the 29 Oct SEO fixes) | — |
| Now | Vercel Pro (Hobby forbids payments: https://vercel.com/docs/limits/fair-use-guidelines) | $20/seat/mo |
| Now | Prisma Starter (daily snapshots, 7 days: https://www.prisma.io/docs/postgres/database/backups) | $10/mo |
| Now | Check R2 for an existing backup bucket (section 2) | — |
| Now | Copy `CREDENTIAL_KEYS`, `NEXTAUTH_SECRET` and the webhook secrets to a password manager, plus an offline copy | — |
| Now | Create Sentry Developer and UptimeRobot accounts | Free |
| Now | Spend caps or billing alerts on Vercel, Prisma and R2 | — |
| Before GTM | Registered legal entity name, a `grievance@` role mailbox on our domain, and a phone number | — |
| Before GTM | Lawyer/CA: GST invoicing and TCS, the grievance officer role, DPDP dates, Legal Metrology categories, PCI SAQ-A with Razorpay | Professional fees |
| Before GTM | Merchant Center return and shipping settings match `/policies`; Google Business Profile address matches the site; Meta domain verification | — |
| 90 days | Category copy (150–300 words each); own-site product titles instead of marketplace codes; Amazon Brand Registry; review requests after delivery | — |
| Done | Unblocked AI search crawlers in Vercel Firewall (2026-10-31) | — |

**Running cost for GTM-grade infrastructure: about $30/month**, plus professional fees.

---

## 5. Sequenced roadmap

| Week | Code | Owner |
|---|---|---|
| **0** | B1 Next upgrade · B2 region · B8 CI secrets and deploy order | Deploy · Vercel Pro · Prisma Starter · key escrow · backup-bucket check |
| **1** | B5 payments and takeover · B6 rate limiting + Turnstile · B9 double-submit lock and idempotency | Engage lawyer/CA |
| **2** | B7 observability + timeouts · B3 nightly dump + first restore drill · B12 pooler, LCP quick wins, k6 smoke | Sentry, UptimeRobot |
| **3** | B10 SEO core · B11 compliance UI (seller/product details, grievance record) · B8 Playwright smoke + branch protection | Supply legal facts; align Merchant Center and GBP |
| **GTM gate** | All blockers closed; k6 at 3× peak passes; Rich Results Test valid; restore drill done | Sign-off |
| **+90 days** | Section 7 | Content, Brand Registry, reviews |

---

## 6. GTM blockers (must ship before launch)

Each blocker covers **Issue → Impact → Solution → How → Evidence**.

### B1. Critical Next.js vulnerability
- **Issue:** `next@16.3.5` is affected by the critical RCE advisories in section 1.
- **Impact:** anyone on the internet could run code on the server and read every secret (DB, Razorpay, marketplace keys).
- **Solution / How:**
  - Upgrade `next` to ≥16.4.1 and `sharp` to ≥0.35.5 in `package.json`.
  - Run the unit tests and `next build`.
  - Add `npm audit --omit=dev --audit-level=high` and Dependabot to `.github/workflows/ci.yml`.
- **Evidence:** the GitHub advisory above; OWASP A06 Vulnerable and Outdated Components — https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/

### B2. Functions run in the wrong region
- **Issue:** functions run in `iad1` (Washington DC) while the database is in Mumbai.
- **Impact:** about 200 ms per sequential DB round trip. A page with 3 sequential reads pays about 0.6 s before rendering, which on Indian 4G can break the 2.5 s LCP target on its own.
- **Solution / How:** add `"regions": ["bom1"]` to `vercel.json`, then confirm `bom1` in the deployment summary and in the `x-vercel-id` header.
- **Evidence:**
  - Vercel defaults new projects to `iad1` and advises running near the data source — https://vercel.com/docs/functions/configuring-functions/region
  - Speed and revenue: Nykaa saw 28% more organic traffic from T2/T3 cities after a 40% LCP improvement — https://web.dev/case-studies/vitals-business-impact
  - Deloitte: 0.1 s faster on mobile gave +8.4% retail conversion — https://www.deloitte.com/ie/en/services/consulting/research/milliseconds-make-millions.html

### B3. No database backup
- **Issue:** the production database has no backup of any kind.
- **Impact:** one bad migration, or a command against the wrong host, permanently loses every order, payout and listing.
- **Solution:**
  - Prisma Starter snapshots.
  - Plus a nightly encrypted `pg_dump` to an R2 bucket we control.
  - Plus a quarterly restore drill with row-count checks.
  - Write RPO 24h / RTO 4h into [OPERATIONS.md](OPERATIONS.md).
- **How:** a GitHub Actions scheduled workflow:
  1. `pg_dump` over the direct URL.
  2. Encrypt with `age`.
  3. Upload to an R2 bucket with a Bucket Lock. R2 has no object versioning; Bucket Locks are its protection.
  4. Restore into a scratch Postgres and compare row counts.
  5. Alert on failure.
- **Evidence:**
  - GitLab 2017 lost about 6 hours of data because its backups "failed silently" and were never tested — https://about.gitlab.com/blog/2017/02/10/postmortem-of-database-outage-of-january-31/
  - Google SRE: "what people really want are restores" — https://sre.google/sre-book/data-integrity/
  - R2 Bucket Locks — https://developers.cloudflare.com/r2/buckets/bucket-locks/

### B4. Vercel Hobby forbids a store that takes payments
- **Issue:** the store runs on Vercel Hobby.
- **Impact:** the account can be suspended; logs are kept for 1 hour; rollback goes back only one deployment.
- **Solution:** Vercel Pro. Owner action, see section 4.

### B5. Payments and account takeover

| Issue | Impact | Fix (files) |
|---|---|---|
| Every "Pay" click overwrites the gateway order | Buyer is charged and the order expires; a griefer can do this to other people's orders | Reuse the existing unpaid gateway order via a conditional update, or keep every gateway order id. Require the session owner or a guest checkout token on create-order, confirm-free and abandon (`server/payments/payment.service.ts`, `server/checkout/order.repository.ts`) |
| Google sign-in keeps an attacker's password (pre-hijack) | Full account takeover, including seller portals | When Google links to an unverified account, clear the password and revoke sessions (`src/lib/auth-config.ts`, `signIn`) |
| Order lookup returns the order id from guessable `BB-<digits>` codes | The id unlocks payment actions on other people's orders | Drop the id from the lookup response; retire legacy codes or require email plus code |
| Place-order has no idempotency key | A double tap creates two orders and holds stock twice | `Idempotency-Key` header plus a unique column; a replay returns the first result (`[MIGRATION]`, `[CONTRACT]`) |
| Blocked users keep acting on 13 routes | A banned buyer keeps ordering and reviewing | Use `requireSession()` from `src/lib/admin-auth.ts` everywhere, plus a guard test |
| Shiprocket webhook is unsigned | Forged "delivered" events trigger payouts | Verify Shiprocket's token in constant time (`src/app/api/webhooks/shipping/shiprocket/route.ts`) |

**Evidence:**
- Pre-hijacked accounts, USENIX Security 2022 — https://www.usenix.org/conference/usenixsecurity22/presentation/sudhodanan
- OWASP API1 broken object-level authorization — https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- Stripe on idempotency keys — https://stripe.com/blog/idempotency

### B6. No rate limiting or bot protection
- **Issue:** `src/lib/rate-limit/index.ts` sets `RATE_LIMITING_ENABLED = false`.
- **Impact:**
  - Password spraying.
  - Email bombing through our sender domain.
  - Brute force of order codes.
  - Fake orders holding stock.
  - A scraper burning the DB quota. Production was blocked this way on 2026-08-21.
- **Solution / How:**
  - Wire Upstash per `docs/specs/rate-limiting/`: fail closed on auth routes (including the NextAuth credentials callback); fail open with an alert elsewhere.
  - Cloudflare Turnstile on signup, forgot-password and checkout.
  - Vercel Firewall rate rules.
- **Evidence:** OWASP Credential Stuffing Prevention — https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html

### B7. Failures reach nobody
- **Issue:** no error tracking, health endpoint or alerting.
- **Impact:** a checkout 500, a lost webhook or a dead worker is discovered through a customer complaint.
- **Solution / How:**
  - Sentry via `instrumentation.ts` with `onRequestError` (follow `docs/specs/error-tracking/`).
  - Root `error.tsx` and `global-error.tsx`.
  - `/api/health` that does not hit the DB on every ping.
  - UptimeRobot monitor.
  - Worker heartbeat alert, plus alerts on reconcile recoveries and growth of `jobs_failed`.
  - `AbortSignal.timeout` on the unbounded calls in `server/payments/providers/razorpay/razorpay.repository.ts`, `server/catalog/object-store.ts`, `server/shipping/services/provider-auth.ts` and `server/notifications/email.service.ts`.
  - Call `validateEnv()` from `src/lib/env.ts`.
- **Evidence:**
  - Sentry for Next.js — https://docs.sentry.io/platforms/javascript/guides/nextjs/
  - Vercel Hobby log retention is 1 hour — https://vercel.com/docs/logs/runtime

### B8. Deploy safety
- **Issue:**
  - A push to `main` deploys to production with no e2e test.
  - The worker deploys in parallel with migrations.
  - `.github/workflows/ci.yml` passes `toJSON(secrets)` to a shell step.
  - Actions are pinned by tag, not commit SHA.
- **Impact:** a broken checkout ships to customers first, and one compromised action leaks every credential.
- **Solution / How:**
  - Playwright smoke suite on the preview, required before production.
  - Branch protection on `main`.
  - `deploy-worker` needs `deploy`.
  - `prisma migrate deploy` as its own CI step.
  - Pass only named secrets.
  - Pin actions to SHAs; pin the Vercel CLI version; `permissions: contents: read`.
- **Evidence:**
  - The tj-actions/changed-files compromise (CVE-2025-30066).
  - GitHub Actions hardening — https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions

### B9. Double-submit and state screens
- **Issue:** no in-flight protection on mutations, and most pages have no loading or error state.
- **Impact:** duplicate requests on a double tap, and blank screens or endless spinners on slow networks.
- **Solution / How:**
  - In-flight ref lock in `src/hooks/core/useMutation.ts` and `src/hooks/core/useServerForm.ts`. This fixes about 70 files at once.
  - `pending` prop on `src/components/ui/button.tsx`: spinner, `aria-busy`, ignores clicks, never `disabled`.
  - Timeout and offline mapping in `src/lib/api-client.ts`.
  - `src/store/cartStore.ts` hydrates after mount.
  - `error.tsx` and `loading.tsx` for checkout and account. **Never put a `loading.tsx` above a page that calls `notFound()`**: `tests/unit/honest-status.test.ts` enforces this, because it turns a 404 into a soft 404.

### B10. SEO core

| Issue | Fix |
|---|---|
| No structured data, so no price, stock or shipping in results | Product + Offer (price from the same effective-price function that charges, ADR-0018), BreadcrumbList, MerchantReturnPolicy, OfferShippingDetails. Serialise with `<` escaped |
| Weak brand signal ("Bhendi Bazaar" is also a Mumbai neighbourhood) | Organization (logo; `sameAs` Amazon, Flipkart, Meesho, Instagram, GBP) and WebSite SearchAction on `/s?q=`; root `title.template` |
| Product soft 404 | Call `notFound()` inside the product page's `generateMetadata`, as the category page does |
| Googlebot gets the canonical in `<body>` | Add Googlebot to `htmlLimitedBots` in `next.config.ts`; confirm with Search Console URL Inspection |
| `priority` deprecated on hero images | `preload` or `fetchPriority="high"` |

**Evidence:**
- Product structured data — https://developers.google.com/search/docs/appearance/structured-data/product
- Site names — https://developers.google.com/search/docs/appearance/site-names
- Google's structured-data case studies (quote figures from that page) — https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data

### B11. Compliance must-haves *(verify each with a lawyer or CA)*

| Requirement | Today | Fix |
|---|---|---|
| Grievance officer (IT Rules / E-Commerce Rules) | Real name, but a personal Gmail, no phone, and the entity named as "Bhendi-Bazaar.com" (`src/lib/config.ts`, `LEGAL`) | Registered legal name, `grievance@` role mailbox, phone, separate privacy contact |
| Acknowledge a grievance within 48 h, resolve within a month | The contact form stores nothing | `Grievance` record with a ticket code, an auto-acknowledgement email, and an admin list flagging overdue tickets. New model, so it needs a spec |
| Seller name, address and GSTIN on listings | Only "Sold by {org}" (`src/components/product/product-details.tsx`); GSTIN is stored but not shown | A "Seller and product details" block |
| Country of origin, MRP, manufacturer/packer, net quantity, consumer care, "inclusive of all taxes" (E-Commerce Rules, Legal Metrology) | Mostly stored, none shown | Show them; add net quantity and consumer care as facts via a data migration |
| GST tax invoices per seller; TCS under s.52 | None | Decide the invoicing model with the CA; per-seller `TaxInvoice`; TCS as a ledger line in `server/payouts/ledger.service.ts` (integer paise). Touches money, so it needs a spec |
| Incident reporting (CERT-In 6 h; DPDP breach notice) | No runbook | A one-page runbook with contacts and templates |
| Consent before Meta Pixel / GA4 | No consent system (fine today, since no ad tags are loaded) | Consent banner; tags load only after opt-in; Consent Mode v2 |
| Privacy notice (DPDP) | `src/components/support/store-policies.tsx` lists the data collected and the processors | Add the purpose per item, retention periods, the route to complain to the Board, cross-border transfer (functions run in the US today), and an age statement |

**Evidence:**
- Flipkart's grievance page (named officer, address, email, phone, 48 h acknowledgement with a ticket ID) — https://www.flipkart.com/pages/grievance-redressal-mechanism
- DPDP penalties up to ₹250 crore — https://prsindia.org/billtrack/digital-personal-data-protection-bill-2023
- RBI failed-transaction refund deadline (T+5, ₹100 per day after) — https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11693

### B12. Connection pooling, LCP quick wins and a load smoke test
- **Pooler:** use the pooled connection string (Prisma Postgres pooler or Accelerate, already provisioned but unused) and set pool `max` to 1–3 per instance in `server/shared/prisma.ts`. — https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
- **Product page JS (about 240 KB gzipped):**
  - `fetchPriority="high"` on the first image in `src/components/product/product-gallery.tsx`.
  - Drop `libphonenumber` from the client bundle (about 50 KB).
  - `next/dynamic` for lightbox, crop and video.
  - Stream similar products instead of awaiting them.
- **k6 smoke test** at 3× expected peak before launch.

---

## 7. First 90 days after launch

| Theme | Work | Why |
|---|---|---|
| **Caching** | Cache Components with `cacheTag`/`revalidateTag` on catalogue reads (`expire: 0` for withdrawals); prices per request; session and wishlist behind Suspense. ADR first: the nonce CSP versus static shells. Ship `docs/specs/read-caching/` | The biggest TTFB and DB-cost lever; protects the quota when a link goes viral |
| **Search** | `pg_trgm` GIN index on product name; channel name matching in SQL `similarity()`; revisit a search engine past about 100k SKUs | ILIKE scans the whole table on every keystroke — https://www.postgresql.org/docs/current/pgtrgm.html |
| **Channel paths** | SKU lookup by index; keyset pagination for listings; readiness stored on save or cached per org; ChannelListing indexes | Today each view is O(catalogue); a seller with 5k SKUs hits pool timeouts |
| **Performance budgets** | Lighthouse CI on the preview; bundle size per route; k6 journey before each sale | Stops regressions coming back silently |
| **Scalable testing** | Integration tests run in CI against the CI Postgres; the skip count only goes down; Playwright sharding; query budgets on channel pages | Proves the DB invariants on every change |
| **Growth & attribution** | Feed: `item_group_id`, colour, size, gender, sale dates (`server/listing/shopfront-feed.ts`); GA4 + Meta Pixel + Conversions API (server event from the verified-payment handler, de-duplicated by event_id) behind consent; ratings markup above a review floor; video markup | Know which channel makes revenue; win Shopping filters — https://developers.facebook.com/docs/marketing-api/conversions-api |
| **DPDP** | Self-serve export and erasure (keep tax-required records with a reason); retention purge jobs; consent ledger; age statement; processor agreements and cross-border disclosure | Most obligations apply from 13 May 2027 *(verify)*. Build before, not after |
| **Logs** | Structured JSON logger with request and order ids; drain to a 180-day store *(CERT-In: verify the India-residency requirement)* | Investigations and compliance |
| **Security depth** | MFA for admins and org owners; JWT `tokenVersion` revocation with `maxAge` ≤7 days; OWNER/STAFF role matrix; hashed reset tokens; narrow the `/api/auth/` origin exemption (`src/lib/same-origin.ts`); SSRF allowlist on media import (`server/catalog/media-import.service.ts`); upload size caps (`server/catalog/object-store.ts`); `security.txt`; next-auth v5 plan; an external pen test | NIST 800-63B AAL2 — https://pages.nist.gov/800-63-3/sp800-63b.html |
| **Reliability** | SLO (checkout 99.5%) with burn-rate alerts; kill switches (checkout, marketplace sync, enhancement spend); an expand/contract migration convention; a second worker or a paid VM; spend caps; R2 Bucket Lock plus a weekly replica | Google SRE workbook — https://sre.google/workbook/alerting-on-slos/ |
| **Engineering** | Blocking lint; move the validation schemas out of `src/`; retire `src/domain`; split `order.service`; axe in Playwright; Renovate + `knip`; rotate the CHANGELOG (6.8k lines) | Keeps the codebase cheap to change |

---

## 8. Keeping the standard

Gates to add in CI. Each one only ever tightens:
1. `npm audit --omit=dev --audit-level=high` reports 0; Dependabot or Renovate is on.
2. Playwright smoke plus axe must pass before a production deploy.
3. No outbound `fetch` in `server/` without a timeout.
4. In `src/app/api`, `getServerSession` is used only through `requireSession` (allowlist).
5. Mutating hooks use the in-flight lock; the `disabled={pending}` count only falls.
6. `server/**` never imports `@/`; DAL files import `server-only`.
7. The client-component ceiling (186) only falls; file-size ceilings of 300 lines for components and 500 for server files.
8. The integration-test skip count only falls; lint becomes blocking once it reaches zero errors.
9. Coverage floor on `server/checkout`, `server/payments` and `server/promotions` only.
10. Lighthouse budget on product and category pages (LCP ≤2.5 s on mobile); route JS ≤170 KB gzipped.
11. Query budgets (`tests/integration/db-ops-budget.test.ts`) extended to the channel and listing pages.
12. Quarterly: restore drill, worker-rebuild drill, secrets rotation.

**Keep, because it is above the industry norm:**
- Executable invariants: one repository per table, conditional stock, seed guard, migration-drop guard.
- Ratchets that prove they scanned.
- Route reachability.
- The DB query-budget suite.
- Strict TypeScript with zero `@ts-ignore`.
- Nonce CSP.
- A single conditional payment confirmation, backed by an hourly reconcile.

**Trim:**
- The docs (about 390k words) outweigh the code (about 98k lines).
- Rotate the CHANGELOG yearly.
- Keep CLAUDE.md under its cap by pushing detail into the domain files.
- Don't write an ADR for a rule a test already enforces.

---

## 9. Progress checks

| Metric | 31 Oct | GTM target | Check |
|---|---|---|---|
| Critical/high npm advisories | ≥3 (Next.js) | 0 | `npm audit --omit=dev --audit-level=high` |
| Function region | iad1 | bom1 | `x-vercel-id` header (curl below) |
| Newest restorable backup | none | ≤24 h; drill ≤90 days old | Prisma console + dump bucket |
| Time from a production error to an alert | never | ≤5 min | Force a 500 on staging |
| Rate limiting | off | on | `grep -n "RATE_LIMITING_ENABLED =" src/lib/rate-limit/index.ts` |
| Unknown product/category status | 200 | 404 | curl below |
| Pages with JSON-LD | 0 | all product, category, home | curl below |
| LCP p75 mobile | unmeasured | ≤2.5 s | Vercel Speed Insights / PageSpeed Insights |
| TTFB p75 from India | ~350 ms (uncached) | ≤800 ms, then ≤400 ms with caching | curl below |
| Product route JS | ~240 KB gz | ≤170 KB gz | `next build` output |
| Mutating actions with an in-flight lock | 0 | all | unit test: `mutate` called twice in one tick hits the API once |
| E2E journeys gating deploy | 0 | ≥3 | CI |
| Compliance must-haves met | ~3 of 11 | 11 of 11 | B11 table |
| AI crawlers allowed | 200 (fixed) | 200 | curl below |

```bash
B=https://www.bhendi-bazaar.com
curl -sI $B/ | grep -i x-vercel-id                                    # bom1::bom1 target
curl -s -o /dev/null -w '%{http_code}\n' $B/category/zz-not-real      # 404
curl -s -o /dev/null -w '%{http_code}\n' $B/product/zz-not-real       # 404
curl -s $B/sitemap.xml | grep -c '/s</loc>'                           # 0
curl -s $B/product/light-blue-rida | grep -c 'application/ld+json'    # >=1
curl -s -o /dev/null -w 'ttfb=%{time_starttransfer}\n' $B/product/light-blue-rida
for u in OAI-SearchBot/1.0 GPTBot/1.1 PerplexityBot/1.0 ClaudeBot/1.0; do
  curl -s -o /dev/null -w "$u %{http_code}\n" -A "Mozilla/5.0 (compatible; $u)" $B/
done                                                                  # all 200
grep -rnE '"use cache"|cacheTag\(' src server | wc -l                 # >0 after caching
grep -n "toJSON(secrets)" .github/workflows/*.yml                     # nothing
```

---

### About the sources
Every link points to a primary source: vendor docs, standards bodies, regulators, company engineering blogs, or post-mortems. Opened during this review: the GitHub advisories, Vercel region docs, Prisma backups and pricing, Vercel fair use, the RBI circular, the PRS DPDP page and the Flipkart grievance page. The rest are canonical pages cited from known locations; open them before quoting figures externally. Several Indian government sites blocked automated reads, so the CERT-In, E-Commerce Rules, GST and Legal Metrology specifics are marked *(verify)*.
