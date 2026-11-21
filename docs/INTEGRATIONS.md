# INTEGRATIONS.md — external-service behaviour

- **Verified:** 2026-11-06
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
- **Refunds take a `receipt`, which Razorpay's refund docs (read 2026-10-30) say "is treated as an idempotency key" per payment;** no idempotency header is documented. A refund call that times out may still have refunded, so we never retry blind: `GET /payments/{id}/refunds` is read first and the refund carrying our receipt is adopted (order-fulfilment D17). A refund can come back `failed`, which moved no money. **Unverified against live keys** — confirm the receipt dedupe on the first real refund.

## Shiprocket (courier)

- **The API credentials are a separate "API user", not the dashboard login.** Created in the Shiprocket dashboard under *Settings → API → Configure → Create an API User*, and the email **must differ from the registered account email** — reusing it is rejected. The dashboard itself signs in by mobile and OTP, so there is no dashboard password to reuse even if one wanted to. This costs an hour the first time, because the failure looks like wrong credentials rather than the wrong *kind* of credentials.
- **Auth is a bearer token with an expiry**, obtained by posting the API user's email and password. Their 240-hour validity is what `TOKEN_EXPIRY_HOURS` in `providers/shiprocket/shiprocket.config.ts` mirrors. It is not a long-lived API key, so the token must be cached, its expiry tracked, and re-authentication handled — a 401 mid-session is normal operation, not an error condition. This is why credentials rather than a key are stored ([shipping ADR-0002](../server/shipping/adr/0002-credentials-via-admin-not-env.md)).
- **Rate requests are priced on weight** in kilograms, with origin and destination pincodes. Serviceability is per-pincode-pair, so a rate response can legitimately be empty rather than an error.
- **Status vocabulary is theirs and is finer-grained than ours**, and they can add to it. Normalised on entry ([shipping ADR-0003](../server/shipping/adr/0003-normalise-carrier-status-on-entry.md)).
- **Webhooks carry no signature; they carry a token.** The webhook settings (Settings → Additional Settings → Webhooks) take a URL, an auth token type (`x-api-key`) and a token, sent on every delivery in that header (confirmed in the dashboard, 2026-11-01). **The URL may not contain "shiprocket", "kartrocket", "sr" or "kr"**, which is why ours is `/api/webhooks/shipping/courier`. There is one webhook URL per account: pointing it at us replaces whatever was there. `server/shipping/courier-token.ts` compares it in constant time with `SHIPROCKET_WEBHOOK_TOKEN` before the body is read, and the route answers 401 without it, so a forged "delivered" cannot release a payout (order-fulfilment D9). A shared token is weaker than a body signature (it does not bind the payload), so keep it long, random and out of logs. A replayed update is harmless: every move and notice is idempotent.
- **`etd` is their delivery estimate**, `"YYYY-MM-DD HH:mm:ss"` in India time, beside `awb` and `shipment_status` in the webhook body. Its India day replaces our ETA when it differs (order-fulfilment D10, Q6). ⚠️ *Unverified* — from their published sample payload, not a captured one; check the first real update's body on the conflict list or `ShippingEvent`.
- **"PICKED UP" is what the webhook says once the courier has the parcel**; "PICKUP SCHEDULED" and "OUT FOR PICKUP" come before and leave a booked parcel where it is.
- **Rate lookups are slow and rate-limited**, which is why quotes are cached (`ShippingRateCache`).
- **A label link is an S3 object on Shiprocket's bucket** (`kr-shipmultichannel-mum.s3.ap-south-1.amazonaws.com`), or a `shiprocket.in` page. ⚠️ *Unverified* — taken from community examples, not their docs; `server/shipping/label.ts` holds the allowlist the booking form checks against (order-fulfilment D7). Confirm on the first real booking and widen the list there.
- **Booking and rate quoting are separate calls.** A rate quote is not a reservation — the price can change between quoting and booking, which is the source of [shipping-fulfilment](specs/shipping-fulfilment/) Q2.

## Resend (email)

- **`onboarding@resend.dev` sends without domain verification**, which is what makes local development work with no DNS setup. It cannot be used in production.
- **A production sending domain needs SPF, DKIM, and DMARC records.** Without them mail is accepted by Resend and then filtered by the recipient — so a "successful" send is not a delivered email. This is the most common cause of "the confirmation email didn't arrive".
- **Sending is a network call that can be slow.** ⚠️ Awaiting it inside a request handler makes response latency depend on it; where that latency differs between two code paths, it becomes observable. Prefer dispatching outside the response path.
- **A send takes an `Idempotency-Key`** (the SDK's second argument, `{ idempotencyKey }`): Resend sends once per key, which is what makes a send from an at-least-once job safe to retry. Keys are remembered for 24 hours, per Resend's documentation; a job redelivered later than that would send again.

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

## Marketplaces and feeds (Google and Meta feeds live; marketplaces not yet)

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

### The shopfront feeds

`/feeds/google.xml` and `/feeds/meta.xml` ([shopfront-feeds](specs/shopfront-feeds/)) are
registered by hand — a scheduled-fetch data source in Merchant Center, a scheduled data feed in
Commerce Manager. Each is built on the request, lists only shops that turned that channel on, and
is empty while `BLOCK_CRAWLERS` is set. Google also crawls each product page and pauses an item
whose page price differs from the feed until its next fetch. Meta's 500×500 image minimum is not
enforced by the feed: it sends the stored cover, so a smaller photograph is Meta's rejection to
report.

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
per category and requires 23 to 40, so **Meesho is the binding constraint on a listing form, not
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
`Length` instead. Across its nineteen nodes, twelve require a measurement, seven require none, and
**none requires a size label without also requiring measurements.** Flipkart's `trouser` node
resolves a size through Ideal For, then a `Qualifier` naming the scale — Regular, Number, Euro, UK,
US, Kids — then the allowed value, so it treats "which scale" as its own field. `Free` is a
permitted value on every category this store sells.

**Checked against Google and Meta too, on 2026-10-03, because they publish first.** The
vocabulary was derived from the three marketplaces' templates, and the shopfront channels are the
ones that reach a buyer first — a feed file needs nobody's approval
([ADR-0041](adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)). Google requires more
of apparel than of any other category, and a single missing attribute is an immediate
disapproval: `color`, `size`, `gender`, `age_group`, plus `item_group_id` on every variant.

Eight of the ten are already carried. The interesting one is that **`Ideal For` answers two of
Google's questions at once**: the marketplaces ask a single question whose values are Men, Women,
Boys, Girls, Baby Boys, Baby Girls, Kids and Unisex, which Google splits into `gender`
(male/female/unisex) and `age_group` (newborn/infant/toddler/kids/adult). So `age_group` is a
mapping of an answer we already hold, not a fact we are missing — one canonical question, two
channel fields, which is what the adapters are for.

`size` is required for apparel and we derive rather than store it; `Free Size` is an accepted
value and is what everything this store sells resolves to. `condition` is required only when a
product is *not* new, so for this store it is a constant in the Google adapter rather than a
product fact — it becomes one the day anything used or refurbished is sold.

**Two gaps remain, both access rather than research: Meesho publishes no bakhoor or incense
template in the set downloaded, and Flipkart's attar node was not exported. Everything else the
Indian marketplaces keep behind a seller login, which is why the templates had to come from the
owner's own accounts — the public Flipkart listing API is offer and logistics only, and Myntra the
same shape. Meesho publishes no API schema but its templates carry a `Validation Sheet` holding
every permitted value, which is the richest value source in the set: 185 distinct colours against
Flipkart's 35. Its `Brand` field is optional and drawn from a per-category registry of brands
already enrolled, so a shop's own brand must be registered with Meesho before it can be named. Amazon publishes the mechanism rather than the schemas:
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

### Acting for a shop on Meta: catalogue, WhatsApp, Instagram

Checked 2026-11-05 while spiking `meta-whatsapp-connector`, re-checked and extended 2026-11-06.
Third-party figures are marked; re-check Meta's own pages before a plan depends on one. The owner's
steps and the review kit built on this are in
[social-selling/going-live.md](specs/social-selling/going-live.md).

- **One catalogue serves Facebook, Instagram and WhatsApp.** A WhatsApp Business account (WABA)
  takes exactly one catalogue; several numbers on the WABA can share it. A catalogue fed by our
  hosted feed is a normal catalogue for this purpose. WhatsApp's commerce settings start with the
  catalogue hidden and are switched on by API.
- **Acting on a shop's own Meta assets needs two steps:** Business Verification (up to 14
  business days; a business registered with local authorities, documents in the exact legal name,
  [Meta](https://www.facebook.com/business/help/2058515294227817)), then App Review for *Advanced
  Access* to each permission (a screencast per permission, at least one successful call per
  permission in the last 30 days; "within a week" per Meta, 3–4 weeks for both per Twilio).
  **Access Verification was retired on 9 October 2026**
  ([Meta blog](https://developers.facebook.com/blog/post/2026/10/09/retiring-access-verification-for-tech-provider-apps/));
  the Embedded Signup overview still lists it and is stale. Approved apps stay under Ongoing
  Review. An unregistered individual cannot get Advanced Access. For India, partners advise Udyam
  over a GST in a personal name, and refuse businesses under six months old (third party: wapitech,
  Heltar, 2025).
- **App roles bypass review on our own accounts.** Admins, developers and testers (up to 50) can
  grant any permission without review ([app roles](https://developers.facebook.com/docs/development/build-and-test/app-roles)),
  so everything is buildable on our own Instagram and WhatsApp first. Business-type apps have no
  Development/Live switch; access levels alone decide who outside the app's roles may connect.
- **Becoming a Tech Provider directly** is still offered ("Onboard without a partner" in the
  WhatsApp console). A Tech Provider has no credit line: each shop adds its own payment method and
  Meta bills it ([solution providers](https://developers.facebook.com/docs/whatsapp/solution-providers/)).
  A Tech Partner is a Tech Provider that joined Meta's partner programme; nothing we need.
- **The permissions:** `business_management`, `catalog_management` (create and update a
  business-owned catalogue), `whatsapp_business_management` and `whatsapp_business_messaging`,
  and for posting `instagram_content_publish` (Facebook Login) or
  `instagram_business_content_publish` (Instagram Login). Ask only for what the app uses; extra
  permissions are a common rejection, as are an app reviewers cannot get into and a non-standard
  login button. WhatsApp's review wants two videos: a message sent from our app arriving in
  WhatsApp, and a template being created.
- **The token is a business integration system user token, not an OAuth pair.** Embedded Signup or
  Facebook Login for Business returns a code our server exchanges, server to server, for a
  token that does not expire on a clock. It has no refresh token; it dies when the shop removes
  the app. So "renewal" is not a meaningful operation for WhatsApp, only health checks.
- **Embedded Signup (WhatsApp)** returns the shop's WABA id and phone number id. After the
  exchange our server must register the number for Cloud API and subscribe our app to the WABA's
  webhooks, and the shop must add a payment method to its WABA before it can send. A new Tech
  Provider can onboard **10 businesses per rolling 7 days** by default, rising to 200 once
  verified and reviewed, and beyond only as a Meta Business Partner. Embedded Signup v2 was
  retired on 15 October 2026; build against the current version (v4 at the time of checking).
  It can be tested before approval with our own business (which creates real extra portfolios and
  numbers) or a **sandbox account**: 30 days, a real WABA id, phone number id and code, but no
  sending.
- **Meta is splitting the WABA** into a "WhatsApp account" (numbers and identity) and a
  "Messaging account" (templates, billing, webhooks); an existing `waba_id` now means the
  Messaging account's id ([Embedded Signup overview](https://developers.facebook.com/docs/whatsapp/embedded-signup/overview)).
- **WhatsApp has no official API for Status or for Channels.** "Posting" on WhatsApp through the
  Cloud API means *messages*: a product, multi-product (up to 30 items in up to 10 sections) or
  catalogue message, free-form only within 24 hours of the customer's last message, otherwise a
  Meta-approved template to an opted-in customer. Gateways that post to Channels drive a linked
  personal session and risk the number being banned.
- **WhatsApp costs per delivered template message** (since July 2025). India marketing ₹0.8631
  and utility about ₹0.115 from 1 January 2026, per several Indian providers; replies within the
  24-hour window are free. INR billing needs a WABA created as INR; USD WABAs stop delivering
  in India from 1 January 2027.
- **Instagram publishing** (`POST /<IG_ID>/media` then `/media_publish`) needs a professional
  account and a public image URL. The cap is per account per rolling 24 hours, checkable at
  `/content_publishing_limit`; Meta's own page says 100 in one place and 50 in another, and a
  carousel counts as one.
- **Product tags on Instagram posts are effectively gone for us.** Since 10 August 2023 only shops
  with checkout enabled may tag products, by API or by hand, and existing tags were removed. Meta
  has no onsite checkout in India, so a post can carry a caption and not a buyable tag;
  `shopping_product_tag_eligibility` on the account answers it definitively.
- **Coexistence keeps a shop on its WhatsApp Business app.** Embedded Signup can onboard a number
  already in the app (app 2.24.17+); messages mirror both ways after that, at a fixed 20 per
  second. Meta's page lists `smb_app_state_sync` (the app's contacts, and later changes) and
  `smb_message_echoes` (messages sent from the app) as webhooks, and onboarding must subscribe to
  `account_update`, `history`, `smb_app_state_sync` and `smb_message_echoes`
  ([coexistence](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users));
  partners report up to six months of chat history shared if the shop approves it. Broadcast
  lists, Status, groups and Channels stay app-only, and partners report the app's broadcast lists
  turning read-only. **The app's own catalogue, orders and status tools stop working under
  coexistence**, so the catalogue must be driven by API. India's eligibility for coexistence was
  not confirmed on Meta's page (no country exclusion listed; an Indian provider reports India live,
  2026-11-06); verified on day one with our own number (social-selling Q12).
- **What a coexistence shop gives up** (Meta's page and partners, 2026-11-06): broadcast lists turn
  read-only; view-once and disappearing messages are switched off; the app must be opened at least
  every ~13 days or the link lapses; a blue-tick (Official Business Account) number cannot use it.
  Messages typed in the app stay free; chat history is offered only for the 24 hours of onboarding
  (we import none, Q10). A number that cannot coexist may move fully to the Cloud API and work from
  the portal inbox (Q84); unofficial linked-session tools are never used.
- **Opt-in, not possession, licenses a message.** A number in a contact list may be sent a template
  only with opt-in per category, and an inbound message opens a 24-hour reply window, not consent.
  Poorly rated templates are paused and the number's quality rating drops.
- **The Groups API caps a group at 8 participants**, invite-link joins only (a partner's reading of
  Meta's docs, August 2026). It is not a broadcast substitute.
- **Instagram publishing covers feed images, carousels (no reels inside), reels and stories.**
  Captions may @mention; `user_tags` works on images and, since July 2025, stories; up to three
  `collaborators` on feed posts. Stickers (link, poll, location) cannot be published by API.
  Containers expire after 24 hours, 400 per account per day. No scheduling: we hold the time.
- **Instagram has two logins.** Instagram's own login (`graph.instagram.com`, scopes
  `instagram_business_*`) needs only a professional account, no Facebook Page, and covers
  publishing, comments, mentions, messaging and insights; it cannot reach ads or tagging.
  Facebook Login needs the account linked to a Page (scopes `instagram_basic` and friends;
  messages go through the Messenger Platform). The scope strings differ and the wrong one fails.
- **Instagram's own login does expire** (Meta's business-login page, checked 2026-11-06). The code
  becomes a 1-hour token, exchanged for a 60-day one; `GET /refresh_access_token`
  (`grant_type=ig_refresh_token`) renews it once it is 24 hours old and still valid. One left
  unused for 60 days cannot be renewed. The exchange returns the Instagram-scoped user id and the
  granted permissions, not the username; `/me` gives `username` and `account_type`. Scopes:
  `instagram_business_basic`, `_content_publish`, `_manage_comments`, `_manage_messages`. The
  Instagram login settings take a Deauthorize callback URL and a Data deletion request URL; the
  deletion callback receives a signed request and answers `{url, confirmation_code}`
  ([callback](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback)).
  The deauthorize payload's format for Instagram login was not confirmed; likely the same signed
  request.
- **Instagram webhooks** ([fields](https://developers.facebook.com/documentation/instagram-platform/webhooks/fields)):
  `comments` (mentions arrive inside it), `live_comments`, `messages`, `message_reactions`,
  `messaging_postbacks`, `messaging_seen`, `messaging_referral`, `messaging_optins`,
  `messaging_handover`, `standby`; no `story_insights` under Instagram login. Comment and mention
  webhooks fire only for a public account. **Meta's tables list Advanced Access as needed for
  Instagram-login webhooks**, so whether they reach our own account before review is unconfirmed;
  test it first. WhatsApp also withholds some webhooks while an app is in development.
- **Instagram's reply rules.** A private reply: one message per comment, within 7 days, follow-ups
  only after the person replies and then within 24 hours
  ([private replies](https://developers.facebook.com/docs/instagram-platform/private-replies)).
  A DM: the customer writes first, opening 24 hours (7 days after a Click-to-Direct ad); the
  `HUMAN_AGENT` tag extends a person's reply to 7 days and **is a feature needing its own review**
  ([human agent](https://developers.facebook.com/docs/features-reference/human-agent)).
- **Instagram rate limits** ([overview](https://developers.facebook.com/docs/instagram-platform/overview)):
  4800 × impressions per 24 hours; Conversations 2 a second; Send API 100 a second for text and 10
  for media; private replies 750 an hour per post; publishing 100 posts per 24 hours
  ([publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing)).
- **Embedded Signup can create the business portfolio and the WABA inside the pop-up**, so a shop
  needs only a personal Facebook login; partners report a new portfolio taking longer to be
  cleared for messaging. The flow can be pre-filled with the shop's name, email and website.
  Chat history is offered only at this step, synced within 24 hours, or the shop reconnects.
- **WhatsApp in-chat payment (India):** an `order_details` message paid through Razorpay or PayU
  inside WhatsApp, or by UPI intent; confirmation arrives as the gateway's webhook.

**What an inbox receives and may do** — checked 2026-11-21 for social-selling's inbox steps.

- **Instagram sends DMs only if the shop allows it.** In the Instagram app: Settings → Messages and
  story replies → Message controls → Connected tools → *Allow access to messages*. Off means no DM
  webhooks and no sends, whatever the token. In development mode a webhook fires only for people
  with a role on the app.
- **Instagram's message fields:** `messages` (the shop's own sends arrive here too, as echoes),
  `messaging_reactions`, `messaging_seen`, `messaging_postbacks`, `messaging_referrals`,
  `messaging_optins`, and `message_edit` (since September 2025). Story replies and story mentions
  arrive as ordinary messages; a shared post or reel carries only its URL. GIFs and stickers fire no
  webhook; disappearing media is not delivered. No unsend event was found.
- **Instagram's send side:** `sender_action` `typing_on`/`typing_off`/`mark_seen`; quick replies,
  a generic template (image, text, buttons) and up to four ice breakers. Send limits are per
  account per second (300 for text, 10 for audio or video). Free within 24 hours of the person's
  last message; the `HUMAN_AGENT` tag allows a person's reply up to 7 days.
- **Instagram's Conversations API** (`/me/conversations?platform=instagram`) lists threads and their
  messages; a Requests-folder thread inactive for 30 days is not returned. Meta's docs disagree on
  whether all messages or the latest 20 come back. Developers report DMs the API returns but no
  webhook delivered, so an inbox should reconcile from it rather than trust webhooks alone.
- **Instagram comments:** `comments` and `live_comments` webhooks; a public reply
  (`/<comment>/replies`), hide (not the shop's own comments, not Live), and one private reply per
  comment within 7 days (Live: only during the broadcast). `@mentions` of the shop in others'
  captions and comments can be read and answered.
- **WhatsApp inbound types:** text, image, audio (voice notes), video, document, sticker, location,
  contacts, reaction, interactive (`button_reply`, `list_reply`, `nfm_reply`), template `button`,
  and **`order`**: a cart the buyer sends from the shop's catalogue, with `catalog_id`, a note and
  `product_items` (retailer id, quantity, the catalogue's price). Ad clicks carry a `referral`.
  Statuses (sent, delivered, read, failed) arrive separately and may precede their message.
- **WhatsApp's send side:** marking a message read (which also reads the earlier ones) and a typing
  indicator are one call; the indicator clears on a reply or after about 25 seconds. Media arrives
  as an id to download through the media endpoint, not as a lasting URL.
- **WhatsApp buyers may have no phone number.** With usernames, Meta withholds the phone number in
  some cases and identifies the buyer by a business-scoped user id (`user_id`, per buyer and
  business portfolio) in webhooks since 31 March 2026; sending to it works since July 2026. A
  change arrives as a `messages` system event `user_changed_user_id`, not as the withdrawn
  `user_id_update` field. A contact is keyed by that id, with the phone number when given.
- **Coexistence contacts sync once.** `smb_app_state_sync` is started by our call, once, within 24
  hours of onboarding, then keeps sending changes. A shop that re-registers its app or changes
  phone is offboarded automatically (`ACCOUNT_OFFBOARDED` on `account_update`) and must reconnect.

- **Myntra, Ajio and Nykaa** are invite-only partner programmes. Relevant to what this store
  sells, worth a name in the vocabulary, not worth chasing.

### Connecting a seller: what the two APIs actually do

Checked 2026-10-15 against the providers' own docs, with both partner approvals in hand (Flipkart
third-party app; Amazon public developer, app in Draft). This is the behaviour a connector has to
absorb; sources are [Flipkart's FMSAPI](https://seller.flipkart.com/api-docs/FMSAPI.html) and
[listings v3](https://seller.flipkart.com/api-docs/listing-api-docs/LMAPIRef.html), and Amazon's
[website authorization](https://developer-docs.amazon/sp-api/docs/website-authorization-workflow),
[Listings Items](https://developer-docs.amazon/sp-api/docs/building-listings-management-workflows-guide)
and [deprecations](https://developer-docs.amazon/sp-api/docs/sp-api-deprecations) pages.

**Authorisation.**

| | Flipkart | Amazon |
|---|---|---|
| Consent | `api.flipkart.net/oauth-service/oauth/authorize`, `scope=Seller_Api`, `state` | `sellercentral.amazon.in/apps/authorize/consent?application_id&state`, plus `version=beta` while the app is Draft |
| Exchange | **GET** `/oauth-service/oauth/token?grant_type=authorization_code&code&redirect_uri&state`, Basic auth `appId:secret` | POST `api.amazon.com/auth/o2/token`; the code lives 5 minutes |
| Lifetimes | Access 60 days, refresh 180; a refresh within 21 days of expiry returns a **new** refresh token, which must replace the old | Access 1 hour; the refresh token must be **re-authorised every 365 days** (Amazon emails the seller 30 days ahead), and again whenever a role is added |
| Who authorised | **Not returned.** No documented identity endpoint, so the seller must be bound to `state` before the redirect | `selling_partner_id` arrives on the redirect |
| Revoke | No endpoint documented | The seller revokes in Seller Central |

Amazon no longer requires AWS IAM or SigV4 signing (since 2 October 2023); India is the **Europe**
endpoint, `sellingpartnerapi-eu.amazon.com`. An unlisted public app may hold **25** seller
authorisations; Appstore listing, which Amazon requires of public apps, lifts the cap and takes three
to four weeks.

**Redirects match character for character.** Both marketplaces compare the `redirect_uri` we send with
the registered list exactly: scheme, host (`www` or not), path. Ours is built from `NEXT_PUBLIC_APP_URL`,
which in production is `https://www.bhendi-bazaar.com`, so the first live connect (2026-10-21) failed
with Amazon's `MD5101` until the `www` callback was registered. Amazon takes several redirect URIs and
lets you add one; **Flipkart takes one and does not let you edit it**, so a wrong one means a new app
and new credentials. Register the host the app actually uses, before the first test.

**Listing.**

- **Flipkart cannot create a product.** `POST /listings/v3` lists against an existing `product_id`
  (FSN); no catalogue API is public. A new product goes up through the seller's own dashboard
  template, and the listing is linked afterwards. Separately: `POST /listings/v3` silently overwrites
  an existing SKU, while `/listings/v3/update` errors on a missing one; price and stock each have their
  own update endpoint; every call takes at most 10 SKUs and returns 200 with a result **per SKU**, so a
  partial failure is never an HTTP error. `POST /listings/v3/search` pages a seller's whole catalogue
  with FSN and SKU, 500 at a time, which is how existing listings are found.
- **Flipkart location ids come from an unpublished "Onboarding API".** Stock is set per `location_id`;
  the practical source is an existing listing's details or a shipment.
- **Amazon can create a product.** `putListingsItem` with `requirements=LISTING` creates one;
  `LISTING_OFFER_ONLY` sells against an existing ASIN. The required attributes come from the Product
  Type Definitions schema, which grows conditional requirements as fields are filled.
  `mode=VALIDATION_PREVIEW` validates without persisting, which is the only realistic test: the
  sandbox is static for this API.
- **Amazon accepts now and decides later.** A submission returns `ACCEPTED`; issues found downstream
  arrive by notification or by polling `getListingsItem(includedData=issues)`. Time to live is not
  documented.
- **Amazon wants a GTIN** unless the brand holds an exemption, approved in Seller Central, after which
  the listing must name exactly the approved brand and set
  `supplier_declared_has_product_identifier_exemption`. Images are public URLs, so ours qualify.
- **Amazon's XML and flat-file feeds were removed on 31 July 2025.** Bulk goes through
  `JSON_LISTINGS_FEED`; per-item calls suit under about 1,500 items per five minutes. Listings calls
  run at 5 requests per second per seller-and-app pair; a 429 is retryable with back-off.

**Reading a shop's listings** (checked 2026-10-21, for channel-import).

- **Amazon** `searchListingsItems` needs only the Product Listing role (ours), takes `marketplaceIds`
  and `includedData` (summaries, offers, fulfillmentAvailability, relationships, issues…), pages 20 at
  a time at 5 requests per second, and **stops at 1,000 results**; paging tokens expire in 24 hours
  and break if a filter changes between pages. A full catalogue comes from the
  `GET_MERCHANT_LISTINGS_ALL_DATA` report, which our roles may request, one marketplace per report.
  Variation parents carry `childSkus` under `relationships`. Stock is per fulfilment channel:
  `DEFAULT` is seller-fulfilled, `AMAZON_IN` is FBA. `status` may be empty.
- **Flipkart** has no single call with everything. `POST /listings/v3/search` walks every SKU and FSN,
  500 per page, by `next_page_id` while `has_more`; `POST /listings/v3/details` gives title, price, tax,
  status and per-location stock, 10 SKUs at a time, with no image; `POST /listings/v3/product/search`
  (20 per batch, by `internalState`) is the only one returning an image URL and the **`sellerId`** —
  the one way to recognise the same Flipkart account in two shops. **Checked on production, 2026-10-21:** our third-party app gets 404 from
  `product/search`; `listings/v3/search`, `listings/v3/details` and `GET /listings/v3/{sku}` answer 200
  (channel-import Q20). Price units (rupees or paise) are
  not documented, and no rate limit is published.

**Detecting a sale.**

- **Flipkart** polls `POST /v3/shipments/filter`, or receives signed webhooks (`X_Authorization:
  FKLOGIN`, SHA-1 over date, URL, method and secret) delivered **at least once**. Enabling webhooks is
  a support ticket asking for a VAPT certificate and an NDA.
- **Amazon's Orders API v0 is deprecated** (28 January 2026) and is removed on **27 March 2027**. New
  code uses `searchOrders` (2026-01-01), which returns SKU and quantity under the roles we hold and
  needs no Restricted Data Token; buyer details need restricted roles we did not request.
  Notifications go only to SQS or EventBridge, so without an AWS account a sale is found by polling.

**Stock and orders, checked on production 2026-10-29 (inventory-sync Q12, read-only).** Flipkart:
`GET /locations/allLocations` answers (the shop has one location), listing details carry stock per
location id, `POST /v3/shipments/filter` answers, and `POST /listings/v3/update/inventory` accepts
our app (an empty body is accepted and changes nothing). Amazon: `orders/v0/orders` and
`orders/2026-01-01/orders` answer under our roles; `supplySources` is refused (403), so multi-location
inventory is not ours to use and a listing has one seller-fulfilled (`DEFAULT`) quantity;
`patchListingsItem` with `mode=VALIDATION_PREVIEW` returns `VALID` for a quantity patch.

**Editing and creating a listing, checked 2026-11-02** (channel-listings, marketplace-publish), from
Amazon's Listings Items 2021-08-01 and Product Type Definitions 2020-09-01 models and guides, and
Flipkart's [listings v3](https://seller.flipkart.com/api-docs/listing-api-docs/LMAPIRef.html).

- **Amazon edits by patch, never put.** A put replaces the whole listing and drops what it leaves out.
  Patch operations are per top-level attribute; price is a `merge` of `purchasable_offer` with its
  selectors (`marketplace_id`, `currency`, `audience`), where a sub-attribute set to null is removed.
  Amazon has no pause: ending the offer (`end_at`) takes a listing off sale and keeps it; `deleteListingsItem`
  removes the SKU for good. MRP is `purchasable_offer.maximum_retail_price`, Amazon.in only.
- **Accepted is not live.** A put or patch answers `ACCEPTED` or `INVALID` with issues; later problems
  come only by polling `getListingsItem(includedData=summaries,issues)` without an AWS queue. An issue
  carries code, message, severity (ERROR, WARNING, INFO), categories and, only sometimes,
  `attributeNames`. `summaries.status` holds `BUYABLE` when on sale.
- **Without Brand Registry an edit may not show.** Amazon merges every seller's contribution to a page
  and may keep another's title or photos while still answering ACCEPTED; `getListingsItem` attributes
  echo what we sent, `summaries.itemName` what the page shows.
- **A new page needs a barcode or the brand's exemption** (`supplier_declared_has_product_identifier_exemption`,
  approved once per brand in Seller Central). A category needing approval comes back as an issue in
  `QUALIFICATION_REQUIRED`. `mode=VALIDATION_PREVIEW` checks without creating, is rate-limited, and does
  not prove approval. Variation themes are read from the type's schema (unused ones were removed in 2025);
  the schema link lives seven days. Listings calls run at 5 a second per seller and app.
- **Flipkart edits price and status only.** `POST /listings/v3/update/price` takes `product_id`, `mrp`,
  `selling_price` (whole numbers) and `currency`; `POST /listings/v3/update` sends the whole listing
  back with `listing_status` ACTIVE or INACTIVE. Title, photos, features and description belong to its
  catalogue and change only in Seller Hub, with about two days of checking; no API creates a product.
  Each SKU answers on its own with status, `errors` and `attribute_errors`; an inactive listing carries
  no reason we can read. No rate limit is published.

**Paid.** Flipkart's Reports API (settlement and fulfilment reports) is a paid partner service;
nothing public marks listings, inventory or shipments as paid, and the partner dashboard's metered
plans should be confirmed with `api-partner-support@flipkart.com` before relying on them.

## Image generation (Cloudflare AI, fal)

The services that paint pixels for us. Reached from `server/content/providers/` today; the provider-neutral
module is [generation-foundation](specs/ai-images/generation-foundation/). Checked against Cloudflare's docs
2026-11-20 (pricing page dated 2026-11-18). **Prices move; recheck before relying on one.**

**Cloudflare: one account, two kinds of model.**
- **Third-party models** (Google, OpenAI, ByteDance, BFL, Bria, others) go through
  `POST https://api.cloudflare.com/client/v4/accounts/{account}/ai/run` with `Authorization: Bearer {token}` and
  a JSON body `{"model": "google/nano-banana-pro", "input": {…}}`. The documented reply is
  `{"state": "Completed", "result": {"image": "<url>"}, "gatewayMetadata": {…}}`: **a link to fetch, not bytes**.
  Every documented example is synchronous. No other `state` values and no polling endpoint are documented, so
  async behaviour is **unverified**.
- **Nano Banana Pro's input:** `prompt`, `image_input[]` (**at most 3 references**, where fal allows 14),
  `aspect_ratio` (1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9), `image_size` (1K, 2K, 4K) and
  `output_format` (jpg, png, webp). Whether a reference is a URL or base64 is **not stated**. Price: $2 per 1M
  input tokens and $120 per 1M output tokens.
- **Hosted `@cf/` models** (`@cf/black-forest-labs/flux-2-klein-4b`, `-9b`, `flux-2-dev`) take a **multipart**
  input (`{"multipart": {"body", "contentType"}}`) and answer with **base64 in JSON** (`image`). Their field
  names (prompt, reference images, width, height, steps), the REST path, and klein-9b's reference limit are
  **not documented**. Read them from a live call before writing the adapter. Zero data retention for both.
- **Hosted prices (neurons).** 10,000 neurons a day are free (resetting 00:00 UTC), then $0.011 per 1k.
  klein-4b costs $0.000059 per input 512² tile and $0.000287 per output tile (≈$0.002 an image).
  klein-9b costs $0.015 for the first MP, $0.002 per extra MP and $0.002 per input MP (≈$0.02).
  flux-2-dev is billed **per step** ($0.00021 per input tile and $0.00041 per output tile, per step), and its
  default step count is **not published**.
- **Neither reply reports cost or usage** in what is documented. Cost therefore has to be computed from a
  declared price rule, not read back.
- **Unified billing** passes provider prices through with no markup and adds a **5% fee on credits bought**.
  It accepts a non-prepaid card only (no PayPal, Apple Pay or Google Pay). An Indian card's forex markup is extra.

**Gemini API directly (`IMAGE_GEN_GEMINI_API_KEY`).** Checked 2026-11-21; the docs moved from
ai.google.dev to aistudio.google.com, and the pricing table was read as a summary, so **recheck prices**.
- **The image docs now show the Interactions API**, `POST https://generativelanguage.googleapis.com/v1beta/interactions`
  with `x-goog-api-key`, not `generateContent`. Body: `{"model", "input": [{type:"text"}, {type:"image",
  mime_type, data:<base64>}…], "response_format": {type:"image", aspect_ratio, image_size}}`. Sizes are
  uppercase (`1K`, `2K`, `4K`); lowercase is rejected. The reply carries base64, at `output_image.data` or
  in a `steps[].content[]` block of `type: "image"`. Synchronous; a Batch API halves the price.
- **Model ids:** Nano Banana Pro `gemini-3-pro-image`, Nano Banana 2 `gemini-3.1-flash-image`, Nano Banana
  2.1 `gemini-nano-banana-2.1` (newest), 2 Lite `gemini-3.1-flash-lite-image`.
- **Up to 14 references** for Pro, 2 and 2.1 (Pro: 6 objects, 5 characters, 3 style). The gateway's route
  to Pro takes 3.
- **Prices (per 1K image):** Pro $0.134 (+$0.0011 per input image), Nano Banana 2 $0.067, 2.1 $0.0336.
- **No usage or cost in the reply**, and the shape of a safety refusal is not documented, so the adapter
  reads refusal words from whatever comes back. Every output carries a SynthID watermark; C2PA not stated.

**fal (the current scene painter, `IMAGE_MODEL_*`).** `POST {endpoint}/fal-ai/bria/product-shot`,
`Authorization: Key …`. It takes a data URL and answers with an image URL. List prices, unverified since the
spike: Bria product-shot ≈$0.04, Nano Banana Pro $0.15, Nano Banana 2 $0.08, Seedream 5 Pro $0.0675
(≤1536²), Seedream 5 Lite $0.035, FLUX.2 [pro] edit $0.03/MP.

**Fidelity is the risk, not price.** In Photoroom's July 2026 benchmark (850 products, on-model, vendor-run, so
indicative only) no model kept every product detail more than 29% of the time. The failures were logos and
text, missing elements, pattern and colour. A generated image needs our own checks around it.

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
