# INTEGRATIONS.md — external-service behaviour

- **Verified:** 2026-10-01
- **Covers:** `server/payments/providers/*/`, `server/shipping/providers/*/`, `server/notifications/**`, `server/catalog/object-store.ts`

## Purpose
What the services we depend on actually do — the behaviour that is not derivable from our code and not obvious from their documentation. Payment, courier, and platform quirks belong to no single domain and outlive any one call site, so they live here rather than in a comment.

**This is not a list of our defects.** It records how someone else's system behaves. When something here explains a constraint on our design, it is cited from the relevant ADR or spec.

**Add to it whenever a spike or an incident teaches something durable.** An entry that saves one hour of rediscovery has paid for itself. Mark anything unverified as such rather than stating it confidently — a wrong entry here is worse than a missing one, because it will be trusted.

---

## Razorpay (payments)

**The `notes` round-trip is a string contract the compiler cannot check.** Our order id
travels to Razorpay in `notes` at gateway-order creation and comes back in every
payment webhook. The key is `RAZORPAY_NOTES_ORDER_KEY` (`server/payments/notes.ts`),
used by both sides and pinned by a test — because creation once wrote `orderId` while
the webhook read `localOrderId`, and every webhook silently no-op'd while returning
200. Razorpay also caps `notes` at 15 keys / 256 chars per value.

- **Amounts are integer paise.** `₹499.50` is `49950`. This is a large part of why we store money the same way ([ADR-0004](adr/0004-money-as-integer-paise.md)) — the boundary already wants integers, so converting late was losing precision for nothing.
- **`notes` is a free-form key-value bag** attached at order creation and echoed back on webhook payloads. It is the mechanism for correlating a gateway payment to our order — and it is a **string-keyed contract that no compiler checks**. The key written at creation and the key read at webhook time must match exactly; there is no error if they do not, because a missing key is simply `undefined`. Assert the round trip in a test ([payment-confirmation](specs/payment-confirmation/) D6).
- **Two different signatures, computed differently:**
  - *Client-return verification* — HMAC-SHA256 over `<gateway_order_id>|<payment_id>` with the **key secret**.
  - *Webhook verification* — HMAC-SHA256 over the **raw request body** with the **webhook secret** (a separate value from the key secret). The body must be verified *before* parsing; parsing and re-serialising changes the bytes and the signature will not match.
- **A signature attests that a payment occurred against a gateway order.** It says nothing about the amount matching *our* order's total. The amount check is a separate, mandatory step ([ADR-0002](adr/0002-server-holds-pricing-authority.md)).
- **Webhooks retry on non-2xx**, which is what makes failing loudly safe — but only if the handler is idempotent, or a retry duplicates side effects.
- **Test vs live keys are distinguishable by prefix** (`rzp_test_` / `rzp_live_`). Worth asserting in a startup check: a test key in production fails silently in the sense that nothing errors, it just never takes money.
- **The dashboard's webhook delivery log** records every attempt and our response. It is the first place to look when a confirmation did not arrive — before reading our own logs.
- Test card `4111 1111 1111 1111` works in test mode.

## Shiprocket (courier)

- **The API credentials are a separate "API user", not the dashboard login.** Created in the Shiprocket dashboard under *Settings → API → Configure → Create an API User*, and the email **must differ from the registered account email** — reusing it is rejected. The dashboard itself signs in by mobile and OTP, so there is no dashboard password to reuse even if one wanted to. This costs an hour the first time, because the failure looks like wrong credentials rather than the wrong *kind* of credentials.
- **Auth is a bearer token with an expiry**, obtained by posting the API user's email and password. Their 240-hour validity is what `TOKEN_EXPIRY_HOURS` in `providers/shiprocket/shiprocket.config.ts` mirrors. It is not a long-lived API key, so the token must be cached, its expiry tracked, and re-authentication handled — a 401 mid-session is normal operation, not an error condition. This is why credentials rather than a key are stored ([shipping ADR-0002](../server/shipping/adr/0002-credentials-via-admin-not-env.md)).
- **Rate requests are priced on weight** in kilograms, with origin and destination pincodes. Serviceability is per-pincode-pair, so a rate response can legitimately be empty rather than an error.
- **Status vocabulary is theirs and is finer-grained than ours**, and they can add to it. Normalised on entry ([shipping ADR-0003](../server/shipping/adr/0003-normalise-carrier-status-on-entry.md)).
- **Webhooks carry no signature by default.** ⚠️ *Unverified* — confirm current options in their dashboard before relying on this. If no signature is available, a shared-secret header or a hard-to-guess path is the fallback, and the handler must still fail loudly on an unmatched payload.
- **Rate lookups are slow and rate-limited**, which is why quotes are cached (`ShippingRateCache`).
- **Booking and rate quoting are separate calls.** A rate quote is not a reservation — the price can change between quoting and booking, which is the source of [shipping-fulfilment](specs/shipping-fulfilment/) Q2.

## Resend (email)

- **`onboarding@resend.dev` sends without domain verification**, which is what makes local development work with no DNS setup. It cannot be used in production.
- **A production sending domain needs SPF, DKIM, and DMARC records.** Without them mail is accepted by Resend and then filtered by the recipient — so a "successful" send is not a delivered email. This is the most common cause of "the confirmation email didn't arrive".
- **Sending is a network call that can be slow.** ⚠️ Awaiting it inside a request handler makes response latency depend on it; where that latency differs between two code paths, it becomes observable. Prefer dispatching outside the response path.

## Vercel (platform)

- **Serverless request bodies are capped at roughly 4.5 MB.** Our upload validation permits 5 MB, so a file between the two limits is rejected by the platform rather than by our handler, producing a less useful error. Worth aligning.
- **No state survives between requests.** Any in-memory counter, cache, or rate limiter is per-instance and resets on cold start — which is why rate limiting uses Redis ([ADR-0001](adr/0001-monorepo-doc-structure.md) is not the reason; the reason is here).
- **Each warm instance holds its own database connections.** With default pool sizing, a modest number of concurrent instances can exhaust Postgres `max_connections`. Use a pooled connection string in production.
- **Environment variables are per-environment** and require a redeploy to take effect. `vercel env pull` brings them locally.
- **Upstash provisioned through Vercel's integration is named `KV_REST_API_URL` / `KV_REST_API_TOKEN`** — *not* the `UPSTASH_REDIS_REST_*` names in Upstash's own documentation. See [OPERATIONS.md](OPERATIONS.md) for why this specific mismatch is unusually costly.
- **A function may run for 300 s on Hobby, and that is a hard cap under Fluid Compute.** Pro defaults to 300 s and allows 800 s, with 1800 s in beta per function. It is set per route with `export const maxDuration`; nothing in this app sets it, so every handler runs at the 300 s default. Checked against Vercel's duration docs 2026-09-25.
- **Work deferred past the response (`after()` from `next/server`, or `waitUntil`) shares the function's deadline.** It is cancelled at `maxDuration`, not granted more time, so deferring work buys nothing against the limit. Only a queue does.
- **A Hobby cron schedule more frequent than once a day fails the deployment**, rather than running at the plan's floor. Precision is roughly hourly. Pro allows once a minute. [OPERATIONS.md](OPERATIONS.md) has why the daily backstop is acceptable.
- **Hobby is licensed for non-commercial use only.** Vercel's fair-use guidelines name "requesting or processing payment from visitors of the site" as commercial usage, which requires Pro or Enterprise. This store takes payments. Flagged 2026-09-25; not yet acted on.

## Cloudflare R2 (storage)

The current image store ([ADR-0028](adr/0028-images-live-in-cloudflare-r2.md)). One seam,
`server/catalog/object-store.ts`, owns every write, delete and URL derivation; reads never pass
through our code, so there is no metered egress path to exhaust.

- **R2 has no egress meter**, which is the whole reason for the move. Class A/B operation counts
  and stored bytes are what to watch, not transfer.
- **The public base URL is configuration, not derivation.** `R2_PUBLIC_BASE_URL` is a separate
  variable from the credentialed S3 endpoint — an `r2.dev` subdomain while developing, a custom
  domain in production. Deriving the public URL from the S3 endpoint produces URLs that need
  credentials to read.
- **`next.config.ts` reads that variable for `images.remotePatterns`.** A host missing there makes
  every image 404 *at the optimizer*, with no error in the app logs and no error in R2's — the
  failure is silent on both sides.
- **A browser gets a presigned PUT, never a token.** `presignUpload` signs the path *and* the
  `content-type`, so a presigned URL cannot be replayed to write a different object or a different
  media type. Objects are written `immutable` with a one-year `max-age`, which is only safe because
  every stored pathname carries a timestamp or random suffix — a caller-controlled, predictable
  path would let an upload overwrite an existing object.
- **`aws4fetch` signs the requests**, not the AWS SDK — one file against two verbs
  ([DEPENDENCIES.md](DEPENDENCIES.md)).

## Vercel Blob (gone)

The previous store. The package, the migration script and the hostname's entries in
`next.config.ts` and the CSP were all removed once the store began answering `403` to its own
contents — at that point nothing could be recovered from it, so nothing was left to keep it for.

Its lesson outlives it, and applies to any metered store: Blob meters **data transfer out**, and on
the free tier an overrun *blocks* rather than bills — every product image goes blank, including your
own ability to read the store, which is what makes exporting after the fact impossible. A row may
still hold one of those dead URLs; [OPERATIONS.md](OPERATIONS.md) has the query and the remedy.

## Marketplaces and feeds (nothing integrated yet)

Checked 2026-09-29 while spiking `listing-schema`. Recorded because the four routes are four
different kinds of thing, and the difference decides the order they are worth building in.

- **A feed file at a URL serves Google and Meta together.** Both fetch a file on a schedule
  rather than being pushed to, and Meta accepts XML in Google's own RSS namespace, so one
  artefact feeds both. No approval, no credentials, no partner agreement — the cheapest
  publishing route by a wide margin. Meta requires images of at least 500×500 and prefers
  square, which `MEDIA_SURFACES.social` already produces. Google's Content API for Shopping
  shuts down on 18 August 2026 and the Merchant API replaces it, but that affects programmatic
  integrations only: a scheduled fetch of a hosted file is unaffected.
- **Flipkart is self-service.** A registered seller creates an application in the Seller
  Dashboard, receives an application id and secret, and takes a token through client
  credentials. Listing management is publicly documented.
- **Amazon is gated on a paid account.** The Selling Partner API requires a **Professional**
  selling account; an Individual account cannot use it at all. After that a private developer
  registration and a self-authorised draft application are enough — no public listing needed.
- **Meesho has no public publishing API.** Catalogues go up through the supplier panel as a
  per-category bulk template, with a quality check of roughly 72 hours. Third-party
  integrators hold partner access; nothing is documented for us to use.
- **ONDC is not a channel in this sense.** A seller does not publish to it: one either joins
  the network as a seller participant speaking the Beckn protocol, or lists through one that
  already has. For this platform that is a question about the platform, not about pushing one
  product, and it belongs in its own decision.
### What each platform asks for in a listing

Read off thirty-four of the platforms' own bulk-upload templates on 2026-10-01, for the categories
this store sells. The templates and the data extracted from them are in
[listing-node-templates](../listing-node-templates/); this section is the conclusions. An earlier
version of it, written from the published specifications alone on 2026-09-29, estimated a shared
core that included colour and size. The templates disagreed, and what follows is measured rather
than inferred.

**Field counts are theatre; required counts are the constraint.** Amazon declares 390 fields
across the ten product types in one workbook and requires 18, with 187 conditional on other
answers. Flipkart declares 66 to 132 per vertical and requires 19 to 32. Meesho declares 35 to 84
per category and requires 23 to 56, so **Meesho is the binding constraint on a listing form, not
Amazon.** Flipkart encodes a field's requirement level as a cell *colour* rather than a value —
blue mandatory, purple conditional, yellow recommended, green optional, grey filled by Flipkart —
decoded against the legend each workbook carries on its own summary sheet.

**The three-platform core is thirteen fields, and it is barely descriptive.** Present in every
node on all three: the seller's own code, description, maximum retail price, stock, brand, images,
tax code, country of origin, manufacturer, packer, importer, net weight, and a key grouping
variants together. Colour and size are *not* in it. Nine of the thirteen are things a shop states
once rather than per product, which is why they belong to the seller profile.

**A field name agreeing is not its values agreeing — and that holds inside one platform.**
Flipkart's own colour list differs per node: sixteen values in all eleven nodes that have one,
nineteen more in only some. Its `Size` is three incompatible scales under one label — thirty-seven
mixed age bands and letters for an abaya, five words for a mat, forty-five numbers for a ring.
`Fabric` and `Material` are the same question asked of cloth and of everything else. Across
platforms Google and Meta remain the closest pair, Meta accepting feeds in Google's namespace and
still disagreeing on values: Google writes `in_stock`, Meta `in stock`; Google offers five age
groups, Meta seven. Only a barcode, an HSN code and an ISO-2 country genuinely agree
([ADR-0045](adr/0045-channel-mappings-are-versioned-data.md)).

**A platform's category sometimes holds what another keeps in a field.** Flipkart has one
`abaya-burqa` node with `Type` in {Abaya, Burqa, Naqab}; Meesho has four separate categories. Bags
are the same — Flipkart splits `bag`, `hand-messenger-bag` and `sling-bag` with `Type` values
inside each, Meesho splits Backpacks, Handbags and Cross-Body. The mapping is therefore
many-to-many and must be allowed to resolve to nothing: `Tote` appears in the `Type` list of two
Flipkart nodes, and a standalone hijab appears in none. Flipkart's `mat` node carries
`Type = Prayer`, so a prayer mat is that node rather than a category.

**Variant axes are declared per node and no two agree.** Flipkart: size for an abaya; capacity and
colour for a bag; plating, size and colour for a ring; set and quantity for incense; brand size
and brand colour for a trouser. An axis assumed in code would be wrong for most categories.

**Sizes are asked for as measurements more often than as labels.** Meesho requires `Bust Size` and
`Length Size` on an abaya and offers no size field at all on palazzos or trousers, where it asks
`Length` instead. Across its nineteen nodes, thirteen require a measurement, six require none, and
**none requires a size label without also requiring measurements.** Flipkart's `trouser` node
resolves a size through Ideal For, then a `Qualifier` naming the scale — Regular, Number, Euro, UK,
US, Kids — then the allowed value, so it treats "which scale" as its own field. `Free` is a
permitted value on every category this store sells.

**Two gaps remain**, both access rather than research: Meesho publishes no bakhoor or incense
template in the set downloaded, and Flipkart's attar node was not exported. Everything else the
Indian marketplaces keep behind a seller login, which is why the templates had to come from the
owner's own accounts — the public Flipkart listing API is offer and logistics only, Myntra the
same shape, and Meesho publishes nothing. Amazon publishes the mechanism rather than the schemas:
a JSON schema fetched per product type, whose stated required list is not the real one because
conditional rules add requirements as attributes are filled.

### What it takes to act for many sellers

Checked 2026-09-29. The distinction that decides the cost is **acting for our own one account** versus
**software many sellers each authorise against their own account**. The second is what a connector is,
and it is a different licence class on every platform that has one.

| Platform | Multi-seller | The gate |
|---|---|---|
| Google Merchant | Yes, two shapes | Self-serve. An OAuth verification review, 3–5 business days. Google names marketplaces as an eligible profile and recommends *account relationships with services*, a two-sided handshake where the merchant keeps their own account, over sub-account aggregation |
| Flipkart | Yes, documented | A separate *Third Party Access* programme from the seller's own *Self Access*. Register at the partner portal, verification call within 72 hours. Sharing a seller's own credentials with a partner is a permanent ban |
| Meta | Yes, the "tech provider" model | App Review plus Business Verification. Free, deterministic, rejection-prone. Until verified, other businesses cannot grant the permission at all |
| Amazon | Yes, a *public* application | Solution Provider Portal registration: business registration number, government ID, a video identity call, a security questionnaire, and a **publicly reachable website describing the service**. Sellers must be on the **Professional** plan. Restricted roles touching buyer data add an architecture review and a security assessment measured in months |
| Meesho | In practice only | No public API, no self-serve, no OAuth. An integrator is whitelisted by relationship, then each seller is enabled by email. A calendar dependency, not an engineering one |
| Myntra | No programme found | Real public API docs, but per-seller shared secrets and no partner tier. Behind a curated brand approval of two to six weeks |
| Ajio, Nykaa | No | No public developer programme. Per-seller username and password issued by the platform |

The Amazon developer fee announced in November 2025 was **cancelled on 12 May 2026**; access is free
again. Re-check before committing to a plan that depends on it.

Two facts that shape the machinery rather than the paperwork. **Amazon pushes notifications only to an
Amazon queue or event bus, never to a plain HTTP endpoint**, so consuming its order events means holding
an AWS account and either polling that queue from our worker or bridging it back to an endpoint.
**Flipkart posts to a URL we host**, signature-authenticated, but enabling it is a support ticket per
seller that asks for a security test certificate for the receiving URL. Everything else polls.

- **Myntra, Ajio and Nykaa** are invite-only partner programmes. Relevant to what this store
  sells, worth a name in the vocabulary, not worth chasing.

## YouTube (product video)

Embedding only — nothing is uploaded and no video file is ever served by us ([ADR-0017](adr/0017-video-is-embedded-not-hosted.md)).

- **No OAuth and no API key are needed to embed.** An embed is an iframe against a video id. Credentials would only be required to upload on someone's behalf or read private metadata, and we do neither.
- **The uploader can disable embedding, and there is no way to detect that before rendering.** The link stays valid, the poster still loads, and the iframe shows YouTube's own error. This is why the unavailable state is a rendering concern rather than a validation rule.
- **A video we do not own can be deleted, made private, or age-restricted at any moment.** A failed poster is the only signal available cheaply, so it is what drives the unavailable state.
- **A monetised third-party video runs its owner's advertising inside our page.** Accepted knowingly; see the ADR's consequences.
- **`maxresdefault.jpg` 404s for any video never published above 720p.** `hqdefault.jpg` always exists, so that is the poster size used. Both live on `i.ytimg.com`, which must be listed in `next.config.ts` under `images.remotePatterns` or `next/image` refuses to render them.
- **oEmbed (`https://www.youtube.com/oembed?url=...&format=json`) needs no key** and 404s for a video that does not exist or is private. Available for save-time validation; not currently called — the boundary only parses the link shape.
- **Embeds use `youtube-nocookie.com`**, and the player is mounted on a tap rather than on load.

## Google OAuth

- **The redirect URI must match exactly**, including scheme, host, port, and path: `<NEXTAUTH_URL>/api/auth/callback/google`. A mismatch fails at Google with a message that does not name the expected value.
- **A separate redirect URI is needed per environment.** Local, preview, and production are three entries.
- **NextAuth v4 does not link a Google login to an existing email-matched account by default** under a JWT session strategy — the adapter's linking behaviour does not apply. `src/lib/auth-config.ts` does it explicitly in its `signIn` callback. This is the least obvious behaviour in our auth setup and the easiest to break by "simplifying" that callback.
- **NextAuth v4's default session token is an encrypted JWE**, not a signed HS256 JWT. Anything asserting otherwise is wrong.

## Prisma Postgres (database)

The hosted database at `db.prisma.io`. Checked against Prisma's docs 2026-09-25 for [ADR-0038](adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md).

- **Every query is a billed operation, and the allowance is a hard stop on the Free plan.** A read, a write, a joined query and a cached read each count once. Free includes 200k a month (raised from 100k at some point after 2026-08-21, when this store exhausted it and production was blocked until the month rolled over); Starter is $10 for 1M. Anything that asks the database on a timer — a poller, a heartbeat, a health monitor — is spending this allowance around the clock, so timers are set against it, never left at a library's default.
- **Two connection strings, two behaviours.** The direct host is plain PostgreSQL 17 over TLS. The pooled host is a PgBouncer in transaction mode with a ten-minute query timeout and no session state, so `LISTEN`/`NOTIFY`, advisory locks and anything else session-bound need the direct string.
- **Direct connections are scarce.** Free and Starter allow 10 direct connections, of which 5 are reserved for the platform, leaving 5 for everything of ours combined — the site's functions and any worker. Pro allows 50. A library that defaults its pool to 10 will exhaust this on its own; size pools explicitly.
- **Pooled limits are stated inconsistently** — the docs page and the pricing page disagree by an order of magnitude — so treat the lower figure as the one to design for until Prisma resolves it.
- **Idle pooled connections are closed after sixty minutes.** Whether the same applies to direct connections is not stated; a long-lived listener should expect to reconnect.
- **Extensions are enabled with `CREATE EXTENSION` in a migration**, from a fixed list of about fifty (`pgcrypto`, `pg_trgm`, `vector`, `citext` among them). Whether the provisioned role may `CREATE SCHEMA` is not documented and must be tested before a second schema is relied upon.

## Prisma 7

- **The seed command lives in `prisma.config.ts`** (`migrations.seed`), not in `package.json`'s `prisma.seed` key as in earlier versions. A missing `package.json` key does not mean seeding is unconfigured.
- **A driver adapter is required.** Constructing `new PrismaClient()` with no adapter and no datasource `url` throws. Any standalone script must build the client the way `server/shared/prisma.ts` does.
- **Default transaction isolation is READ COMMITTED with no row locking**, so a read followed by a write inside `$transaction` does not prevent concurrent callers from both passing the read ([ADR-0007](adr/0007-conditional-stock-decrement.md)).
- **`contains` compiles to `LIKE '%term%'`.** A leading wildcard cannot use a btree index, so no amount of indexing makes the current product search fast — it needs `pg_trgm` or a `tsvector` column.
- **A column-to-column comparison** (for example `stock <= lowStockThreshold`) is not expressible in the Prisma query API and needs raw SQL.
