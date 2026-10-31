# OPERATIONS.md — setup, env, deploy, runbook

- **Verified:** 2026-10-31
- **Covers:** `src/lib/rate-limit/**`, `src/lib/env.ts`, `prisma/seed-guard.ts`, `vercel.json`, `.github/workflows/**`, `next.config.ts`

## Prerequisites
Node 20.x (CI pins `20.x`) · PostgreSQL 14+ · npm · a Razorpay account (test mode for development).

## First-time setup

```bash
npm install                 # postinstall runs `prisma generate`
cp .env.example .env        # then fill in the values from the table below
npx prisma migrate dev      # apply the migrations
npm run dev                 # http://localhost:3000
```

⚠️ **Do not run `npx prisma db seed` casually.** It deletes every table. See [Seeding](#seeding).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `MIGRATE_DATABASE_URL` | ○ | The **direct** connection string (`db.prisma.io`, no `pooled.`), read by `prisma.config.ts` for migrations only. Prisma Migrate takes a session-scoped advisory lock and a transaction pooler gives each statement a different backend session, so the lock can never be acquired and `migrate deploy` dies on a 10s timeout with P1002. Unset locally, where `DATABASE_URL` is already direct |
| `NEXTAUTH_SECRET` | ✅ | JWT signing key. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | Canonical app URL. `http://localhost:3000` locally; the deployed origin in production |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth. Redirect URI: `<NEXTAUTH_URL>/api/auth/callback/google` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | ✅ | Payment gateway. `rzp_test_*` for development |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | ➖ | **Read by nothing.** Marked required here until 2026-09-23; no `process.env` reference exists. The checkout widget is handed the key id in the server's response (`server/payments/providers/razorpay/razorpay.repository.ts`), so setting it changes nothing and leaving it unset breaks nothing |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ | Verifies webhook signatures. Without it the webhook fails closed |
| `SHIPROCKET_WEBHOOK_TOKEN` | ✅ | The security token set in Shiprocket's webhook settings, which Shiprocket sends as `x-api-key`. The tracking webhook refuses (401) any request without it, and refuses everything while it is unset |
| `APP_ENV` | ✅ | The environment, named by us: `local`, `preview` or `production` ([ADR-0037](adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md) D2). **Set it in Vercel for both Preview and Production** — a production build without it refuses to guess, and the admin dashboard's worker card shows "status unavailable" until it is set (it took the whole dashboard down once, PR-158). Defaults to `local` only outside a production build. The worker keys its heartbeat on it. `NODE_ENV` is never set by us: Vercel and Next.js set it to `production` for every build, which is why `APP_ENV` is required there |
| `WORKER_VERSION` | ○ | What the worker reports as its version in its heartbeat — the image tag once it is deployed, `dev` locally |
| `CRON_SECRET` | ➖ | **Read by nothing since PR-210.** Reconciliation moved onto the worker, which calls the domain directly and needs no bearer token; the route it guarded is gone. Safe to remove from the deployment |
| `R2_PUBLIC_BASE_URL` | ✅ | Where a stored image is read from — a custom domain on the Cloudflare zone for each bucket, the production one and `dev.bhendi-bazaar.com` for the development bucket. An `r2.dev` URL also works and is the fallback before a domain is attached, but it can serve no image transformations, which is what background removal is (`IMAGE_SEGMENT_PROVIDER`). **Also feeds `next.config.ts` `remotePatterns` at build time**, so a wrong value 404s every image at the optimizer with no error anywhere |
| `R2_ENDPOINT` | ✅ | The S3 API endpoint, `https://<account-id>.r2.cloudflarestorage.com`. Not public — never used to build an image URL |
| `FFMPEG_PATH` / `FFPROBE_PATH` | — | Worker only, optional. Where the transcoder's binaries are when they are not on `PATH` ([ADR-0039](adr/0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md)); the image installs ffmpeg as an OS package, so neither is set there |
| `R2_BUCKET` | ✅ | Bucket name |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | ✅ | R2 API token with read+write on that bucket |
| `IMAGE_SEGMENT_PROVIDER` | ○ | Which service cuts a product out of its background for the `cut out`, `on white` and `studio` improvements: `zone` — the image host's own delivery transform on the custom images domain, free to 5,000 a month — or `model`, the hosted vision model. **Defaults to `zone`**, and whichever is asked for, the other runs when it is not set up. An unrecognised value is the default rather than an error: it is a preference, not a credential |
| `IMAGE_MODEL_API_KEY` | ○ | The key for that hosted vision model. Setting it is the whole of what makes `model` available; without it only the image host's transform can run, which means **on an `r2.dev` base nothing can**, since that host serves objects and transforms none. Set it locally, or background removal is unavailable in development. The same key buys the **scene** improvement, which has no free route at all — no key, no scenes anywhere, and the account behind it needs a *balance* as well as a key (see [A scene costs money](#a-scene-costs-money)) |
| `IMAGE_MODEL_ENDPOINT` | ○ | Where those model requests go. Unset, the code uses the service's public host; set it to point at a proxy or a staging host without a release |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | ➖ | **Read by nothing today.** Rate limiting is detached (`src/lib/rate-limit/index.ts`) — set these only when reconnecting it, and see the naming trap below |
| `ENCRYPTION_KEY` | ○ | Decrypts shipping credentials stored before 2026-10-20 only (`server/shared/crypto.ts`). Keep it set while any such row exists; new values use `CREDENTIAL_KEYS` |
| `CHANNELS_CONNECT` | ○ | Marketplaces open to connect, comma-separated (`amazon,flipkart`); empty or unset means none (`server/channels/channel-availability.ts`). The only switch for marketplace connections |
| `AMAZON_APP_ID` / `AMAZON_APP_SECRET` | ○ | Amazon SP-API Login with Amazon client id and secret (Developer Central → app → LWA credentials). Unset means Amazon shows as unavailable |
| `AMAZON_SOLUTION_ID` | ○ | The Amazon app's own id, `amzn1.sp.solution…`, used in the consent link |
| `FLIPKART_APP_ID` / `FLIPKART_APP_SECRET` | ○ | Flipkart third-party app (Partner portal → Manage API Access). Unset means Flipkart shows as unavailable |
| `CREDENTIAL_KEYS` | ✅ | Encrypts secrets at rest (carrier passwords, marketplace tokens): comma-separated `version:64-hex` pairs; the highest version encrypts, every listed one decrypts. Generate with `openssl rand -hex 32`. Same value on the site and the worker; losing it means every shop reconnects. To rotate, add a higher version and keep the old until the daily job has re-encrypted |
| `RESEND_API_KEY` / `EMAIL_FROM` | ✅ | Transactional email |
| `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` | ○ | Only if connecting Shiprocket by env rather than through the admin UI |
| `NEXT_PUBLIC_APP_URL` | ✅ | The app's public origin. **Every outbound link is built from it** — verification, password reset, order tracking (`server/shared/app-url.ts`, `appUrl()`). Unset and email sends throw rather than mailing `undefined/...` |
| `DATABASE_POOL_MAX` | ○ | Connections each server instance may hold (`server/shared/prisma.ts`). Unset keeps 10 in production. Set 3–5 once `DATABASE_URL` is the **pooled** string, so many instances cannot exhaust the database's connections. Never below 3 (refused, with an error in the log): a transaction holding one connection can need a second, and two checkouts at once would wait out the pool. Web only; leave it unset for the worker, whose four concurrent jobs need the default |
| `APP_COMMIT` | ○ | The deployed commit, for `/api/health?deep=1`. Unset on Vercel, which supplies its own (`server/shared/deployment.ts` falls back to it); set it on any other host |
| `VERCEL_GIT_COMMIT_SHA` / `NEXT_RUNTIME` | ➖ | Set by the platform, never by us. Read only through `server/shared/deployment.ts` and by `src/instrumentation.ts`, which checks the environment in Node, not in middleware |
| `PROD_ADMIN_EMAIL` / `PROD_ADMIN_PASSWORD` | ○ | Read by `prisma/seed/prod.ts`, the one-off bootstrap that grants platform ADMIN where an environment has none. Set them for that single run and unset them afterwards. Until 2026-09-23 that script hashed the literal `'STRONG_RANDOM_PASSWORD'`, so anyone who could read the repository knew the admin password — CLAUDE.md Invariant 7's "no credential literal lives in a seed", broken in the one script that may legitimately be pointed at production. It now refuses a placeholder value, refuses to run without both variables, and will **not** reset the password of an account that already exists |
| `SEED_ALLOW_DESTRUCTIVE` | ○ | Set to `1` to let `prisma/seed.ts` wipe and reseed. **Never set in a deployment environment** |
| `SEED_ALLOWED_DATABASE_URL` | ○ | The exact development connection string. Required to seed any non-localhost database — see below. **Never set in a deployment environment** |
| `CSP_REPORT_ONLY` | ○ | `1` downgrades the Content-Security-Policy to `Content-Security-Policy-Report-Only`, so violations are reported and nothing is blocked (`src/lib/security-headers.ts`). The escape hatch if a policy change breaks a page in production — it needs no code change and no rebuild. **Leave unset normally**: report-only enforces nothing |
| `ORG_HANDLE_HOLD_DAYS` | ○ | How long a retired org handle is held before returning to the pool — redirecting and unavailable to others until then, 404 after ([ADR-0030](adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md)). Defaults to 180 |
| `PRISMA_LOG_QUERIES` | ○ | `1` prints every SQL statement, so you can count the billed operations a page costs. **Development only** — never set in a deployment. It is also the instrument `tests/integration/db-ops-budget.test.ts` measures through |
| `BLOCK_CRAWLERS` | ○ | Pre-launch only. `1` turns every compliant crawler away: robots.txt disallows all, the sitemap goes empty, and every response carries `X-Robots-Tag: noindex, nofollow` (`src/lib/crawl-block.ts`). **Delete at launch** — while set, the 410 purge of the old WordPress index is paused, and the site cannot be indexed |
| `GOOGLE_VERIFICATION_TOKEN` | ○ | The content value of Google Search Console's HTML-meta verification tag. Rendered into the page `<head>` (`src/app/layout.tsx`) only when set; unset, no tag is emitted |

`.env.example` and `.env.production.example` are the committed shape of this table — copy one and fill it in. They carry sample values only, and `.gitignore` admits just those two out of `.env*`. `src/lib/env.ts` holds the required-variable list (every ✅ row above), kept in step with this table. `src/instrumentation.ts` checks it once per server start and logs `[startup] Missing required environment variables: …` as an error. It logs rather than refuses to start until every name is confirmed set in production; then `register()` should throw.

### Local development database
Development runs against a local Postgres, never a metered cloud one — a hot-reload session against Prisma Postgres is what exhausted the workspace's operation quota in August 2026 (CHANGELOG PR-70). One-time setup:

```
docker start bhendi-pg      # or: docker run --name bhendi-pg -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=bhendi_bazaar_dev -p 5433:5432 -d postgres:16
# .env
DATABASE_URL="postgres://<your-user>@localhost:5432/bhendi_bazaar_dev"
npx prisma migrate deploy
SEED_ALLOW_DESTRUCTIVE=1 npx prisma db seed
```

`PRISMA_LOG_QUERIES=1` makes the Prisma client print every SQL statement, so you can count the billed operations a page costs. Dev-only; never set in a deployment. `tests/integration/db-ops-budget.test.ts` pins the per-call budgets.

### ⚠️ Seeding
`prisma/seed.ts` deletes every table, so it refuses to run unless the target is named (Invariant 7). Wiping is its own gate:

```
SEED_ALLOW_DESTRUCTIVE=1
```

On localhost, only the database **named** `bhendi_bazaar_dev` may be seeded — a local hostname alone proves nothing when the same server hosts unrelated work databases. For a cloud development database, name the exact connection string as well:

```
SEED_ALLOWED_DATABASE_URL=<the exact same string as your dev DATABASE_URL>
```

`SEED_ALLOWED_DATABASE_URL` exists because **hostname cannot tell dev from production here** — Prisma Postgres serves both from `db.prisma.io`, so allowing the host would allow production. Matching the full connection string identifies one specific database. Keep these variables in your local `.env` only; production stays protected precisely by never having them.

To seed reference data that production also needs, do not reach for the seed — write a data migration. `vercel.json` runs `prisma migrate deploy` before the build, so a migration reaches every environment on merge, while the seed reaches none of them.

### Setting up the R2 bucket
Images live in Cloudflare R2 ([ADR-0028](adr/0028-images-live-in-cloudflare-r2.md)). From a fresh Cloudflare account:

**1. Create the bucket.** Dashboard → R2 → *Create bucket*. Name it (e.g. `bhendi-bazaar`) and pick a location hint near your buyers (APAC for India). → `R2_BUCKET`.

**2. Mint an API token.** **Not inside the bucket** — this trips people up. Go to the **R2 object storage** page (the one listing your buckets), find the **Account Details** panel, and select **Manage** next to **API Tokens** → *Create Account API token*. A *User* API token also works but is tied to one person's login; an account token is not.

Permission **Object Read & Write** — not Admin, since the app only reads and writes objects and never manages buckets. That permission level then lets you **scope the token to specific buckets**; pick just this one.

- Access Key ID → `R2_ACCESS_KEY_ID`
- Secret Access Key → `R2_SECRET_ACCESS_KEY` — **shown once**, and only rotatable afterwards, never retrievable
- Account ID, also in the Account Details panel → `R2_ENDPOINT` is `https://<account-id>.r2.cloudflarestorage.com`, **without** the bucket name; the code appends it

If you are looking at something that asks you to *supply* a secret rather than generating one, that is Workers secrets — a different feature.

**3. Turn on public read.** Bucket → Settings → Public access.

- *Developing:* attach a custom domain to the development bucket too — `dev.bhendi-bazaar.com` is on the same zone, so it costs nothing and the image transformations work there exactly as in production. The **r2.dev subdomain** is the fallback before that: Cloudflare rate-limits it, says not to use it in production, and serves no transformations, so background removal is unavailable on it.
- *Production:* add a **custom domain**. See below — it needs the zone on Cloudflare DNS first. That URL becomes `R2_PUBLIC_BASE_URL`.

#### Putting the custom domain on Cloudflare DNS

R2 refuses a domain it does not host DNS for: *"Public bucket access supports only domains on your account and managed through Cloudflare DNS."* The registrar stays GoDaddy; only the nameservers move. No domain transfer.

**Use a subdomain — `images.bhendi-bazaar.com`, never the apex.** Attaching `bhendi-bazaar.com` itself would point the storefront's apex at the bucket, and the shop would start serving image files.

1. **Export the zone from GoDaddy first** — do not rely on Cloudflare's scan. DNS cannot be enumerated, so the scan guesses at common names and routinely misses the ones that matter. GoDaddy's DNS page has an *Export* action; keep that file until the migration is verified.

   For this domain the records that a scan can miss, and what each costs:

   | Record | Purpose | Lost means |
   |---|---|---|
   | `TXT resend._domainkey` | Resend DKIM | Transactional email keeps sending and starts landing in spam |
   | `MX send` → `feedback-smtp.*.amazonses.com` | Resend bounce handling | Bounces stop being processed |
   | `TXT send` → `v=spf1 include:amazonses.com ~all` | Resend SPF | Same, quietly |
   | `MX` apex (two records) | Inbound mail | Inbound email silently lost |

   Copy `MX` priorities exactly — this domain has two at the apex and the lower number wins, so reversing them reroutes all inbound mail.
2. Cloudflare → **Add a site** → `bhendi-bazaar.com`, Free plan. Compare the scanned records against your list and fix the gaps **before** switching.
3. **Keep every Vercel record DNS-only (grey cloud).** Vercel [advises against a reverse proxy in front of it](https://vercel.com/kb/guide/cloudflare-with-vercel) — an orange-clouded record is the usual cause of "Invalid Configuration" and failed certificate generation, and it puts two CDNs in series.
4. Change the nameservers at GoDaddy to the two Cloudflare gives you. Activation is usually under an hour, occasionally up to 24.
5. Once active: R2 → bucket → Settings → Public access → **Custom domain** → `images.bhendi-bazaar.com`. Cloudflare creates the record itself. **This one is proxied (orange) and must be** — that is how R2 serves it, and it is unrelated to rule 3, which is about the records pointing at Vercel.
6. Set `R2_PUBLIC_BASE_URL=https://images.bhendi-bazaar.com` and **redeploy** — `next.config.ts` reads it at build time.

Until this is done, `r2.dev` works. It is rate-limited and Cloudflare says not to use it in production, so it is a way to defer the DNS move, not to skip it.

**4. Add a CORS policy — the step that is easy to miss.** The bulk wizards PUT straight from the browser to the bucket, and *CORS applies to presigned URLs*: without this, uploads fail even though the URL is valid. Bucket → Settings → CORS Policy → *Add CORS policy* → JSON:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://bhendi-bazaar.com"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Every origin that uploads must be listed — add Vercel preview URLs if you upload from them. Only `PUT` is needed: reads are plain public GETs and are not a CORS matter.

**5. Set the five variables** locally and in Vercel (see the table above), then redeploy. `R2_PUBLIC_BASE_URL` is read by `next.config.ts` **at build time** for `remotePatterns`, so a change to it needs a new build, not just a restart.

**6. Smoke-test before trusting it.** Upload one image through the admin UI. That exercises the whole path — presign, PUT, public URL, optimizer — and is where a wrong endpoint or a missing CORS rule shows up. Then check the image renders on the storefront, which proves `remotePatterns` too.

### Images left behind on the retired store
The Vercel Blob store is gone: the package, its migration script, the hostname in
`next.config.ts` `remotePatterns` and its entry in the CSP's `img-src` were all removed once the
store began answering `403` to its own contents — at which point allow-listing it protected
nothing, because the bytes were unreachable either way.

A row can still *hold* one of those dead URLs. **It does not render as a broken image — it
throws.** `next/image` has no degradation path for a host missing from `remotePatterns`: it
raises `Invalid src prop` during render, which unmounts the page rather than the one picture.
One leftover `Banner.imageUrl` blanked both the storefront homepage and `/admin/banners` —
the page the remedy below has to be carried out on. Since PR-121 the banner surfaces route
their stored URL through `isRenderableImageUrl` (`server/catalog/image-paths.ts`), so a dead
one reads as "no image" and the admin row says *Image needs re-uploading*. Since PR-148
`Product.thumbnail` and `ProductMedia.ref` are guarded where products are mapped for display
(`src/data-access-layer/products.dal.ts` and its org-portal counterpart): a dead thumbnail
becomes the brand mark and a dead photo is dropped from the gallery, so saving the product's
edit form clears it from the row. Search suggestions, wishlist, cart, bidding and order lines
carry the thumbnail by other paths and **are not yet guarded**, and neither are the other five
columns — any of them will still take a page down. Eight columns can hold one: `Category.heroImage`, `Product.thumbnail`, `ProductMedia.ref`, `Profile.profilePic`,
`Org.logoUrl`, `OrderItem.thumbnail`, `ShippingProvider.logoUrl`, `Banner.imageUrl`. To find them:

```
SELECT 'Banner' AS t, id, "imageUrl" AS url FROM "Banner" WHERE "imageUrl" LIKE '%blob.vercel-storage.com%'
UNION ALL SELECT 'Category', id, "heroImage" FROM "Category" WHERE "heroImage" LIKE '%blob.vercel-storage.com%'
UNION ALL SELECT 'Product', id, thumbnail FROM "Product" WHERE thumbnail LIKE '%blob.vercel-storage.com%'
UNION ALL SELECT 'ProductMedia', id, ref FROM "ProductMedia" WHERE ref LIKE '%blob.vercel-storage.com%'
UNION ALL SELECT 'Profile', id, "profilePic" FROM "Profile" WHERE "profilePic" LIKE '%blob.vercel-storage.com%'
UNION ALL SELECT 'Org', id, "logoUrl" FROM "Org" WHERE "logoUrl" LIKE '%blob.vercel-storage.com%'
UNION ALL SELECT 'OrderItem', id, thumbnail FROM "OrderItem" WHERE thumbnail LIKE '%blob.vercel-storage.com%'
UNION ALL SELECT 'ShippingProvider', id, "logoUrl" FROM "ShippingProvider" WHERE "logoUrl" LIKE '%blob.vercel-storage.com%';
```

The remedy is to re-upload the image through the admin UI, which writes an R2 URL. There is no
recovery path through the old store — its contents cannot be read, which is the whole reason for
ADR-0028. Run this against **production and development separately**; they are different databases.

### ⚠️ Why the Vercel Blob store is retired (historical)
Vercel Blob meters **Data Transfer** — bytes served *out* of the store — against a monthly allowance (10 GB on the free tier; Vercel documents the wait after an overrun as 30 days, so treat the reset as a rolling window rather than a calendar month). On the free tier, exceeding it does not bill: it **blocks further transfer** with `403`, so every product image on the storefront goes blank — and so does your own ability to read the store's contents, which is what makes exporting after the fact impossible. It was exhausted pre-launch in September 2026; [ADR-0026](adr/0026-images-are-delivered-through-the-optimizer.md) has the causes and the fix.

Images now live in Cloudflare R2, which has no egress meter at all ([ADR-0028](adr/0028-images-live-in-cloudflare-r2.md)), so this failure mode is gone rather than managed. Kept because the reasoning transfers: two things moved that meter, and both still apply to whatever store you are on.

- **A delivery regression.** Anything serving an original instead of an optimized derivative — a raw `<img>`, an `unoptimized`, a `fill` with no `sizes`. `tests/unit/image-delivery.test.ts` fails the build on all three, so a jump with that suite green means something outside `src/` is fetching.
- **Your own dev traffic.** `localhost` reads the same Blob URLs as production, so image-heavy local work and repeated bulk-upload runs draw on the same meter.

Image *optimization* is a separate quota with its own limit. If images break again and Blob transfer looks healthy, look there next.

### ⚠️ Rate limiting is detached — every endpoint is unthrottled
`src/lib/rate-limit/index.ts` exports limiters that allow every request and a
`RATE_LIMITING_ENABLED === false` flag. Call sites that read `apiRateLimit`, `authRateLimit`,
`paymentRateLimit` or `withRateLimit` still compile and still *look* like protection in the
handler source; none of them rejects anything. Nothing imports `@upstash/*`. This is deliberate —
the previous arrangement failed open silently and keyed on a caller-supplied header — but it means
**signup, password reset, verification resend, order lookup, payment-order creation, bid placement,
shipping-rate quoting and stock checks are all unthrottled in production.** Treat that as a live
exposure, not a backlog item; `tests/unit/rate-limit-detached.test.ts` asserts the state so it
cannot quietly become half-true. Reconnecting is [rate-limiting](specs/rate-limiting/).

**When you reconnect it — the Upstash naming trap.** Wire `./upstash`, which reads
**`KV_REST_API_URL`** and **`KV_REST_API_TOKEN`** — the names Vercel's Upstash integration
provisions. Upstash's own dashboard calls them `UPSTASH_REDIS_REST_URL` / `_TOKEN`; using those
names leaves the limiter unconfigured. Use the names in the table.

### Two origin variables, two jobs
`NEXTAUTH_URL` is **NextAuth's own** configuration — it builds OAuth callback URLs and nothing else should read it. `NEXT_PUBLIC_APP_URL` is the app's public origin, used for links that leave the server. They hold the same value locally and *must* diverge on Vercel previews, so keep the responsibilities separate.

**The dev port is pinned:** `npm run dev` runs `next dev -p 3000`. This is deliberate. Google OAuth matches the registered redirect URI exactly (`http://localhost:3000/api/auth/callback/google`), so the port is a contract with an external service, not a preference. Unpinned, `next dev` silently falls back to 3001 when 3000 is busy — the app then serves from one port while both origin variables claim another, which breaks OAuth *and* puts the wrong host into every verification and reset email sent that session. Pinned, it fails loudly instead.

**Vercel previews:** preview deployments get dynamic origins, so a fixed `NEXTAUTH_URL` cannot match and OAuth will fail there. NextAuth v4 does not infer it — derive it from `VERCEL_URL` when `VERCEL_ENV === "preview"`. (NextAuth v5 removes the variable entirely, inferring the origin from request headers.)

### Local webhook testing (tunnel)
Gateway and courier webhooks need a publicly reachable URL, so local testing needs a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000     # or: ngrok http 3000
```

Then, for the duration of that session:

1. Set **both** `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to the tunnel origin. Leaving them on `localhost:3000` means OAuth callbacks and emailed links resolve to a host the outside world cannot reach.
2. Add `<tunnel>/api/auth/callback/google` to the Google Cloud Console redirect URIs, or Google sign-in fails with a mismatch error that does not name the expected value.
3. Point the gateway webhook at `<tunnel>/api/webhooks/razorpay` and the courier webhook at `<tunnel>/api/webhooks/shipping/shiprocket`.
4. Restart the dev server — `NEXT_PUBLIC_*` values are inlined at build time, so a change is not picked up by a running server.

Tunnel URLs are ephemeral on free tiers; each restart means repeating steps 1–3. Revert `.env` afterwards, or the next non-tunnelled run mails links to a dead host.

### Set in admin, not in the environment: the enhancement allowance and the daily cap
How many photo enhancements a shop may run in a month, and what every shop together may spend in a
day, are rows in the database and are edited at `/admin/enhancements` — not variables, because they
are the answer to a provider bill and that answer should not wait for a deploy. **With no settings
row the code falls back** to 300 a month and ₹500 a day (`FALLBACK_MONTHLY_ALLOWANCE` /
`FALLBACK_DAILY_CAP_PAISE` in `server/content/enhancement.types.ts`), so a fresh database works and
the first save on that screen is what makes the numbers the platform's. A shop with no row of its
own follows the platform's number; one with a row has been given an allowance of its own or paused.
Nothing here needs seeding.

### Choosing a cut-out service: the bake-off
Which service cuts a product out is the platform's choice and changes no screen
([image-enhancement](specs/image-enhancement/) R8). To choose it on evidence rather than on claims,
run the same real photographs through every service that is set up:

```bash
npm run enhance:bakeoff -- --org <orgId> --limit 20
```

It prints the shop's name and how many photographs it will use before it starts, then takes that
shop's newest ready images, runs each available service over every one, and prints the URL of a page
that lays them out side by side — the original, then each service's cut-out shown twice, on mid-grey
and on white, with the service's key and how many milliseconds it took. Grey is where a halo and a
missed edge show; white is what the result is actually for.

It writes nothing to the database and creates no library image: everything lands under a
`bakeoff/<runId>/` prefix in the object store, so cleaning up is deleting that prefix. It does spend
real money on any service that bills per image, which is what `--limit` is for. Set
`IMAGE_SEGMENT_PROVIDER` to the winner afterwards; nothing else changes.

### A scene costs money

Every other improvement is free or nearly so: `light` and `enlarge` run on our own CPU, and a
cut-out is free to 5,000 a month on the image host. **A scene is not.** One run pays a hosted model
about **₹3.50** to paint the setting (`SCENE_PAINT_PAISE`), plus about ₹0.18 for the cut-out when
that came from the paid model rather than the image host's transform — so a scene run is roughly
₹3.50 and the ledger records the two together, which is also what the platform's daily cap counts.
At the default cap of ₹500 a day that is about 140 scenes across every shop.

That money is a **balance on the image-model account**, and a key alone does not make one. With a
key and no balance the request is accepted, the worker runs, the service refuses, and the run is
marked failed — which costs the shop nothing (a failed run is the one state that does not count
against its month) and shows the member one line in the improve sheet:

```text
The picture service is out of credit. Ask the platform owner to top it up.
```

That sentence is deliberate: it names something the platform owner can do rather than telling a
shop to try again at a service that will refuse again. With **no key at all** the tools list still
offers "In a scene", and choosing a setting is refused before anything is spent with
`Scene backdrops are not set up yet`. Nothing else is affected either way — the other five
improvements keep working.

### Env hygiene
`.env*` is gitignored and has never been committed — keep it that way. Set `NODE_ENV` to a valid Node value (`development` / `production` / `test`); anything else silently changes behaviour in code that branches on it. Avoid keeping more than one live connection string in the file at a time — see [Seeding](#seeding) for why.

## Local PostgreSQL via Docker

```bash
docker run --name bhendi-pg -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=bhendi_bazaar -p 5432:5432 -d postgres:16
pg_isready -h localhost
```
Then `DATABASE_URL="postgresql://postgres:password@localhost:5432/bhendi_bazaar?schema=public"`.

## Everyday commands

```bash
npm run dev            # dev server
npm run worker         # the job worker, against the same DATABASE_URL (worker-foundation)
npm run build          # production build
npm start              # serve the build
npx tsc --noEmit       # typecheck
npm run lint           # ESLint
npm run test:run       # tests (single run)
npx prisma studio      # database GUI
npx prisma migrate dev # create + apply a migration
```

## Seeding

`prisma/seed.ts` begins by deleting every table, and `prisma.config.ts` wires it to `DATABASE_URL` from `.env` (Prisma 7 reads the seed command from `prisma.config.ts`, not `package.json`).

**Read `DATABASE_URL` and confirm it points at localhost before every seed.** The guard described in [Invariant 7](../CLAUDE.md) makes this automatic; until it is in place, the check is manual and there is no undo. Seeded credentials are defined in `prisma/seed/users.seed.ts` — never use them anywhere reachable from the internet.

## Creating an admin user

`npx prisma studio`, open `User`, and set `role: "ADMIN"` and `isEmailVerified: true` on an account created through normal sign-up, so the password hash is generated by the app rather than by hand.

## Connecting a shipping provider

1. Go to `/admin/shipping/providers`.
2. Each card shows connection state, priority, supported modes, and coverage.
3. Connect with provider credentials — stored AES-256-GCM encrypted.
4. Only configured providers can be enabled; changes take effect immediately.

This makes **rate quoting** live. Shipment booking currently uses a mock implementation — see [ARCHITECTURE.md](ARCHITECTURE.md) and [shipping-fulfilment](specs/shipping-fulfilment/).

## The worker

The job queue is a set of tables in the application's own Postgres, in the `pgboss` schema, and
the worker is a second process that runs them ([ADR-0038](adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [worker-foundation](specs/worker-foundation/)).

**What runs here.** Five job types, registered in `worker/main.ts` and owned by the domain each
belongs to: a no-op `ping`, the media sweep, video transcoding, photo enhancement, and the payment
reconciliation that used to be a Vercel cron. The video and enhancement ones decide what the
machine needs. Transcoding wants ffmpeg, which the image carries as an OS package.
Enhancement wants the same three `IMAGE_*` variables the web app has, because the web app only
checks a tool is available and then queues it — set them in one place and not the other and every
run fails on the half that is missing. Both are in `.env.worker.example`.

- **Locally:** `npm run worker` beside `npm run dev`, same `DATABASE_URL`. It logs the job types it
  knows and writes a heartbeat row the admin dashboard reads. Send it a no-op with a `ping` job from
  any transaction (`server/shared/jobs/ping.job.ts`).
- **The schema is ours to migrate.** `prisma/migrations/20260926100000_worker_foundation/` holds
  pg-boss's construction plan verbatim. Upgrading pg-boss means exporting its migration plan into a
  new Prisma migration; the library's own runtime migration is switched off and must stay off.
- **Every timer is set in `server/shared/jobs/jobs.config.ts`**, and `tests/unit/jobs-config.test.ts`
  fails if one is shortened or left to a default: the database bills every poll.
- **ffmpeg is in the image** for hosted video ([ADR-0039](adr/0039-video-is-stored-in-our-object-store-and-transcoded-by-the-worker.md)): a Debian package, pinned by the base image's release. Transcodes run one at a time — the free machine has the CPU for one — and `tests/unit/video-transcode.test.ts` runs the real binary, so a laptop without ffmpeg (`brew install ffmpeg`) skips that one suite while CI never does.
- **Schedules are in-process timers that enqueue a job** (`server/shared/jobs/jobs.schedule.ts`),
  never pg-boss's cron: the floor is one tick an hour and the count is budgeted in the idle estimate.
  The worker logs them at start. Two are registered. `media.sweep`, every six hours: uploads that
  never confirmed go after an hour, and a retired image's stored object goes after thirty days.
  `payment.reconcile`, hourly: every checkout stuck past the fifteen-minute hold window is put to
  the gateway, so a payment whose webhook was lost is confirmed and a genuinely abandoned one
  gives its stock back. It ran daily as a Vercel cron until PR-210, because the free plan allows
  no more; an hour is the schedule floor here and the idle estimate has no room below it, so
  going faster means raising that ceiling, which is a decision (ADR-0038 D8).
- **Failed jobs** park in the `jobs_failed` queue after five attempts. The dashboard card shows the
  count and re-runs them; each re-run is an audit entry.
- **Direct connections.** The worker needs the direct connection string (notify is session-bound);
  it takes three pooled connections plus one listener of the five the plan allows.

### The worker's image

`infra/worker/Dockerfile` builds it: dependencies from the lockfile, the Prisma client generated,
then only `server/`, `worker/` and `prisma/` on a Node 22 base, run with `node --import tsx`. The
`deploy-worker` job in `.github/workflows/ci.yml` builds it for arm64 and amd64 on every push and
pushes `ghcr.io/<owner>/bhendi-bazaar-worker:<sha>` and `:<branch>`. Build it yourself with
`docker build -f infra/worker/Dockerfile .`; run it anywhere with the env file below. It is about
1.1 GB because it carries the whole lockfile's dependencies; trimming to the worker's own set was
left until a second job type existed, and four now do — ping, the media sweep, video transcoding
and photo enhancement — so it is work that is owed rather than work that is waiting.

### The worker's machine

An Ubuntu 24.04 virtual machine the project administers, provisioned and rebuilt by
`infra/worker/provision.sh` (worker-foundation R7, trd D8). The current machine is an Oracle Cloud
Always Free instance in **India West (Mumbai)**, the database's region, on a Pay As You Go account.
That is a deployment fact ([ADR-0037](adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)); nothing in the repository knows it.

**Account setup, once.** After the Pay As You Go upgrade completes:

1. **Budget alert.** Billing → Budgets → a monthly budget of 1 USD with an alert rule at 100% to your
   email. Budgets alert; they do not stop spending.
2. **Quotas are the brake.** Governance → Quotas → a quota policy on the tenancy that forbids anything
   the free tier does not cover. Oracle refuses a request over quota rather than billing it. The
   Always Free allowance is 2 Ampere OCPUs with 12 GB, or the two AMD micro instances, and 200 GB of
   block storage; set the quotas to exactly that, so a rebuild is delete-then-create and two machines
   can never coexist and bill:

   ```text
   zero compute-core quotas /*/ in tenancy
   set compute-core quota standard-a1-core-count to 2 in tenancy
   set compute-core quota standard-a1-core-regional-count to 2 in tenancy
   set compute-core quota standard-e2-micro-core-count to 2 in tenancy
   zero compute-memory quotas /*/ in tenancy
   set compute-memory quota standard-a1-memory-count to 12 in tenancy
   set compute-memory quota standard-a1-memory-regional-count to 12 in tenancy
   zero block-storage quotas /*/ in tenancy
   set block-storage quota total-storage-gb to 200 in tenancy
   zero database quotas /*/ in tenancy
   ```

   The two `-regional-count` names are the ones Oracle actually checked when the first instance was
   created on 2026-09-26: a wildcard `zero` covers them too, so each needs its own `set`, or the
   create fails with "compartment quotas were exceeded" naming them. The micro shape has no
   regional variant; Oracle rejects that name.
3. **The idle rule.** Oracle reclaims Always Free instances that stay under 20% CPU, network and
   memory for seven days. The Pay As You Go account is the commonly reported protection; the
   provisioning script is the fallback — a reclaimed machine is a ten-minute rebuild.

**The machine, once (and again after a loss).**

1. Networking → Virtual Cloud Networks → wizard, "Create VCN with Internet Connectivity". In the
   public subnet's security list keep inbound to SSH (22) only.
2. Compute → Instances → Create: image Ubuntu 24.04 (Always Free eligible); shape
   `VM.Standard.A1.Flex`, 2 OCPUs, 12 GB — if Mumbai has no capacity, `VM.Standard.E2.1.Micro`;
   public IPv4 assigned; your SSH public key pasted; 50 GB boot volume.
3. Networking → IP Management → Reserved Public IPs: reserve the address, so a rebuilt machine keeps
   it and no secret changes.
4. From a terminal, as `ubuntu`: copy `infra/worker/` to the machine and run `sudo ./provision.sh`.
   It is idempotent; re-run it after any change to the script.

**GitHub repository secrets the deploy needs.**

| Secret | Holds |
|---|---|
| `WORKER_HOST` | The reserved public IP |
| `WORKER_SSH_USER` | `ubuntu` on that image |
| `WORKER_SSH_KEY` | A private key whose public half is in the machine's `authorized_keys`. Generate one for the pipeline alone; never reuse a personal key |
| `WORKER_ENV_<NAME>` | **One secret per worker variable**, named for it: `WORKER_ENV_DATABASE_URL` (the **direct** string of the production database), `WORKER_ENV_CREDENTIAL_KEYS`, and so on for every name in `.env.worker.example`. The deploy writes `NAME=value` for each (`infra/worker/compose-env.sh`), so changing a value is editing one secret. **The workflow names each secret it passes**, never `toJSON(secrets)`, so a secret for a new variable is read only once its line is added to the step's `env:` in `ci.yml` (and `WORKER_STAGING_ENV_` in `staging-worker.yml`); `.env.worker.example` is the complete list and `tests/unit/deploy-safety.test.ts` holds both workflows to exactly it |
| `WORKER_ENV_FILE` | Optional, the old whole-file form. Still read as the base; an individual `WORKER_ENV_<NAME>` replaces its line. Move values out of it one at a time, then delete it |
| `GHCR_PULL_USER` / `GHCR_PULL_TOKEN` | A GitHub user and a personal access token with `read:packages`, so the machine can pull the private image |

**Redeploys and the dev domain.** `dev.bhendi-bazaar.com` is moved onto a deployment by the pipeline's
alias step, and only by it. A Redeploy from the Vercel dashboard rebuilds the source of the deployment
you clicked — not the branch's latest commit — and leaves the domain where it was. To get current
`develop` code onto dev with current variables, push, or re-run the workflow from the Actions tab.
A new or changed environment variable also reaches only deployments created after it was saved.

**Deploy.** A push to `main` waits for the web `deploy` job, whose build applies migrations, then builds the image, then over SSH writes the env file, copies
`compose.yml`, pulls the commit's image and restarts the stack. The heartbeat on the admin dashboard
goes green within five minutes. A rollback is re-running the job on an older commit. Until
`WORKER_HOST` exists the job builds and pushes and skips the machine.

**Staging.** Same image, different env file, started by hand while someone is testing (spec R6):

```bash
mkdir -p ~/worker-staging && cp infra/worker/compose.yml ~/worker-staging/ && cd ~/worker-staging
# .env from .env.worker.example with the dev database and APP_ENV=preview
WORKER_IMAGE=ghcr.io/<owner>/bhendi-bazaar-worker:develop docker compose -p worker-staging up -d
docker compose -p worker-staging down   # when done: an idle worker still bills polls
```

The staging worker reads `WORKER_STAGING_ENV_<NAME>` the same way, over the optional base `WORKER_STAGING_ENV_FILE`, and refuses to start when its `DATABASE_URL` equals production's.

**Or press the button.** `.github/workflows/staging-worker.yml` is a manually triggered workflow
in the Actions tab with two choices: up or down, and how long before it stops itself. It reaches
the same machine over the same connection, keeps its files in `/opt/worker-staging` beside the
production stack, and schedules the shutdown **on the machine** — a job that slept for eight hours
would spend eight hours of the Actions allowance doing nothing. Running it again extends the
session rather than stacking a second timer. This is how somebody tests the dev site without a
terminal, and it is why `WORKER_STAGING_ENV_FILE` exists.

**Run it on the worker's own machine, not a laptop**, whenever somebody else is doing the testing.
The stack publishes no port and mounts no named volume, so a second project beside the production
one on the same host costs nothing and conflicts with nothing — and it keeps running when the
laptop that started it is shut, which a tester three time zones or one sleep cycle away depends on.
Its own directory is what keeps the two apart: the whole difference between staging and production
is which `.env` sits next to the compose file, and one wrong `DATABASE_URL` there points a staging
worker at the live database with nothing to notice it.

**Rebuild after a loss.** Create the instance again with the reserved IP, run `provision.sh`, re-run
the last `main` pipeline. Nothing was on the machine that is not in Postgres or the object store.

## The media library backfill

Every image the store holds has a record in `MediaAsset` from [media-library](specs/media-library/) PR 1 onward — uploads register one before the bytes move. Images stored before that are brought under the record by a one-off, idempotent script rather than a migration, because it needs the object store to read each image's dimensions (trd D3):

```bash
npm run media:backfill            # report what would be created and linked
npm run media:backfill -- --write # create the assets and link the rows
```

A write also hashes ready images recorded before the content-hash column existed (trd D11), up to two
thousand per run — a larger library needs a second run, and the summary line's `hashed` count says when
it is done. Until an image is hashed, uploading it again stores a second copy.

Run it once per database after the deploy that carries the migration, with that database's `DATABASE_URL` and the R2 variables in the environment.

**Pointing it at a database is the whole risk.** The script loads `.env` by itself, so run bare it
targets local development and says nothing about which database it reached. Pass the target's own
file instead — `npx tsx --env-file=.env.production.reference scripts/backfill-media-assets.ts` — and
note that a name the passed file omits still falls back to `.env`, silently. That is how a
production database comes to be paired with a development bucket: every reference is then
unrecognised, every asset is written with no object key, and because the run is idempotent on the
reference a corrected re-run skips them all and the null is permanent. Crop, improve and the
deletion sweep each need that key. A write therefore stops when nothing in the library belongs to
the configured store, and the report warns about the same thing rather than printing a clean plan
the write will decline; `--allow-foreign` is how a library of genuinely external URLs says so.
Report first, without `--write`, and read the summary before committing to it. Re-running is safe: a URL that already has an asset is linked, not duplicated. A URL nobody can fetch still gets a record, without dimensions, and is listed at the end so it can be looked at. Record the run in the CHANGELOG.

## Infrastructure

Who owns what. Verified 2026-08-05 from `.vercel/project.json`, `.env`, and which variables the code actually reads.

| Concern | Provider | Notes |
|---|---|---|
| Hosting | **Vercel** | Project `bhendi-bazaar`; deployed from GitHub Actions, not the Git integration — see [Deploy](#deploy) |
| Domain | **GoDaddy** (registrar), **Cloudflare** (DNS) | `bhendi-bazaar.com`; nameservers at Cloudflare, records there point at Vercel. Add any DNS record in Cloudflare, never GoDaddy |
| Database | **Prisma Postgres** (`db.prisma.io`), **Mumbai region** | Provisioned through the Vercel marketplace integration. **Not** Vercel Postgres/Neon — a different dashboard, different connection limits, and its own backup story. Anything that talks to it constantly — the worker of [worker-foundation](specs/worker-foundation/) — is placed in the same region |
| Connection pooling | **Prisma Accelerate** — provisioned, **not in use** | See below |
| Redis (rate limiting) | **Upstash** — *not currently wired* | Intended provider, via the Vercel integration, hence the `KV_REST_API_*` names rather than Upstash's own `UPSTASH_REDIS_REST_*`. No live code reads it |
| File storage | **Cloudflare R2** | `R2_*` variables; `R2_PUBLIC_BASE_URL` is read by `next.config.ts` at build time for `remotePatterns`. No egress meter ([ADR-0028](adr/0028-images-live-in-cloudflare-r2.md)) |
| Payments | **Razorpay** | Test keys locally (`rzp_test_*`) |
| Email | **Resend** | |
| Shipping | **Shiprocket** | Rates live; booking see [ARCHITECTURE.md](ARCHITECTURE.md) |
| OAuth | **Google Cloud** | Redirect URI per environment |

### Accelerate is provisioned but bypassed
`PRISMA_DATABASE_URL` holds a `prisma+postgres://accelerate.prisma-data.net/…` URL, but **nothing reads it** — `server/shared/prisma.ts` connects via `DATABASE_URL` directly. Accelerate exists to pool connections and cache queries, which is exactly the pressure a serverless deployment puts on a single Postgres instance. Worth revisiting: routing through it would address per-instance connection limits more thoroughly than tuning `max` on the local pool.

### Unused environment variables
The code reads only `DATABASE_URL` from the connection-string set — `KV_REST_API_URL` included, now that the limiter is detached. `POSTGRES_URL`, `DB_URL`, `REDIS_URL`, `KV_URL`, and `PRISMA_DATABASE_URL` are read by nothing — leftovers from provisioning. Keeping several live connection strings in one `.env` is the hazard behind the seed guard ([Invariant 7](../CLAUDE.md)); prune them.

## Deploy

Vercel, project `bhendi-bazaar`. All routes are server-rendered on demand.

**Functions run in `bom1` (Mumbai)**, beside the database (`vercel.json` `regions`); Vercel's default is `iad1`, which puts every query a round trip across the world. Confirm with `curl -sI <origin> | grep -i x-vercel-id`, which should read `bom1::bom1`.

**Uptime probe: `/api/health`.** A plain GET answers from the function without touching the database, so it can be pinged freely. `?deep=1` also asks the database (at most once per 30 s, 5 s deadline) and checks the required variables, and answers **503** when either fails; which variables are missing goes to the server log, not the public response. Point an uptime monitor (UptimeRobot, 5-minute interval) at `https://www.bhendi-bazaar.com/api/health?deep=1` and alert on any non-200. The deep response carries the deployed commit.

**Load smoke before launch and before each sale.** Actions → *Load smoke* runs `perf/k6-smoke.js` (home → category → product → cart, reads only) at the peak you give it, against the preview by default. Give it 3× the concurrent shoppers you expect; it fails if more than 1% of requests fail or a page's p95 passes 1.5 s. Every request is a billed database read, so do not point it at production casually.

**CI is hardened** (`tests/unit/deploy-safety.test.ts`): workflows are `contents: read` unless a job asks for more, every action is pinned to a commit SHA (Dependabot, `.github/dependabot.yml`, proposes bumps), the Vercel CLI is pinned to a version, and `node scripts/audit-prod.mjs` blocks the test job: a high or critical advisory in a production dependency stops the deploy until it is upgraded, or listed in `audit-allowlist.json` with a reason and an expiry. **`deploy` also needs `e2e`**: a production build of the same commit must pass the browser journeys first ([TESTING.md](TESTING.md)).

**The reconcile cron runs once a day, and that is the plan's limit, not a judgement.** Hobby permits one cron invocation per day, so `vercel.json`'s `30 3 * * *` is as often as it can run. Nothing depends on it: since [checkout-abandonment](specs/checkout-abandonment/) a buyer who closes the payment window releases their own reservation immediately, and a checkout blocked by a stale hold releases it and retries. The cron only catches the buyer whose browser never asked. If the project ever moves to Pro, tightening the schedule is a one-line edit and needs no code change.

**Deployments come from GitHub Actions, not from Vercel's Git integration.** Hobby only git-deploys commits authored by the Vercel account owner, so a collaborator's push silently never shipped. `vercel.json` sets `git.deploymentEnabled: false`, and `.github/workflows/ci.yml`'s `deploy` job runs `vercel pull` / `vercel build` / `vercel deploy --prebuilt` with an account token — authorship stops mattering. `main` deploys with `--prod`; `develop` deploys a preview. The job needs `test` to pass first, and needs three repository secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (the latter two are in `.vercel/project.json`).

- **Set every variable above in Vercel per environment.** `NEXTAUTH_URL` must be the deployed origin. The CI runner has no env of its own — `vercel pull` supplies the build's variables from the target Vercel environment, so a variable missing there is missing at build.
- `vercel env pull` before running migrations locally against a deployed database.
- **Migrations run in the build** ([ADR-0014](adr/0014-deploys-run-their-own-migrations.md)): `vercel.json`'s `buildCommand` is `npx prisma migrate deploy && next build`, so every Vercel build applies pending migrations to that environment's `DATABASE_URL` before compiling. A merge to `main` **is** a prod schema change; preview builds migrate whatever database the Preview environment points at — so if Preview has no database of its own, a push to `develop` migrates production. `migrate deploy` only applies pending migrations in order — never resets or drops. Manual `migrate deploy` remains only for local runs against a deployed database (`vercel env pull` first).
- Register the Razorpay webhook at `<origin>/api/webhooks/razorpay` and the Shiprocket webhook at `<origin>/api/webhooks/shipping/shiprocket`. Local webhook testing needs a tunnel.
- Use a pooled connection string (pgbouncer / Neon) in production: `server/shared/prisma.ts` creates a `pg` Pool per module evaluation with default sizing, so many warm instances can exhaust `max_connections`.

## Backups

**Targets:** lose at most a day (RPO 24 h), be back within four hours (RTO 4 h). Two layers, because
either alone has a failure the other covers: Prisma's own snapshots (Starter plan, restore in its
console) and a nightly encrypted dump in an R2 bucket we control (`.github/workflows/db-backup.yml`,
`scripts/backup/db-backup.sh`), which survives losing the Prisma account.

**One-time setup (owner):**
1. On your own machine: `age-keygen -o backup-key.txt`. Put the whole file in the password manager and
   an offline copy. It is the only way to read a backup; it never goes into GitHub.
2. In Cloudflare: a bucket for backups only (not the image bucket). Add a **Bucket Lock** rule for
   `db/` (retain 35 days), so nothing, including a stolen credential, can delete a recent backup, and a
   lifecycle rule that deletes `db/` objects after 90 days.
3. An R2 API token for that bucket alone, **Object Write** only: CI can add backups and can never read
   or delete them.
4. GitHub repository secrets: `BACKUP_DATABASE_URL` (the **direct** string, as `MIGRATE_DATABASE_URL`),
   `BACKUP_AGE_RECIPIENT` (the `age1…` public key line from step 1), `BACKUP_R2_ENDPOINT`,
   `BACKUP_R2_BUCKET`, `BACKUP_R2_ACCESS_KEY_ID`, `BACKUP_R2_SECRET_ACCESS_KEY`.
5. Actions → *Database backup* → Run workflow, and check `db/<year>/<month>/` holds a `.dump.age` and a
   `.counts.tsv`.

Until step 4 is done the nightly run fails red on purpose.

**Restore drill, quarterly and after any change to the backup:** with a read-capable token, download the
newest pair, start an empty local Postgres (`docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432
postgres:17`, then `createdb -h localhost -U postgres bb_drill`), and run

```bash
BACKUP_AGE_IDENTITY="$(cat backup-key.txt)" DRILL_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bb_drill bash scripts/backup/db-restore-drill.sh <file>.dump.age <file>.counts.tsv
```

It restores, recounts every table and fails on any difference. It refuses a non-local target. Record the
date in the CHANGELOG; a drill older than 90 days is a GTM-READINESS section 9 failure.

**A real restore** is the same `age --decrypt | pg_restore` into a new database, then pointing
`DATABASE_URL` at it, after the drill steps have proved the file.

## Recovering a failed migration

A migration that raises leaves the deploy dead in a specific way, and the second symptom is
worse than the first. `vercel.json` runs `npx prisma migrate deploy && next build`, so the
failure is recorded in `_prisma_migrations` and **every later deploy stops with P3009 before it
compiles anything** — the branch is un-shippable until the record is cleared, not just this
build. Migrations run in a transaction unless they say otherwise, so the schema itself is
untouched; it is the bookkeeping that blocks.

This happened on 2026-09-24: `20260923090000_reviews_soft_state` refused to make `Review.userId`
required over 10 authorless rows (ADR-0032 — it will not guess an author). Dev had none of those
rows and CI's database is empty, so nothing before production could have raised it.

1. **Read the rows before deciding anything.** The refusal names a count, never the rows.
2. **Take the copy yourself.** No migration can keep one for you: `prisma migrate deploy` does
   not surface `RAISE NOTICE`, so a copy raised inside the migration dies with the transaction
   that deleted the rows.
   ```
   psql "$MIGRATE_DATABASE_URL" -c "\copy (SELECT * FROM \"Review\" WHERE \"userId\" IS NULL) TO 'orphans.csv' CSV HEADER"
   ```
3. **Write the resolution as a migration**, dated *just before* the one that refused, so
   `migrate deploy` applies it first on the environment that is retrying and harmlessly late
   anywhere the refusal never happened. Never edit the migration that failed — it is already
   applied elsewhere, and Prisma checksums it.
4. **Clear the failed record**, or the new migration will not be reached:
   ```
   MIGRATE_DATABASE_URL="<direct prod URL>" npx prisma migrate resolve --rolled-back 20260923090000_reviews_soft_state
   ```
   **Pass `MIGRATE_DATABASE_URL` inline, always — and confirm the target first.**
   `prisma.config.ts` resolves `process.env.MIGRATE_DATABASE_URL || env("DATABASE_URL")`, and
   that `env()` reads the `.env` *file* rather than the environment. So `DATABASE_URL=… npx
   prisma …` is **silently ignored** and the command hits your dev database instead — which on a
   `resolve --rolled-back` means un-applying a migration that was fine, and leaving dev broken
   the same way production is. `npx prisma migrate status` prints the host it will use; run that
   first, every time.
5. **Redeploy.** The fix applies, then the retry.

**Rehearse it against a scratch database first.** The whole sequence above was run on a throwaway
copy before production: plant the offending rows, watch `migrate deploy` fail with the same
P3018, confirm the rollback left the schema alone, then run the recovery and check the end state.
That rehearsal is what caught the `RAISE NOTICE` archive being invisible.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Can't reach database server` | Postgres not running (`pg_isready`), or a malformed `DATABASE_URL`. For Docker, check the container is up |
| `@prisma/client did not initialize yet` | `npx prisma generate` |
| `PrismaClientOptions` error in a script | Prisma 7 needs the `pg` adapter — construct the client the way `server/shared/prisma.ts` does, not bare |
| Port 3000 in use | `lsof -ti:3000 \| xargs kill` or `npm run dev -- -p 3001` |
| Rate limiting not applying | Expected: it is detached and allows everything, whatever `KV_REST_API_*` holds. Confirm with `RATE_LIMITING_ENABLED` in `src/lib/rate-limit/index.ts`. The [rate-limiting](specs/rate-limiting/) spec closes this properly |
| Stale types or unexplained build errors | `rm -rf .next && npx prisma generate` |
| Webhook not arriving locally | No tunnel, or the secret is unset. Check the gateway dashboard's delivery log first — it records attempts and responses |
